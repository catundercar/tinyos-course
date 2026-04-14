//! syscall/fs.rs — PROVIDED. Stdout-only sys_write (no VFS yet; that's Phase 5).

const FD_STDOUT: usize = 1;

pub fn sys_write(fd: usize, buf: *const u8, len: usize) -> isize {
    match fd {
        FD_STDOUT => {
            let slice = unsafe { core::slice::from_raw_parts(buf, len) };
            let s = core::str::from_utf8(slice).unwrap_or("<invalid utf8>");
            crate::print!("{}", s);
            len as isize
        }
        _ => -1,
    }
}
