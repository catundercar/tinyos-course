//! Lab 2 ⭐⭐⭐ — SV39 three-level page table.
//!
//! SV39 splits a 39-bit virtual address into
//!
//!     63          39 38       30 29       21 20       12 11         0
//!     +-------------+-----------+-----------+-----------+------------+
//!     |  sign-ext   |  L2 idx   |  L1 idx   |  L0 idx   |   offset   |
//!     +-------------+-----------+-----------+-----------+------------+
//!                          9 bits       9 bits      9 bits   12 bits
//!
//! Each level's PTE is 64 bits:
//!
//!     63                    54 53                         10 9   8 7 6 5 4 3 2 1 0
//!     +----------------------+------------------------------+-----+-+-+-+-+-+-+-+-+
//!     |        reserved      |             PPN              | RSW |D|A|G|U|X|W|R|V|
//!     +----------------------+------------------------------+-----+-+-+-+-+-+-+-+-+
//!
//! Students implement `map`, `unmap`, `translate`, `find_pte`, and
//! `find_pte_create`. The rest is scaffolding.

extern crate alloc;
use alloc::vec::Vec;
use bitflags::bitflags;

use super::address::{PhysAddr, PhysPageNum, StepByOne, VirtAddr, VirtPageNum};
use super::frame_allocator::{frame_alloc, FrameTracker};

bitflags! {
    /// 8 architectural flag bits + 2 RSW. PROVIDED.
    pub struct PTEFlags: u8 {
        const V = 1 << 0;  // Valid
        const R = 1 << 1;  // Read
        const W = 1 << 2;  // Write
        const X = 1 << 3;  // eXecute
        const U = 1 << 4;  // User-accessible
        const G = 1 << 5;  // Global
        const A = 1 << 6;  // Accessed
        const D = 1 << 7;  // Dirty
    }
}

/// A single 64-bit page-table entry.
#[derive(Copy, Clone)]
#[repr(C)]
pub struct PageTableEntry { pub bits: usize }

impl PageTableEntry {
    /// Build a leaf/interior PTE from a PPN and a set of flags.
    pub fn new(ppn: PhysPageNum, flags: PTEFlags) -> Self {
        PageTableEntry { bits: (ppn.0 << 10) | flags.bits() as usize }
    }
    pub fn empty() -> Self { PageTableEntry { bits: 0 } }
    pub fn ppn(&self)   -> PhysPageNum { (self.bits >> 10 & ((1usize << 44) - 1)).into() }
    pub fn flags(&self) -> PTEFlags    { PTEFlags::from_bits_truncate(self.bits as u8) }
    pub fn is_valid(&self)    -> bool { (self.flags() & PTEFlags::V) != PTEFlags::empty() }
    pub fn readable(&self)    -> bool { (self.flags() & PTEFlags::R) != PTEFlags::empty() }
    pub fn writable(&self)    -> bool { (self.flags() & PTEFlags::W) != PTEFlags::empty() }
    pub fn executable(&self)  -> bool { (self.flags() & PTEFlags::X) != PTEFlags::empty() }
}

/// A complete page table: the root frame plus every interior frame it owns.
///
/// Owning `Vec<FrameTracker>` means dropping a `PageTable` automatically
/// frees every physical frame used to store its PTEs.
pub struct PageTable {
    pub root_ppn: PhysPageNum,
    frames: Vec<FrameTracker>,
}

impl PageTable {
    /// Create a fresh (empty) page table: allocate one frame for the root.
    pub fn new() -> Self {
        let frame = frame_alloc().expect("OOM: no frame for page-table root");
        PageTable { root_ppn: frame.ppn, frames: alloc::vec![frame] }
    }

    /// Build a _view_ over a foreign address space by its `satp` value.
    /// Used by `translated_byte_buffer` below to read user memory from S-mode.
    pub fn from_token(satp: usize) -> Self {
        PageTable {
            root_ppn: PhysPageNum::from(satp & ((1usize << 44) - 1)),
            frames: Vec::new(),
        }
    }

    /// The value that should be written to `satp`:
    ///     MODE=8 (SV39) << 60  |  root_ppn
    pub fn token(&self) -> usize { 8usize << 60 | self.root_ppn.0 }

    /// Walk the three levels, allocating missing interior frames on the way.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Compute `idx = vpn.indexes()` → `[L2, L1, L0]`.
    /// 2. Starting from `self.root_ppn`, for each level:
    ///      - Grab `pte = &mut ppn.get_pte_array()[idx[i]]`.
    ///      - If `i == 2` (leaf level), return `Some(pte)`.
    ///      - If `!pte.is_valid()`, allocate a new frame, set
    ///        `*pte = PageTableEntry::new(frame.ppn, PTEFlags::V)` and push
    ///        the tracker into `self.frames`.
    ///      - Descend: `ppn = pte.ppn()`.
    /// 3. Return `None` only if allocation fails.
    ///
    /// HINT: An _interior_ PTE has ONLY the V bit set — no R/W/X. That's
    ///       how the hardware distinguishes it from a leaf.
    fn find_pte_create(&mut self, vpn: VirtPageNum) -> Option<&mut PageTableEntry> {
        // TODO: Implement
        // Step 1: let idx = vpn.indexes();
        // Step 2: let mut ppn = self.root_ppn;
        // Step 3: for i in 0..3 { ... }
        unimplemented!("Lab 2: find_pte_create")
    }

    /// Walk without allocating. Returns `None` if any level is missing.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Same walk as `find_pte_create` but NEVER allocate.
    /// 2. On encountering `!pte.is_valid()` at a non-leaf level, return `None`.
    /// 3. At the leaf level, return `Some(pte)` (even if invalid — callers
    ///    inspect `is_valid()` themselves).
    fn find_pte(&self, vpn: VirtPageNum) -> Option<&mut PageTableEntry> {
        // TODO: Implement
        unimplemented!("Lab 2: find_pte")
    }

    /// Install a leaf mapping `vpn → ppn` with `flags`.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Call `find_pte_create(vpn)`.
    /// 2. Assert the returned PTE is NOT already valid (double-map bug).
    /// 3. Write `PageTableEntry::new(ppn, flags | V)`.
    ///
    /// HINT: Callers provide R/W/X/U but forget V — always OR it in here.
    pub fn map(&mut self, vpn: VirtPageNum, ppn: PhysPageNum, flags: PTEFlags) {
        // TODO: Implement
        unimplemented!("Lab 2: map")
    }

    /// Clear a leaf mapping.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. `find_pte(vpn)` must return a valid PTE — assert this.
    /// 2. Overwrite with `PageTableEntry::empty()`.
    pub fn unmap(&mut self, vpn: VirtPageNum) {
        // TODO: Implement
        unimplemented!("Lab 2: unmap")
    }

    /// Translate a VPN to its current PTE (copy), or `None`.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Use `find_pte`.
    /// 2. Return `Some(*pte)` iff `pte.is_valid()`.
    pub fn translate(&self, vpn: VirtPageNum) -> Option<PageTableEntry> {
        // TODO: Implement
        unimplemented!("Lab 2: translate")
    }
}

/// PROVIDED. Read a user-mode byte buffer from S-mode, even though we are
/// running on a _different_ `satp`. Used by `sys_write` to print user
/// strings. Walks the user page table page-by-page and returns a list of
/// kernel-reachable slices (one per page crossed).
pub fn translated_byte_buffer(token: usize, ptr: *const u8, len: usize) -> Vec<&'static [u8]> {
    let page_table = PageTable::from_token(token);
    let mut start = ptr as usize;
    let end = start + len;
    let mut v = Vec::new();
    while start < end {
        let start_va = VirtAddr::from(start);
        let mut vpn = start_va.floor();
        let ppn = page_table.translate(vpn).expect("bad user ptr").ppn();
        vpn.step();
        let mut end_va: VirtAddr = vpn.into();
        end_va = end_va.min(VirtAddr::from(end));
        if end_va.page_offset() == 0 {
            v.push(&ppn.get_bytes_array()[start_va.page_offset()..]);
        } else {
            v.push(&ppn.get_bytes_array()[start_va.page_offset()..end_va.page_offset()]);
        }
        start = end_va.into();
    }
    v
}

/// PROVIDED. Walk a NUL-terminated user string into a kernel `String`.
pub fn translated_str(token: usize, ptr: *const u8) -> alloc::string::String {
    let page_table = PageTable::from_token(token);
    let mut s = alloc::string::String::new();
    let mut va = ptr as usize;
    loop {
        let ch: u8 = *page_table
            .translate(VirtAddr::from(va).floor())
            .unwrap()
            .ppn()
            .get_mut::<u8>();
        // NOTE: simplified — a real impl reads at `va`'s page offset
        if ch == 0 { break; }
        s.push(ch as char);
        va += 1;
    }
    s
}
