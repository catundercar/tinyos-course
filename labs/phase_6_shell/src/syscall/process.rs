//! Process-related syscalls. Students implement fork / exec / waitpid / getpid here.
//!
//! These three primitives are the final glue between the kernel and user-land;
//! every command the shell runs eventually flows through this file.

use alloc::sync::Arc;
use alloc::string::String;

use crate::fs::open_file;
use crate::mm::{translated_ref, translated_refmut, translated_str};
use crate::task::{
    add_task, current_task, current_user_token, reparent_to_init, schedule, TaskStatus,
};
use crate::trap::trap_return;

/// `sys_getpid` — trivial, provided as a warm-up.
pub fn sys_getpid() -> isize {
    current_task().unwrap().getpid() as isize
}

/// `sys_fork` — duplicate the current process.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Take `current_task()`; deep-clone its `memory_set` via `MemorySet::from_existing_user`
/// 2. Allocate a fresh pid and kernel stack; build a new `ProcessControlBlock`
/// 3. Child's fd_table is a `Vec` of `Arc::clone` of every Some slot (share refs!)
/// 4. Set child trap_cx.x[10] (a0) = 0 so `fork` returns 0 in the child
/// 5. Hook parent/child: parent.children.push(child.clone()); child.parent = Weak(parent)
/// 6. `add_task(child.clone())`; return child's pid to the parent
///
/// HINT: The "a0 = 0 in child" trick makes fork return twice from a single syscall —
/// parent gets the child pid, child gets 0.
///
/// HINT: The kernel stack of the child must be freshly allocated, but the user page
/// tables are a COPY (same virtual layout, different physical frames).
pub fn sys_fork() -> isize {
    // TODO: Implement
    // Step 1: let parent = current_task().unwrap();
    // Step 2: let child = parent.fork();            // helper on PCB you may add
    // Step 3: let child_trap_cx = child.inner.memory_set.trap_cx_mut();
    // Step 4: child_trap_cx.x[10] = 0;
    // Step 5: add_task(child.clone());
    // Step 6: return child.getpid() as isize;
    unimplemented!("TODO: sys_fork");
}

/// `sys_exec` — replace the current address space with a new program.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Read NUL-terminated `path` out of user space via `translated_str`
/// 2. Open the file from the root FS; return -1 if not found
/// 3. Read ELF into a `Vec<u8>`
/// 4. Call `task.exec(&elf_data)` which swaps `memory_set` in place
/// 5. Return 0 (but note: the trap frame was rewritten, so a0 will be whatever
///    the new program's `_start` expects)
///
/// HINT: Do NOT allocate a new pid. exec keeps the pid, parent links, and fd_table.
///
/// HINT: After exec, trap_return will pop registers from the NEW trap_cx that lives
/// in the NEW memory_set. The old memory_set is already dropped — do not touch it.
pub fn sys_exec(_path: *const u8) -> isize {
    // TODO: Implement
    // Step 1: let token = current_user_token();
    // Step 2: let path = translated_str(token, path);
    // Step 3: let file = open_file(&path, OpenFlags::RDONLY).ok_or(-1)?;
    // Step 4: let elf = file.read_all();
    // Step 5: current_task().unwrap().exec(&elf);
    // Step 6: 0
    unimplemented!("TODO: sys_exec");
}

/// `sys_waitpid` — reap a zombie child and read out its exit code.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. If `pid == -1` wait for ANY child; else wait for the child with exactly that pid
/// 2. If no matching child exists at all → return -1
/// 3. If a matching child exists but none is Zombie yet → return -2 (try again)
/// 4. If a Zombie child is found:
///    a. remove it from `current.children` (dropping the last Arc frees its kernel stack)
///    b. write `child.exit_code` into `*exit_code_ptr` using `translated_refmut`
///    c. return the child's pid
///
/// HINT: The user-shell retries on -2 via a `yield` loop; do not block here.
///
/// HINT: Hold the current-task lock only while scanning; release it before writing
/// to user memory to avoid re-entering the allocator under the lock.
pub fn sys_waitpid(_pid: isize, _exit_code_ptr: *mut i32) -> isize {
    // TODO: Implement
    // Step 1: let task = current_task().unwrap();
    // Step 2: let mut inner = task.inner_exclusive_access();
    // Step 3: scan inner.children; if no match → -1
    // Step 4: find zombie matching pid; if none → -2
    // Step 5: remove and read exit_code; write back via translated_refmut
    unimplemented!("TODO: sys_waitpid");
}

/// `sys_exit` — terminate current task and wake parent. PROVIDED.
pub fn sys_exit(exit_code: i32) -> ! {
    let task = current_task().unwrap();
    {
        let mut inner = task.inner_exclusive_access();
        inner.status = TaskStatus::Zombie;
        inner.exit_code = exit_code;
        // close all fds
        for slot in inner.fd_table.iter_mut() { slot.take(); }
    }
    reparent_to_init(&task);
    // last task context switch — we never come back
    let mut unused_cx = crate::task::TaskContext::default();
    schedule(&mut unused_cx as *mut _);
    unreachable!()
}

/// `sys_yield` — voluntarily give up the CPU. PROVIDED.
pub fn sys_yield() -> isize {
    let task = current_task().unwrap();
    let cx_ptr = {
        let mut inner = task.inner_exclusive_access();
        inner.status = TaskStatus::Ready;
        &mut inner.task_cx as *mut _
    };
    schedule(cx_ptr);
    0
}
