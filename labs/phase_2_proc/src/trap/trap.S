    # trap.S — PROVIDED. User↔kernel TrapContext save/restore.
    # Same layout as Phase 1. The scheduler sits on top of this: a timer
    # interrupt enters __alltraps, trap_handler() may call __switch, which
    # returns through a *different* task's kernel stack → its own __restore.

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
    csrrw sp, sscratch, sp      # sp <-> sscratch: now sp = kernel stack top
    addi sp, sp, -34*8          # reserve TrapContext
    sd x1, 1*8(sp)
    sd x3, 3*8(sp)
    .set n, 5
    .rept 27
        SAVE_GP %n
        .set n, n+1
    .endr
    csrr t0, sstatus
    csrr t1, sepc
    sd t0, 32*8(sp)
    sd t1, 33*8(sp)
    csrr t2, sscratch           # t2 = user sp
    sd t2, 2*8(sp)
    mv a0, sp                   # a0 = &TrapContext
    call trap_handler

__restore:
    mv sp, a0                   # a0 = &TrapContext on *this* task's kstack
    ld t0, 32*8(sp)
    ld t1, 33*8(sp)
    ld t2, 2*8(sp)
    csrw sstatus, t0
    csrw sepc, t1
    csrw sscratch, t2
    ld x1, 1*8(sp)
    ld x3, 3*8(sp)
    .set n, 5
    .rept 27
        LOAD_GP %n
        .set n, n+1
    .endr
    addi sp, sp, 34*8
    csrrw sp, sscratch, sp
    sret
