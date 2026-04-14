TARGET := riscv64gc-unknown-none-elf
MODE   := release
KERNEL_ELF := target/$(TARGET)/$(MODE)/kernel
KERNEL_BIN := $(KERNEL_ELF).bin
FS_IMG := target/fs.img
BOOTLOADER := rustsbi-qemu.bin
QEMU := qemu-system-riscv64

.PHONY: build fs-img run clean test grade

build:
	cargo build --release

$(KERNEL_BIN): build
	rust-objcopy --strip-all $(KERNEL_ELF) -O binary $(KERNEL_BIN)

fs-img:
	@mkdir -p target
	cargo run --release --manifest-path easy-fs-fuse/Cargo.toml -- \
		-s user/src/bin -t target/ -o $(FS_IMG)

run: $(KERNEL_BIN) fs-img
	$(QEMU) -machine virt -nographic -bios $(BOOTLOADER) \
		-device loader,file=$(KERNEL_BIN),addr=0x80200000 \
		-drive file=$(FS_IMG),if=none,format=raw,id=x0 \
		-device virtio-blk-device,drive=x0,bus=virtio-mmio-bus.0

test:
	cargo test --manifest-path easy-fs/Cargo.toml

grade:
	python3 scripts/grade.py

clean:
	cargo clean
	rm -f $(FS_IMG)
