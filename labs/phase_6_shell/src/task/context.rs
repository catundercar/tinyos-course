//! Kernel-side task context used by the scheduler's `__switch` trampoline. PROVIDED.
#[repr(C)]
#[derive(Copy, Clone, Default)]
pub struct TaskContext {
    pub ra: usize,
    pub sp: usize,
    pub s: [usize; 12],
}

impl TaskContext {
    pub fn goto_trap_return(kstack_top: usize) -> Self {
        extern "C" { fn __restore(); }
        Self { ra: __restore as usize, sp: kstack_top, s: [0; 12] }
    }
}
