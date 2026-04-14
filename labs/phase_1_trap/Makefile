TARGET    := riscv64gc-unknown-none-elf
MODE      := release
KERNEL    := target/$(TARGET)/$(MODE)/kernel
BIN       := $(KERNEL).bin
USER_ELF  := user/target/$(TARGET)/$(MODE)/hello

QEMU      := qemu-system-riscv64
OBJCOPY   := rust-objcopy --binary-architecture=riscv64
GDB       := riscv64-unknown-elf-gdb

QEMU_ARGS := -machine virt -nographic -bios default \
             -device loader,file=$(BIN),addr=0x80200000

.PHONY: all build user bin qemu gdb clean test grade

all: bin

user:
	cd user && cargo build --$(MODE)

build: user
	cargo build --$(MODE)

bin: build
	$(OBJCOPY) $(KERNEL) --strip-all -O binary $(BIN)

qemu: bin
	$(QEMU) $(QEMU_ARGS)

gdb: bin
	$(QEMU) $(QEMU_ARGS) -s -S &
	$(GDB) -ex 'file $(KERNEL)' -ex 'target remote :1234'

test:
	cargo test --target $(shell rustc -vV | sed -n 's|host: ||p')

grade:
	python3 scripts/grade.py

clean:
	cargo clean
	cd user && cargo clean
	rm -f $(BIN)
