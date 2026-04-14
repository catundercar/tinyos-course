# Phase 0 · Boot & Kernel Entry

> From power-on to `println!("Hello, TinyOS!")` on a bare RISC-V machine.

## Learning goals

By the end of Phase 0 you will be able to:

- Read and write a RISC-V linker script and explain every section.
- Boot a `no_std` Rust kernel that OpenSBI hands off at `0x80200000`.
- Call into M-mode firmware via `ecall` (the SBI).
- Route `print!` / `println!` through the SBI console.
- Write a `#[panic_handler]` that prints file+line and shuts down.

## Prerequisites

See [`labs/shared/TOOLCHAIN.md`](../shared/TOOLCHAIN.md). In short:

```bash
rustup toolchain install nightly-2024-05-02
rustup target add riscv64gc-unknown-none-elf
rustup component add rust-src llvm-tools-preview
cargo install cargo-binutils

# macOS
brew install qemu

# Ubuntu/Debian
sudo apt install qemu-system-misc
```

## Suggested order

| Lab | File(s) | Difficulty | What you build |
|-----|---------|:---:|----------------|
| 1 | `src/entry.asm`, `linker.ld` (read only) | ⭐ | Stack pointer + jump into Rust |
| 2 | `src/sbi.rs`, `src/console.rs` | ⭐⭐ | `ecall`, `print!`, `println!` |
| 3 | `src/lang_items.rs` | ⭐⭐ | `#[panic_handler]` with location info |

Read [`COURSE.en.md`](./COURSE.en.md) (or [`COURSE.zh-CN.md`](./COURSE.zh-CN.md)) before each lab.

## Commands

```bash
make build        # compile kernel ELF + binary
make qemu         # boot in qemu-system-riscv64 (Ctrl-A X to quit)
make gdb          # qemu -S -s (paused); in another shell: make gdb-client
make test         # host-side cargo tests
make grade        # visual progress-bar grader
make clean        # wipe artifacts
```

## Expected output (all three labs complete)

```
Hello, TinyOS!
[kernel] booted at 0x80200012
[kernel] .text   [0x80200000, 0x80203000)
[kernel] .rodata [0x80203000, 0x80204000)
[kernel] .data   [0x80204000, 0x80205000)
[kernel] .bss    [0x80205000, 0x80215000)
```

If you panic deliberately:

```
[kernel] PANIC at src/main.rs:58: intentional grader panic at line 58
```

## Directory layout

```
phase_0_boot/
├── Cargo.toml
├── rust-toolchain.toml
├── .cargo/config.toml
├── linker.ld              # PROVIDED
├── Makefile
├── src/
│   ├── main.rs            # mostly PROVIDED (rust_main)
│   ├── types.rs           # PROVIDED — SBI constants
│   ├── entry.asm          # Lab 1 TODO
│   ├── sbi.rs             # Lab 2 TODO
│   ├── console.rs         # Lab 2 TODO
│   └── lang_items.rs      # Lab 3 TODO
├── tests/test_lab1_boot.rs
└── scripts/grade.py
```

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `unimp` illegal instruction on boot | Lab 1 TODOs in `entry.asm` not filled in — the safety `unimp` is still there. |
| QEMU hangs with no output | `sbi::console_putchar` or `sbi_call` not implemented (Lab 2). |
| `#[panic_handler] function required` | You deleted the `#[panic_handler]` attribute from `lang_items.rs`. |
| `_start` not at `0x80200000` | Linker script not picked up — check `.cargo/config.toml` rustflags. |
| Stack grows down into code | Forgot to `la sp, boot_stack_top` (the *top*, not the bottom). |
