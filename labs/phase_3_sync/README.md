# Phase 3 · Concurrency & Locks

> Week 7 · 2 labs · deliverable `tinyos-sync`

You already have a preemptive scheduler from Phase 2. Now you'll make it
*safe* to share data between tasks. By the end of this phase your kernel
exposes the full stack of synchronization primitives — spinlocks, sleep
mutexes, counting semaphores, condition variables — plus the user-space
syscalls to drive them from programs like `philosopher_dinner`.

## Labs

| # | Difficulty | Module | What you build |
|---|------------|--------|----------------|
| 1 | ⭐⭐⭐ | `src/sync/spin.rs` | `SpinLock<T>` + `SpinLockGuard<T>` with RAII drop, AMO-based acquire, interrupt-disable while held |
| 2 | ⭐⭐⭐ | `src/sync/{mutex,semaphore,condvar}.rs`, `src/syscall/sync.rs` | Blocking `Mutex`, counting `Semaphore`, `Condvar.wait/signal`, and the nine `sys_*` wrappers |

## Layout

```
phase_3_sync/
├── COURSE.zh-CN.md   # Course textbook (Chinese)
├── COURSE.en.md      # Course textbook (English)
├── src/
│   ├── sync/         # ← student code lives here
│   ├── syscall/sync.rs
│   ├── arch/interrupts.rs   # PROVIDED — IRQ enable/disable helpers
│   ├── task/          # PROVIDED stub — real impl in Phase 2
│   └── main.rs        # PROVIDED — kernel entry
├── user/src/bin/      # PROVIDED — demos + stress tests
├── tests/             # PROVIDED — host-side cargo tests
└── scripts/grade.py   # PROVIDED — auto-grader with progress bars
```

## Workflow

```bash
# Run the host tests for Lab 1
cargo test --target $(rustc -vV | sed -n 's|host: ||p') --test test_lab1_spin

# Run the grader (both labs + reminders for the QEMU demos)
make grade

# Boot the kernel
make qemu
```

## Acceptance criteria (from `course-roadmap.jsx`)

- [x] Race counter: 10 tasks × 10 000 increments = exactly 100 000
- [x] Dining philosophers demo: no deadlock for 60 s
- [x] SpinLock refuses re-entry from the same hart (interrupt-disable assertion)
- [x] Semaphore `up`/`down` stress test passes

## Reading list

- xv6-riscv book, Ch. 6 *Locking*
- OSTEP Ch. 28–31 *Concurrency*
- Linux Kernel Development, Ch. 10 *Kernel Synchronization Methods*
