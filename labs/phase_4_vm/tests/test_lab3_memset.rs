//! Lab 3 host-side tests. We verify the VPN/VA arithmetic used while
//! carving MapAreas — the heavy lifting (new_kernel / from_elf) runs only
//! on target.

use phase_4_vm::mm::address::{StepByOne, VPNRange, VirtAddr, VirtPageNum};

#[test]
fn va_floor_ceil_page_aligned() {
    let a = VirtAddr::from(0x1_2345);
    assert_eq!(a.floor().0, 0x12);
    assert_eq!(a.ceil().0,  0x13);
    assert_eq!(a.page_offset(), 0x345);
}

#[test]
fn vpn_range_iterates_inclusive_exclusive() {
    let r = VPNRange::new(VirtPageNum(4), VirtPageNum(7));
    let v: Vec<_> = r.into_iter().map(|p| p.0).collect();
    assert_eq!(v, vec![4, 5, 6]);
}

#[test]
fn vpn_indexes_split_9_9_9() {
    //   VPN = 0b_1_0000_0010_0_0000_0011_0_0000_0100  (L2=1, L1=3, L0=4)
    //       =        (1 << 18) | (3 << 9) | 4
    let vpn = VirtPageNum((1 << 18) | (3 << 9) | 4);
    assert_eq!(vpn.indexes(), [1, 3, 4]);
}

#[test]
fn step_by_one_advances() {
    let mut v = VirtPageNum(42);
    v.step();
    assert_eq!(v.0, 43);
}
