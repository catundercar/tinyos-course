//! Trap-handling facade. PROVIDED.
#[repr(C)]
#[derive(Clone, Copy, Default)]
pub struct TrapContext {
    pub x: [usize; 32],
    pub sstatus: usize,
    pub sepc: usize,
    pub kernel_sp: usize,
}

impl TrapContext {
    pub fn app_init_context(entry: usize, sp: usize, ksp: usize) -> Self {
        let mut cx = Self::default();
        cx.x[2] = sp;
        cx.sepc = entry;
        cx.kernel_sp = ksp;
        cx
    }
}

pub fn init() {}
pub fn trap_return() {}
