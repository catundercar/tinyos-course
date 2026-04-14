# Toolchain Reference (shared across all phases)

## Rust
- Channel: `nightly-2024-05-02` (pinned per phase via `rust-toolchain.toml`)
- Target: `riscv64gc-unknown-none-elf`
- Install: `rustup target add riscv64gc-unknown-none-elf` + `rustup component add rust-src llvm-tools-preview`

## QEMU
- `qemu-system-riscv64` ≥ 7.0
- Machine: `-machine virt -bios default -nographic`
- Memory: `-m 128M`
- Block device (from Phase 5): `-drive file=fs.img,if=none,format=raw,id=x0 -device virtio-blk-device,drive=x0,bus=virtio-mmio-bus.0`

## Entry address
- OpenSBI (bios default) jumps to `0x80200000` in S-mode → our kernel's `_start`

## Typical Cargo commands per phase
```
cd labs/phase_N_name
cargo build --release              # compile kernel
make qemu                           # run in qemu
make gdb                            # debug with gdb
make test                           # run host-side tests
python scripts/grade.py             # auto-grade
```

## Common Makefile targets
- `build` — cargo build + objcopy to bin
- `qemu` — run in qemu-system-riscv64
- `gdb` — qemu -s -S + gdb riscv64-unknown-elf-gdb
- `test` — cargo test on host-side logic (no_std-compatible tests)
- `clean` — cargo clean + rm *.bin

## File naming convention (Rust adaptation)
- `phase_N/` = student crate name (e.g., `phase_0`, `phase_1`)
- `src/main.rs` — kernel entry
- `src/lib.rs` — reusable modules (when applicable)
- `src/types.rs` — provided type definitions
- `src/{module}.rs` — student TODO modules
- `tests/test_lab{K}_{module}.rs` — host-runnable tests (cfg(test), no_std-compatible via mock)
- `scripts/grade.py` — graded Python script that runs qemu and checks output/exit code
