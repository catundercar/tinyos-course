//! Pipes with a 2048-byte ring buffer. The write-end and read-end each keep a
//! `Weak<Pipe>` to the opposite side so that when the last Arc on one end drops,
//! the other end observes EOF.
//!
//! This is the heart of Lab 2. Students implement the three methods marked TODO.

use alloc::sync::{Arc, Weak};
use spin::Mutex;

use super::File;
use crate::mm::UserBuffer;
use crate::task::suspend_current_and_run_next;

const RING_BUFFER_SIZE: usize = 2048;

#[derive(Copy, Clone, PartialEq)]
enum RingBufferStatus { Full, Empty, Normal }

pub struct PipeRingBuffer {
    arr: [u8; RING_BUFFER_SIZE],
    head: usize,
    tail: usize,
    status: RingBufferStatus,
    /// Weak ref to the WRITE-end. If it upgrades to `None`, no one can ever
    /// write to us again → readers should return 0 (EOF).
    write_end: Option<Weak<Pipe>>,
}

impl PipeRingBuffer {
    pub fn new() -> Self {
        Self {
            arr: [0; RING_BUFFER_SIZE],
            head: 0,
            tail: 0,
            status: RingBufferStatus::Empty,
            write_end: None,
        }
    }
    pub fn set_write_end(&mut self, write_end: &Arc<Pipe>) {
        self.write_end = Some(Arc::downgrade(write_end));
    }
    pub fn write_byte(&mut self, b: u8) {
        self.status = RingBufferStatus::Normal;
        self.arr[self.tail] = b;
        self.tail = (self.tail + 1) % RING_BUFFER_SIZE;
        if self.tail == self.head { self.status = RingBufferStatus::Full; }
    }
    pub fn read_byte(&mut self) -> u8 {
        self.status = RingBufferStatus::Normal;
        let b = self.arr[self.head];
        self.head = (self.head + 1) % RING_BUFFER_SIZE;
        if self.head == self.tail { self.status = RingBufferStatus::Empty; }
        b
    }
    pub fn available_read(&self) -> usize {
        if self.status == RingBufferStatus::Empty { 0 }
        else if self.tail > self.head { self.tail - self.head }
        else { RING_BUFFER_SIZE - self.head + self.tail }
    }
    pub fn available_write(&self) -> usize {
        if self.status == RingBufferStatus::Full { 0 }
        else { RING_BUFFER_SIZE - self.available_read() }
    }
    pub fn all_write_ends_closed(&self) -> bool {
        self.write_end.as_ref().unwrap().upgrade().is_none()
    }
}

pub struct Pipe {
    readable: bool,
    writable: bool,
    buffer: Arc<Mutex<PipeRingBuffer>>,
}

impl Pipe {
    pub fn read_end_with_buffer(buffer: Arc<Mutex<PipeRingBuffer>>) -> Self {
        Self { readable: true, writable: false, buffer }
    }
    pub fn write_end_with_buffer(buffer: Arc<Mutex<PipeRingBuffer>>) -> Self {
        Self { readable: false, writable: true, buffer }
    }
}

/// Factory. PROVIDED — builds the two matched ends and wires the Weak back-ref.
pub fn make_pipe() -> (Arc<Pipe>, Arc<Pipe>) {
    let buffer = Arc::new(Mutex::new(PipeRingBuffer::new()));
    let read_end  = Arc::new(Pipe::read_end_with_buffer(buffer.clone()));
    let write_end = Arc::new(Pipe::write_end_with_buffer(buffer.clone()));
    buffer.lock().set_write_end(&write_end);
    (read_end, write_end)
}

impl File for Pipe {
    fn readable(&self) -> bool { self.readable }
    fn writable(&self) -> bool { self.writable }

    /// Blocking read — copy up to `buf.len()` bytes out of the ring.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Loop over the user buffer slice-by-slice
    /// 2. Lock the ring; if `available_read() == 0`:
    ///    a. if `all_write_ends_closed()` → return bytes copied so far (EOF, maybe 0)
    ///    b. else drop the lock and `suspend_current_and_run_next()`, then retry
    /// 3. Otherwise consume one byte per user slot via `read_byte()`
    /// 4. Return total bytes read
    ///
    /// HINT: Always drop the Mutex guard before yielding, or the writer will
    /// deadlock trying to wake you up.
    ///
    /// HINT: The `UserBuffer` iterator yields `&mut [u8]` slices across page
    /// boundaries — iterate carefully and track how many bytes you have consumed.
    fn read(&self, _buf: UserBuffer) -> usize {
        assert!(self.readable);
        // TODO: Implement
        // Step 1: let mut bytes_read = 0;
        // Step 2: loop over buf.into_iter() borrowing each &mut u8 slot
        // Step 3: inside loop — lock, check, maybe suspend, else read_byte
        // Step 4: break when user slice exhausted OR EOF observed
        unimplemented!("TODO: Pipe::read");
    }

    /// Blocking write — copy all bytes from `buf` into the ring.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Loop over user slots
    /// 2. If `available_write() == 0` → drop lock, yield, retry
    /// 3. Else call `write_byte()` for each user byte
    /// 4. Return total bytes written
    ///
    /// HINT: Unlike read, write must deliver EVERY byte — there is no "EOF on
    /// write". If all readers closed, the producer should still eventually exit
    /// via a broken-pipe signal — but we skip signals in this course, so just
    /// keep looping. (Usertests do not exercise broken-pipe.)
    fn write(&self, _buf: UserBuffer) -> usize {
        assert!(self.writable);
        // TODO: Implement
        unimplemented!("TODO: Pipe::write");
    }
}
