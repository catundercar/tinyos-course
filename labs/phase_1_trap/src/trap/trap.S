# LAB 2 · ⭐⭐⭐ — __alltraps and __restore
#
# This file contains TWO labelled assembly routines the CPU will jump to:
#
#   __alltraps  — installed in stvec; runs when any trap lands in S-mode.
#                 Saves 34 registers into a TrapContext on the kernel stack,
#                 then tail-calls `trap_handler(ctx: &mut TrapContext)`.
#
#   __restore   — called with a0 = &TrapContext; pops 34 regs back and
#                 executes `sret` to return to U-mode.
#
# The magic trick you must understand first:
#
#   csrrw sp, sscratch, sp
#
# This atomically swaps `sp` with `sscratch`. Before the trap, the kernel
# stored the kernel stack top in `sscratch` and the user is running with
# user-sp in `sp`. After the swap: sp = kernel stack, sscratch = user sp.
# We can now push the user context safely onto the kernel stack.
#
# On __restore we do the same swap in reverse so we leave with sp = user sp
# and sscratch = kernel-stack-top (ready for the next trap).
#
#
# TrapContext layout on the kernel stack (from low to high address):
#
#     offset   field          how saved
#     ------   -----------    --------------------------------
#       0      x0 (always 0)  (skipped)
#       8      x1 ra          sd x1, 1*8(sp)
#      16      x2 sp          (user sp; from sscratch)
#      24      x3 gp          sd x3, 3*8(sp)
#      ...
#     31*8     x31            sd x31, 31*8(sp)
#     32*8     sstatus        csrr t0, sstatus ; sd t0, 32*8(sp)
#     33*8     sepc           csrr t1, sepc    ; sd t1, 33*8(sp)
#     total: 34 * 8 = 272 bytes

.altmacro
.macro SAVE_GP n
    sd x\n, \n*8(sp)
.endm
.macro LOAD_GP n
    ld x\n, \n*8(sp)
.endm

    .section .text
    .globl __alltraps
    .globl __restore
    .align 2

__alltraps:
    # TODO (Lab 2): save user context, switch stacks, call trap_handler
    #
    # Pseudocode:
    #   1. csrrw sp, sscratch, sp          # sp ← kernel_sp, sscratch ← user_sp
    #   2. addi  sp, sp, -34*8             # allocate TrapContext
    #   3. sd x1, 1*8(sp)                  # save ra
    #   4. sd x3, 3*8(sp)                  # save gp (skip x0, x2, x4)
    #   5. .set n, 5 ; .rept 27 ; SAVE_GP %n ; .set n, n+1 ; .endr   # x5..x31
    #   6. csrr t0, sstatus ; sd t0, 32*8(sp)
    #   7. csrr t1, sepc    ; sd t1, 33*8(sp)
    #   8. csrr t2, sscratch ; sd t2, 2*8(sp)    # save the original (user) sp
    #   9. mv a0, sp                       # first arg = &TrapContext
    #  10. call trap_handler
    #  11. fall through into __restore (a0 still points at the ctx)

    # TODO: replace the trap sentinel below with your implementation.
    unimp

__restore:
    # TODO (Lab 2): restore context and sret back to U-mode
    #
    # On entry: a0 = address of TrapContext on the kernel stack.
    #
    # Pseudocode:
    #   1. mv sp, a0                         # switch to the ctx frame
    #   2. ld t0, 32*8(sp) ; csrw sstatus, t0
    #   3. ld t1, 33*8(sp) ; csrw sepc,    t1
    #   4. ld t2, 2*8(sp)  ; csrw sscratch, t2   # stash user sp for next trap
    #   5. ld x1, 1*8(sp)
    #   6. ld x3, 3*8(sp)
    #   7. .set n, 5 ; .rept 27 ; LOAD_GP %n ; .set n, n+1 ; .endr
    #   8. addi sp, sp, 34*8                # pop TrapContext
    #   9. csrrw sp, sscratch, sp           # swap back → sp = user sp
    #  10. sret                              # CPU jumps to sepc in U-mode

    # TODO: replace the sentinel below with your implementation.
    unimp
