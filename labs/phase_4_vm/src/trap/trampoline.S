    # PROVIDED. Placed in .text.trampoline so the linker script can page-align
    # and the mm subsystem can map it at VA = TRAMPOLINE.
    .section .text.trampoline
    .globl __alltraps
    .globl __restore
    .align 2
__alltraps:
    # save caller regs into *TRAP_CONTEXT (sscratch swap), switch to kernel
    # satp (kept in trap_ctx), jump to trap_handler.
    #
    # Students: this file is provided as a stub illustrating WHERE the
    # mechanism lives. The full assembly is in rCore ch4 — paste it here
    # when wiring up Phase 4 Integration.
    j  __alltraps            # infinite-loop placeholder
__restore:
    j  __restore
