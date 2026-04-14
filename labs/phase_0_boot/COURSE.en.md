# Phase 0 · Boot & Kernel Entry

> Goal: On a virtual RISC-V machine in QEMU, take over from OpenSBI,
> print `Hello, TinyOS!` from your own Rust kernel, and shut down
> cleanly.

---

## 0.0 Phase Intro

### What you're building

By the end of Phase 0 you'll watch a virtual RISC-V machine boot from
nothing: CPU reset, OpenSBI firmware running, your assembly `_start`
taking the baton, setting the stack pointer, jumping into Rust land,
and pushing bytes through `sbi_ecall` to the UART — until this line
appears:

```
Hello, TinyOS!
```

That's the moment you realize: **an operating system is not magic**.
It's a blob of machine code placed at the right address, plus a
convention (SBI) to talk to the software below it.

Concretely, you'll implement:

1. A **linker script** `linker.ld` that pins `.text` at `0x80200000`.
2. An **assembly shim** `entry.asm` that sets `sp` and jumps to
   `rust_main`.
3. A set of **SBI bindings** `sbi.rs` using `ecall` for
   `console_putchar` and `system_reset`.
4. A **formatted print layer** `console.rs` — the `print!` /
   `println!` macros.
5. A **panic handler** `lang_items.rs` that logs the location and
   shuts down on failure.

### Boot flow overview

```
  Power-on
    │
    ▼
  ┌─────────────────────────┐
  │  M-mode reset vector    │  hard-coded in hardware
  │  (in QEMU: the MROM)    │
  └─────────┬───────────────┘
            │ jump
            ▼
  ┌─────────────────────────┐
  │  OpenSBI @ 0x80000000   │  M-mode firmware
  │  - init UART / CLINT    │
  │  - prepare S-mode env   │
  │  - mret to 0x80200000   │
  └─────────┬───────────────┘
            │ mret (enter S-mode)
            ▼
  ┌─────────────────────────┐
  │  _start @ 0x80200000    │  ← your entry.asm
  │  la sp, boot_stack_top  │
  │  call rust_main         │
  └─────────┬───────────────┘
            │ jal
            ▼
  ┌─────────────────────────┐
  │  rust_main (Rust)        │  ← your main.rs
  │  clear_bss()             │
  │  println!("Hello, ...")  │──┐
  │  sbi::shutdown()         │  │
  └──────────────────────────┘  │ ecall
                                ▼
                       ┌────────────────────┐
                       │ OpenSBI putchar()  │
                       │ → UART MMIO write  │
                       └────────────────────┘
```

### Mental model

> **Bare-metal Rust ≈ Rust − std.**

`std` relies on an OS to provide heap, threads, files, syscalls.
Right now **we are** that OS — we can't depend on ourselves. Switching
to `#![no_std]` removes `std` and hands us three responsibilities that
correspond exactly to the three labs:

```rust
#![no_std]    // no standard library
#![no_main]   // no `main` symbol

// Problem 1: no main — where does the CPU land?    → Lab 1 entry.asm
// Problem 2: no println — how do we print?          → Lab 2 sbi + console
// Problem 3: no unwinder — what happens on panic?   → Lab 3 panic_handler
```

Solve those three and the rest of Rust (`&str`, `Option`, `for`,
`format_args!`, traits) still works. You're still writing modern Rust —
there's just no OS underneath.

**Three takeaways:**
1. **Control starts at your `_start`** — it must sit at `0x80200000`,
   or OpenSBI jumps into nothing. → Lab 1.
2. **All I/O goes through SBI** — S-mode can't poke the UART directly,
   you `ecall` M-mode. → Lab 2.
3. **Panic is your job** — nobody above you to catch it; the compiler
   won't let you skip it either. → Lab 3.

---

## 0.1 Concepts: RISC-V privilege levels and boot flow

### Three privilege modes

The RISC-V spec defines three run modes ordered by privilege:

| Mode | Short | Privilege | Who runs here | Phase 0 usage |
|------|:-----:|-----------|---------------|---------------|
| User | U | lowest; no CSRs | user programs | not yet — Phase 2 |
| Supervisor | S | page tables, s-csrs | **the kernel** | our code |
| Machine | M | raw MMIO, physical addrs | firmware (OpenSBI) | we ecall into it |

### Why not write the kernel in M-mode?

Technically you could — nobody does, because:

- **M-mode is board-specific**: every vendor has different UART
  addresses and clock trees. You'd need a driver per board.
- **SBI abstracts that away**: OpenSBI already has M-mode drivers for
  each board. You only need to remember the ecall numbers.
- **Two-layer isolation**: firmware bugs won't directly clobber the
  kernel's assumptions about address space.

The modern RISC-V software stack looks like this:

```
  ┌─────────────┐  U-mode
  │  user app   │
  └──────┬──────┘
         │ ecall (syscall)
  ┌──────▼──────┐  S-mode
  │  your OS    │  ← Phase 0 starts here
  └──────┬──────┘
         │ ecall (SBI)
  ┌──────▼──────┐  M-mode
  │  OpenSBI    │
  └──────┬──────┘
         │ MMIO
  ┌──────▼──────┐
  │  hardware   │
  └─────────────┘
```

### Privilege transitions

- Low → high: an `ecall` (or interrupt/exception) traps; hardware
  saves pc and mode into CSRs and jumps to the trap handler.
- High → low: `mret` / `sret` restore pc and mode from CSRs.

In Phase 0 we only exercise **S → M** (ecall into OpenSBI) and
**M → S** (mret back). U-mode comes in Phase 1.

---

## 0.2 Concepts: linker script and memory layout

### What each section is

An ELF has several **sections**. The four you'll care about now:

| Section | Meaning | Writable? | Placement |
|---------|---------|:---------:|-----------|
| `.text` | executable code | ❌ | first, right at BASE_ADDRESS |
| `.rodata` | read-only data (string literals, `const`) | ❌ | after `.text` |
| `.data` | globals with non-zero initial value | ✅ | after `.rodata` |
| `.bss` | zero-initialized globals + stack | ✅ | last; must be zeroed at boot |

### Why address `0x80200000`?

On the RISC-V `virt` machine, DRAM starts at `0x80000000`. QEMU's
default `-bios default` is OpenSBI, which loads itself into the first
2 MiB and configures its `fw_jump` target to `0x80200000`. In other
words, after `mret` the pc will **always** be `0x80200000`. Our
`_start` must be waiting there.

### Memory layout

```
physical address
 0x80000000 ┌──────────────────────┐
            │  OpenSBI (M-mode)    │   ~2 MiB
 0x80200000 ├──────────────────────┤  ← BASE_ADDRESS
            │  .text.entry (_start)│
            │  .text (rust fns)    │
            │  ─────────── etext   │
            │  .rodata             │
            │  ─────────── erodata │
            │  .data               │
            │  ─────────── edata   │
            │  .bss.stack (boot)   │   ← initial sp = top of this
            │  .bss (globals)      │
            │  ─────────── ebss    │
            │  (unused...)          │
 0x88000000 └──────────────────────┘   128 MiB ceiling (-m 128M)
```

### Linker script walkthrough

```ld
OUTPUT_ARCH(riscv)
ENTRY(_start)                      ; ELF entry symbol (gdb uses it)
BASE_ADDRESS = 0x80200000;         ; constant

SECTIONS
{
    . = BASE_ADDRESS;              ; location counter; next bytes go here
    stext = .;                     ; label (Rust can extern "C" its address)
    .text : {
        *(.text.entry)             ; _start MUST come first
        *(.text .text.*)           ; all other functions
    }
    . = ALIGN(4K);                 ; page-align
    etext = .;
    ...
}
```

Common pitfalls:

| Symptom | Cause |
|---------|-------|
| `_start` isn't at `0x80200000` | Forgot `*(.text.entry)` as the first line inside `.text` |
| String literals print garbage | `.rodata` got `/DISCARD/`-ed |
| Static initial values wrong | `.bss` never zeroed (clear_bss not called) |
| Stack clobbers code randomly | Boot stack too small, or `sp` pointed at bottom instead of top |

---

## Lab 1 · `entry.asm` + `linker.ld` ⭐

**Learning goals:**
- Understand the minimal skeleton of bare-metal RISC-V assembly.
- Know why the bootstrap triad is (set sp, clear bss, jump to Rust).
- Read `la` / `call` pseudo-instructions and their expansions.

**Prerequisites:**
- RISC-V registers: `sp` is x2, `ra` is x1, args go in `a0`..`a7`.
- Assembly syntax: `#` comments, `.section` / `.globl` directives,
  `.space N` to reserve N bytes.

**Core concept: the bootstrap triad**

When the CPU lands on `_start`:
1. **The stack is dirty** — `sp` still holds whatever OpenSBI left
   there. Rust function prologues immediately do
   `addi sp, sp, -16; sd ra, 8(sp)`. If `sp` doesn't point to memory
   we own, the first push explodes.
2. **`.bss` is dirty** — the ELF header only records `.bss`'s size,
   not its content. Who zeros it? We do. `clear_bss` is already
   provided in `main.rs`.
3. **Nobody returns** — `rust_main` has signature `-> !` (the Never
   type). After `call` we should never execute the next instruction;
   add `wfi; j .` as a safety net anyway.

**Step-by-step**

Step 1 — first TODO: set the stack pointer.
```asm
la   sp, boot_stack_top
```
`la` = load address. `boot_stack_top` is a label at the end of this
file, at the **high end** of the reserved stack region.

Step 2 — second TODO: jump to Rust.
```asm
call rust_main
```
`call` expands to `auipc ra, ...; jalr ra, ra, ...`. It writes the
return address into `ra`, but we'll never use it — `rust_main` is
`!`.

Step 3 — delete the `unimp` placeholder. That's an intentional illegal
instruction that reminds you Lab 1 isn't done.

**Common mistakes**

| You wrote | What happens |
|-----------|--------------|
| `la sp, boot_stack_lower_bound` | `sp` at the bottom; first push overflows into `.data` |
| `j rust_main` | Works (equivalent to `call`), but less idiomatic |
| Forgot `.section .text.entry` | `_start` might not live at 0x80200000 — CPU lands on a random function |
| Left `unimp` in | QEMU immediately takes an illegal-instruction exception |

**Testing**

```bash
make build                      # should compile cleanly
make grade                      # Lab 1: 4/4 green
make qemu                       # hangs until Lab 2 (no output yet)
```

---

## 0.3 Concepts: SBI and the ecall path

### What SBI is

**SBI = Supervisor Binary Interface** — a spec from the RISC-V
Foundation ([github.com/riscv-non-isa/riscv-sbi-doc](https://github.com/riscv-non-isa/riscv-sbi-doc)).
It defines which services an S-mode kernel can request from M-mode
firmware:

- console byte I/O
- shutdown / reboot
- timer setup
- inter-processor interrupts, TLB shootdowns
- ...

OpenSBI, RustSBI, and others implement this spec. Think of SBI as
"the syscalls that live below the OS."

### The `ecall` instruction

`ecall` is RISC-V's environment-call instruction, and its target
depends on the **calling mode**:

| From | Traps into | Phase 0 use |
|------|------------|-------------|
| U-mode | S-mode (`scause=8`) | user syscalls — Phase 1 |
| S-mode | M-mode (`mcause=9`) | **this phase** — calling SBI |
| M-mode | M-mode | firmware internal |

On `ecall`, hardware:
1. Saves current pc into `sepc` / `mepc`.
2. Saves the cause into `scause` / `mcause` (value = 8 + source mode).
3. Jumps to the target mode's `stvec` / `mtvec`.

### SBI calling convention

```
inputs:
  a7 = extension id (eid)
  a6 = function id (fid, only for v1.0 extensions)
  a0..a5 = arguments
outputs:
  a0 = error code (0 = SBI_SUCCESS)
  a1 = value (extension-specific, often unused)
```

For Lab 2 we use two honest **legacy** extensions:

| eid | Name | Behavior |
|-----|------|----------|
| 1 | CONSOLE_PUTCHAR | push the low 8 bits of a0 into the UART |
| 8 | SHUTDOWN | power off (does not return) |

### Call flow

```
kernel (S-mode)                   OpenSBI (M-mode)                  UART
    │                                   │                             │
    │  ecall  (a7=1, a0='H')            │                             │
    ├──────────────────────────────────▶│                             │
    │                                   │  mmio_write(UART_TX, 'H')   │
    │                                   ├────────────────────────────▶│
    │                                   │                             │
    │  mret (sepc += 4)                 │                             │
    │◀──────────────────────────────────┤                             │
    │                                   │                             │
  pc = pc_after_ecall                   │                             │
```

---

## Lab 2 · `sbi.rs` + `console.rs` ⭐⭐

**Learning goals:**
- Write `core::arch::asm!` inline assembly.
- Understand `inlateout`, clobbers, and `options`.
- Implement `core::fmt::Write` and wire up the `format_args!` machinery.

**Core implementation: `sbi_call`**

```rust
#[inline(always)]
fn sbi_call(eid: usize, arg0: usize, arg1: usize, arg2: usize) -> usize {
    let mut ret: usize;
    unsafe {
        core::arch::asm!(
            "ecall",
            inlateout("a0") arg0 => ret,
            in("a1") arg1,
            in("a2") arg2,
            in("a7") eid,
            options(nostack, preserves_flags),
        );
    }
    ret
}
```

Key points:
- `inlateout("a0") arg0 => ret` — `a0` is loaded with `arg0` going in,
  then read back as `ret` after `ecall`. Exactly matches the SBI
  convention for a dual-purpose register.
- `options(nostack)` — we don't touch `sp`, so Rust is free to inline.
- `options(preserves_flags)` — RISC-V has no flags, but it's a good
  habit for portability.

**The second half: `Stdout` implements `fmt::Write`**

```rust
impl core::fmt::Write for Stdout {
    fn write_str(&mut self, s: &str) -> core::fmt::Result {
        for &b in s.as_bytes() {
            console_putchar(b as usize);
        }
        Ok(())
    }
}
```

Once `Write` is implemented, the `println!` macro's expansion can
call `write_fmt`, and `core::fmt` chops `"hart {}", 0` into two
`write_str` calls (`"hart "` and `"0"`). Zero runtime overhead, zero
heap.

**Common mistakes**

| You wrote | What happens |
|-----------|--------------|
| Forgot `unsafe { asm! }` | Compiler: "use of unsafe" |
| Mixed up arg order (arg0 into a1) | OpenSBI sees garbage — putchar prints weird bytes |
| `print!` macro calling `print!` | Recursion — stack overflow |
| `Stdout` doesn't impl Write, called putchar directly | Loses `{}` formatting |

**Testing**

```bash
make qemu
# expected:
#   Hello, TinyOS!
#   [kernel] booted at 0x...
#   [kernel] .text   [0x80200000, 0x...)
#   ...
# QEMU then exits on its own (shutdown worked).
```

---

## Lab 3 · `panic_handler` ⭐⭐

**Why `no_std` forces a `#[panic_handler]`**

In full Rust, panic flows: `panic!` → the `core::panic_handler`
symbol → std's default impl (unwind, print, abort). Drop std and the
symbol **vanishes**, leaving the linker to shout:

```
error: `#[panic_handler]` function required, but not found
```

So we define one in our `no_std` crate — it's the kernel's last-resort
logger. Exactly one such function can exist in the whole binary.

**PanicInfo**

```rust
pub struct PanicInfo<'a> {
    fn location(&self) -> Option<&Location<'a>>;    // file + line + col
    fn message(&self)  -> Option<&fmt::Arguments>;  // feature-gated
    fn payload(&self)  -> &(dyn Any + Send);        // unused here
    fn can_unwind(&self) -> bool;                   // always false in no_std
}
```

`info.message()` isn't stable yet, so `main.rs` enables it via
`#![feature(panic_info_message)]`.

**Reference implementation**

```rust
#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    if let Some(loc) = info.location() {
        println!(
            "[kernel] PANIC at {}:{}: {}",
            loc.file(),
            loc.line(),
            info.message().unwrap()
        );
    } else {
        println!("[kernel] PANIC: {}", info.message().unwrap());
    }
    shutdown()
}
```

**Common mistakes**

| Mistake | Effect |
|---------|--------|
| `fn panic(info: &PanicInfo)` with no `-> !` | Compile error (signature mismatch) |
| Forgot `#[panic_handler]` | Linker complains about missing symbol |
| Panics inside the handler | Infinite recursion → stack overflow |
| `info.message()` without `Option` handling | Doesn't compile (it's `Option`) |

---

## 0.4 Integration: boot your kernel

After all three labs are done:

```bash
make qemu
```

Expected output:

```
Hello, TinyOS!
[kernel] booted at 0x802000XX
[kernel] .text   [0x80200000, 0x80203000)
[kernel] .rodata [0x80203000, 0x80204000)
[kernel] .data   [0x80204000, 0x80205000)
[kernel] .bss    [0x80205000, 0x80215000)
```

QEMU then exits on its own (you get your shell back).

### Five things to try

1. **Panic on purpose**: in `rust_main`, add
   ```rust
   panic!("just testing, line {}", line!());
   ```
   Observe Lab 3's output format.

2. **Illegal write**:
   ```rust
   unsafe { (0x0 as *mut u8).write_volatile(42); }
   ```
   See what happens. (Hint: Load/Store Access Fault — but we have no
   trap handler yet; the next phase catches it.)

3. **Shrink the stack**: change `.space 4096 * 16` to `.space 16`
   and rerun. When does a recursive function explode?

4. **Step in gdb**:
   ```bash
   make gdb          # terminal 1
   make gdb-client   # terminal 2
   (gdb) b rust_main
   (gdb) c
   (gdb) layout asm
   ```

5. **Alternative shutdown**: swap `SBI_SHUTDOWN` (legacy) for the
   SRST v1.0 extension, observe QEMU's exit code.

### Expected `grade.py` output

```
═════════════════════════════════════════════════
  Phase 0 · Grading Report
═════════════════════════════════════════════════

  entry.asm + linker.ld
  ████████████████████ 100%  (4/4 tests)
    ✓ kernel builds with `cargo build --release`
    ✓ _start is at 0x80200000
    ✓ linker symbols stext/etext/sbss/ebss/boot_stack_top exist
    ✓ _start loads stack pointer before calling rust_main

  sbi.rs + console.rs
  ████████████████████ 100%  (3/3 tests)
    ✓ prints 'Hello, TinyOS!'
    ✓ prints kernel memory layout (.text / .bss)
    ✓ qemu exits cleanly (sbi::shutdown works)

  panic_handler
  ████████████████████ 100%  (4/4 tests)
    ✓ panic handler prints the word PANIC
    ✓ panic handler prints file:line location
    ✓ panic handler prints the panic message
    ✓ panic handler shuts down (no hang)

─────────────────────────────────────────────────
  Overall: 11/11 tests passed (100%)
```

---

## 0.5 Recap

| Concept | What you learned | Why it matters |
|---------|------------------|----------------|
| Privilege levels | M / S / U layers and their uses | Phase 1 traps, Phase 2 userspace both rely on it |
| Linker scripts | Section layout, BASE_ADDRESS, symbols | Every later phase touches it (stack, heap, kernel/user split) |
| `no_std` | What disappears with std, what you must replace | Starting point for all systems/embedded Rust |
| SBI | ecall convention, legacy vs v1.0 | Template for Phase 1 syscalls |
| panic_handler | PanicInfo, required symbol, must be `-> !` | The last line of defense for kernel stability |

### What you built

```
┌──────────────────────────────────────────┐
│         Your TinyOS Phase 0              │
│                                          │
│    ┌─────────────────────────────────┐    │
│    │      println!("Hello...")       │    │
│    └──────────────┬──────────────────┘    │
│                   ▼                      │
│    ┌─────────────────────────────────┐    │
│    │   Stdout : fmt::Write           │    │
│    └──────────────┬──────────────────┘    │
│                   ▼                      │
│    ┌─────────────────────────────────┐    │
│    │   sbi::console_putchar          │    │
│    └──────────────┬──────────────────┘    │
│                   ▼                      │
│    ┌─────────────────────────────────┐    │
│    │   sbi_call → ecall              │    │
│    └─────────────────────────────────┘    │
└──────────────────────────────────────────┘
         ▲
         │ starts here
  ┌──────┴──────┐
  │  _start.asm │
  │  la sp, ... │
  │  call rust_ │
  └─────────────┘
```

### Phase 1 preview

Next phase opens the **reverse** channel — not just kernel → firmware,
but **user program → kernel**. You will:

- Point `stvec` at an assembly entry `__alltraps`.
- Save 34 registers into a `TrapContext` and dispatch on `scause`.
- Implement the first real syscalls: `sys_write`, `sys_exit`.
- Let a U-mode user program `ecall` into your kernel.

---

## References

### Required reading

1. [xv6-riscv book, Ch. 1-2](https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf)
   — MIT 6.S081's official text. Ch. 1-2 cover boot and the trap
   framework. C-based but the concepts are identical.
2. [rCore-Tutorial §1 · Application and execution environment](https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter1/index.html)
   — Tsinghua's Rust OS tutorial. Chinese-native but with an English
   edition; Phase 0 mirrors its chapter 1.
3. [RISC-V ELF psABI specification](https://github.com/riscv-non-isa/riscv-elf-psabi-doc)
   — Linker script, calling convention, register roles.

### Deeper reading

4. [RISC-V Privileged Spec v1.12](https://github.com/riscv/riscv-isa-manual/releases)
   — Authoritative definition of privilege levels, CSRs, traps.
5. [OpenSBI documentation](https://github.com/riscv-software-src/opensbi/tree/master/docs)
   — SBI spec, platform support, boot-flow details.
6. [The Embedonomicon](https://docs.rust-embedded.org/embedonomicon/)
   — Rust Embedded's official tour from `#![no_std]` to a minimal
   `start`.
7. [Writing an OS in Rust (Philipp Oppermann)](https://os.phil-opp.com/)
   — x86_64, but the no_std / panic_handler / linker explanations are
   excellent.

### Stretch questions

- If we booted directly in M-mode (no OpenSBI), what extra work would
  be needed? (Hint: write your own `mret` transition into S-mode,
  set up `mtvec`, initialize the CLINT timer, write an MMIO UART
  driver.)
- Why does `.bss` need to be zeroed manually? Isn't that the ELF
  loader's job? (Hint: when there is a loader — e.g. Linux's
  `load_elf_binary` — yes. We have no loader; OpenSBI just copies
  bytes to physical memory without parsing `p_memsz > p_filesz` in
  the ELF program header.)
- What if we put `.bss.stack` after `.data` instead of at the front
  of `.bss`? (Hint: ELF file size grows — `.data` zeroes occupy disk
  bytes, `.bss` zeroes do not.)
- Can `ecall` be issued from M-mode? Where does it trap? (Hint: yes —
  it traps back into M-mode's own handler. Firmware sometimes uses
  this for internal self-test.)
