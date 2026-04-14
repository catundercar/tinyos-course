//! PROVIDED — Phase 2 baseline shim.
pub fn run_first_task() -> ! {
    crate::println!("[kernel] no tasks; halting");
    crate::sbi::shutdown(false)
}

pub fn current_user_token() -> usize { 0 }
