//! Stub. Students extend Phase 3's task module for Phase 4:
//!   * `TaskControlBlock` gains `memory_set: MemorySet` and
//!     `trap_cx_ppn: PhysPageNum`.
//!   * Context switch writes the new `satp` and issues `sfence.vma`.

pub fn add_initproc() { /* TODO Phase 4 integration */ }
pub fn run_first_task() -> ! { panic!("run_first_task stub"); }
