#!/usr/bin/env bash
# Shared helper: boot a phase's kernel.bin in qemu-system-riscv64.
#
# Usage:
#   labs/shared/run_qemu.sh labs/phase_0_boot/target/riscv64gc-unknown-none-elf/release/kernel.bin
#   labs/shared/run_qemu.sh labs/phase_5_fs/kernel.bin labs/phase_5_fs/fs.img
#
# Exits 0 on clean shutdown (sbi shutdown), non-zero on qemu error.
set -euo pipefail

KERNEL="${1:?need path to kernel.bin}"
FSIMG="${2:-}"

ARGS=(
  -machine virt
  -bios default
  -kernel "$KERNEL"
  -m 128M
  -nographic
  -smp 1
)

if [[ -n "$FSIMG" && -f "$FSIMG" ]]; then
  ARGS+=(
    -drive "file=$FSIMG,if=none,format=raw,id=x0"
    -device "virtio-blk-device,drive=x0,bus=virtio-mmio-bus.0"
  )
fi

exec qemu-system-riscv64 "${ARGS[@]}"
