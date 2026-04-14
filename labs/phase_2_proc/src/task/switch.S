    # switch.S — STUDENT (Lab 1 ⭐⭐).
    #
    # fn __switch(current_task_cx_ptr: *mut TaskContext,
    #             next_task_cx_ptr:    *const TaskContext);
    #
    # a0 = &mut current (where to SAVE our registers)
    # a1 = &    next    (where to LOAD the next task's registers from)
    #
    # TaskContext layout (14×8 bytes = 112 bytes):
    #   offset 0   : ra
    #   offset 8   : sp
    #   offset 16  : s0
    #   offset 24  : s1
    #     ...
    #   offset 104 : s11
    #
    # Essence: swap (ra, sp, s0..s11) between memory at *a0 and *a1.
    # After the last `ret`, the CPU is executing in the "next" task's context.

    .section .text
    .globl __switch
__switch:
    # TODO(Lab 1): save current task's callee-saved state into *a0
    #   Step 1: sd ra,  0*8(a0)
    #   Step 2: sd sp,  1*8(a0)
    #   Step 3: sd s0, 2*8(a0) ... sd s11, 13*8(a0)   (12 stores)
    #
    # TODO(Lab 1): load next task's state from *a1
    #   Step 4: ld ra,  0*8(a1)
    #   Step 5: ld sp,  1*8(a1)
    #   Step 6: ld s0, 2*8(a1) ... ld s11, 13*8(a1)
    #
    # TODO(Lab 1): ret
    #   The `ret` below uses the newly-loaded `ra` and runs on the new `sp`,
    #   so execution resumes in the next task right after IT last called __switch
    #   (or at __restore for a brand-new task).

    # ────────────────────────────────────────────────────────────────────
    # REMOVE the following `ret` and replace with the 27 instructions above.
    # (14 stores to *a0, 14 loads from *a1, 1 ret.)
    ret
