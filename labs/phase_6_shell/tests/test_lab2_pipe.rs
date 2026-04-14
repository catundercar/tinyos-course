//! Lab 2 — pipes & fd table

#[test]
fn pipe_returns_two_distinct_fds() {
    // sys_pipe(&mut [fd1, fd2]) — both fds valid, fd1 < fd2, fd1 readable,
    // fd2 writable.
}

#[test]
fn pipe_write_then_read_preserves_bytes() {
    // Round-trip 1..=100 bytes through a pipe, byte-for-byte.
}

#[test]
fn pipe_read_blocks_until_write() {
    // Reader should yield via suspend_current_and_run_next until bytes arrive.
}

#[test]
fn pipe_read_sees_eof_when_write_ends_drop() {
    // When the last Arc<Pipe> (write-end) is dropped, reader gets 0.
}

#[test]
fn pipe_ring_wraps_around() {
    // Write 1500 bytes, read 1500 bytes, write 1500 more — head/tail must wrap
    // correctly (RING_BUFFER_SIZE = 2048).
}

#[test]
fn dup_clones_arc_same_underlying_file() {
    // After dup, writing to either fd shows up in both read orderings.
}

#[test]
fn close_frees_slot_for_reuse() {
    // Closing fd N makes the slot available for the next dup/pipe.
}
