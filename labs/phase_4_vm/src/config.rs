//! Kernel-wide constants. PROVIDED.

pub const PAGE_SIZE: usize = 0x1000;
pub const PAGE_SIZE_BITS: usize = 12;

/// Kernel heap size (used by alloc crate if enabled).
pub const KERNEL_HEAP_SIZE: usize = 0x30_0000;

/// End of usable physical memory on QEMU virt. Everything above `ekernel`
/// (symbol from `linker.ld`) up to this address is handed to the frame
/// allocator.
pub const MEMORY_END: usize = 0x8080_0000;

/// Virtual address of the trampoline page. Chosen as the very last 4 KiB of
/// the 39-bit virtual space so that both the kernel and every user address
/// space can map the same trampoline code here. Because the value is the
/// same in every page table, executing `sfence.vma` + writing `satp`
/// immediately after transitioning there stays on valid, mapped instructions.
pub const TRAMPOLINE: usize = usize::MAX - PAGE_SIZE + 1;

/// Virtual address of each task's trap context page. Lives one page below
/// the trampoline.
pub const TRAP_CONTEXT: usize = TRAMPOLINE - PAGE_SIZE;

pub const USER_STACK_SIZE: usize = 4096 * 2;
pub const KERNEL_STACK_SIZE: usize = 4096 * 2;

pub const CLOCK_FREQ: usize = 12_500_000;
