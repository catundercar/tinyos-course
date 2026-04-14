# entry.asm — Lab 1 ⭐
#
# The very first instructions of the TinyOS kernel. OpenSBI hands off
# control to the symbol `_start` in S-mode with:
#   - a0 = hartid (which CPU we are)
#   - a1 = pointer to the device tree blob
#   - pc = 0x80200000 (the load address defined in linker.ld)
#
# Your job in this file:
#   1. Reserve a boot stack in the .bss.stack section (provided below).
#   2. Set the stack pointer `sp` to the top of that stack.
#   3. Jump ("call") into `rust_main`, never to return.
#
# Pseudocode:
#       la   sp, boot_stack_top    # load address of boot stack top
#       call rust_main             # tail-call into Rust
#
# Why `.section .text.entry`?
#   - Our linker.ld places `.text.entry` FIRST inside `.text`, so that
#     `_start` sits exactly at 0x80200000 — the address OpenSBI jumps to.
#   - If you forget the section name, the linker may place `_start`
#     anywhere inside `.text` and OpenSBI will land on some random
#     compiler-generated function.

    .section .text.entry
    .globl _start
_start:
    # TODO (Lab 1): set the stack pointer to boot_stack_top
    #
    # HINT: The RISC-V pseudo-instruction to load a symbol's address is
    #           la <rd>, <symbol>
    #       which expands into `auipc` + `addi`.
    #
    # HINT: Remember the stack grows downward on RISC-V, so we point
    #       sp at the *top* (highest address) of the reserved region.

    # TODO (Lab 1): call rust_main
    #
    # HINT: `call rust_main` is a pseudo-instruction for
    #           auipc ra, %pcrel_hi(rust_main)
    #           jalr  ra, ra, %pcrel_lo(rust_main)
    #       which saves return address into ra and jumps.
    #
    # HINT: rust_main is `-> !` (noreturn), so anything after `call`
    #       is dead code. A sane defensive pattern is an infinite
    #       loop just in case.

    # --- remove the `unimp` line below once you've filled in the TODOs ---
    unimp

    # Safety net: if rust_main ever returns (it should not), spin here.
1:
    wfi
    j 1b

    # --- Boot stack. 64 KiB is plenty for Phase 0. ---
    .section .bss.stack
    .globl boot_stack_lower_bound
boot_stack_lower_bound:
    .space 4096 * 16              # 64 KiB
    .globl boot_stack_top
boot_stack_top:
