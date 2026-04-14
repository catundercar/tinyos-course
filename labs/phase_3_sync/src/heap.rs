//! Kernel heap bootstrap. PROVIDED — do not modify.
//!
//! Uses a static 1 MiB buffer + `linked_list_allocator::LockedHeap`. In a
//! real port you'd replace the third-party crate; here we stub out a trivial
//! bump allocator so `alloc::Vec`/`alloc::sync::Arc` are available to the
//! sync primitives.

use core::alloc::{GlobalAlloc, Layout};
use core::cell::UnsafeCell;
use core::sync::atomic::{AtomicUsize, Ordering};

const HEAP_SIZE: usize = 1 << 20; // 1 MiB

struct BumpHeap {
    buf: UnsafeCell<[u8; HEAP_SIZE]>,
    next: AtomicUsize,
}

unsafe impl Sync for BumpHeap {}

unsafe impl GlobalAlloc for BumpHeap {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let base = self.buf.get() as usize;
        let mut off = self.next.load(Ordering::Relaxed);
        loop {
            let aligned = (base + off + layout.align() - 1) & !(layout.align() - 1);
            let new_off = aligned - base + layout.size();
            if new_off > HEAP_SIZE {
                return core::ptr::null_mut();
            }
            match self.next.compare_exchange(
                off,
                new_off,
                Ordering::SeqCst,
                Ordering::Relaxed,
            ) {
                Ok(_) => return aligned as *mut u8,
                Err(actual) => off = actual,
            }
        }
    }
    unsafe fn dealloc(&self, _p: *mut u8, _l: Layout) {
        // bump allocator; leaks are OK for a teaching kernel
    }
}

#[global_allocator]
static HEAP: BumpHeap = BumpHeap {
    buf: UnsafeCell::new([0; HEAP_SIZE]),
    next: AtomicUsize::new(0),
};

pub fn init() {
    // The allocator is statically initialized; nothing to do. Kept as a hook
    // for future paging-aware heap setups in Phase 4.
}
