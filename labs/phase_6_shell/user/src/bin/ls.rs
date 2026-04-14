//! `ls [path]` — list directory entries. Lab 3 student code.
//!
//! TODO: Implement
//!
//! Requirements:
//! 1. If no argv → list `/`
//! 2. Open the directory, iterate entries, print one per line
//! 3. Sort alphabetically (simple bubble sort is fine)
//!
//! HINT: easy-fs exposes `Inode::ls()` returning `Vec<String>`.
//!
//! HINT: Use `println!` — it already routes to fd 1, which the shell will
//! redirect to a pipe or file when needed.
#![no_std] #![no_main]
#[macro_use] extern crate user;

#[no_mangle]
fn main() -> i32 {
    // TODO: Implement `ls`
    // Step 1: determine path (default "/")
    // Step 2: open + iterate
    // Step 3: sort, print one per line
    unimplemented!("TODO: ls")
}
