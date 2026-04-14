//! Lab 2 host-side tests. These poke the PTE bit layout directly — walking
//! multi-level tables requires real memory and is covered by the on-target
//! integration test in Phase 4.6.

use phase_4_vm::mm::address::PhysPageNum;
use phase_4_vm::mm::page_table::{PTEFlags, PageTableEntry};

#[test]
fn pte_bit_layout() {
    let ppn = PhysPageNum(0x1_2345);
    let pte = PageTableEntry::new(ppn, PTEFlags::V | PTEFlags::R | PTEFlags::U);
    assert!(pte.is_valid());
    assert!(pte.readable());
    assert!(!pte.writable());
    assert!(!pte.executable());
    assert_eq!(pte.ppn().0, 0x1_2345, "PPN round-trip must preserve bits");
}

#[test]
fn empty_pte_is_invalid() {
    let p = PageTableEntry::empty();
    assert!(!p.is_valid());
    assert_eq!(p.bits, 0);
}

#[test]
fn flag_bits_match_spec() {
    assert_eq!(PTEFlags::V.bits(), 1 << 0);
    assert_eq!(PTEFlags::R.bits(), 1 << 1);
    assert_eq!(PTEFlags::W.bits(), 1 << 2);
    assert_eq!(PTEFlags::X.bits(), 1 << 3);
    assert_eq!(PTEFlags::U.bits(), 1 << 4);
}
