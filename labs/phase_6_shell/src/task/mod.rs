//! Task & process control. PROVIDED baseline from Phase 5 with extensions for
//! fork / exec / waitpid and a per-process file-descriptor table.
//!
//! Students extend:
//!   - [`manager`]  — ready-queue wiring, orphan reparenting
//!   - [`processor`] — schedule_yield, run_tasks loop
//!
//! Students should NOT need to edit this file directly; the `ProcessControlBlock`
//! fields and invariants are fixed so tests can pin behaviour.

use alloc::sync::{Arc, Weak};
use alloc::vec::Vec;
use alloc::string::String;
use spin::Mutex;

use crate::fs::File;
use crate::mm::MemorySet;
use crate::trap::TrapContext;

pub mod manager;
pub mod processor;
pub mod pid;
pub mod context;

pub use manager::{add_task, fetch_task, reparent_to_init, TASK_MANAGER};
pub use processor::{current_task, current_trap_cx, current_user_token, schedule, run_tasks};
pub use pid::{PidHandle, pid_alloc};
pub use context::TaskContext;

/// PROVIDED. Called once from `rust_main` — loads `/bin/init` ELF and adds it
/// to the ready queue as pid 0. In the scaffold this is a stub.
pub fn add_initproc() {}

/// PROVIDED thin wrapper around `sys_yield` used by blocking I/O paths.
pub fn suspend_current_and_run_next() {
    let _ = crate::syscall::process::sys_yield();
}

/// Runtime status of a process.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum TaskStatus {
    Ready,
    Running,
    Blocked,
    /// Waiting to be reaped by parent via `sys_waitpid`.
    Zombie,
}

/// Process Control Block. Fully fleshed for Phase 6.
/// Mutable parts are behind a single `Mutex<PCBInner>` to keep Arc clones lock-free.
pub struct ProcessControlBlock {
    pub pid: PidHandle,
    inner: Mutex<PCBInner>,
}

pub struct PCBInner {
    pub status: TaskStatus,
    pub task_cx: TaskContext,
    pub memory_set: MemorySet,
    pub trap_cx_ppn: usize,
    pub base_size: usize,
    pub parent: Option<Weak<ProcessControlBlock>>,
    pub children: Vec<Arc<ProcessControlBlock>>,
    pub exit_code: i32,
    /// Per-process fd table. Slot 0/1/2 are reserved for stdin/stdout/stderr
    /// and populated in `new()`. `None` means the slot is free.
    pub fd_table: Vec<Option<Arc<dyn File + Send + Sync>>>,
    pub cwd: String,
}

impl ProcessControlBlock {
    pub fn inner_exclusive_access(&self) -> spin::MutexGuard<'_, PCBInner> {
        self.inner.lock()
    }

    pub fn getpid(&self) -> usize {
        self.pid.0
    }

    /// Build a brand-new PCB from an ELF blob. Provided.
    /// Students do NOT modify — used as the primitive for `sys_exec`.
    pub fn new(elf_data: &[u8]) -> Arc<Self> {
        let (memory_set, user_sp, entry_point) = MemorySet::from_elf(elf_data);
        let trap_cx_ppn = memory_set.translate_trap_cx_ppn();
        let pid = pid_alloc();

        let fd_table: Vec<Option<Arc<dyn File + Send + Sync>>> = vec![
            Some(Arc::new(crate::fs::Stdin) as Arc<dyn File + Send + Sync>),
            Some(Arc::new(crate::fs::Stdout) as Arc<dyn File + Send + Sync>),
            Some(Arc::new(crate::fs::Stdout) as Arc<dyn File + Send + Sync>),
        ];

        let pcb = Arc::new(Self {
            pid,
            inner: Mutex::new(PCBInner {
                status: TaskStatus::Ready,
                task_cx: TaskContext::goto_trap_return(memory_set.kernel_stack_top()),
                memory_set,
                trap_cx_ppn,
                base_size: user_sp,
                parent: None,
                children: Vec::new(),
                exit_code: 0,
                fd_table,
                cwd: String::from("/"),
            }),
        });

        // init the trap_cx living in user space
        let mut inner = pcb.inner_exclusive_access();
        let trap_cx = inner.memory_set.trap_cx_mut();
        *trap_cx = TrapContext::app_init_context(
            entry_point,
            user_sp,
            inner.memory_set.kernel_stack_top(),
        );
        drop(inner);
        pcb
    }
}
