TARGET := riscv64gc-unknown-none-elf
MODE   := release
KERNEL_ELF := target/$(TARGET)/$(MODE)/kernel
KERNEL_BIN := $(KERNEL_ELF).bin

BOOTLOADER := default
QEMU       := qemu-system-riscv64
QEMU_ARGS  := -machine virt -nographic -bios $(BOOTLOADER) \
              -device loader,file=$(KERNEL_BIN),addr=0x80200000

.PHONY: all build run clean test grade

all: build

build:
	cargo build --$(MODE)
	rust-objcopy --strip-all $(KERNEL_ELF) -O binary $(KERNEL_BIN)

run: build
	$(QEMU) $(QEMU_ARGS)

test:
	cargo test --target $(shell rustc -vV | sed -n 's|host: ||p')

grade:
	python3 scripts/grade.py

clean:
	cargo clean
