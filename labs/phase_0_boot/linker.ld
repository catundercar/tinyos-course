/*
 * linker.ld — Kernel memory layout for TinyOS Phase 0
 *
 * PROVIDED FILE — Do NOT modify unless instructed.
 *
 * Memory map (QEMU virt machine + OpenSBI fw_jump):
 *
 *   0x80000000  +------------------------+
 *               |  OpenSBI firmware      |
 *               |  (runs in M-mode)      |
 *   0x80200000  +------------------------+  <-- BASE_ADDRESS, our kernel starts here
 *               |  .text.entry (_start)  |
 *               |  .text (rust code)     |
 *               |  .rodata               |
 *               |  .data                 |
 *               |  .bss + boot stack     |
 *               +------------------------+
 *
 * OpenSBI jumps to 0x80200000 in S-mode with:
 *   - a0 = hartid
 *   - a1 = device tree blob pointer
 */

OUTPUT_ARCH(riscv)
ENTRY(_start)

BASE_ADDRESS = 0x80200000;

SECTIONS
{
    . = BASE_ADDRESS;
    skernel = .;

    stext = .;
    .text : {
        *(.text.entry)          /* _start must be placed first */
        *(.text .text.*)
    }
    . = ALIGN(4K);
    etext = .;

    srodata = .;
    .rodata : {
        *(.rodata .rodata.*)
        *(.srodata .srodata.*)
    }
    . = ALIGN(4K);
    erodata = .;

    sdata = .;
    .data : {
        *(.data .data.*)
        *(.sdata .sdata.*)
    }
    . = ALIGN(4K);
    edata = .;

    .bss : {
        *(.bss.stack)           /* boot stack — must be before normal bss */
        sbss = .;
        *(.bss .bss.*)
        *(.sbss .sbss.*)
    }
    . = ALIGN(4K);
    ebss = .;

    ekernel = .;

    /DISCARD/ : {
        *(.eh_frame)
        *(.debug_*)
    }
}
