# Phase 6 — Shell, Pipes, Coreutils
TARGET        := riscv64gc-unknown-none-elf
MODE          := release
KERNEL_ELF    := target/$(TARGET)/$(MODE)/kernel
KERNEL_BIN    := $(KERNEL_ELF).bin
BOOTLOADER    := bootloader/rustsbi-qemu.bin
QEMU          := qemu-system-riscv64

QEMU_ARGS := -machine virt \
             -nographic \
             -bios $(BOOTLOADER) \
             -device loader,file=$(KERNEL_BIN),addr=0x80200000 \
             -drive file=fs.img,if=none,format=raw,id=x0 \
             -device virtio-blk-device,drive=x0,bus=virtio-mmio-bus.0

.PHONY: all build user fs run clean test grade

all: build

user:
	cd user && cargo build --release

fs: user
	./scripts/mkfs.sh

build: user fs
	cargo build --release
	rust-objcopy --strip-all $(KERNEL_ELF) -O binary $(KERNEL_BIN)

run: build
	$(QEMU) $(QEMU_ARGS)

test:
	cargo test --test test_lab1_fork
	cargo test --test test_lab2_pipe
	cargo test --test test_lab3_shell

grade:
	python3 scripts/grade.py

clean:
	cargo clean
	cd user && cargo clean
