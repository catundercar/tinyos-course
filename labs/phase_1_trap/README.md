# Phase 1 · Traps & Syscalls

> Build the U-mode ↔ S-mode trap path. Save 34 registers, dispatch the cause,
> run the syscall, restore and return — all in ~120 lines of careful asm +
> Rust.

**Prerequisite**: Phase 0 complete. You already have boot, console, panic.

---

## Labs

| Lab   | Difficulty | File                       | What you build                            |
| ----- | ---------- | -------------------------- | ----------------------------------------- |
| Lab 1 | ⭐⭐        | `src/trap/context.rs`      | `TrapContext` struct + `app_init_context` |
| Lab 2 | ⭐⭐⭐      | `src/trap/trap.S` + `mod.rs` | `__alltraps` / `__restore` + dispatcher   |
| Lab 3 | ⭐⭐        | `src/syscall/`             | `sys_write`, `sys_exit`, `sys_getpid`     |

---

## Quick start

```bash
rustup target add riscv64gc-unknown-none-elf
rustup component add rust-src llvm-tools-preview

cargo install cargo-binutils      # for rust-objcopy

# Run
make qemu                          # full kernel + user app in QEMU
make test                          # host-side unit tests
python3 scripts/grade.py           # all labs, with progress bars
```

Expected output on success:

```
[kernel] TinyOS Phase 1 · Traps & Syscalls
[kernel] loaded app @ 0x80400000, jumping to U-mode
[user] hello from U-mode!
[user] goodbye
[kernel] app exited with code 0
```

---

## How to read this phase

1. Start with [`COURSE.en.md`](./COURSE.en.md) (or `.zh-CN.md`) — ~40 min.
2. Do Lab 1 (the struct) — should take 20 min.
3. Do Lab 2 (the hard one) — 2–3 hours the first time. Expect to stare at
   `__alltraps` and GDB.
4. Do Lab 3 (three small functions) — 20 min.
5. `make qemu` → see the greeting — this is the whole point.

---

## Common failures (and how to debug them)

- **Kernel freezes right after "jumping to U-mode"** — `__alltraps` is
  probably writing to user-sp instead of kernel-sp. Check the `csrrw sp,
  sscratch, sp` lines carefully.
- **"load access fault" inside the handler** — you forgot to seed `sscratch`
  in `trap::init()`.
- **Registers come back scrambled** — you saved/restored x0 (skip it) or
  used a register that was not yet saved as a scratch.
- **Tests compile but qemu crashes silently** — check `Makefile`'s QEMU_ARGS;
  if `-bios default` is missing, there is no OpenSBI and `ecall` faults.

See `COURSE.en.md §Lab 2 guide` for a line-by-line walkthrough.
