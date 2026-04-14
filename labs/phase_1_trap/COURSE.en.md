# Phase 1 — Traps & Syscalls

> *"A trap is a function call the hardware forces on you."*
> — anon. kernel hacker

---

## 1.0 Preface · Why traps matter

In Phase 0 you wrote a kernel that could `println!`. It ran in **S-mode** and
did anything it wanted. There were no users; there were no programs. That is
a fine way to build a bootloader, but it is a terrible way to build an
operating system.

An OS's whole job is to **run other people's code safely**. To do that the CPU
needs a fence between the kernel (privileged) and user programs (unprivileged).
RISC-V gives you that fence in the form of three privilege levels and one
mechanism that bridges them: the **trap**.

A trap is what happens when:
- user code executes `ecall` — asking the kernel for a service;
- user code does something illegal — dereferences a null pointer, divides by
  zero, tries to execute a privileged instruction;
- a device interrupt fires — the timer ticks, the disk is ready.

In every case the hardware mid-flight **stops** the user, switches to S-mode,
jumps into the kernel at a fixed address (`stvec`), and tells the kernel
"here, you deal with it". When the kernel is done, a single instruction
`sret` drops back into U-mode exactly where the user left off — as if
nothing had happened.

That mental model is the whole phase:

```
       U-mode                       S-mode                      U-mode
   ┌──────────┐  ecall   ┌──────────────────────┐   sret   ┌──────────┐
   │  user    ├─────────▶│  __alltraps          │          │  user    │
   │  code    │          │     └─► trap_handler │          │  code    │
   │  pc=N    │          │           └─► syscall│          │  pc=N+4  │
   └──────────┘          │  __restore           ├─────────▶└──────────┘
                         └──────────────────────┘
```

By the end of this phase you will have written every box in that diagram.

---

## 1.1 Concept · S-mode trap CSRs

RISC-V's supervisor trap machinery is five control-and-status registers.
Learn them cold.

| CSR        | Read/Write | Purpose                                                  |
| ---------- | ---------- | -------------------------------------------------------- |
| `stvec`    | R/W        | Address the CPU jumps to when any S-mode trap fires.     |
| `sepc`     | R/W        | PC of the faulting instruction (ecall, illegal, etc.).   |
| `scause`   | R/W        | Why we trapped. MSB=1 → interrupt, MSB=0 → exception.    |
| `stval`    | R/W        | Extra info (faulting address on a page fault, etc.).     |
| `sscratch` | R/W        | Free register for the kernel's use. We stash kernel-sp.  |
| `sstatus`  | R/W        | Mode & interrupt bits. **Critical bits below.**          |

### `sstatus` bits you will touch

```
 63                                                                 0
  ────────────────────────────────────────────────────────────────
  │ ... │ SUM │ ... │ SPP │ ... │ SPIE │ ... │ SIE │ ... │
  ────────────────────────────────────────────────────────────────
             bit 18   bit 8         bit 5         bit 1
```

- `SPP` (Supervisor Previous Privilege): 0 if the trap came from **U-mode**,
  1 if it came from S-mode. When `sret` executes, the CPU returns to the
  mode named by SPP. To run a user app for the first time you must **clear
  SPP** manually — that is exactly what `app_init_context` does.
- `SPIE` (Supervisor Previous Interrupt Enable): saved IE bit. On `sret`,
  the CPU restores `SIE` from `SPIE`.
- `SIE` (Supervisor Interrupt Enable): global mask. For Phase 1 we keep it
  disabled in U-mode — timer interrupts arrive in Phase 2.

---

## 1.2 Concept · TrapContext (why 34 registers)

When a trap fires, the hardware saves **one** thing: `sepc`. Every general
register is live and, the moment you execute `mv`, `ld`, or `addi` in the
kernel, it is gone. So our first act on entering the kernel must be to spill
**all 32 GPRs** (x0..x31) into memory. To that we add `sstatus` and `sepc`
(already saved by the CPU but we need it in memory so we can tweak it).
Total: **34 × 8 = 272 bytes**.

```
TrapContext memory layout (grows from low to high)

  offset  field        notes
  ─────── ───────────  ──────────────────────────────────────
   +  0   x0           always zero; we still store it for a tidy layout
   +  8   x1  (ra)     return address
   + 16   x2  (sp)     user stack pointer (from sscratch)
   + 24   x3  (gp)
   + 32   x4  (tp)
   + 40   x5  (t0)     ← scratch used inside __alltraps
   + 48   x6  (t1)
   ...
   + 80   x10 (a0)     syscall ret / first arg
   + 88   x11 (a1)
   ...
   +136   x17 (a7)     syscall number
   ...
   +248   x31
   +256   sstatus      (32 * 8)
   +264   sepc         (33 * 8)
  ─────── ───────────
   272 B total
```

Hold this picture in your head. Every line of `trap.S` is either writing a
register into one of these slots or reading it back out.

---

## Lab 1 · TrapContext · ⭐⭐

**File**: `src/trap/context.rs`

### Step-by-step pseudocode

```rust
pub fn app_init_context(entry: usize, user_sp: usize) -> Self {
    let mut sstatus: usize;
    unsafe { asm!("csrr {}, sstatus", out(reg) sstatus); }
    sstatus &= !SSTATUS_SPP;        // return to U-mode
    let mut ctx = TrapContext { x: [0; 32], sstatus, sepc: entry };
    ctx.x[2] = user_sp;              // sp
    ctx
}
```

### Common mistakes

- **Forgetting to clear SPP.** `sret` will happily drop you back into S-mode
  and your user app will execute privileged instructions that silently
  succeed — until Phase 2 when you turn on paging and everything explodes.
- **Stuffing `entry` into `x[0]`** instead of `sepc`. `x[0]` is hardwired to
  zero; the write is discarded.
- **Forgetting to set `x[2]`.** The first instruction of your user program
  is almost always `addi sp, sp, -N`, which, with `sp = 0`, page-faults.
- **Writing 34 as the register count.** You have 32 GPRs + sstatus + sepc.
  Many students write 33 and live with a mysterious 8-byte shift.

### What to run

```bash
cargo test --target $(rustc -vV | sed -n 's|host: ||p') --test test_lab1_context
```

All four tests must pass before moving on.

---

## 1.3 Concept · The `__alltraps` dance

Here is the choreography, in prose, that `trap.S` must execute:

```
Before the trap:              After 10 lines of __alltraps:
  sp       = user_sp            sp       = kernel_sp - 272
  sscratch = kernel_sp          sscratch = user_sp
                                *(kernel_sp - 272 + i*8) = x[i]  for all i
                                *(kernel_sp - 272 + 32*8) = sstatus
                                *(kernel_sp - 272 + 33*8) = sepc
```

The single clever trick is this instruction:

```asm
csrrw sp, sscratch, sp     # atomically: tmp = sp; sp = sscratch; sscratch = tmp
```

**Why atomic?** Because we have no free register at the start of a trap — we
have not yet saved any of them. `csrrw` uses the CSR itself as the
intermediate, so no GPR is clobbered. After the swap, `sp` is our kernel
stack and `sscratch` holds the user sp. We then allocate 272 bytes of
TrapContext and fill it in with plain `sd` stores.

### ASCII of the stack after `__alltraps`

```
  high addresses
  ┌───────────────────┐  ← kernel_sp (old top)
  │                   │
  │   TrapContext     │   272 bytes
  │   (x0..x31,       │
  │    sstatus, sepc) │
  │                   │
  ├───────────────────┤  ← kernel_sp - 272      == new sp      == a0 into trap_handler
  │  ... handler's    │
  │   stack frame ... │
  └───────────────────┘
  low addresses
```

---

## Lab 2 · `__alltraps` / `__restore` + dispatcher · ⭐⭐⭐

**Files**: `src/trap/trap.S` and `src/trap/mod.rs`

### Line-by-line pseudocode for `__alltraps`

```
__alltraps:
    csrrw sp, sscratch, sp          ; swap: sp ← kernel_sp, sscratch ← user_sp
    addi  sp, sp, -34*8             ; allocate TrapContext
    sd x1, 1*8(sp)                  ; save ra
    sd x3, 3*8(sp)                  ; save gp  (skip x0 & x2 & x4 for now)
    .set n, 5                       ; loop x5..x31
    .rept 27
        SAVE_GP %n
        .set n, n+1
    .endr
    csrr t0, sstatus ; sd t0, 32*8(sp)
    csrr t1, sepc    ; sd t1, 33*8(sp)
    csrr t2, sscratch ; sd t2, 2*8(sp)   ; save the *user* sp into x[2]
    mv a0, sp                       ; &TrapContext
    call trap_handler
    # fall through into __restore with a0 still valid
```

### `__restore` is the same movie run backwards

```
__restore:
    mv sp, a0                        ; sp ← &TrapContext
    ld t0, 32*8(sp) ; csrw sstatus, t0
    ld t1, 33*8(sp) ; csrw sepc,    t1
    ld t2, 2*8(sp)  ; csrw sscratch, t2  ; stash user sp for next time
    ld x1, 1*8(sp)
    ld x3, 3*8(sp)
    .set n, 5 ; .rept 27 ; LOAD_GP %n ; .set n, n+1 ; .endr
    addi sp, sp, 34*8               ; pop the ctx
    csrrw sp, sscratch, sp          ; sp ← user_sp, sscratch ← kernel_sp
    sret                             ; hardware jumps to sepc in U-mode
```

### The Rust-side handler

```rust
#[no_mangle]
pub extern "C" fn trap_handler(cx: &mut TrapContext) -> &mut TrapContext {
    let scause: usize; let stval: usize;
    unsafe {
        asm!("csrr {}, scause", out(reg) scause);
        asm!("csrr {}, stval",  out(reg) stval);
    }
    let is_int = (scause as isize) < 0;
    let code   = scause & !(1 << 63);
    match (is_int, code) {
        (false, EXC_U_ECALL) => {
            cx.sepc += 4;                  // skip the ecall
            cx.x[10] = syscall(cx.x[17], [cx.x[10], cx.x[11], cx.x[12]]) as usize;
        }
        (false, EXC_ILLEGAL_INST) => {
            println!("[kernel] illegal instruction at {:#x}", cx.sepc);
            exit_current(-3);
        }
        (false, EXC_LOAD_FAULT | EXC_STORE_FAULT
              | EXC_LOAD_PAGE_FAULT | EXC_STORE_PAGE_FAULT) => {
            println!("[kernel] memory fault: scause={} stval={:#x} sepc={:#x}",
                     code, stval, cx.sepc);
            exit_current(-2);
        }
        _ => panic!("unsupported trap: scause={} is_int={}", code, is_int),
    }
    cx
}
```

### Gotchas worth a page of your notebook

1. **Do not save x0.** It is hardwired to zero on RISC-V. Saving it is
   harmless but unconventional; restoring into it is a no-op. We skip it
   in the loop above.
2. **`csrrw sp, sscratch, sp` must come FIRST.** If you try to compute the
   kernel sp any other way (e.g. by loading it from a static) you will
   clobber a GPR before saving it. Every register is live at entry.
3. **`sepc` += 4.** Only for `ecall`. The CPU points `sepc` at the ecall
   instruction itself; without the +4 you re-execute it forever.
4. **Install stvec in MODE=0 (direct).** The low two bits of stvec select
   the mode. MODE=1 (vectored) dispatches interrupts through an offset
   table — not what we want.

---

## 1.4 Concept · Syscall ABI

Phase 1 follows rCore / Linux for RISC-V:

| Register | Role                        |
| -------- | --------------------------- |
| `a7`     | syscall number              |
| `a0..a5` | arguments (we use a0..a2)   |
| `a0`     | return value                |

```
user:
    li a7, 64                ; SYSCALL_WRITE
    li a0, 1                 ; fd = stdout
    la a1, msg               ; buf
    li a2, msg_len           ; len
    ecall                    ; → trap_handler → syscall → sys_write → len
    # a0 now holds the return value
```

**Why `sepc += 4`?** Because `sepc` is the PC **of** the ecall instruction,
not after it. If you `sret` without bumping it, the CPU re-executes the
same `ecall` and you're stuck in an infinite trap loop.

---

## Lab 3 · Syscalls · ⭐⭐

**Files**: `src/syscall/mod.rs`, `fs.rs`, `process.rs`

Three functions, each shorter than their docstring:

```rust
pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    match id {
        SYSCALL_WRITE  => sys_write(args[0], args[1] as *const u8, args[2]),
        SYSCALL_EXIT   => sys_exit(args[0] as i32),
        SYSCALL_GETPID => sys_getpid(),
        _ => panic!("unknown syscall {}", id),
    }
}

pub fn sys_write(fd: usize, buf: *const u8, len: usize) -> isize {
    assert_eq!(fd, FD_STDOUT);
    let slice = unsafe { core::slice::from_raw_parts(buf, len) };
    for &b in slice { console_putchar(b as usize); }
    len as isize
}

pub fn sys_exit(code: i32) -> ! { exit_current(code) }
pub fn sys_getpid() -> isize { 0 }
```

The apparent simplicity is misleading — you are now a kernel whose
user-space code works.

---

## 1.5 Integration · See it run

```bash
make qemu
```

Expected:

```
[kernel] TinyOS Phase 1 · Traps & Syscalls
[kernel] loaded app @ 0x80400000, jumping to U-mode
[user] hello from U-mode!
[user] goodbye
[kernel] app exited with code 0
```

If you see `[user] hello`, every box of the diagram at the top of this doc
is working. Congratulations — you have written an OS that can host programs.

### Debug workflow when it does not work

```bash
make gdb
(gdb) b trap_handler
(gdb) b *__alltraps
(gdb) c
# single-step with `si`; inspect $sp, $sepc, $scause
```

Key GDB tricks:

```
(gdb) info reg                 # all GPRs
(gdb) x/34xg $sp               # dump the TrapContext on the kernel stack
(gdb) print/x $sstatus         # check SPP bit
```

---

## 1.6 Review & what's next

| Topic                      | You can now…                                          |
| -------------------------- | ----------------------------------------------------- |
| Privilege levels           | explain why U-mode cannot touch `sstatus`             |
| TrapContext                | draw its 272-byte layout from memory                  |
| `__alltraps` / `__restore` | implement them and explain every `csrrw`              |
| Syscall ABI                | wire `a7` → dispatch table → return value             |
| Exception cause handling   | distinguish recoverable faults from terminal panics   |

**Phase 2 preview** — Processes & scheduling. You will promote `TrapContext`
from a singleton-on-the-kernel-stack to a per-task resource, and pair it with
a `TaskContext` (callee-saved regs + ra + sp) that a new `__switch` routine
will swap. Timer interrupts replace `sret` as the primary way user code
bounces back to the kernel.

---

## References

### Required

- **xv6-riscv book**, Ch. 4 *Traps and system calls*
  <https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf>
- **rCore-Tutorial**, §3 trap subsystem
  <https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/>
- **RISC-V Privileged Spec v1.12**, Ch. 10 *Supervisor-Level ISA*
  <https://github.com/riscv/riscv-isa-manual/releases>

### Deep dive

- **RISC-V ISA Vol I** — authoritative definition of `ecall` / `sret`
  and CSR operations.
  <https://riscv.org/technical/specifications/>
- Linux `arch/riscv/kernel/entry.S` — the same `__alltraps` pattern at
  production scale (macro-heavy; read after you have written your own).
  <https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/riscv/kernel/entry.S>
- Yosef Pertzovsky, "Context Switches on RISC-V" — a good visualisation of
  the sp/sscratch swap dance.

### Stretch questions

- What happens if `__alltraps` is interrupted before it has saved `x1`
  (e.g. a spurious NMI)? (Hint: RISC-V masks S-mode interrupts via
  `sstatus.SIE` on trap entry, but NMIs and debug exceptions need
  separate shadow registers.)
- Why does `TrapContext` save 34 registers instead of 32? (Hint: you
  also need `sstatus` and `sepc`, otherwise a nested trap clobbers them.)
- If a user program passes a pointer to a kernel address in `ecall`,
  what happens when the kernel dereferences it? (Hint: before page
  tables, any physical address is reachable; after SV39 in Phase 4
  you'll need `copy_from_user` to translate through the user's page
  table.)
