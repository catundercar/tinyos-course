//! PROVIDED. SV39 address / page-number newtypes and `From<>` conversions.
//!
//!   VirtAddr (39 bits, sign-extended to 64 on RISC-V)
//!     └── VirtPageNum = VA >> 12    (27 bits, split 9/9/9 for L2/L1/L0)
//!
//!   PhysAddr (56 bits)
//!     └── PhysPageNum = PA >> 12    (44 bits — the value stored in a PTE)
//!
//! Students will consume the `From` impls plus the `indexes()` helper when
//! walking the three-level page table.

use crate::config::{PAGE_SIZE, PAGE_SIZE_BITS};
use core::fmt::{self, Debug, Formatter};

const PA_WIDTH_SV39: usize = 56;
const VA_WIDTH_SV39: usize = 39;
const PPN_WIDTH_SV39: usize = PA_WIDTH_SV39 - PAGE_SIZE_BITS;   // 44
const VPN_WIDTH_SV39: usize = VA_WIDTH_SV39 - PAGE_SIZE_BITS;   // 27

#[repr(C)] #[derive(Copy, Clone, Ord, PartialOrd, Eq, PartialEq)] pub struct PhysAddr(pub usize);
#[repr(C)] #[derive(Copy, Clone, Ord, PartialOrd, Eq, PartialEq)] pub struct VirtAddr(pub usize);
#[repr(C)] #[derive(Copy, Clone, Ord, PartialOrd, Eq, PartialEq)] pub struct PhysPageNum(pub usize);
#[repr(C)] #[derive(Copy, Clone, Ord, PartialOrd, Eq, PartialEq)] pub struct VirtPageNum(pub usize);

impl Debug for PhysAddr    { fn fmt(&self, f: &mut Formatter) -> fmt::Result { write!(f, "PA:{:#x}",  self.0) } }
impl Debug for VirtAddr    { fn fmt(&self, f: &mut Formatter) -> fmt::Result { write!(f, "VA:{:#x}",  self.0) } }
impl Debug for PhysPageNum { fn fmt(&self, f: &mut Formatter) -> fmt::Result { write!(f, "PPN:{:#x}", self.0) } }
impl Debug for VirtPageNum { fn fmt(&self, f: &mut Formatter) -> fmt::Result { write!(f, "VPN:{:#x}", self.0) } }

impl From<usize> for PhysAddr    { fn from(v: usize) -> Self { Self(v & ((1 << PA_WIDTH_SV39) - 1)) } }
impl From<usize> for VirtAddr    { fn from(v: usize) -> Self { Self(v & ((1 << VA_WIDTH_SV39) - 1)) } }
impl From<usize> for PhysPageNum { fn from(v: usize) -> Self { Self(v & ((1 << PPN_WIDTH_SV39) - 1)) } }
impl From<usize> for VirtPageNum { fn from(v: usize) -> Self { Self(v & ((1 << VPN_WIDTH_SV39) - 1)) } }

impl From<PhysAddr>    for usize { fn from(v: PhysAddr)    -> Self { v.0 } }
impl From<VirtAddr>    for usize { fn from(v: VirtAddr)    -> Self { v.0 } }
impl From<PhysPageNum> for usize { fn from(v: PhysPageNum) -> Self { v.0 } }
impl From<VirtPageNum> for usize { fn from(v: VirtPageNum) -> Self { v.0 } }

impl VirtAddr {
    pub fn floor(&self) -> VirtPageNum { VirtPageNum(self.0 / PAGE_SIZE) }
    pub fn ceil (&self) -> VirtPageNum { VirtPageNum((self.0 + PAGE_SIZE - 1) / PAGE_SIZE) }
    pub fn page_offset(&self) -> usize { self.0 & (PAGE_SIZE - 1) }
    pub fn aligned(&self) -> bool { self.page_offset() == 0 }
}
impl PhysAddr {
    pub fn floor(&self) -> PhysPageNum { PhysPageNum(self.0 / PAGE_SIZE) }
    pub fn ceil (&self) -> PhysPageNum { PhysPageNum((self.0 + PAGE_SIZE - 1) / PAGE_SIZE) }
    pub fn page_offset(&self) -> usize { self.0 & (PAGE_SIZE - 1) }
}

impl From<VirtAddr> for VirtPageNum { fn from(v: VirtAddr) -> Self { assert_eq!(v.page_offset(), 0); v.floor() } }
impl From<PhysAddr> for PhysPageNum { fn from(v: PhysAddr) -> Self { assert_eq!(v.page_offset(), 0); v.floor() } }
impl From<VirtPageNum> for VirtAddr { fn from(v: VirtPageNum) -> Self { VirtAddr(v.0 << PAGE_SIZE_BITS) } }
impl From<PhysPageNum> for PhysAddr { fn from(v: PhysPageNum) -> Self { PhysAddr(v.0 << PAGE_SIZE_BITS) } }

impl VirtPageNum {
    /// Split the 27-bit VPN into three 9-bit indexes: `[L2, L1, L0]`.
    pub fn indexes(&self) -> [usize; 3] {
        let mut vpn = self.0;
        let mut idx = [0usize; 3];
        for i in (0..3).rev() {
            idx[i] = vpn & 0x1ff;
            vpn >>= 9;
        }
        idx
    }
}

impl PhysPageNum {
    /// View the frame as an array of 512 PTEs (used while walking / building
    /// page tables in Lab 2).
    pub fn get_pte_array(&self) -> &'static mut [crate::mm::page_table::PageTableEntry] {
        let pa: PhysAddr = (*self).into();
        unsafe { core::slice::from_raw_parts_mut(pa.0 as *mut _, 512) }
    }
    /// View the frame as a 4 KiB byte buffer (for `memset` / elf copy).
    pub fn get_bytes_array(&self) -> &'static mut [u8] {
        let pa: PhysAddr = (*self).into();
        unsafe { core::slice::from_raw_parts_mut(pa.0 as *mut u8, 4096) }
    }
    pub fn get_mut<T>(&self) -> &'static mut T {
        let pa: PhysAddr = (*self).into();
        unsafe { (pa.0 as *mut T).as_mut().unwrap() }
    }
}

pub trait StepByOne { fn step(&mut self); }
impl StepByOne for VirtPageNum { fn step(&mut self) { self.0 += 1; } }
impl StepByOne for PhysPageNum { fn step(&mut self) { self.0 += 1; } }

#[derive(Copy, Clone)]
pub struct VPNRange { l: VirtPageNum, r: VirtPageNum }
impl VPNRange {
    pub fn new(l: VirtPageNum, r: VirtPageNum) -> Self { assert!(l.0 <= r.0); Self { l, r } }
    pub fn get_start(&self) -> VirtPageNum { self.l }
    pub fn get_end  (&self) -> VirtPageNum { self.r }
}
impl IntoIterator for VPNRange {
    type Item = VirtPageNum;
    type IntoIter = VPNRangeIter;
    fn into_iter(self) -> Self::IntoIter { VPNRangeIter { cur: self.l, end: self.r } }
}
pub struct VPNRangeIter { cur: VirtPageNum, end: VirtPageNum }
impl Iterator for VPNRangeIter {
    type Item = VirtPageNum;
    fn next(&mut self) -> Option<Self::Item> {
        if self.cur.0 >= self.end.0 { None }
        else { let t = self.cur; self.cur.step(); Some(t) }
    }
}
