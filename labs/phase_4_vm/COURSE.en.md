# Phase 4 · Virtual Memory & SV39 Paging

> **Week 8–9 · 3 labs**
> Prereq: Phase 3 (kernel/user split, trap, simple scheduler)
> After: Phase 5 (file system) will rely on `translated_byte_buffer`.

---

## 4.0 Opening — the magic of "same pointer, different worlds"

Run these two programs simultaneously on a PC:

```c
// program A                         // program B
int *p = (int*)0x10000000;           int *p = (int*)0x10000000;
*p = 111;                            *p = 222;
printf("%d\n", *p);                  printf("%d\n", *p);
```

A prints `111`. B prints `222`. Neither sees the other's write. Yet they
agreed on the exact same address `0x10000000`. How?

Because each process reads and writes through a **private mapping table**
installed into the CPU's memory-management unit (MMU). When A executes, the
MMU translates `0x10000000` via *A's table* to some physical frame `PA_a`.
When B runs, the MMU translates the *same* virtual address via *B's table*
to a completely different physical frame `PA_b`. The RAM chips don't know
about processes — they only see two distinct physical addresses.

The three components Phase 4 builds are:

```
          ┌───────────────────┐   ┌───────────────────┐
   Proc A │   MemorySet A     │   │   MemorySet B     │ Proc B
          │ ┌──────────────┐  │   │ ┌──────────────┐  │
          │ │ PageTable A  │  │   │ │ PageTable B  │  │
          │ │  (frames)    │  │   │ │  (frames)    │  │
          │ └──────┬───────┘  │   │ └──────┬───────┘  │
          └────────┼──────────┘   └────────┼──────────┘
                   │                       │
                   ▼                       ▼
          ┌──────────────────────────────────────────┐
          │         FrameAllocator (singleton)       │
          │   hands out free 4 KiB physical frames   │
          └──────────────────────────────────────────┘
```

One global frame allocator. One page table per process. Contexts switch by
writing a new root PPN into the CSR `satp`.

---

## 4.1 Concept — three reasons VM exists

| Motivation       | What would go wrong *without* VM                              |
|------------------|---------------------------------------------------------------|
| **Isolation**    | Any user bug can scribble over the kernel or its neighbours.  |
| **Relocation**   | You'd have to recompile binaries for every boot-time address. |
| **Overcommit**   | You couldn't run more RAM-worth of processes than you have.   |

SV39 paging solves all three by inserting the MMU between every load/store
and the physical bus.

---

## 4.2 Concept — SV39 layout

RISC-V SV39 uses **39-bit virtual addresses** and **56-bit physical addresses**.
A VA is split `9 / 9 / 9 / 12` to index three levels of page tables:

```
 63           39 38       30 29       21 20       12 11         0
 ┌──────────────┬───────────┬───────────┬───────────┬────────────┐
 │ sign-extend  │  VPN[2]   │  VPN[1]   │  VPN[0]   │   offset   │
 └──────────────┴───────────┴───────────┴───────────┴────────────┘
     25 bits       9 bits     9 bits      9 bits      12 bits
```

### The three-level walk

```
         satp.PPN ──► ┌─────────┐
                      │  L2 PT  │   512 PTEs
                      └────┬────┘
       VA[38:30]=VPN[2]  ──►│
                            ▼
                      PTE2.PPN ──► ┌─────────┐
                                   │  L1 PT  │
                                   └────┬────┘
                 VA[29:21]=VPN[1]  ──►│
                                      ▼
                                 PTE1.PPN ──► ┌─────────┐
                                              │  L0 PT  │
                                              └────┬────┘
                       VA[20:12]=VPN[0]        ──►│
                                                   ▼
                                              PTE0.PPN + VA[11:0] = PA
```

Three memory loads in the worst case. Hardware caches the final mapping in
the **TLB** so most translations are single-cycle.

---

## 4.3 Concept — the PTE

Every level stores 512 × 64-bit PTEs per 4 KiB frame:

```
 63        54 53                         10 9   8 7 6 5 4 3 2 1 0
 ┌────────────┬──────────────────────────────┬─────┬─┬─┬─┬─┬─┬─┬─┬─┐
 │  reserved  │              PPN             │ RSW │D│A│G│U│X│W│R│V│
 └────────────┴──────────────────────────────┴─────┴─┴─┴─┴─┴─┴─┴─┴─┘
      10              44 bits                  2   1 1 1 1 1 1 1 1
```

| bit | name | meaning |
|-----|------|---------|
| 0   | V    | Valid — clear on every unused slot |
| 1   | R    | Readable leaf |
| 2   | W    | Writable leaf |
| 3   | X    | Executable leaf |
| 4   | U    | User-mode may access (S-mode can only if `SUM=1`) |
| 5   | G    | Global (shared across ASIDs) |
| 6   | A    | Accessed (set by HW or SW) |
| 7   | D    | Dirty |
| 8–9 | RSW  | free for the OS |

Common combos:

| combo     | intent                                  |
|-----------|------------------------------------------|
| `V`       | interior PTE (next-level pointer)        |
| `V R X`   | kernel .text / trampoline                |
| `V R`     | kernel .rodata                           |
| `V R W`   | kernel .data / .bss / phys mem           |
| `V R W U` | user stack, user heap, anon mmap         |
| `V R X U` | user .text                               |

A PTE with R=W=X=0 but V=1 is an **interior pointer**; any other combo is a
**leaf**.

---

## Lab 1 guide ⭐⭐ — `frame_allocator.rs`

The allocator hands out 4 KiB physical frames. Each allocation returns a
`FrameTracker` whose destructor returns the frame to the pool. Internal
structure:

```
  StackFrameAllocator
  ┌───────────────────────────────────────────────────┐
  │  current  ───► end                                │
  │     │                                             │
  │     ▼                                             │
  │  [ never-allocated frames ]                       │
  │                                                   │
  │  recycled: Vec<PPN>   ◄─── pushed on dealloc      │
  └───────────────────────────────────────────────────┘
```

### Pitfalls

* **Forgetting to zero**. `FrameTracker::new` MUST zero its 4 KiB — a stale
  page would otherwise appear as a valid PTE array when reused as a page
  table frame.
* **Leaking trackers**. Storing raw `PhysPageNum` anywhere the tracker
  isn't present will silently leak the frame.
* **Sanity-check double-free**. The test `double_free_panics` catches this.

---

## Lab 2 guide ⭐⭐⭐ — `page_table.rs`

Two helpers do the heavy lifting:

* `find_pte_create(vpn)` — walk L2→L1→L0, **allocating** a fresh frame on
  any invalid interior PTE.
* `find_pte(vpn)`       — same walk, but **never** allocate; return `None`
  if any interior step is missing.

Once those work, `map`, `unmap`, `translate` are three-liners. `translate`
is what `translated_byte_buffer` (already PROVIDED) uses to let the kernel
read a user buffer even after `satp` has been switched away.

### Why interior PTEs have only V

Hardware decides "this PTE is a leaf" by checking `R | W | X != 0`. Keep
interior PTEs at exactly `V=1` so the walker descends into the next table
rather than stopping early.

---

## 4.4 Concept — the `satp` CSR

```
 63   60 59       44 43                                 0
 ┌──────┬───────────┬───────────────────────────────────┐
 │ MODE │   ASID    │              root PPN             │
 └──────┴───────────┴───────────────────────────────────┘
    4       16                    44
```

`MODE = 8` selects SV39. Writing `satp` does **not** invalidate the TLB on
its own — you must follow with:

```asm
    csrw  satp, t0
    sfence.vma                 # flush every TLB entry
```

Omit the fence and the CPU may happily keep using the *previous* address
space's cached translations.

---

## 4.5 Concept — MemorySet / MapArea & the trampoline trick

```
 User address space                       Kernel address space
 ┌────────────────────────┐ 2^39-1        ┌────────────────────────┐
 │   Trampoline (R X)     │═══════════════│   Trampoline (R X)     │  <- same PA!
 ├────────────────────────┤ TRAMPOLINE-1  ├────────────────────────┤
 │   TrapContext (R W)    │               │  (identity-mapped      │
 ├────────────────────────┤               │   phys memory, kernel  │
 │                        │               │   .text/.rodata/.data) │
 │   user stack (R W U)   │               │                        │
 │   ...                  │               │                        │
 │   user .bss  (R W U)   │               │                        │
 │   user .data (R W U)   │               │                        │
 │   user .text (R X U)   │               │                        │
 └────────────────────────┘ 0             └────────────────────────┘ 0
```

The **trampoline** is a single page of assembly that lives at the *same* VA
(`0xFFFFFFFFFFFFF000`, i.e. `usize::MAX - 0xFFF`) in every address space —
kernel and user alike — and points at the *same* physical frame. This is
the only way to survive the instruction *immediately after* `csrw satp`:
whether you execute that instruction in the old or new mapping, the next
PC is still mapped to valid code.

---

## Lab 3 guide ⭐⭐⭐ — `memory_set.rs`

### `new_kernel()`

Walk every kernel section (`stext..etext`, `srodata..erodata`, `sdata..edata`,
`sbss..ebss`) and the remaining physical memory `ekernel..MEMORY_END`,
pushing an **identity-mapped** MapArea each. No `U`. Don't forget
`map_trampoline()`.

### `from_elf(elf)`

1. Parse with `xmas_elf::ElfFile::new`.
2. For every `PT_LOAD` program header:
   - start = `ph.virtual_addr()`; end = start + `ph.mem_size()`.
   - perm bits from `ph.flags()` ORed with `U`.
   - data = `elf_data[ph.offset()..ph.offset()+ph.file_size()]`.
   - push a Framed MapArea with that data.
3. One guard page above `max_end_vpn`, then a Framed `USER_STACK_SIZE` area
   — that's your user stack (`R W U`).
4. A Framed `[TRAP_CONTEXT, TRAMPOLINE)` page (`R W`, no `U`).
5. Return `(ms, user_sp, entry)`.

---

## 4.6 Integration — boot it

Wire `task::TaskControlBlock` to own a `MemorySet` and a `trap_cx_ppn`. The
context-switch path now ends with:

```asm
    csrw  satp, t0          # new process's root PPN
    sfence.vma
    sret
```

Test:

1. Launch two instances of `isolation_demo`. Each writes `0xAAAA_AAAA` vs
   `0xBBBB_BBBB` at `0x10000000`. Both must read back their own value.
2. Launch `page_fault_demo`. Expect `[kernel] StorePageFault @ 0x0 in task
   N, killed.` followed by the scheduler moving on.

---

## Common Mistakes

A running list of the bugs students actually hit, with the exact symptom you'll see, the root cause, and the fix. When something goes wrong, scan this section before you start blind-debugging.

### 1. Forgetting `sfence.vma` after writing `satp`
**Symptom**: After switching to the user page table you immediately hit `InstructionPageFault`, or the first instruction in user mode faults on fetch. Sometimes it runs on QEMU but dies on real hardware or a stricter simulator.
**Cause**: Writing `satp` only tells the MMU where the new page table lives. The TLB still has cached VA to PA translations from the old table, and the CPU happily uses them until the TLB is flushed.
**Fix**: Always emit `sfence.vma` right after modifying `satp` (no operands = flush all):
```asm
csrw satp, t0
sfence.vma zero, zero
```
Also flush the TLB for a given VA whenever you modify its leaf PTE — otherwise later accesses won't see the update.

### 2. Illegal PTE flag combinations (`R=0, W=1` is reserved)
**Symptom**: A `LoadPageFault` or `StorePageFault` on the very first memory access after loading a page table; `mcause` looks sane but the flags you set "should have been enough".
**Cause**: SV39 declares `R=0, W=1` as a reserved encoding; hardware treats the PTE as faulting. Same for `R=0, W=1, X=1`. And if you forget `V=1`, the whole PTE is considered invalid regardless of other bits.
**Fix**: Wrap flags in a bitflags enum; never poke raw bits:
```rust
bitflags! {
    pub struct PTEFlags: u8 {
        const V = 1 << 0;
        const R = 1 << 1;
        const W = 1 << 2;
        const X = 1 << 3;
        const U = 1 << 4;
    }
}
```
Use `V | R | W | U` for user data, `V | R | X | U` for user code. Never set W without R.

### 3. `FrameTracker` not actually owned — frames leak or alias
**Symptom**: After a few seconds you get sporadic `LoadPageFault`s, or user processes read weird zeros / data that belongs to another process. `frame_alloc` returns the same physical page to two different contexts.
**Cause**: `frame_alloc()` returns a `FrameTracker` whose `Drop` returns the frame to the allocator. If you write `let ppn = frame_alloc().unwrap().ppn;`, the tracker is destroyed at the end of the statement — the frame is reclaimed but your PTE still points at it.
**Fix**: Store the `FrameTracker` inside `MapArea.data_frames: BTreeMap<VirtPageNum, FrameTracker>` or `PageTable.frames: Vec<FrameTracker>`, so its lifetime matches the structure that owns the mapping.

### 4. Confusing VPN with PPN when walking the table
**Symptom**: The page walk jumps to an impossible address, and QEMU prints `InstructionPageFault @ 0xdeadbeef...`. On inspection you used a user VA where a PA was expected.
**Cause**: VPN indexes into *this* page table; PPN points at the *next* table or leaf. It's easy to write `pt[vpn.2]` and then use that PTE's VPN as a physical base — mixing the two up.
**Fix**: Remember `next_pt = PPN(pte) << 12`. A three-level walk looks like:
```rust
let idxs = vpn.indexes();   // [vpn2, vpn1, vpn0]
let mut ppn = self.root_ppn;
for i in 0..3 {
    let pte = &ppn.get_pte_array()[idxs[i]];
    if i == 2 { return Some(*pte); }
    ppn = pte.ppn();        // next level is a PPN, not a VPN
}
```

### 5. Not identity-mapping the trampoline in both kernel and user spaces
**Symptom**: `__alltraps` switches `satp` and the very next instruction faults with `InstructionPageFault`. You can enter the trampoline from user space, but you die right before returning.
**Cause**: Trampoline code executes across the satp switch — at the moment satp changes, PC must map to the same physical page under both the old and new page tables. Omit it from either side and the *next* instruction has no translation.
**Fix**: Map the trampoline at `TRAMPOLINE = 0xffff_ffff_ffff_f000` in every MemorySet, pointing at the same physical code:
```rust
memory_set.page_table.map(
    VirtAddr::from(TRAMPOLINE).into(),
    PhysAddr::from(strampoline as usize).into(),
    PTEFlags::R | PTEFlags::X,
);
```
Do it for both the kernel and every user MemorySet (no `U` bit on either — the kernel doesn't need it and user code never jumps there directly).

### 6. Missing guard page around the user stack, or double-mapped pages
**Symptom**: A user program silently corrupts a neighbor's stack/heap; or right after `exec` you hit `StorePageFault` on an address that looks like it should be inside the stack.
**Cause**: Stack overflow into an adjacent valid page corrupts it silently instead of faulting; or you miscomputed stack top, so the stack area overlaps the trap-context area, producing two PTEs for the same VPN.
**Fix**: Leave a single **unmapped** guard page below the stack so overflow faults loudly:
```
[user stack top] ← sp grows down from here
...
[user stack bottom]
[GUARD PAGE unmapped]   ← overflow = StorePageFault
[next area]
```
Then `assert!` that the VPN ranges of every MapArea are disjoint when pushing them into the MemorySet.

### 7. Stale `satp` on context switch — kernel fault on task-switch return
**Symptom**: After scheduling the second user task the kernel reads the wrong `TrapContext`, or syscall arguments are garbage from the previous task.
**Cause**: `__switch` only swaps the kernel stack and callee-saved registers. `satp` must be swapped separately on the way back to user mode; if you rely on "whatever satp the previous task left", the kernel translates the new task's trap context through the old table.
**Fix**: In `trap_return`, load the current task's `user_satp()`, write it, then `sfence.vma`:
```asm
csrw satp, a0
sfence.vma zero, zero
jr     t0              # jump into the trampoline's sret
```
Never assume "whatever satp happens to be loaded is the right one".

---

## 4.7 Review & what's next

| You should now be able to…                             | Relevant file              |
|--------------------------------------------------------|----------------------------|
| Draw the SV39 walk from memory                         | §4.2                       |
| Read a PTE and say what access it permits              | §4.3                       |
| Explain the trampoline trick in 30 seconds             | §4.5                       |
| Allocate physical frames without leaks                 | Lab 1                      |
| Install & translate a mapping                          | Lab 2                      |
| Build per-process address spaces from ELFs             | Lab 3                      |

**Phase 5 preview.** With address spaces in place, loading a program now
means reading its ELF from disk. Next we'll build a tiny FAT-style file
system and replace the Phase 4 hard-coded ELF blob with a real
`sys_exec("/bin/hello")`.

---

## References

### Required

* xv6-riscv book — Chapter 3 *Page tables*
  <https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf>
* rCore Tutorial v3 — Chapter 4 *Address Space*
  <https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/index.html>
* RISC-V Privileged Spec — Chapter 10 *Supervisor-Level Memory Management*
  <https://github.com/riscv/riscv-isa-manual/releases>

### Deep dive

* OSTEP — Ch. 18–23 *Virtualization of Memory*, a systematic intro to
  paging, TLBs, and multi-level page tables.
  <https://pages.cs.wisc.edu/~remzi/OSTEP/>
* Writing an OS in Rust (Phil-Opp) — *Paging Introduction* and
  *Paging Implementation*. x86_64-flavoured, but the `Mapper` /
  `FrameAllocator` abstractions mirror your `MemorySet` closely.
  <https://os.phil-opp.com/>
* Linux `arch/riscv/mm/init.c` — production-grade SV39/SV48 switch
  and `setup_vm_final`.
  <https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/riscv/mm/init.c>

### Stretch questions

* Why must `sfence.vma` follow every `satp` write? What goes wrong
  without it? (Hint: stale TLB entries from the old ASID make the
  next instruction fetch through the old page table — QEMU is
  forgiving, silicon is not.)
* Why does the trampoline page need to be mapped at the **same VA** in
  both kernel and every user address space? (Hint: the instruction that
  writes `satp` must have a valid translation in both page tables,
  otherwise PC+4 falls into a hole.)
* What would you gain (and lose) by putting the kernel at low addresses
  with identity mapping plus page-table isolation? (Hint: shared TLB
  entries across U/S; but the kernel must be relocation-aware — xv6
  avoids this by living in high addresses.)
