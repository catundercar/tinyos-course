//! Lab 1 host-side tests. Pure logic — runs with `cargo test --target $HOST`.
//!
//! We exercise the `StackFrameAllocator` directly by giving it a fake
//! [l, r) range. Because `alloc()` only returns PPNs (no real memory
//! dereferenced) we can test it off-target.

use phase_4_vm::mm::address::PhysPageNum;
use phase_4_vm::mm::frame_allocator::{FrameAllocator, StackFrameAllocator};

#[test]
fn alloc_from_empty_returns_none() {
    let a = StackFrameAllocator::new();
    let mut a = a;
    assert!(a.alloc().is_none());
}

#[test]
fn alloc_bumps_from_current() {
    let mut a = StackFrameAllocator::new();
    a.init(PhysPageNum(10), PhysPageNum(13));
    assert_eq!(a.alloc().unwrap().0, 10);
    assert_eq!(a.alloc().unwrap().0, 11);
    assert_eq!(a.alloc().unwrap().0, 12);
    assert!(a.alloc().is_none(), "allocator should exhaust at `end`");
}

#[test]
fn dealloc_then_alloc_reuses_recycled_ppn() {
    let mut a = StackFrameAllocator::new();
    a.init(PhysPageNum(100), PhysPageNum(110));
    let p0 = a.alloc().unwrap();
    let p1 = a.alloc().unwrap();
    a.dealloc(p0);
    let p2 = a.alloc().unwrap();
    assert_eq!(p0.0, p2.0, "recycled frames must be reused LIFO");
    assert_ne!(p1.0, p2.0);
}

#[test]
#[should_panic]
fn double_free_panics() {
    let mut a = StackFrameAllocator::new();
    a.init(PhysPageNum(0), PhysPageNum(4));
    let p = a.alloc().unwrap();
    a.dealloc(p);
    a.dealloc(p);   // boom
}
