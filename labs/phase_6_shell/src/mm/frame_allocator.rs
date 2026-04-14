//! Lab 1 ⭐⭐ — Physical frame allocator.
//!
//! We manage the region `[ekernel, MEMORY_END)` as 4 KiB physical frames.
//! The kernel hands out one frame at a time via `frame_alloc()` and reclaims
//! them either through an explicit `frame_dealloc()` or (preferably) through
//! the `FrameTracker` RAII wrapper whose `Drop` impl calls `frame_dealloc`.
//!
//! You will implement:
//!   * `StackFrameAllocator` — a simple "bump + recycled Vec" allocator.
//!   * `FrameTracker::new`  — initialise & zero-fill a freshly allocated
//!     frame.
//!
//! The `init_frame_allocator()`, `frame_alloc()`, `frame_dealloc()` wrappers
//! and the `FRAME_ALLOCATOR` global are PROVIDED.

extern crate alloc;
use alloc::vec::Vec;
use lazy_static::lazy_static;
use spin::Mutex;

use super::address::{PhysAddr, PhysPageNum};
use crate::config::MEMORY_END;

pub trait FrameAllocator {
    fn new() -> Self;
    fn alloc(&mut self) -> Option<PhysPageNum>;
    fn dealloc(&mut self, ppn: PhysPageNum);
}

/// Stack-based frame allocator.
///
/// Layout:
///
///   |---- recycled (stack, most recently freed on top) ----|
///   |-------- current ... end (never-yet-allocated) -------|
///
/// * `alloc()` pops from `recycled` if non-empty, otherwise bumps `current`.
/// * `dealloc()` pushes onto `recycled` after a sanity check.
pub struct StackFrameAllocator {
    pub current: usize,
    pub end: usize,
    pub recycled: Vec<usize>,
}

impl StackFrameAllocator {
    pub fn init(&mut self, l: PhysPageNum, r: PhysPageNum) {
        self.current = l.0;
        self.end = r.0;
    }
}

impl FrameAllocator for StackFrameAllocator {
    fn new() -> Self { Self { current: 0, end: 0, recycled: Vec::new() } }

    /// Allocate a single frame.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. If `recycled` is non-empty, pop and return its top as `PhysPageNum`.
    /// 2. Otherwise, if `current < end`, return `current` as `PhysPageNum`
    ///    and advance `current` by one.
    /// 3. If no frames remain, return `None`.
    ///
    /// HINT: `PhysPageNum(x)` — plain tuple-struct ctor works.
    ///
    /// HINT: Do NOT zero the frame here; that is `FrameTracker::new`'s job.
    fn alloc(&mut self) -> Option<PhysPageNum> {
        // TODO: Implement
        // Step 1: pop from self.recycled if available
        // Step 2: else compare self.current vs self.end, bump and return
        // Step 3: else return None
        unimplemented!("Lab 1: StackFrameAllocator::alloc")
    }

    /// Free a previously allocated frame.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Reject double-free: `ppn.0` must be < `current` AND not already
    ///    in `recycled`. Panic on violation (use `panic!`).
    /// 2. Push `ppn.0` onto `recycled`.
    ///
    /// HINT: `self.recycled.iter().any(|&p| p == ppn.0)` catches
    ///       double-frees in debug builds; keep it even if slow.
    fn dealloc(&mut self, ppn: PhysPageNum) {
        // TODO: Implement
        // Step 1: sanity-check (not already in recycled, and < current)
        // Step 2: push onto recycled
        unimplemented!("Lab 1: StackFrameAllocator::dealloc")
    }
}

lazy_static! {
    pub static ref FRAME_ALLOCATOR: Mutex<StackFrameAllocator> =
        Mutex::new(StackFrameAllocator::new());
}

/// PROVIDED. Called once during `mm::init`.
pub fn init_frame_allocator() {
    extern "C" { fn ekernel(); }
    FRAME_ALLOCATOR.lock().init(
        PhysAddr::from(ekernel as usize).ceil(),
        PhysAddr::from(MEMORY_END).floor(),
    );
}

/// PROVIDED.
pub fn frame_alloc() -> Option<FrameTracker> {
    FRAME_ALLOCATOR.lock().alloc().map(FrameTracker::new)
}
/// PROVIDED.
pub fn frame_dealloc(ppn: PhysPageNum) { FRAME_ALLOCATOR.lock().dealloc(ppn); }

/// RAII wrapper around a single physical frame.
///
/// As soon as the `FrameTracker` goes out of scope, its `Drop` impl (below)
/// calls `frame_dealloc`, so forgetting to free a frame becomes impossible
/// as long as the tracker is reachable.
pub struct FrameTracker { pub ppn: PhysPageNum }

impl FrameTracker {
    /// Construct a tracker around a just-allocated frame.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Zero-fill the 4 KiB frame (use `ppn.get_bytes_array()`).
    /// 2. Return `Self { ppn }`.
    ///
    /// HINT: Uninitialised frames may contain stale kernel data from a
    ///       previous owner — never skip the zero-fill.
    pub fn new(ppn: PhysPageNum) -> Self {
        // TODO: Implement
        // Step 1: `for b in ppn.get_bytes_array() { *b = 0 }`
        // Step 2: build the tracker struct
        unimplemented!("Lab 1: FrameTracker::new")
    }
}

impl Drop for FrameTracker {
    fn drop(&mut self) { frame_dealloc(self.ppn); }
}

impl core::fmt::Debug for FrameTracker {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "FrameTracker:PPN={:#x}", self.ppn.0)
    }
}
