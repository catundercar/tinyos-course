//! `wc [-l|-w|-c]` — count lines / words / bytes from stdin. Lab 3.
//!
//! TODO: Implement
//!
//! Requirements:
//! 1. Read stdin in 512-byte chunks until EOF (read returns 0)
//! 2. Count newlines, whitespace-separated words, total bytes
//! 3. Print "lines words bytes" (or just the counter matching the flag)
//!
//! HINT: Whitespace state machine: set `in_word` when you see non-space, clear
//! on space; increment `words` on the 0→1 transition.
//!
//! HINT: `wc` is the canonical pipe sink — once `ls | wc -l` works, you're done.
#![no_std] #![no_main]
#[macro_use] extern crate user;
#[no_mangle] fn main() -> i32 { unimplemented!("TODO: wc") }
