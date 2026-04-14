//! test_lab2_scheduler.rs — Host-side tests for Lab 2 (Round-Robin logic).
//!
//! We model the TaskManager's picking logic in plain Rust — no qemu, no asm —
//! and verify the student's algorithm via a shim. A passing run here is
//! necessary but not sufficient: the full end-to-end is graded by
//! `scripts/grade.py`.

#[derive(Copy, Clone, PartialEq, Eq, Debug)]
enum Status { Ready, Running, Exited }

fn find_next(tasks: &[Status], current: usize) -> Option<usize> {
    let n = tasks.len();
    for off in 1..=n {
        let i = (current + off) % n;
        if tasks[i] == Status::Ready { return Some(i); }
    }
    None
}

#[test]
fn wraps_around_to_zero() {
    let t = [Status::Ready, Status::Ready, Status::Ready];
    assert_eq!(find_next(&t, 2), Some(0));
}

#[test]
fn skips_exited_tasks() {
    let t = [Status::Running, Status::Exited, Status::Ready];
    assert_eq!(find_next(&t, 0), Some(2));
}

#[test]
fn returns_none_when_everyone_exited() {
    let t = [Status::Exited, Status::Exited, Status::Exited];
    assert_eq!(find_next(&t, 1), None);
}

#[test]
fn picks_next_in_round_robin_order() {
    let t = [Status::Running, Status::Ready, Status::Ready, Status::Ready];
    assert_eq!(find_next(&t, 0), Some(1));
    assert_eq!(find_next(&t, 1), Some(2));
    assert_eq!(find_next(&t, 2), Some(3));
}
