# Makefile for TinyOS Phase 0 — Boot & Kernel Entry
#
# Usage:
#   make build    — compile the kernel
#   make qemu     — run in qemu
#   make gdb      — run qemu paused + connect gdb
#   make test     — host-side tests
#   make clean    — clean artifacts
#   make grade    — run the grader

TARGET      := riscv64gc-unknown-none-elf
MODE        := release
KERNEL_ELF  := target/$(TARGET)/$(MODE)/kernel
KERNEL_BIN  := $(KERNEL_ELF).bin

OBJCOPY     := rust-objcopy --binary-architecture=riscv64
OBJDUMP     := rust-objdump --arch-name=riscv64

QEMU        := qemu-system-riscv64
BOOTLOADER  := default
QEMU_ARGS   := -machine virt \
               -nographic \
               -bios $(BOOTLOADER) \
               -m 128M \
               -kernel $(KERNEL_BIN)

CARGO_FLAGS := --release

.PHONY: build qemu gdb test clean grade disasm all

all: build

build:
	cargo build $(CARGO_FLAGS)
	$(OBJCOPY) $(KERNEL_ELF) --strip-all -O binary $(KERNEL_BIN)
	@echo "Built $(KERNEL_BIN)"

qemu: build
	$(QEMU) $(QEMU_ARGS)

gdb: build
	$(QEMU) $(QEMU_ARGS) -s -S

gdb-client:
	riscv64-unknown-elf-gdb \
	    -ex 'file $(KERNEL_ELF)' \
	    -ex 'set arch riscv:rv64' \
	    -ex 'target remote localhost:1234'

disasm: build
	$(OBJDUMP) -d $(KERNEL_ELF) | less

test:
	@echo "Running host-side tests..."
	cargo test --test test_lab1_boot --target $(shell rustc -vV | awk '/host/ {print $$2}') || true

clean:
	cargo clean
	rm -f $(KERNEL_BIN)

grade:
	python3 scripts/grade.py
