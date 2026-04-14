//! PID allocator. PROVIDED.
use alloc::vec::Vec;
use spin::Mutex;
use lazy_static::lazy_static;

pub struct PidAllocator {
    current: usize,
    recycled: Vec<usize>,
}

impl PidAllocator {
    pub const fn new() -> Self { Self { current: 0, recycled: Vec::new() } }
    pub fn alloc(&mut self) -> PidHandle {
        if let Some(p) = self.recycled.pop() { PidHandle(p) }
        else { self.current += 1; PidHandle(self.current - 1) }
    }
    pub fn dealloc(&mut self, pid: usize) { self.recycled.push(pid); }
}

lazy_static! {
    static ref PID_ALLOCATOR: Mutex<PidAllocator> = Mutex::new(PidAllocator::new());
}

pub struct PidHandle(pub usize);

impl Drop for PidHandle {
    fn drop(&mut self) { PID_ALLOCATOR.lock().dealloc(self.0); }
}

pub fn pid_alloc() -> PidHandle { PID_ALLOCATOR.lock().alloc() }
