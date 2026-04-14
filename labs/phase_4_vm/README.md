# Phase 4 — Virtual Memory & SV39 Paging

> Goal: turn "one CPU, one memory" into "every process has its own 39-bit
> virtual address space." By the end, two programs can each write to
> `0x1000_0000` without noticing each other, and a stray null-deref gets
> killed instead of taking down the kernel.

## Deliverables

| Lab | Difficulty | File | What you build |
|-----|------------|------|----------------|
| 1   | ⭐⭐        | `src/mm/frame_allocator.rs` | Stack-based physical frame allocator + `FrameTracker` RAII |
| 2   | ⭐⭐⭐      | `src/mm/page_table.rs`      | `PageTableEntry`, three-level walk (`map`/`unmap`/`translate`) |
| 3   | ⭐⭐⭐      | `src/mm/memory_set.rs`      | `MapArea`, `MemorySet::new_kernel`, `MemorySet::from_elf`, mmap syscalls |

## Workflow

```bash
# Host-side unit tests per lab
cargo test --test test_lab1_frame
cargo test --test test_lab2_pagetable
cargo test --test test_lab3_memset

# Integrated visual grade
make grade          # or: python3 scripts/grade.py

# On-target boot
make run            # qemu-system-riscv64
```

## Reading order

1. `COURSE.zh-CN.md` / `COURSE.en.md` §4.0–§4.3 (concepts)
2. Lab 1 (`COURSE` §Lab 1 guide, then `frame_allocator.rs`)
3. Lab 2 (§Lab 2 guide, then `page_table.rs`)
4. `COURSE` §4.4–§4.5 (satp, MemorySet)
5. Lab 3 (§Lab 3 guide, then `memory_set.rs`)
6. `COURSE` §4.6 integration — boot it in QEMU

## Provided vs student-written

* **PROVIDED**: `address.rs`, `config.rs`, linker script, trampoline.S stub,
  trap dispatcher skeleton, console/sbi, `Cargo.toml`, grading script.
* **STUDENT**: every function with a `// TODO` marker and an
  `unimplemented!` body. Don't delete the `unimplemented!` line — replace
  it.

## Acceptance

Beyond the unit tests, the Phase 4 deliverable is considered complete when:

1. `make run` boots into user-mode with SV39 active.
2. `mmap_demo` reads back `0xdead_beef` it wrote via an mmapped page.
3. `isolation_demo` forked twice shows the two processes reading different
   values at the same VA.
4. `page_fault_demo` prints `about to segfault...`, is killed, and the
   kernel survives to run the next task.
