//! Stdin / Stdout bound to the UART. PROVIDED.
use super::File;
use crate::drivers::uart;
use crate::mm::UserBuffer;
use crate::task::suspend_current_and_run_next;

pub struct Stdin;
pub struct Stdout;

impl File for Stdin {
    fn readable(&self) -> bool { true }
    fn writable(&self) -> bool { false }
    fn read(&self, mut buf: UserBuffer) -> usize {
        assert_eq!(buf.len(), 1, "Only support len = 1 in sys_read for Stdin");
        loop {
            if let Some(c) = uart::poll_in() {
                unsafe { buf.buffers[0].as_mut_ptr().write_volatile(c); }
                return 1;
            } else {
                suspend_current_and_run_next();
            }
        }
    }
    fn write(&self, _: UserBuffer) -> usize { panic!("Cannot write to stdin"); }
}

impl File for Stdout {
    fn readable(&self) -> bool { false }
    fn writable(&self) -> bool { true }
    fn read(&self, _: UserBuffer) -> usize { panic!("Cannot read from stdout"); }
    fn write(&self, buf: UserBuffer) -> usize {
        for slice in buf.buffers.iter() {
            for &b in slice.iter() { uart::putc(b); }
        }
        buf.len()
    }
}
