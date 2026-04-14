//! Memory-management subsystem root. PROVIDED (baseline copied from Phase 4).
//!
//! ⚠️ BEFORE YOU START PHASE 5: this directory is an exact copy of the
//! Phase 4 `src/mm/` scaffold — `address.rs` is complete, but
//! `frame_allocator.rs`, `page_table.rs`, and `memory_set.rs` still
//! contain the same student TODOs you solved in Phase 4. Paste your
//! working Phase 4 solutions into those three files (or copy them
//! over verbatim) before attempting any Phase 5 lab. The FS relies
//! on a functioning VM subsystem underneath.
//!
//! `init()` is called exactly once, early in kernel boot, and performs:
//!   1. `frame_allocator::init_frame_allocator()` — hand the free physical
//!      frames between `ekernel` and `MEMORY_END` to the stack allocator.
//!   2. `KERNEL_SPACE.activate()`   — build the kernel MemorySet (identity
//!      map of kernel sections + physical memory + MMIO) and write its root
//!      PPN into `satp`, then flush the TLB.
//!
//! Students do NOT need to modify this file — but make sure the functions it
//! calls (`frame_alloc`, `PageTable::new`, `MemorySet::new_kernel`, …) are
//! implemented correctly.

pub mod address;
pub mod frame_allocator;
pub mod memory_set;
pub mod page_table;

pub use address::{PhysAddr, PhysPageNum, VirtAddr, VirtPageNum, StepByOne, VPNRange};
pub use frame_allocator::{frame_alloc, frame_dealloc, FrameTracker};
pub use memory_set::{MapArea, MapPermission, MapType, MemorySet, KERNEL_SPACE};
pub use page_table::{translated_byte_buffer, translated_str, PageTable, PageTableEntry, PTEFlags};

pub fn init() {
    frame_allocator::init_frame_allocator();
    KERNEL_SPACE.lock().activate();
}
