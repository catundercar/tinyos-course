# Phase 2 — Process & Scheduling (`tinyos-proc`)

> From single task to N tasks. Build a Task Control Block, a round-robin
> scheduler, and a 10 ms timer-preempt so three user apps run concurrently.

## Labs

| #  | Difficulty | File(s)                                  | What you build                                  |
|----|-----------|------------------------------------------|-------------------------------------------------|
| 1  | ⭐⭐       | `src/task/context.rs`, `src/task/switch.S` | `TaskContext` (14×usize) + `__switch` asm     |
| 2  | ⭐⭐⭐     | `src/task/mod.rs`                         | `TaskManager`, round-robin, yield/exit         |
| 3  | ⭐⭐       | `src/timer.rs`, patch `src/trap/mod.rs`   | S-mode timer interrupt → preempt every 10 ms   |

## Quick start

```bash
# 1. build user apps
make user

# 2. build + run the kernel in QEMU
make qemu

# 3. run host-side unit tests (Lab 1/2/3 individually)
make test

# 4. full auto-grade (host tests + qemu integration)
make grade
```

## What "done" looks like

After all three labs are implemented, `make qemu` should print something like:

```
[kernel] TinyOS Phase 2 booting
A0 B0 C A1 B1 C C A2 B2 C A3 B3 C A4 B4 [A done]
[B done]
C C C [C done]
[kernel] task exited with code 0
```

The key acceptance signals:

1. A and B interleave — cooperative scheduling via `sys_yield` works.
2. `C ` tokens appear even though `app_timer` never yields — preemption works.
3. All three apps reach their `[X done]` marker.

## Reading order

Before touching code, read the COURSE doc end-to-end:

- English: [`COURSE.en.md`](./COURSE.en.md)
- 中文:    [`COURSE.zh-CN.md`](./COURSE.zh-CN.md)

## Layout

```
phase_2_proc/
├── src/
│   ├── main.rs            PROVIDED — kernel entry, calls run_first_task
│   ├── entry.asm          PROVIDED
│   ├── sbi.rs             PROVIDED — ecall wrappers incl. set_timer
│   ├── console.rs         PROVIDED
│   ├── lang_items.rs      PROVIDED — panic handler
│   ├── config.rs          PROVIDED — MAX_APP_NUM, CLOCK_FREQ, stack sizes
│   ├── types.rs           PROVIDED — TaskStatus enum
│   ├── loader.rs          PROVIDED — multi-app loader + per-task stacks
│   ├── trap/
│   │   ├── mod.rs         PROVIDED, Lab 3 patch point (timer branch TODO)
│   │   ├── context.rs     PROVIDED — 34-word TrapContext
│   │   └── trap.S         PROVIDED — __alltraps / __restore
│   ├── syscall/
│   │   ├── mod.rs         PROVIDED — dispatch
│   │   ├── fs.rs          PROVIDED — sys_write
│   │   └── process.rs     PROVIDED — sys_yield / sys_exit / sys_get_time
│   ├── task/
│   │   ├── mod.rs         STUDENT (Lab 2) — TaskManager, round-robin
│   │   ├── context.rs     STUDENT (Lab 1) — TaskContext::goto_restore
│   │   ├── switch.S       STUDENT (Lab 1) — __switch asm
│   │   └── task.rs        PROVIDED — TCB struct
│   └── timer.rs           STUDENT (Lab 3) — set_next_trigger
├── tests/                 host-side unit tests
├── user/                  3 demo apps (A/B/C)
├── scripts/grade.py       auto-grader
└── Makefile, linker.ld, Cargo.toml, rust-toolchain.toml, .cargo/config.toml
```
