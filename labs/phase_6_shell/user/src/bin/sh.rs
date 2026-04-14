//! Lab 3 ⭐⭐⭐ — the shell. Reads a line, tokenizes it, builds a pipeline
//! (`cmd1 | cmd2 | cmd3`), and orchestrates fork / pipe / dup / exec / wait.
//!
//! Supports redirection: `<`, `>`, and background `&` (no job control).
//!
//! A complete reference solution fits in ~150 lines; the TODOs below break it
//! into three manageable pieces.
#![no_std] #![no_main]
extern crate alloc;
#[macro_use] extern crate user;
use alloc::{string::String, vec::Vec};
use user::*;

/// A single parsed command inside a pipeline.
pub struct Command {
    pub argv: Vec<String>,
    pub stdin_file: Option<String>,   // from `<`
    pub stdout_file: Option<String>,  // from `>`
}

/// Parse a raw line into a pipeline of commands plus a "background" flag.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Split on `|` into pipeline segments
/// 2. For each segment, split on whitespace into tokens
/// 3. If a token is `<` or `>`, the NEXT token is a filename — attach to Command
/// 4. A trailing `&` on the whole line means "run in background"
/// 5. Return `(Vec<Command>, background: bool)`
///
/// HINT: You do NOT need to handle quoting — the tests only use bare words
/// like `ls | wc -l` and `cat README.md > out.txt`.
///
/// HINT: Treat empty tokens as filler. A command with zero argv tokens is an
/// error — return an empty Vec and let the caller print a syntax message.
pub fn parse_line(_line: &str) -> (Vec<Command>, bool) {
    // TODO: Implement
    // Step 1: trim + detect trailing '&'
    // Step 2: split on '|'
    // Step 3: for each segment, scan tokens — attach <, > files
    unimplemented!("TODO: parse_line");
}

/// Execute a parsed pipeline by forking one child per command and wiring pipes.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. If `cmds.len() == 1` and no redirs → just fork+exec+wait (the easy path)
/// 2. Otherwise create `cmds.len() - 1` pipes up front
/// 3. For each command i:
///      a. fork
///      b. in the child: if i > 0, `dup` pipe[i-1].read to fd 0, close originals
///                       if i < n-1, `dup` pipe[i].write to fd 1, close originals
///                       close ALL other pipe fds before exec
///                       apply `<` / `>` redirs by open()+dup()+close()
///                       exec(argv[0])
///      c. in the parent: remember child pid
/// 4. Parent closes ALL pipe fds, then `waitpid`s each child in order
/// 5. If `background == true` → skip the wait loop
///
/// HINT: The SINGLE biggest source of hangs is forgetting to close pipe fds in
/// the parent. `wc` will block forever if ANY process still holds the write-end.
///
/// HINT: `dup` always returns the lowest free fd. To target fd 0 you must
/// `close(0)` FIRST, then `dup(pipe_read)` — the new fd will be 0.
pub fn run_pipeline(_cmds: Vec<Command>, _background: bool) {
    // TODO: Implement
    unimplemented!("TODO: run_pipeline");
}

/// REPL — read a line, parse, run. PROVIDED skeleton; completes once parse+run
/// are implemented.
fn repl() -> ! {
    let mut buf = [0u8; 256];
    loop {
        print!("$ ");
        let mut cursor = 0usize;
        loop {
            let mut ch = [0u8; 1];
            if read(0, &mut ch) <= 0 { continue; }
            if ch[0] == b'\n' { break; }
            buf[cursor] = ch[0];
            cursor += 1;
            write(1, &ch);
        }
        write(1, b"\n");
        let line = core::str::from_utf8(&buf[..cursor]).unwrap_or("");
        if line.trim().is_empty() { continue; }
        if line.trim() == "exit" { exit(0); }
        let (cmds, bg) = parse_line(line);
        if cmds.is_empty() { println!("sh: syntax error"); continue; }
        run_pipeline(cmds, bg);
    }
}

#[no_mangle]
fn main() -> i32 { repl() }
