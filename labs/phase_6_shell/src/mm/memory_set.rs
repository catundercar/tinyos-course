//! Lab 3 ⭐⭐⭐ — MemorySet & MapArea.
//!
//! A `MemorySet` is "everything one `satp` can see":
//!
//!      MemorySet
//!        ├── page_table : PageTable      (owns its frames, Lab 2)
//!        └── areas      : Vec<MapArea>   (what's currently mapped)
//!
//! A `MapArea` is a contiguous range of VPNs sharing one `MapPermission`.
//! Framed areas own a `BTreeMap<VirtPageNum, FrameTracker>` so dropping the
//! area returns all physical frames to the allocator.
//!
//! Students implement:
//!   * `MapArea::map_one` / `unmap_one`
//!   * `MemorySet::push`  (map + optionally copy_data)
//!   * `MemorySet::new_kernel`
//!   * `MemorySet::from_elf`
//!
//! The activate / kernel-space singleton scaffolding is PROVIDED.

extern crate alloc;
use alloc::collections::BTreeMap;
use alloc::sync::Arc;
use alloc::vec::Vec;
use bitflags::bitflags;
use core::arch::asm;
use lazy_static::lazy_static;
use spin::Mutex;

use super::address::{PhysAddr, PhysPageNum, StepByOne, VPNRange, VirtAddr, VirtPageNum};
use super::frame_allocator::{frame_alloc, FrameTracker};
use super::page_table::{PTEFlags, PageTable, PageTableEntry};
use crate::config::{MEMORY_END, PAGE_SIZE, TRAMPOLINE, TRAP_CONTEXT, USER_STACK_SIZE};

extern "C" {
    fn stext();  fn etext();
    fn srodata(); fn erodata();
    fn sdata();   fn edata();
    fn sbss();    fn ebss();
    fn ekernel();
    fn strampoline();
}

/// PROVIDED.
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
pub enum MapType { Identical, Framed }

bitflags! {
    /// Subset of PTE flags exposed to MapArea callers. PROVIDED.
    pub struct MapPermission: u8 {
        const R = 1 << 1;
        const W = 1 << 2;
        const X = 1 << 3;
        const U = 1 << 4;
    }
}

/// PROVIDED (mostly). `map_one` / `unmap_one` are students'.
pub struct MapArea {
    pub vpn_range: VPNRange,
    pub data_frames: BTreeMap<VirtPageNum, FrameTracker>,
    pub map_type: MapType,
    pub map_perm: MapPermission,
}

impl MapArea {
    pub fn new(start_va: VirtAddr, end_va: VirtAddr, map_type: MapType, map_perm: MapPermission) -> Self {
        let start_vpn: VirtPageNum = start_va.floor();
        let end_vpn:   VirtPageNum = end_va.ceil();
        Self {
            vpn_range: VPNRange::new(start_vpn, end_vpn),
            data_frames: BTreeMap::new(),
            map_type, map_perm,
        }
    }

    /// Map one page: pick a PPN according to `map_type`, then install the
    /// PTE in `page_table`.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. For `MapType::Identical`: `ppn = PhysPageNum(vpn.0)` — the VA
    ///    equals the PA.
    /// 2. For `MapType::Framed`: `let frame = frame_alloc().unwrap();
    ///    let ppn = frame.ppn; self.data_frames.insert(vpn, frame);`
    /// 3. Convert `self.map_perm` → `PTEFlags` (the bit layouts line up by
    ///    design), then `page_table.map(vpn, ppn, flags)`.
    ///
    /// HINT: `PTEFlags::from_bits(self.map_perm.bits()).unwrap()` works.
    pub fn map_one(&mut self, page_table: &mut PageTable, vpn: VirtPageNum) {
        // TODO: Implement
        unimplemented!("Lab 3: map_one")
    }

    /// Unmap one page. For `Framed`, also drop its backing frame (remove
    /// from `data_frames`). Then call `page_table.unmap(vpn)`.
    ///
    /// TODO: Implement this method
    pub fn unmap_one(&mut self, page_table: &mut PageTable, vpn: VirtPageNum) {
        // TODO: Implement
        unimplemented!("Lab 3: unmap_one")
    }

    pub fn map  (&mut self, pt: &mut PageTable) { for vpn in self.vpn_range { self.map_one(pt, vpn); } }
    pub fn unmap(&mut self, pt: &mut PageTable) {
        let vpns: Vec<_> = self.vpn_range.into_iter().collect();
        for vpn in vpns { self.unmap_one(pt, vpn); }
    }

    /// PROVIDED. Copy `data` into this MapArea's backing frames, one page
    /// at a time. Requires `MapType::Framed`.
    pub fn copy_data(&mut self, pt: &mut PageTable, data: &[u8]) {
        assert_eq!(self.map_type, MapType::Framed);
        let mut start = 0usize;
        let mut cur_vpn = self.vpn_range.get_start();
        loop {
            let src = &data[start .. (data.len().min(start + PAGE_SIZE))];
            let dst = &mut pt.translate(cur_vpn).unwrap().ppn().get_bytes_array()[..src.len()];
            dst.copy_from_slice(src);
            start += PAGE_SIZE;
            if start >= data.len() { break; }
            cur_vpn.step();
        }
    }
}

pub struct MemorySet {
    pub page_table: PageTable,
    pub areas: Vec<MapArea>,
}

impl MemorySet {
    pub fn new_bare() -> Self { Self { page_table: PageTable::new(), areas: Vec::new() } }
    pub fn token(&self) -> usize { self.page_table.token() }

    /// PROVIDED — maps the trampoline as `X` at VA = TRAMPOLINE.
    fn map_trampoline(&mut self) {
        self.page_table.map(
            VirtAddr::from(TRAMPOLINE).into(),
            PhysAddr::from(strampoline as usize).into(),
            PTEFlags::R | PTEFlags::X,
        );
    }

    /// Install one area (optionally initialised from `data`).
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. `map_area.map(&mut self.page_table)`.
    /// 2. If `data.is_some()`, call `map_area.copy_data(...)`.
    /// 3. `self.areas.push(map_area)`.
    pub fn push(&mut self, mut map_area: MapArea, data: Option<&[u8]>) {
        // TODO: Implement
        unimplemented!("Lab 3: MemorySet::push")
    }

    /// Build the kernel's MemorySet.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Allocate a bare MemorySet, then call `map_trampoline()`.
    /// 2. Identity-map `.text`  (R|X), `.rodata` (R), `.data` (R|W),
    ///    `.bss`   (R|W), and the rest of physical RAM `[ekernel..MEMORY_END)`
    ///    (R|W). Use `MapType::Identical`. NO `U` bit — kernel only.
    /// 3. Return the MemorySet.
    ///
    /// HINT: Reuse the `extern "C" { fn stext(); ... }` symbols at the top
    ///       of this file to get section boundaries.
    pub fn new_kernel() -> Self {
        // TODO: Implement
        unimplemented!("Lab 3: new_kernel")
    }

    /// Build a user-mode MemorySet from an ELF image.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. `map_trampoline()`.
    /// 2. Parse the ELF (`xmas_elf::ElfFile::new(elf_data).unwrap()`).
    /// 3. For each `PT_LOAD` program header, create a Framed MapArea with
    ///    permissions derived from `ph.flags()` (always U), copy its file
    ///    bytes with `push(area, Some(...))`.
    /// 4. Track `max_end_vpn` across segments → `user_stack_bottom =
    ///    (max_end_vpn + guard page) << 12`, push a Framed R|W|U stack area
    ///    of size `USER_STACK_SIZE`.
    /// 5. Push the trap-context page: VA range `[TRAP_CONTEXT, TRAMPOLINE)`,
    ///    Framed, R|W (no U — kernel touches it with satp already switched).
    /// 6. Return `(memory_set, user_sp, entry_point)`.
    ///
    /// HINT: Bit correspondence
    ///       ELF PF_R→R, PF_W→W, PF_X→X. Always OR in `U`.
    pub fn from_elf(elf_data: &[u8]) -> (Self, usize, usize) {
        // TODO: Implement
        unimplemented!("Lab 3: from_elf")
    }

    /// PROVIDED. Write the new satp and flush the TLB.
    ///
    /// ```text
    ///   satp = MODE(8=SV39) << 60 | ASID(0) | PPN(root)
    ///   csrw  satp, t0
    ///   sfence.vma                 # invalidate every TLB entry
    /// ```
    pub fn activate(&self) {
        let satp = self.page_table.token();
        unsafe {
            asm!("csrw satp, {0}", "sfence.vma", in(reg) satp);
        }
    }

    pub fn translate(&self, vpn: VirtPageNum) -> Option<PageTableEntry> {
        self.page_table.translate(vpn)
    }
}

lazy_static! {
    /// PROVIDED — the global kernel MemorySet, behind a Mutex for interior
    /// mutability during late init (e.g. mapping MMIO regions).
    pub static ref KERNEL_SPACE: Arc<Mutex<MemorySet>> =
        Arc::new(Mutex::new(MemorySet::new_kernel()));
}

