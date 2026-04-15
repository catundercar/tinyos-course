import type { PhaseContent } from "./types";

const LAB_PT = "labs/phase_4_vm/src/mm/page_table.rs";
const LAB_FA = "labs/phase_4_vm/src/mm/frame_allocator.rs";
const LAB_MS = "labs/phase_4_vm/src/mm/memory_set.rs";
const LAB_ADDR = "labs/phase_4_vm/src/mm/address.rs";

export const phase4ZhCN: PhaseContent = {
  phaseId: 4,
  color: "#2563EB",
  accent: "#60A5FA",
  lessons: [
    // ─────────────────────────────── Lesson 1 ───────────────────────────────
    {
      phaseId: 4,
      lessonId: 1,
      title: "SV39 三级页表：从虚拟地址到物理地址",
      subtitle: "39-bit VA · 9/9/9/12 · 3-level walk · satp",
      type: "Concept",
      duration: "90 min",
      objectives: [
        "记住 SV39 虚拟地址 9/9/9/12 的切分方式",
        "用 ASCII 图默写一次三级页表 walk",
        "区分 VPN、PPN、PA、VA 四种地址/索引",
        "写出 satp 的 MODE/ASID/PPN 字段并知道如何启用 SV39",
      ],
      sections: [
        {
          title: "为什么一个虚拟地址需要三次查表",
          blocks: [
            { type: "paragraph", text: "SV39 用 39 位虚拟地址映射到 56 位物理地址。如果用一张平坦页表，需要 2^27 × 8B = 1 GiB 的连续内存，这既浪费又不现实。多级页表把它按 9 位一层切成 3 层，每张页表只占 4 KiB（512 × 8B），按需分配中间层。" },
            { type: "paragraph", text: "页大小固定 4 KiB（12 位偏移），所以 VA 中真正用来找页的位数是 39 - 12 = 27 位，恰好分成 9 + 9 + 9 三段，对应三级页表的索引。" },
            { type: "callout", variant: "info", text: "SV39 只使用低 39 位，高 25 位必须是第 38 位的符号扩展——否则取指/访存直接异常。这等价于把 VA 空间切成 [0, 2^38) 和 [2^64-2^38, 2^64) 两段（用户高半 / 内核高半）。" },
          ],
        },
        {
          title: "虚拟地址的位切分",
          blocks: [
            {
              type: "diagram",
              content: ` 63                    39 38       30 29       21 20       12 11         0
 ┌───────────────────────┬───────────┬───────────┬───────────┬────────────┐
 │    sign-extend (=38)  │  VPN[2]   │  VPN[1]   │  VPN[0]   │   offset   │
 └───────────────────────┴───────────┴───────────┴───────────┴────────────┘
        25 bits            9 bits      9 bits      9 bits      12 bits
                           (L2 idx)    (L1 idx)    (L0 idx)    (in-page)`,
            },
            { type: "paragraph", text: "关键直觉：VPN[2]/VPN[1]/VPN[0] 是三张页表中的数组下标，offset 是最后一级页里面的字节偏移。四个字段加起来就是一次完整翻译。" },
          ],
        },
        {
          title: "三级 walk：三次访存就能算出任意 PA",
          blocks: [
            {
              type: "diagram",
              content: ` satp.PPN ──► ┌────────── L2 page table (512 × PTE) ──────────┐
              │ ...                                            │
              │ [VPN[2]] = PTE2:  V=1 PPN=0x80201             │  (interior, R|W|X=0)
              │ ...                                            │
              └────────────┬───────────────────────────────────┘
                           │ next = PTE2.PPN << 12 = 0x80201000
                           ▼
              ┌────────── L1 page table at PA 0x80201000 ─────┐
              │ [VPN[1]] = PTE1:  V=1 PPN=0x80202             │
              └────────────┬───────────────────────────────────┘
                           ▼
              ┌────────── L0 page table at PA 0x80202000 ─────┐
              │ [VPN[0]] = PTE0:  V=1 R=1 W=1 U=1 PPN=0x80AFC │  (leaf!)
              └────────────┬───────────────────────────────────┘
                           ▼
              PA = (0x80AFC << 12) | offset`,
            },
            { type: "paragraph", text: "硬件最多三次内存访问；命中 TLB 时就是一次寄存器操作。\"叶子\" 的判据不是 \"在第 0 级\"，而是 \"R|W|X 任一为 1\"——SV39 支持 2 MiB / 1 GiB 大页，方式就是把叶子上提到第 1 级或第 2 级。" },
            {
              type: "code",
              language: "rust",
              code: `// labs/phase_4_vm/src/mm/page_table.rs 的核心 walk
fn find_pte(&self, vpn: VirtPageNum) -> Option<&mut PageTableEntry> {
    let idxs = vpn.indexes();               // [vpn2, vpn1, vpn0]
    let mut ppn = self.root_ppn;            // 来自 satp.PPN
    for i in 0..3 {
        let pte = &mut ppn.get_pte_array()[idxs[i]];
        if i == 2 { return Some(pte); }     // 第 0 级就是叶子
        if !pte.is_valid() { return None; } // 中途缺页 → None
        ppn = pte.ppn();                    // 下一级的 PPN
    }
    unreachable!()
}`,
            },
          ],
        },
        {
          title: "satp CSR：告诉 MMU \"从哪里开始 walk\"",
          blocks: [
            {
              type: "diagram",
              content: ` 63    60 59               44 43                                       0
 ┌───────┬───────────────────┬─────────────────────────────────────────┐
 │ MODE  │       ASID        │             root PPN                    │
 └───────┴───────────────────┴─────────────────────────────────────────┘
  4 bits       16 bits                       44 bits`,
            },
            {
              type: "table",
              headers: ["字段", "宽度", "含义"],
              rows: [
                ["MODE", "4", "0=Bare（不翻译） / 8=Sv39 / 9=Sv48 / 10=Sv57"],
                ["ASID", "16", "地址空间 ID；允许同一 TLB 承载多个进程"],
                ["PPN", "44", "L2 页表所在物理页的物理页号"],
              ],
            },
            {
              type: "code",
              language: "rust",
              code: `// 启用 SV39
let satp = 8usize << 60             // MODE = Sv39
         | 0usize << 44             // ASID = 0（内核）
         | kernel_root_ppn.0;        // root PPN
unsafe {
    asm!("csrw satp, {0}", "sfence.vma", in(reg) satp);
}`,
            },
            { type: "callout", variant: "warning", text: "写 satp 不会自动刷 TLB。必须紧跟一条 sfence.vma——否则 CPU 可能继续用旧地址空间的缓存翻译，第一条指令就 InstructionPageFault。" },
          ],
        },
        {
          title: "SV39 vs SV48：为什么本课只做 SV39",
          blocks: [
            {
              type: "table",
              headers: ["属性", "SV39", "SV48"],
              rows: [
                ["VA 位数", "39", "48"],
                ["可寻址空间", "512 GiB", "256 TiB"],
                ["层数", "3", "4"],
                ["QEMU virt 支持", "是", "是"],
                ["xv6-riscv / rCore 默认", "SV39", "可选"],
              ],
            },
            { type: "paragraph", text: "SV39 对教学足够：3 层 walk 手画得下，512 GiB 远超 QEMU 默认 128 MiB 物理内存。SV48 只是多加一级 VPN[3]，算法完全相同。" },
          ],
        },
      ],
      exercises: [
        {
          id: "hand-walk",
          title: "手工演算一次 walk",
          description: "给 VA = 0x0000_0040_0020_0ABC、satp.PPN = 0x80000，手算 VPN[2..0] 与 offset，并写出经过 L2/L1/L0 之后的 PA（假设每级 PTE.PPN = base + level）。",
          labFile: LAB_ADDR,
          pseudocode: `vpn2 = (va >> 30) & 0x1FF
vpn1 = (va >> 21) & 0x1FF
vpn0 = (va >> 12) & 0x1FF
off  =  va        & 0xFFF
pa   = (leaf_ppn << 12) | off`,
          hints: [
            "0x0000_0040_0020_0ABC 的第 38 位必须等于高 25 位——否则这是非法 VA",
            "小心 9 位掩码 0x1FF = 511，不要写成 0xFFF",
            "最终 PA = 56 位，别把高位截断到 32 位",
          ],
        },
        {
          id: "indexes",
          title: "实现 VirtPageNum::indexes()",
          description: "在 address.rs 中，给定 VPN（27 位），按 L2 → L1 → L0 顺序返回三个 9 位下标。",
          labFile: LAB_ADDR,
          pseudocode: `fn indexes(self) -> [usize; 3] {
    let mut vpn = self.0;
    let mut out = [0; 3];
    for i in (0..3).rev() {          // L0 最先被拿出
        out[i] = vpn & 0x1FF;
        vpn >>= 9;
    }
    out                               // 返回顺序：[L2, L1, L0]
}`,
          hints: [
            "返回数组的索引 0 对应最先使用的 L2，别写反",
            "vpn 已经右移掉了 12 位 offset——不要再右移",
          ],
        },
      ],
      acceptanceCriteria: [
        "能口述 9/9/9/12 切分并画出三级 walk 图",
        "说清 satp 三个字段与 MODE=8 的含义",
        "能解释为什么写 satp 后必须 sfence.vma",
        "page_table::tests::test_walk_three_levels 通过",
      ],
      references: [
        {
          title: "[必读] RISC-V Privileged Spec · Ch.10 Supervisor-Level Memory Management",
          description: "SV39 的规范源头：VA 格式、PTE 布局、sfence 语义",
          url: "https://github.com/riscv/riscv-isa-manual/releases",
        },
        {
          title: "[必读] rCore-Tutorial v3 · Chapter 4.1 地址空间",
          description: "同样 Rust + SV39 的姐妹教程，代码风格一致",
          url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/2sv39-implementation-1.html",
        },
        {
          title: "[深入阅读] xv6-riscv book · Chapter 3 Page tables",
          description: "C 实现对照版，可对照 Rust 版差异",
          url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf",
        },
      ],
    },

    // ─────────────────────────────── Lesson 2 ───────────────────────────────
    {
      phaseId: 4,
      lessonId: 2,
      title: "PTE 标志位：V/R/W/X/U/G/A/D",
      subtitle: "权限矩阵 · 叶子 vs 中间 · 非法组合",
      type: "Concept",
      duration: "60 min",
      objectives: [
        "背下 PTE 8 个低位标志的语义",
        "区分 \"叶子 PTE\" 与 \"中间 PTE\" 的写法差异",
        "列出常见权限组合并写出每一种的用途",
        "识别 SV39 的保留/非法标志组合",
      ],
      sections: [
        {
          title: "64 位 PTE 位布局",
          blocks: [
            {
              type: "diagram",
              content: ` 63        54 53                            10 9   8 7 6 5 4 3 2 1 0
 ┌────────────┬─────────────────────────────────┬─────┬─┬─┬─┬─┬─┬─┬─┬─┐
 │  reserved  │              PPN                │ RSW │D│A│G│U│X│W│R│V│
 └────────────┴─────────────────────────────────┴─────┴─┴─┴─┴─┴─┴─┴─┴─┘
     10              44 bits                     2    1 1 1 1 1 1 1 1`,
            },
            { type: "paragraph", text: "低 10 位是标志，中间 44 位是 PPN，高 10 位保留为 0。PPN 需要左移 12 位才是物理地址——这正是大家最常踩的坑（见 Lesson 3 常见错误）。" },
          ],
        },
        {
          title: "八个标志位一表看懂",
          blocks: [
            {
              type: "table",
              headers: ["bit", "名", "含义", "谁写"],
              rows: [
                ["0", "V", "Valid：PTE 本身有效；清 0 的一切其他字段都无意义", "OS"],
                ["1", "R", "叶子可读", "OS"],
                ["2", "W", "叶子可写", "OS"],
                ["3", "X", "叶子可执行（取指）", "OS"],
                ["4", "U", "U-mode 可访问；S-mode 访问此页需 sstatus.SUM=1", "OS"],
                ["5", "G", "Global：所有 ASID 共享（内核页常置 1）", "OS"],
                ["6", "A", "Accessed：硬件或软件在首次访问时置 1", "HW/SW"],
                ["7", "D", "Dirty：写访问时置 1（仅对 W 页有意义）", "HW/SW"],
                ["8–9", "RSW", "Reserved for Software：OS 自由使用", "OS"],
              ],
            },
          ],
        },
        {
          title: "叶子 PTE vs 中间 PTE",
          blocks: [
            { type: "paragraph", text: "硬件如何判定一个 PTE 是叶子？看 R|W|X——任一为 1 就是叶子，否则继续往下一级走。因此：" },
            {
              type: "table",
              headers: ["R", "W", "X", "硬件解释"],
              rows: [
                ["0", "0", "0", "中间 PTE（下一级页表指针）"],
                ["1", "0", "0", "叶子：只读数据页（.rodata）"],
                ["1", "0", "1", "叶子：代码页（.text / trampoline）"],
                ["1", "1", "0", "叶子：读写数据页（.data / 栈）"],
                ["1", "1", "1", "叶子：可读写+可执行（JIT 才用，一般禁止）"],
                ["0", "1", "*", "保留！硬件 PageFault"],
                ["0", "0", "1", "叶子：只执行（罕见，SV39 允许）"],
              ],
            },
            { type: "callout", variant: "warning", text: "W=1 而 R=0 是 SV39 保留组合，硬件直接报 PageFault。别以为 \"写权限包含读\"——RISC-V 要求必须显式置 R。" },
          ],
        },
        {
          title: "常见权限组合速查表",
          blocks: [
            {
              type: "table",
              headers: ["组合", "用途"],
              rows: [
                ["V", "中间 PTE（纯指针，R|W|X=0）"],
                ["V R X", "内核 .text / trampoline"],
                ["V R", "内核 .rodata"],
                ["V R W", "内核 .data / .bss / 物理帧窗口"],
                ["V R W U", "用户栈 / 用户堆 / anon mmap"],
                ["V R X U", "用户 .text"],
                ["V R U", "用户 .rodata（ELF 的 PT_LOAD R 位）"],
              ],
            },
            {
              type: "code",
              language: "rust",
              code: `// labs/phase_4_vm/src/mm/page_table.rs
bitflags! {
    pub struct PTEFlags: u8 {
        const V = 1 << 0;
        const R = 1 << 1;
        const W = 1 << 2;
        const X = 1 << 3;
        const U = 1 << 4;
        const G = 1 << 5;
        const A = 1 << 6;
        const D = 1 << 7;
    }
}

impl PageTableEntry {
    pub fn new(ppn: PhysPageNum, flags: PTEFlags) -> Self {
        Self { bits: (ppn.0 << 10) | flags.bits as usize }
    }
    pub fn ppn(&self)   -> PhysPageNum { ((self.bits >> 10) & ((1 << 44) - 1)).into() }
    pub fn flags(&self) -> PTEFlags    { PTEFlags::from_bits_truncate(self.bits as u8) }
    pub fn is_valid(&self) -> bool     { self.flags().contains(PTEFlags::V) }
    pub fn is_leaf(&self)  -> bool     { self.flags().intersects(PTEFlags::R | PTEFlags::W | PTEFlags::X) }
}`,
            },
          ],
        },
        {
          title: "U 位与 SUM：内核为什么默认不能读用户页",
          blocks: [
            { type: "paragraph", text: "当 S-mode CPU 试图访问带 U 标志的页，默认会触发异常，防止内核被 \"confused deputy\" 攻击误引导读用户数据。要临时允许这件事，必须把 sstatus.SUM（Supervisor User Memory）置 1。Lesson 5 的 copy_from_user 正是要利用这一点。" },
            {
              type: "code",
              language: "rust",
              code: `// 在内核需要读用户指针前打开 SUM
unsafe { riscv::register::sstatus::set_sum(); }
// …读用户 buffer…
unsafe { riscv::register::sstatus::clear_sum(); }`,
            },
          ],
        },
      ],
      exercises: [
        {
          id: "flags-encode",
          title: "实现 PageTableEntry::new",
          description: "把 44 位 PPN 左移 10 位并或上 flags.bits，组装 64 位 PTE。注意别把 flags 截到高位。",
          labFile: LAB_PT,
          pseudocode: `bits = (ppn & ((1<<44)-1)) << 10 | (flags.bits as usize & 0x3FF)`,
          hints: [
            "flags 只用低 10 位（含 RSW），不要溢出到 PPN",
            "PPN 也要做 44 位掩码，防止调用方传进来脏数据",
          ],
        },
        {
          id: "is-leaf",
          title: "实现 is_leaf / is_interior",
          description: "根据 R|W|X 任一为 1 判定叶子；全 0 即中间 PTE。注意 V=0 的 PTE 无所谓叶子/中间——返回什么都不影响后续 walk，但最好显式处理。",
          labFile: LAB_PT,
          hints: [
            "bitflags::intersects 比 contains 更适合 \"任一\"",
            "先判 is_valid，再判 leaf，逻辑更清晰",
          ],
        },
      ],
      acceptanceCriteria: [
        "能默写 PTE 的 64 位布局",
        "能说明为什么 W=1, R=0 非法",
        "能解释 SUM 位的作用",
        "page_table::tests::test_pte_encode_decode 通过",
      ],
      references: [
        {
          title: "[必读] RISC-V Privileged Spec · §10.3.1 Addressing and Memory Protection",
          description: "PTE 格式权威来源，包含保留组合的完整列表",
          url: "https://github.com/riscv/riscv-isa-manual/releases",
        },
        {
          title: "[必读] rCore-Tutorial v3 · 4.2 SV39 页表项",
          description: "中文解读 PTE 各位的含义",
          url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/3sv39-implementation-2.html",
        },
        {
          title: "[深入阅读] Writing an OS in Rust · Paging Introduction",
          description: "Phil-Opp 系列的页表章节，x86_64 但概念通用",
          url: "https://os.phil-opp.com/paging-introduction/",
        },
      ],
    },

    // ─────────────────────────────── Lesson 3 ───────────────────────────────
    {
      phaseId: 4,
      lessonId: 3,
      title: "FrameAllocator：栈式分配 + RAII 防泄漏",
      subtitle: "StackFrameAllocator · FrameTracker · recycled",
      type: "Concept + Practice",
      duration: "90 min",
      objectives: [
        "比较栈式 vs 位图式帧分配器的空间/时间权衡",
        "理解 FrameTracker 的 RAII 释放契约",
        "能解释 recycled Vec 的 LIFO 语义为什么对 TLB 友好",
        "避免 \"FrameTracker 没被持有 → 帧提前归还\" 这一 Rust 专属坑",
      ],
      sections: [
        {
          title: "只有一个全局实例",
          blocks: [
            { type: "paragraph", text: "物理内存是全局唯一资源，所以分配器是单例——通常是一个 lazy_static 的 Mutex<StackFrameAllocator>。它从内核 .bss 之后 (ekernel) 到 MEMORY_END 之间的物理帧里分配。" },
            {
              type: "diagram",
              content: ` ekernel                                                       MEMORY_END
  │                                                                   │
  ▼                                                                   ▼
  ┌──────┬────────────────────────────────────────────────────────────┐
  │ .bss │                 可分配物理帧区间                            │
  └──────┴────────────────────────────────────────────────────────────┘
            ▲                                   ▲
            │                                   │
        current (下一个 never-allocated)      end`,
            },
          ],
        },
        {
          title: "StackFrameAllocator 的数据结构",
          blocks: [
            {
              type: "code",
              language: "rust",
              code: `// labs/phase_4_vm/src/mm/frame_allocator.rs
pub struct StackFrameAllocator {
    current: usize,                  // 下一个 never-allocated 的 PPN
    end: usize,                      // 可分配区间的上界（独占）
    recycled: Vec<usize>,            // 被 dealloc 归还的 PPN 栈
}

impl StackFrameAllocator {
    pub fn alloc(&mut self) -> Option<PhysPageNum> {
        if let Some(ppn) = self.recycled.pop() {
            Some(ppn.into())         // 优先复用最近释放的
        } else if self.current < self.end {
            self.current += 1;
            Some((self.current - 1).into())
        } else {
            None                     // OOM
        }
    }

    pub fn dealloc(&mut self, ppn: PhysPageNum) {
        // validity check: 不能归还从未分配过的帧
        assert!(ppn.0 < self.current && !self.recycled.contains(&ppn.0),
                "double free PPN {:#x}", ppn.0);
        self.recycled.push(ppn.0);
    }
}`,
            },
            { type: "callout", variant: "tip", text: "LIFO 的副作用：刚释放的帧最可能还在 L1/L2 cache，也最可能有 TLB 残留——马上复用往往免一次 cache miss。这是栈式分配器的一个隐性优点。" },
          ],
        },
        {
          title: "栈式 vs 位图式：怎么选",
          blocks: [
            {
              type: "table",
              headers: ["维度", "栈式 (current/recycled)", "位图 (bitmap)"],
              rows: [
                ["元数据开销", "O(空闲帧数)，最坏 == 物理内存 / 4KiB × 8B", "固定 O(总帧数 / 8)"],
                ["alloc 复杂度", "O(1)", "O(N) 找第一个 0 位（可用 free-list 加速）"],
                ["dealloc 复杂度", "O(1)", "O(1)"],
                ["碎片", "不处理（无连续性保证）", "支持连续分配（伙伴系统）"],
                ["适用场景", "教学/小系统，单帧分配为主", "支持大页/连续 DMA 的生产级内核"],
              ],
            },
            { type: "paragraph", text: "Phase 4 选栈式：代码 40 行，缺点（不支持连续物理区间）对我们无影响——SV39 允许任意物理帧拼接成虚拟连续区间。" },
          ],
        },
        {
          title: "FrameTracker：RAII 把 drop 绑死到归还",
          blocks: [
            {
              type: "code",
              language: "rust",
              code: `pub struct FrameTracker {
    pub ppn: PhysPageNum,
}

impl FrameTracker {
    pub fn new(ppn: PhysPageNum) -> Self {
        // 初始化必须清零——防止脏数据被当成合法 PTE
        let bytes = ppn.get_bytes_array();
        for b in bytes { *b = 0; }
        Self { ppn }
    }
}

impl Drop for FrameTracker {
    fn drop(&mut self) {
        FRAME_ALLOCATOR.lock().dealloc(self.ppn);
    }
}

pub fn frame_alloc() -> Option<FrameTracker> {
    FRAME_ALLOCATOR.lock().alloc().map(FrameTracker::new)
}`,
            },
            { type: "callout", variant: "warning", text: "Rust 坑：let ppn = frame_alloc().unwrap().ppn; 会在语句结束时 Drop 整个 FrameTracker——帧立刻归还，但你的 PTE 还指着它。必须把 FrameTracker 存进某个生命周期和映射一致的容器（比如 MapArea.data_frames、PageTable.frames）。" },
          ],
        },
        {
          title: "碎片问题：栈式分配器故意忽略的代价",
          blocks: [
            { type: "paragraph", text: "只给单帧，不保证连续性——因此无法直接分配一个 2 MiB 大页或 DMA 缓冲区。生产内核用伙伴系统 + slab 解决这个问题。教学版本里我们接受这个代价，因为所有映射都是 4 KiB 粒度，虚拟层把离散物理帧重新拼成了连续虚拟区间。" },
          ],
        },
      ],
      exercises: [
        {
          id: "stack-alloc",
          title: "实现 StackFrameAllocator::alloc / dealloc",
          description: "填写 alloc：优先 pop recycled，否则 current++ 直到 end。实现 dealloc：加 double-free 检查。",
          labFile: LAB_FA,
          pseudocode: `alloc():
  if let Some(ppn) = recycled.pop(): return Some(ppn)
  if current == end: return None
  ppn = current; current += 1
  return Some(ppn)

dealloc(ppn):
  assert ppn < current
  assert ppn not in recycled        // double free
  recycled.push(ppn)`,
          hints: [
            "别忘了 PhysPageNum::from(usize) 的类型转换",
            "double-free 检查可以用 recycled.iter().any(|&p| p == ppn.0)",
          ],
        },
        {
          id: "frame-tracker",
          title: "实现 FrameTracker 与 frame_alloc",
          description: "保证：(1) new() 把 4 KiB 清零；(2) Drop 归还帧到全局分配器；(3) frame_alloc() 返回 Option<FrameTracker>。",
          labFile: LAB_FA,
          hints: [
            "清零可以用 for b in ppn.get_bytes_array() { *b = 0; }",
            "Drop 里调用 FRAME_ALLOCATOR.lock().dealloc(self.ppn)",
            "别加 #[derive(Copy)]——FrameTracker 的所有权必须唯一",
          ],
        },
      ],
      acceptanceCriteria: [
        "frame_allocator::tests::test_alloc_recycle 通过",
        "frame_allocator::tests::double_free_panics 触发 panic",
        "能解释为什么 FrameTracker 不能实现 Copy",
        "能说出清零的必要性",
      ],
      references: [
        {
          title: "[必读] rCore-Tutorial v3 · 4.3 管理 SV39 多级页表",
          description: "StackFrameAllocator / FrameTracker 的原版讲解",
          url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/4sv39-implementation-3.html",
        },
        {
          title: "[必读] labs/phase_4_vm/COURSE.en.md · Lab 1 guide",
          description: "本仓库的 Lab 1 完整讲解与常见错误",
          url: "./labs/phase_4_vm/COURSE.en.md",
        },
        {
          title: "[深入阅读] Linux Memory Management: Buddy Allocator",
          description: "生产级连续帧分配的经典算法",
          url: "https://www.kernel.org/doc/gorman/html/understand/understand009.html",
        },
      ],
    },

    // ─────────────────────────────── Lesson 4 ───────────────────────────────
    {
      phaseId: 4,
      lessonId: 4,
      title: "MemorySet + MapArea + Trampoline",
      subtitle: "地址空间对象 · identity vs framed · 跨空间共享页",
      type: "Concept + Practice",
      duration: "120 min",
      objectives: [
        "画出 MemorySet / MapArea / PageTable 的持有关系",
        "区分 identity 映射与 framed 映射的使用场合",
        "解释为什么 trampoline 必须在内核/用户映射到同一 VA",
        "理解 TrapContext 页 \"固定槽位\" 的设计意图",
      ],
      sections: [
        {
          title: "三层对象的 ownership",
          blocks: [
            {
              type: "diagram",
              content: ` MemorySet  (一个进程/内核有一个)
  ├── PageTable
  │     └── frames: Vec<FrameTracker>   // 所有中间/叶子页表帧
  ├── areas: Vec<MapArea>               // 每个 area 是一段连续 VPN 区间
  │     └── MapArea
  │           ├── vpn_range: [start, end)
  │           ├── map_type: Identical | Framed
  │           ├── map_perm: PTEFlags (R/W/X/U)
  │           └── data_frames: BTreeMap<VPN, FrameTracker>
  │                 // 仅 Framed 才用；Identical 没有自己的帧`,
            },
            { type: "paragraph", text: "核心想法：MemorySet 是 \"PageTable + 有含义的区间集合\"。PageTable 只知道 PTE，MapArea 记住 \"这段 VA 原本是什么（代码/栈/MMIO）\"，这让 unmap 和 fork 都很自然。" },
          ],
        },
        {
          title: "Identity vs Framed：两种映射的对照",
          blocks: [
            {
              type: "table",
              headers: ["方面", "Identical", "Framed"],
              rows: [
                ["VA → PA", "PA = VA", "PA = 从 FrameAllocator 新取一帧"],
                ["谁用", "内核自身 (.text/.rodata/.data/物理内存窗口)", "用户 ELF 段、用户栈、TrapContext"],
                ["data_frames", "空（不持有帧）", "每个 VPN 对应一个 FrameTracker"],
                ["拷贝 ELF 数据", "不需要（已经在原地）", "需要 memcpy 到新分配的帧"],
                ["特点", "地址关系最简单，方便内核访问物理内存", "隔离性强，进程之间无冲突"],
              ],
            },
            {
              type: "code",
              language: "rust",
              code: `// labs/phase_4_vm/src/mm/memory_set.rs
pub enum MapType { Identical, Framed }

pub struct MapArea {
    pub vpn_range: VPNRange,
    pub data_frames: BTreeMap<VirtPageNum, FrameTracker>,
    pub map_type: MapType,
    pub map_perm: PTEFlags,
}

impl MapArea {
    pub fn map_one(&mut self, pt: &mut PageTable, vpn: VirtPageNum) {
        let ppn = match self.map_type {
            MapType::Identical => PhysPageNum(vpn.0),
            MapType::Framed => {
                let f = frame_alloc().unwrap();
                let ppn = f.ppn;
                self.data_frames.insert(vpn, f);   // 必须持有，否则帧被 drop
                ppn
            }
        };
        pt.map(vpn, ppn, PTEFlags::V | self.map_perm);
    }
}`,
            },
          ],
        },
        {
          title: "地址空间布局（用户态）",
          blocks: [
            {
              type: "diagram",
              content: ` 用户地址空间 (每个进程一份)                        共享？
 ┌──────────────────────────────────────┐ 2^39-1
 │  Trampoline (R X)                    │   ═══► 与内核共享同一 PA！
 ├──────────────────────────────────────┤ TRAMPOLINE - 1
 │  TrapContext (R W, no U)             │   固定槽位；内核通过它恢复上下文
 ├──────────────────────────────────────┤
 │  …… 空洞（未映射）……                 │
 ├──────────────────────────────────────┤ user_sp
 │  user stack (R W U)                  │
 ├──────────────────────────────────────┤
 │  [guard page, unmapped]              │   栈溢出会触发 StorePageFault
 ├──────────────────────────────────────┤ max_end_vpn
 │  .bss  (R W U)                       │
 │  .data (R W U)                       │
 │  .rodata (R U)                       │
 │  .text (R X U)                       │
 └──────────────────────────────────────┘ 0`,
            },
            { type: "paragraph", text: "三个关键常量：TRAMPOLINE = 0xFFFF_FFFF_FFFF_F000（VA 空间顶端），TRAP_CONTEXT = TRAMPOLINE - PAGE_SIZE，USER_STACK 紧贴 TrapContext 下方留一页 guard。" },
          ],
        },
        {
          title: "Trampoline：为什么必须跨空间同 VA 同 PA",
          blocks: [
            { type: "paragraph", text: "想象 trap_return 的最后三条指令：csrw satp, t0 / sfence.vma / sret。satp 一旦切到用户页表，下一条 sfence.vma 就必须在新页表里也能取到——否则 PC+4 掉进空洞。" },
            {
              type: "diagram",
              content: ` 内核地址空间                           用户地址空间
 ┌────────────────────┐ 2^39-1         ┌────────────────────┐ 2^39-1
 │ Trampoline (R X)   │═══════════════ │ Trampoline (R X)   │
 │ PPN = X            │    同一 X      │ PPN = X            │
 ├────────────────────┤                ├────────────────────┤
 │ kernel identity…   │                │ TrapContext        │
 │                    │                │ user stack         │
 │                    │                │ user elf segments  │
 └────────────────────┘ 0              └────────────────────┘ 0

  csrw satp, t0         ← 这条指令 PC 在 Trampoline 里
  sfence.vma            ← 切到用户页表后，同一 VA 仍指向同一 PA`,
            },
            { type: "callout", variant: "warning", text: "如果内核不把 trampoline 映射到 2^39 - 4KiB，csrw 之后就立即 InstructionPageFault。这是 Phase 4 调试最痛苦的 bug，因为 QEMU 偶尔能蒙混过去，硬件就一定死。" },
            {
              type: "code",
              language: "rust",
              code: `// 每个 MemorySet（内核+用户）都要调用
fn map_trampoline(&mut self) {
    self.page_table.map(
        VirtAddr::from(TRAMPOLINE).into(),
        PhysAddr::from(strampoline as usize).into(),  // 链接脚本中导出的符号
        PTEFlags::R | PTEFlags::X,                     // 注意没有 U
    );
}`,
            },
          ],
        },
        {
          title: "TrapContext 页：为什么放在固定槽位",
          blocks: [
            { type: "paragraph", text: "内核要保存/恢复一个进程的寄存器，但在 trap_return 执行 csrw satp 之后，内核的数据已经不可见了。如果 TrapContext 在进程自己的 VA 里有一个固定槽位（TRAMPOLINE - PAGE_SIZE），那么 trampoline.S 就可以用这一个编译期常量寻址——不需要每次传参。" },
            {
              type: "list",
              ordered: true,
              items: [
                "内核在 __alltraps：先从 sscratch 取 user_satp 之前的临时寄存器栈，把寄存器一把存到 TRAP_CONTEXT_VA",
                "切到内核栈，调用 trap_handler",
                "trap_return：把 TRAP_CONTEXT_VA 里的寄存器恢复，再 csrw satp → sret",
                "整个过程内核只需要知道一个常量：TRAMPOLINE - 4KiB",
              ],
            },
          ],
        },
      ],
      exercises: [
        {
          id: "map-one",
          title: "实现 MapArea::map_one",
          description: "根据 map_type 选 identity 或 framed。Framed 情况下：frame_alloc() → insert 进 data_frames → page_table.map。",
          labFile: LAB_MS,
          pseudocode: `fn map_one(pt, vpn):
  ppn = match self.map_type:
    Identical => PPN(vpn.0)
    Framed    =>
      f = frame_alloc().unwrap()
      ppn = f.ppn
      self.data_frames.insert(vpn, f)   // 持有，否则立即 drop
      ppn
  pt.map(vpn, ppn, V | self.map_perm)`,
          hints: [
            "PhysPageNum(vpn.0) 这种赤裸 wrap 在 identity 情形下是合法的——物理帧号和虚拟页号数值相等",
            "忘 insert FrameTracker → 帧立即归还 → PTE 悬空",
          ],
        },
        {
          id: "from-elf",
          title: "实现 MemorySet::from_elf",
          description: "解析 ELF 的 PT_LOAD 程序头，为每段 push 一个 Framed MapArea；在最高段之上留 guard page + user stack；最后再插 TrapContext 页和 trampoline。返回 (memory_set, user_sp, entry)。",
          labFile: LAB_MS,
          pseudocode: `fn from_elf(elf_bytes):
  ms = MemorySet::new_bare()
  ms.map_trampoline()
  elf = ElfFile::new(elf_bytes)
  max_end = 0
  for ph in elf.program_iter() where ph.get_type() == Load:
    start_va = ph.virtual_addr()
    end_va   = start_va + ph.mem_size()
    perm     = PTEFlags::U |
               (R if ph.flags().R else 0) |
               (W if ph.flags().W else 0) |
               (X if ph.flags().X else 0)
    area = MapArea::new(start_va, end_va, Framed, perm)
    ms.push(area, Some(&elf_bytes[ph.offset()..ph.offset()+ph.file_size()]))
    max_end = max(max_end, end_va)

  user_stack_bottom = max_end + PAGE_SIZE           // guard
  user_stack_top    = user_stack_bottom + USER_STACK_SIZE
  ms.push(MapArea::new(user_stack_bottom, user_stack_top, Framed, R|W|U), None)

  // TrapContext slot
  ms.push(MapArea::new(TRAP_CONTEXT, TRAMPOLINE, Framed, R|W), None)

  return (ms, user_stack_top, elf.header.pt2.entry_point())`,
          hints: [
            "ELF flags 来自 ph.flags()：第 0 位 X、第 1 位 W、第 2 位 R（注意位序）",
            "push() 内部会对每个 VPN 调 map_one，然后把 data（如果有）memcpy 进去",
            "别忘了 U 位——不然用户进程读自己代码都会 PageFault",
          ],
        },
      ],
      acceptanceCriteria: [
        "memory_set::tests::test_from_elf_hello 返回合法 (entry, sp)",
        "memory_set::tests::test_trampoline_shared 验证内核与用户 trampoline PPN 相同",
        "能画出用户地址空间布局并标出 TRAMPOLINE / TRAP_CONTEXT",
        "能解释为什么 trampoline 不带 U 位",
      ],
      references: [
        {
          title: "[必读] rCore-Tutorial v3 · 4.4 内核与应用的地址空间",
          description: "MemorySet / MapArea / trampoline 的设计原版",
          url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/5kernel-app-spaces.html",
        },
        {
          title: "[必读] labs/phase_4_vm/COURSE.en.md · §4.5 trampoline trick",
          description: "本仓库的完整 trampoline 讲解（含 ASCII 图）",
          url: "./labs/phase_4_vm/COURSE.en.md",
        },
        {
          title: "[深入阅读] xv6-riscv book · Ch.4 Traps and system calls",
          description: "C 实现版 trampoline 与 trapframe 的对照讲解",
          url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf",
        },
      ],
    },

    // ─────────────────────────────── Lesson 5 ───────────────────────────────
    {
      phaseId: 4,
      lessonId: 5,
      title: "copy_from_user / copy_to_user：穿越地址空间的指针",
      subtitle: "translate_byte_buffer · SUM 位 · 跨页拷贝",
      type: "Concept + Practice",
      duration: "80 min",
      objectives: [
        "解释 \"内核不能直接 deref 用户指针\" 的两条根因",
        "写出 translate_byte_buffer 的循环结构",
        "知道 SUM 位何时该开、何时必须关",
        "避免 \"跨页用户缓冲区\" 造成的半页截断 bug",
      ],
      sections: [
        {
          title: "为什么不能 unsafe *user_ptr",
          blocks: [
            { type: "paragraph", text: "内核在处理系统调用时，satp 通常已经切到内核页表（或者仍停在用户页表，取决于设计）。无论哪种，裸 *ptr 都有两个致命问题：" },
            {
              type: "list",
              ordered: true,
              items: [
                "地址空间错配：内核页表里可能根本没有映射这个用户 VA，直接 deref 会 LoadPageFault",
                "权限保护：即使映射存在，U 位的存在会在 S-mode 触发异常（除非 SUM=1，且这是受控临时操作）",
                "物理不连续：一个 4KB 跨页的用户 buffer，在物理空间里可能是两块不相邻的帧——单次 memcpy 会越界",
              ],
            },
            { type: "callout", variant: "warning", text: "结论：内核必须显式走用户页表把 VA 翻译成 PA，然后用物理地址（或内核的 identity 映射）读/写。这正是 translate_byte_buffer 做的事。" },
          ],
        },
        {
          title: "translate_byte_buffer：一段 VA 映射为多段 PA",
          blocks: [
            {
              type: "diagram",
              content: ` 用户视角：一段连续 VA [ptr, ptr+len)
   |────────────────────────────────────────────|
   ptr                                        ptr+len

 物理视角：可能跨若干帧，每帧不一定相邻
   ┌─────┐   ┌─────┐         ┌─────┐
   │ PA0 │   │ PA1 │  ……     │ PAn │
   └─────┘   └─────┘         └─────┘
   [...]     [full]          [...]
   起始段：     中间段全页:       末尾段：
   从 ptr&0xFFF  完整 4KiB         到 (ptr+len)&0xFFF
   到 4096`,
            },
            {
              type: "code",
              language: "rust",
              code: `// labs/phase_4_vm/src/mm/page_table.rs
pub fn translated_byte_buffer(
    token: usize,                    // 用户 satp（含 MODE|ASID|PPN）
    ptr: *const u8,
    len: usize,
) -> Vec<&'static mut [u8]> {
    let page_table = PageTable::from_token(token);
    let mut start = ptr as usize;
    let end = start + len;
    let mut v = Vec::new();
    while start < end {
        let start_va = VirtAddr::from(start);
        let mut vpn: VirtPageNum = start_va.floor();
        let ppn = page_table.translate(vpn).unwrap().ppn();
        vpn.step();                   // 下一页起点
        let mut end_va: VirtAddr = vpn.into();
        end_va = end_va.min(VirtAddr::from(end));
        // 这一页里的 [start_va.page_offset(), end_va.page_offset() or 4096)
        if end_va.page_offset() == 0 {
            v.push(&mut ppn.get_bytes_array()[start_va.page_offset()..]);
        } else {
            v.push(&mut ppn.get_bytes_array()
                [start_va.page_offset()..end_va.page_offset()]);
        }
        start = end_va.into();
    }
    v
}`,
            },
            { type: "paragraph", text: "关键点：每次循环只处理 \"当前这一页内的片段\"。跨页的用户 buffer 被返回为 Vec<&mut [u8]>——调用者需要遍历这些切片（sys_write 就是逐片写到 stdout）。" },
          ],
        },
        {
          title: "SUM 位：内核读用户页的许可证",
          blocks: [
            { type: "paragraph", text: "即使通过物理地址走 identity 映射访问，有些实现（或你把内核留在用户页表里执行 syscall 的架构）会让内核触碰带 U 位的 PTE。这时必须打开 sstatus.SUM：" },
            {
              type: "code",
              language: "rust",
              code: `use riscv::register::sstatus;

pub fn with_sum<R>(f: impl FnOnce() -> R) -> R {
    unsafe { sstatus::set_sum(); }
    let r = f();
    unsafe { sstatus::clear_sum(); }
    r
}`,
            },
            {
              type: "table",
              headers: ["场景", "需要 SUM=1？"],
              rows: [
                ["通过 translate_byte_buffer 访问 identity-mapped phys mem", "不需要（identity 页没有 U）"],
                ["内核留在用户页表，直接访问用户 VA", "需要（否则 S-mode 访问 U 页 PageFault）"],
                ["sret 进入用户前/从用户返回后的 trap_handler", "必须 clear 回 0，防止 confused deputy"],
              ],
            },
            { type: "callout", variant: "tip", text: "\"confused deputy\"：如果 SUM 一直开着，内核代码可能被欺骗去读任意用户页；Linux 有 STAC/CLAC、SMAP 等硬件机制解决同样问题。RISC-V 用 SUM + 软件自律。" },
          ],
        },
        {
          title: "常见错误合集（Phase 4 全套）",
          blocks: [
            {
              type: "table",
              headers: ["#", "症状", "原因", "修复"],
              rows: [
                ["1", "csrw satp 之后立即 InstructionPageFault", "忘 sfence.vma，TLB 仍指旧页表", "csrw satp 后紧跟 sfence.vma zero, zero"],
                ["2", "加载 PTE 就 PageFault，标志看似合法", "W=1, R=0 是保留组合", "用 bitflags，永远一起置 R|W"],
                ["3", "进程跑几秒后 LoadPageFault / 读到别人数据", "FrameTracker 没被持有，帧被 drop 归还", "把 FrameTracker 存进 MapArea.data_frames"],
                ["4", "三级 walk 跳到 0xdeadbeef", "把 PTE 中的字段当 VPN 用，忘了 <<12", "next_pt = pte.ppn() 已是 PhysPageNum，左移 12 才是 PA"],
                ["5", "trap_return 的 sret 位置 InstructionPageFault", "trampoline 未在内核侧映射，或 VA 不一致", "所有 MemorySet 都 map_trampoline()，VA = 2^39 - 4KiB"],
                ["6", "用户栈悄悄踩到 .bss", "缺 guard page", "stack_bottom = max_end + PAGE_SIZE，留一页空洞"],
                ["7", "调度第二个进程时 syscall 参数乱码", "切 TCB 没切 satp", "trap_return 一开始 csrw satp, user_satp"],
                ["8", "sys_write 输出被截半", "跨页 buffer 只处理了前半段", "translated_byte_buffer 循环直到 start >= end"],
                ["9", "PPN 当 PA 传给 memcpy", "PPN 和 PA 差 12 位", "PA = ppn.0 << 12，用 PhysAddr::from(ppn) 而非 as usize"],
              ],
            },
          ],
        },
      ],
      exercises: [
        {
          id: "translate-buffer",
          title: "实现 translated_byte_buffer",
          description: "把 (token, ptr, len) 转成 Vec<&mut [u8]>——每个切片对应一个物理页内的片段。",
          labFile: LAB_PT,
          pseudocode: `v = []
cur = ptr
while cur < ptr + len:
  vpn   = floor(cur)
  ppn   = pt.translate(vpn).ppn
  next  = (vpn + 1).start_va
  slice_end = min(next, ptr + len)
  off_lo = cur - vpn.start_va
  off_hi = slice_end - vpn.start_va    // 可能 == 4096
  v.push(&mut ppn.bytes[off_lo..off_hi])
  cur = slice_end
return v`,
          hints: [
            "off_hi == 4096 时，bytes[off_lo..] 和 bytes[off_lo..4096] 等价",
            "translate() 失败（用户传了非法指针）必须向上报错，不要 unwrap——kill 当前任务更合适",
          ],
        },
        {
          id: "copy-to-user",
          title: "实现 copy_to_user",
          description: "对照 translate_byte_buffer，写一个把内核 &[u8] 拷进用户 VA 的版本。注意：可能跨页。",
          labFile: LAB_PT,
          pseudocode: `fn copy_to_user(token, dst_user: *mut u8, src: &[u8]):
  for slice in translated_byte_buffer(token, dst_user, src.len()):
    let n = slice.len()
    slice.copy_from_slice(&src[offset..offset+n])
    offset += n`,
          hints: [
            "别忘了维护一个 offset 累加到 src 上",
            "zero-length 要提前 return，否则循环会立即退出但代码看起来更清晰",
          ],
        },
      ],
      acceptanceCriteria: [
        "page_table::tests::test_translate_cross_page 通过（buffer 跨两页）",
        "sys_write(stdout, \"hello\", 5) 在用户程序里能正确输出",
        "能说出 SUM 位在本仓库实现里 \"通常是否需要\" 的答案",
        "能对照 Common Mistakes 表口述至少 3 个 bug 的根因",
      ],
      references: [
        {
          title: "[必读] labs/phase_4_vm/COURSE.en.md · Common Mistakes",
          description: "本仓库 9 个高频 bug 的症状/根因/修复对照表",
          url: "./labs/phase_4_vm/COURSE.en.md",
        },
        {
          title: "[必读] rCore-Tutorial v3 · 4.5 基于地址空间的分时多任务",
          description: "用户/内核地址空间切换的完整路径",
          url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/6multitasking-based-on-as.html",
        },
        {
          title: "[深入阅读] Linux SMAP/SMEP & RISC-V SUM/MXR",
          description: "硬件隔离策略的横向对比",
          url: "https://lwn.net/Articles/517251/",
        },
      ],
    },
  ],
};

export const phase4En: PhaseContent = {
  phaseId: 4,
  color: "#2563EB",
  accent: "#60A5FA",
  lessons: [
    // ─────────────────────────────── Lesson 1 ───────────────────────────────
    {
      phaseId: 4,
      lessonId: 1,
      title: "SV39 Three-Level Page Tables",
      subtitle: "39-bit VA · 9/9/9/12 split · 3-level walk · satp",
      type: "Concept",
      duration: "90 min",
      objectives: [
        "Memorize the 9/9/9/12 decomposition of an SV39 virtual address",
        "Draw the three-level walk from scratch",
        "Distinguish VPN vs PPN vs PA vs VA without confusion",
        "Write the satp MODE/ASID/PPN fields and know how to enable SV39",
      ],
      sections: [
        {
          title: "Why one VA needs three table lookups",
          blocks: [
            { type: "paragraph", text: "SV39 maps 39-bit virtual addresses to 56-bit physical addresses. A flat page table would need 2^27 × 8 B = 1 GiB of contiguous memory per process — absurd. Multi-level paging slices the VPN into 9-bit chunks, so every page table is exactly one 4 KiB frame (512 × 8 B PTEs), and interior levels are allocated only on demand." },
            { type: "paragraph", text: "Pages are fixed at 4 KiB (12-bit offset), so the real \"page number\" part of a VA is 39 − 12 = 27 bits, split 9 + 9 + 9 across three levels." },
            { type: "callout", variant: "info", text: "SV39 uses only the low 39 bits; bits 63..39 MUST be a sign-extension of bit 38 — otherwise fetch/load/store raises immediately. This carves the VA space into [0, 2^38) and [2^64 − 2^38, 2^64) — the low half for user, high half for kernel." },
          ],
        },
        {
          title: "The 39-bit VA bit layout",
          blocks: [
            {
              type: "diagram",
              content: ` 63                    39 38       30 29       21 20       12 11         0
 ┌───────────────────────┬───────────┬───────────┬───────────┬────────────┐
 │    sign-extend (=38)  │  VPN[2]   │  VPN[1]   │  VPN[0]   │   offset   │
 └───────────────────────┴───────────┴───────────┴───────────┴────────────┘
        25 bits            9 bits      9 bits      9 bits      12 bits
                           (L2 idx)    (L1 idx)    (L0 idx)    (in-page)`,
            },
            { type: "paragraph", text: "Mental model: VPN[2]/VPN[1]/VPN[0] are array indices into three page tables; offset is the byte offset inside the final 4 KiB frame. Together they form one full translation." },
          ],
        },
        {
          title: "The three-level walk, with concrete numbers",
          blocks: [
            {
              type: "diagram",
              content: ` satp.PPN ──► ┌────────── L2 page table (512 × PTE) ──────────┐
              │ ...                                            │
              │ [VPN[2]] = PTE2:  V=1 PPN=0x80201             │ (interior, R|W|X=0)
              │ ...                                            │
              └────────────┬───────────────────────────────────┘
                           │ next = PTE2.PPN << 12 = 0x80201000
                           ▼
              ┌────────── L1 page table at PA 0x80201000 ─────┐
              │ [VPN[1]] = PTE1:  V=1 PPN=0x80202             │
              └────────────┬───────────────────────────────────┘
                           ▼
              ┌────────── L0 page table at PA 0x80202000 ─────┐
              │ [VPN[0]] = PTE0:  V=1 R=1 W=1 U=1 PPN=0x80AFC │ (leaf!)
              └────────────┬───────────────────────────────────┘
                           ▼
              PA = (0x80AFC << 12) | offset`,
            },
            { type: "paragraph", text: "Up to three memory loads; a TLB hit collapses them to one register op. The \"leaf\" decision is not \"am I at level 0?\" — it is \"is any of R|W|X set?\". That is how SV39 supports 2 MiB and 1 GiB huge pages: promote the leaf to L1 or L2." },
            {
              type: "code",
              language: "rust",
              code: `// labs/phase_4_vm/src/mm/page_table.rs — core walk
fn find_pte(&self, vpn: VirtPageNum) -> Option<&mut PageTableEntry> {
    let idxs = vpn.indexes();               // [vpn2, vpn1, vpn0]
    let mut ppn = self.root_ppn;            // from satp.PPN
    for i in 0..3 {
        let pte = &mut ppn.get_pte_array()[idxs[i]];
        if i == 2 { return Some(pte); }     // L0 is the leaf
        if !pte.is_valid() { return None; } // hole in the middle
        ppn = pte.ppn();                    // next-level base
    }
    unreachable!()
}`,
            },
          ],
        },
        {
          title: "The satp CSR: \"start walking from here\"",
          blocks: [
            {
              type: "diagram",
              content: ` 63    60 59               44 43                                       0
 ┌───────┬───────────────────┬─────────────────────────────────────────┐
 │ MODE  │       ASID        │             root PPN                    │
 └───────┴───────────────────┴─────────────────────────────────────────┘
  4 bits       16 bits                       44 bits`,
            },
            {
              type: "table",
              headers: ["Field", "Width", "Meaning"],
              rows: [
                ["MODE", "4", "0=Bare (no translation) / 8=Sv39 / 9=Sv48 / 10=Sv57"],
                ["ASID", "16", "Address-space ID; lets multiple processes coexist in TLB"],
                ["PPN", "44", "Physical page number of the root (L2) page table"],
              ],
            },
            {
              type: "code",
              language: "rust",
              code: `// enable SV39
let satp = 8usize << 60             // MODE = Sv39
         | 0usize << 44             // ASID = 0 (kernel)
         | kernel_root_ppn.0;        // root PPN
unsafe {
    asm!("csrw satp, {0}", "sfence.vma", in(reg) satp);
}`,
            },
            { type: "callout", variant: "warning", text: "Writing satp does NOT flush the TLB. You MUST follow with sfence.vma — otherwise the CPU keeps using cached translations from the old address space and your very first fetch is InstructionPageFault." },
          ],
        },
        {
          title: "SV39 vs SV48: why this course picks SV39",
          blocks: [
            {
              type: "table",
              headers: ["Attribute", "SV39", "SV48"],
              rows: [
                ["VA bits", "39", "48"],
                ["Addressable space", "512 GiB", "256 TiB"],
                ["Levels", "3", "4"],
                ["QEMU virt support", "yes", "yes"],
                ["xv6-riscv / rCore default", "SV39", "optional"],
              ],
            },
            { type: "paragraph", text: "SV39 is plenty for teaching: a 3-level walk fits on a page, 512 GiB dwarfs QEMU's default 128 MiB of physical memory, and the SV48 generalization is just \"add VPN[3]\"." },
          ],
        },
      ],
      exercises: [
        {
          id: "hand-walk",
          title: "Hand-walk a translation",
          description: "Given VA = 0x0000_0040_0020_0ABC and satp.PPN = 0x80000, compute VPN[2..0] and offset, then write the PA produced by passing through L2/L1/L0 (assume each PTE.PPN = base + level).",
          labFile: LAB_ADDR,
          pseudocode: `vpn2 = (va >> 30) & 0x1FF
vpn1 = (va >> 21) & 0x1FF
vpn0 = (va >> 12) & 0x1FF
off  =  va        & 0xFFF
pa   = (leaf_ppn << 12) | off`,
          hints: [
            "Bit 38 of the VA must equal the upper 25 bits — otherwise it is an illegal VA",
            "9-bit mask is 0x1FF (= 511), not 0xFFF",
            "Final PA is 56 bits wide — don't truncate to 32",
          ],
        },
        {
          id: "indexes",
          title: "Implement VirtPageNum::indexes()",
          description: "In address.rs, given a 27-bit VPN, return the three 9-bit indices in [L2, L1, L0] order.",
          labFile: LAB_ADDR,
          pseudocode: `fn indexes(self) -> [usize; 3] {
    let mut vpn = self.0;
    let mut out = [0; 3];
    for i in (0..3).rev() {          // L0 pops first
        out[i] = vpn & 0x1FF;
        vpn >>= 9;
    }
    out                               // order: [L2, L1, L0]
}`,
          hints: [
            "Array index 0 is L2 (used first), don't flip the order",
            "vpn already excludes the 12-bit offset — do not shift again",
          ],
        },
      ],
      acceptanceCriteria: [
        "You can recite the 9/9/9/12 split and draw the 3-level walk",
        "You can name the three satp fields and explain MODE=8",
        "You can explain why sfence.vma must follow a satp write",
        "page_table::tests::test_walk_three_levels passes",
      ],
      references: [
        {
          title: "[Required] RISC-V Privileged Spec · Ch.10 Supervisor-Level Memory Management",
          description: "The normative source for SV39 — VA format, PTE layout, sfence semantics",
          url: "https://github.com/riscv/riscv-isa-manual/releases",
        },
        {
          title: "[Required] rCore-Tutorial v3 · Chapter 4.1 Address Space",
          description: "Sister tutorial with the same Rust + SV39 style",
          url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/2sv39-implementation-1.html",
        },
        {
          title: "[Deep dive] xv6-riscv book · Chapter 3 Page tables",
          description: "C implementation — great for cross-checking the Rust version",
          url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf",
        },
      ],
    },

    // ─────────────────────────────── Lesson 2 ───────────────────────────────
    {
      phaseId: 4,
      lessonId: 2,
      title: "PTE Flags: V/R/W/X/U/G/A/D",
      subtitle: "Permission matrix · leaf vs interior · reserved combos",
      type: "Concept",
      duration: "60 min",
      objectives: [
        "Know the semantics of all 8 low PTE flag bits",
        "Tell a leaf PTE from an interior PTE",
        "List the common permission combos and their purpose",
        "Recognize SV39's reserved/illegal flag combinations",
      ],
      sections: [
        {
          title: "The 64-bit PTE layout",
          blocks: [
            {
              type: "diagram",
              content: ` 63        54 53                            10 9   8 7 6 5 4 3 2 1 0
 ┌────────────┬─────────────────────────────────┬─────┬─┬─┬─┬─┬─┬─┬─┬─┐
 │  reserved  │              PPN                │ RSW │D│A│G│U│X│W│R│V│
 └────────────┴─────────────────────────────────┴─────┴─┴─┴─┴─┴─┴─┴─┴─┘
     10              44 bits                     2    1 1 1 1 1 1 1 1`,
            },
            { type: "paragraph", text: "Low 10 bits are flags, middle 44 bits are PPN, high 10 bits are reserved-zero. PPN must be shifted left by 12 to become a physical address — the single most common bug (see Lesson 3's Common Mistakes)." },
          ],
        },
        {
          title: "The 8 flag bits at a glance",
          blocks: [
            {
              type: "table",
              headers: ["bit", "name", "meaning", "who writes"],
              rows: [
                ["0", "V", "Valid — cleared PTEs make all other bits meaningless", "OS"],
                ["1", "R", "Leaf is readable", "OS"],
                ["2", "W", "Leaf is writable", "OS"],
                ["3", "X", "Leaf is executable (fetch)", "OS"],
                ["4", "U", "U-mode may access; S-mode needs sstatus.SUM=1", "OS"],
                ["5", "G", "Global (shared across ASIDs; usually on for kernel pages)", "OS"],
                ["6", "A", "Accessed — HW or SW sets on first access", "HW/SW"],
                ["7", "D", "Dirty — set on write (only meaningful if W)", "HW/SW"],
                ["8–9", "RSW", "Reserved for Software — yours to use", "OS"],
              ],
            },
          ],
        },
        {
          title: "Leaf PTE vs interior PTE",
          blocks: [
            { type: "paragraph", text: "How does hardware decide \"this PTE is a leaf\"? It checks R|W|X — if any of those is 1 it's a leaf; otherwise it descends. Hence:" },
            {
              type: "table",
              headers: ["R", "W", "X", "Hardware interpretation"],
              rows: [
                ["0", "0", "0", "Interior PTE (pointer to next-level table)"],
                ["1", "0", "0", "Leaf: read-only data (.rodata)"],
                ["1", "0", "1", "Leaf: code (.text / trampoline)"],
                ["1", "1", "0", "Leaf: read-write data (.data / stack)"],
                ["1", "1", "1", "Leaf: R+W+X (only JIT; usually forbidden)"],
                ["0", "1", "*", "RESERVED! hardware raises PageFault"],
                ["0", "0", "1", "Leaf: execute-only (rare but legal)"],
              ],
            },
            { type: "callout", variant: "warning", text: "W=1 with R=0 is a reserved encoding in SV39 — hardware will PageFault on it. Don't assume \"writable implies readable\"; RISC-V requires R to be set explicitly." },
          ],
        },
        {
          title: "Common permission combos cheat sheet",
          blocks: [
            {
              type: "table",
              headers: ["Combo", "Use"],
              rows: [
                ["V", "Interior PTE (pure pointer; R|W|X=0)"],
                ["V R X", "Kernel .text / trampoline"],
                ["V R", "Kernel .rodata"],
                ["V R W", "Kernel .data / .bss / phys-mem window"],
                ["V R W U", "User stack / heap / anon mmap"],
                ["V R X U", "User .text"],
                ["V R U", "User .rodata (ELF PT_LOAD with R only)"],
              ],
            },
            {
              type: "code",
              language: "rust",
              code: `// labs/phase_4_vm/src/mm/page_table.rs
bitflags! {
    pub struct PTEFlags: u8 {
        const V = 1 << 0;
        const R = 1 << 1;
        const W = 1 << 2;
        const X = 1 << 3;
        const U = 1 << 4;
        const G = 1 << 5;
        const A = 1 << 6;
        const D = 1 << 7;
    }
}

impl PageTableEntry {
    pub fn new(ppn: PhysPageNum, flags: PTEFlags) -> Self {
        Self { bits: (ppn.0 << 10) | flags.bits as usize }
    }
    pub fn ppn(&self)   -> PhysPageNum { ((self.bits >> 10) & ((1 << 44) - 1)).into() }
    pub fn flags(&self) -> PTEFlags    { PTEFlags::from_bits_truncate(self.bits as u8) }
    pub fn is_valid(&self) -> bool     { self.flags().contains(PTEFlags::V) }
    pub fn is_leaf(&self)  -> bool     { self.flags().intersects(PTEFlags::R | PTEFlags::W | PTEFlags::X) }
}`,
            },
          ],
        },
        {
          title: "The U bit and SUM: why the kernel can't read user pages by default",
          blocks: [
            { type: "paragraph", text: "When a page has U=1, an S-mode access faults unless sstatus.SUM (Supervisor User Memory) is 1. This is a defense against confused-deputy attacks where a buggy kernel is tricked into reading user data at the wrong time. Lesson 5's copy_from_user leverages exactly this bit." },
            {
              type: "code",
              language: "rust",
              code: `// open SUM briefly, then close it
unsafe { riscv::register::sstatus::set_sum(); }
// …read user buffer…
unsafe { riscv::register::sstatus::clear_sum(); }`,
            },
          ],
        },
      ],
      exercises: [
        {
          id: "flags-encode",
          title: "Implement PageTableEntry::new",
          description: "Shift the 44-bit PPN left by 10 and OR in flags.bits to form a 64-bit PTE. Mask flags so they can't spill into PPN.",
          labFile: LAB_PT,
          pseudocode: `bits = (ppn & ((1<<44)-1)) << 10 | (flags.bits as usize & 0x3FF)`,
          hints: [
            "Flags only use the low 10 bits (including RSW); don't let them leak into PPN",
            "Mask the PPN too so callers can't inject garbage high bits",
          ],
        },
        {
          id: "is-leaf",
          title: "Implement is_leaf / is_interior",
          description: "Leaf iff any of R|W|X is set; all zero means interior. A V=0 PTE has no leaf/interior meaning — handle that explicitly for clarity.",
          labFile: LAB_PT,
          hints: [
            "bitflags::intersects fits \"any of\" better than contains",
            "Check is_valid first, then leaf — keeps the control flow linear",
          ],
        },
      ],
      acceptanceCriteria: [
        "You can draw the 64-bit PTE layout from memory",
        "You can explain why W=1, R=0 is illegal",
        "You can explain what the SUM bit does",
        "page_table::tests::test_pte_encode_decode passes",
      ],
      references: [
        {
          title: "[Required] RISC-V Privileged Spec · §10.3.1 Addressing and Memory Protection",
          description: "Canonical source for PTE format, including the full list of reserved combos",
          url: "https://github.com/riscv/riscv-isa-manual/releases",
        },
        {
          title: "[Required] rCore-Tutorial v3 · 4.2 SV39 PTE",
          description: "Bit-by-bit walkthrough in Chinese",
          url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/3sv39-implementation-2.html",
        },
        {
          title: "[Deep dive] Writing an OS in Rust · Paging Introduction",
          description: "Phil-Opp's paging chapter — x86_64 but the concepts transfer",
          url: "https://os.phil-opp.com/paging-introduction/",
        },
      ],
    },

    // ─────────────────────────────── Lesson 3 ───────────────────────────────
    {
      phaseId: 4,
      lessonId: 3,
      title: "FrameAllocator: stack allocation + RAII safety",
      subtitle: "StackFrameAllocator · FrameTracker · recycled",
      type: "Concept + Practice",
      duration: "90 min",
      objectives: [
        "Compare stack vs bitmap frame allocators on time/space",
        "Internalize the RAII contract behind FrameTracker",
        "Explain why the recycled Vec's LIFO order is TLB-friendly",
        "Avoid the Rust-specific pitfall: \"tracker not held → frame returned early\"",
      ],
      sections: [
        {
          title: "One global allocator, full stop",
          blocks: [
            { type: "paragraph", text: "Physical memory is a global-singleton resource, so is the allocator — typically a lazy_static Mutex<StackFrameAllocator>. It hands out frames from (ekernel .. MEMORY_END), i.e. anything after the kernel's .bss." },
            {
              type: "diagram",
              content: ` ekernel                                                       MEMORY_END
  │                                                                   │
  ▼                                                                   ▼
  ┌──────┬────────────────────────────────────────────────────────────┐
  │ .bss │               allocatable physical frames                   │
  └──────┴────────────────────────────────────────────────────────────┘
            ▲                                   ▲
            │                                   │
        current (next never-allocated)         end`,
            },
          ],
        },
        {
          title: "StackFrameAllocator internals",
          blocks: [
            {
              type: "code",
              language: "rust",
              code: `// labs/phase_4_vm/src/mm/frame_allocator.rs
pub struct StackFrameAllocator {
    current: usize,                  // next never-allocated PPN
    end: usize,                      // upper bound (exclusive)
    recycled: Vec<usize>,            // PPNs handed back via dealloc
}

impl StackFrameAllocator {
    pub fn alloc(&mut self) -> Option<PhysPageNum> {
        if let Some(ppn) = self.recycled.pop() {
            Some(ppn.into())                 // reuse most recently freed
        } else if self.current < self.end {
            self.current += 1;
            Some((self.current - 1).into())
        } else {
            None                              // OOM
        }
    }

    pub fn dealloc(&mut self, ppn: PhysPageNum) {
        // sanity: never-allocated frames cannot be returned
        assert!(ppn.0 < self.current && !self.recycled.contains(&ppn.0),
                "double free PPN {:#x}", ppn.0);
        self.recycled.push(ppn.0);
    }
}`,
            },
            { type: "callout", variant: "tip", text: "LIFO side-effect: a just-freed frame is still hot in L1/L2 and probably still in the TLB — immediately reusing it often saves a cache miss. A quiet benefit of the stack allocator." },
          ],
        },
        {
          title: "Stack vs bitmap — how to choose",
          blocks: [
            {
              type: "table",
              headers: ["Axis", "Stack (current/recycled)", "Bitmap"],
              rows: [
                ["Metadata cost", "O(free frames), worst case = (phys mem / 4 KiB) × 8 B", "Fixed O(total frames / 8)"],
                ["alloc complexity", "O(1)", "O(N) to find first 0 bit (can add a free-list)"],
                ["dealloc complexity", "O(1)", "O(1)"],
                ["Fragmentation", "Ignored — no contiguity guarantee", "Supports contiguous regions (buddy system)"],
                ["Fit for…", "Teaching / small OS, mostly single-frame allocs", "Production kernel with hugepages & contiguous DMA"],
              ],
            },
            { type: "paragraph", text: "Phase 4 goes with stack: about 40 LOC, and its downside (no contiguous runs) does not hurt us — SV39 happily stitches disjoint physical frames into contiguous virtual regions." },
          ],
        },
        {
          title: "FrameTracker: Drop-driven de-allocation",
          blocks: [
            {
              type: "code",
              language: "rust",
              code: `pub struct FrameTracker {
    pub ppn: PhysPageNum,
}

impl FrameTracker {
    pub fn new(ppn: PhysPageNum) -> Self {
        // zero the frame so stale data can't look like valid PTEs
        let bytes = ppn.get_bytes_array();
        for b in bytes { *b = 0; }
        Self { ppn }
    }
}

impl Drop for FrameTracker {
    fn drop(&mut self) {
        FRAME_ALLOCATOR.lock().dealloc(self.ppn);
    }
}

pub fn frame_alloc() -> Option<FrameTracker> {
    FRAME_ALLOCATOR.lock().alloc().map(FrameTracker::new)
}`,
            },
            { type: "callout", variant: "warning", text: "Rust trap: `let ppn = frame_alloc().unwrap().ppn;` drops the whole FrameTracker at the end of the statement. The frame is reclaimed immediately, but your PTE still points at it. Always store the FrameTracker inside something whose lifetime matches the mapping (MapArea.data_frames, PageTable.frames)." },
          ],
        },
        {
          title: "Fragmentation — the cost the stack allocator willfully ignores",
          blocks: [
            { type: "paragraph", text: "Single-frame only, no contiguity guarantee — you can't directly allocate a 2 MiB hugepage or a DMA buffer. Production kernels solve this with a buddy allocator + slab. We accept the cost in the teaching version because every mapping is 4 KiB granular and the virtual layer reassembles discontiguous physical frames into contiguous VA ranges." },
          ],
        },
      ],
      exercises: [
        {
          id: "stack-alloc",
          title: "Implement StackFrameAllocator::alloc / dealloc",
          description: "Fill in alloc: prefer recycled.pop(), otherwise current++ until end. Fill in dealloc with a double-free assertion.",
          labFile: LAB_FA,
          pseudocode: `alloc():
  if let Some(ppn) = recycled.pop(): return Some(ppn)
  if current == end: return None
  ppn = current; current += 1
  return Some(ppn)

dealloc(ppn):
  assert ppn < current
  assert ppn not in recycled       // double free
  recycled.push(ppn)`,
          hints: [
            "Remember PhysPageNum::from(usize) for the type conversion",
            "double-free check: recycled.iter().any(|&p| p == ppn.0)",
          ],
        },
        {
          id: "frame-tracker",
          title: "Implement FrameTracker + frame_alloc",
          description: "Guarantees: (1) new() zeroes the 4 KiB page; (2) Drop returns the frame to the global allocator; (3) frame_alloc() returns Option<FrameTracker>.",
          labFile: LAB_FA,
          hints: [
            "Zero with: for b in ppn.get_bytes_array() { *b = 0; }",
            "Drop body: FRAME_ALLOCATOR.lock().dealloc(self.ppn)",
            "Do NOT #[derive(Copy)] — ownership of a frame must be unique",
          ],
        },
      ],
      acceptanceCriteria: [
        "frame_allocator::tests::test_alloc_recycle passes",
        "frame_allocator::tests::double_free_panics triggers a panic",
        "You can explain why FrameTracker cannot implement Copy",
        "You can justify the zero-on-alloc behavior",
      ],
      references: [
        {
          title: "[Required] rCore-Tutorial v3 · 4.3 Managing SV39 multi-level tables",
          description: "Original walkthrough of StackFrameAllocator / FrameTracker",
          url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/4sv39-implementation-3.html",
        },
        {
          title: "[Required] labs/phase_4_vm/COURSE.en.md · Lab 1 guide",
          description: "This repo's Lab 1 full writeup + common-mistake table",
          url: "./labs/phase_4_vm/COURSE.en.md",
        },
        {
          title: "[Deep dive] Linux Memory Management: Buddy Allocator",
          description: "The production-grade contiguous-frame algorithm",
          url: "https://www.kernel.org/doc/gorman/html/understand/understand009.html",
        },
      ],
    },

    // ─────────────────────────────── Lesson 4 ───────────────────────────────
    {
      phaseId: 4,
      lessonId: 4,
      title: "MemorySet + MapArea + Trampoline",
      subtitle: "Address-space struct · identity vs framed · cross-space page",
      type: "Concept + Practice",
      duration: "120 min",
      objectives: [
        "Draw the ownership graph of MemorySet / MapArea / PageTable",
        "Pick between identity and framed mapping for each region",
        "Explain why the trampoline must share the same VA in kernel and user spaces",
        "Internalize the \"fixed-slot TrapContext\" design",
      ],
      sections: [
        {
          title: "Three layers of ownership",
          blocks: [
            {
              type: "diagram",
              content: ` MemorySet  (one per process / one for the kernel)
  ├── PageTable
  │     └── frames: Vec<FrameTracker>   // all interior/leaf table frames
  ├── areas: Vec<MapArea>               // each area is a contiguous VPN range
  │     └── MapArea
  │           ├── vpn_range: [start, end)
  │           ├── map_type: Identical | Framed
  │           ├── map_perm: PTEFlags (R/W/X/U)
  │           └── data_frames: BTreeMap<VPN, FrameTracker>
  │                 // only used when Framed; Identical owns no frames`,
            },
            { type: "paragraph", text: "The core idea: MemorySet = \"PageTable + a labelled set of regions\". PageTable only knows PTEs; MapArea remembers \"this VA range was originally .text / stack / MMIO\", which makes unmap and fork natural." },
          ],
        },
        {
          title: "Identity vs Framed side-by-side",
          blocks: [
            {
              type: "table",
              headers: ["Aspect", "Identical", "Framed"],
              rows: [
                ["VA → PA", "PA = VA", "PA = fresh frame from FrameAllocator"],
                ["Who uses it", "Kernel itself (.text/.rodata/.data/phys-mem window)", "User ELF segments, user stack, TrapContext"],
                ["data_frames", "Empty (owns no frames)", "One FrameTracker per VPN"],
                ["Copy ELF data?", "No (already in place)", "Yes, memcpy into each new frame"],
                ["Trait", "Simplest PA relationship — easy kernel phys access", "Isolation — processes can't collide"],
              ],
            },
            {
              type: "code",
              language: "rust",
              code: `// labs/phase_4_vm/src/mm/memory_set.rs
pub enum MapType { Identical, Framed }

pub struct MapArea {
    pub vpn_range: VPNRange,
    pub data_frames: BTreeMap<VirtPageNum, FrameTracker>,
    pub map_type: MapType,
    pub map_perm: PTEFlags,
}

impl MapArea {
    pub fn map_one(&mut self, pt: &mut PageTable, vpn: VirtPageNum) {
        let ppn = match self.map_type {
            MapType::Identical => PhysPageNum(vpn.0),
            MapType::Framed => {
                let f = frame_alloc().unwrap();
                let ppn = f.ppn;
                self.data_frames.insert(vpn, f);   // must hold, else dropped
                ppn
            }
        };
        pt.map(vpn, ppn, PTEFlags::V | self.map_perm);
    }
}`,
            },
          ],
        },
        {
          title: "User address space layout",
          blocks: [
            {
              type: "diagram",
              content: ` User address space (one per process)                     shared?
 ┌──────────────────────────────────────┐ 2^39-1
 │  Trampoline (R X)                    │   ═══► same PA as kernel!
 ├──────────────────────────────────────┤ TRAMPOLINE - 1
 │  TrapContext (R W, no U)             │   fixed slot; kernel restores regs here
 ├──────────────────────────────────────┤
 │  ...... hole (unmapped) ......       │
 ├──────────────────────────────────────┤ user_sp
 │  user stack (R W U)                  │
 ├──────────────────────────────────────┤
 │  [guard page, unmapped]              │   stack overflow → StorePageFault
 ├──────────────────────────────────────┤ max_end_vpn
 │  .bss   (R W U)                      │
 │  .data  (R W U)                      │
 │  .rodata (R U)                       │
 │  .text  (R X U)                      │
 └──────────────────────────────────────┘ 0`,
            },
            { type: "paragraph", text: "Three key constants: TRAMPOLINE = 0xFFFF_FFFF_FFFF_F000 (top of VA), TRAP_CONTEXT = TRAMPOLINE − PAGE_SIZE, and USER_STACK sits right below TrapContext with one guard page." },
          ],
        },
        {
          title: "Trampoline: why same-VA-same-PA across spaces",
          blocks: [
            { type: "paragraph", text: "Consider the last three instructions of trap_return: csrw satp, t0 / sfence.vma / sret. The moment satp switches, the *next* instruction must have a translation under the new page table too — otherwise PC+4 drops into a hole." },
            {
              type: "diagram",
              content: ` Kernel address space                      User address space
 ┌────────────────────┐ 2^39-1            ┌────────────────────┐ 2^39-1
 │ Trampoline (R X)   │═══════════════════│ Trampoline (R X)   │
 │ PPN = X            │     same X        │ PPN = X            │
 ├────────────────────┤                   ├────────────────────┤
 │ kernel identity…   │                   │ TrapContext        │
 │                    │                   │ user stack         │
 │                    │                   │ user elf segments  │
 └────────────────────┘ 0                 └────────────────────┘ 0

  csrw satp, t0         ← this PC lives inside Trampoline
  sfence.vma            ← after the switch, same VA still maps to same PA`,
            },
            { type: "callout", variant: "warning", text: "If the kernel forgets to map trampoline at 2^39 − 4KiB, the very next instruction after csrw hits InstructionPageFault. This is the Phase 4 bug students dread — QEMU sometimes forgives it, real silicon never does." },
            {
              type: "code",
              language: "rust",
              code: `// every MemorySet (kernel + user) calls this
fn map_trampoline(&mut self) {
    self.page_table.map(
        VirtAddr::from(TRAMPOLINE).into(),
        PhysAddr::from(strampoline as usize).into(),  // symbol from linker script
        PTEFlags::R | PTEFlags::X,                     // note: no U
    );
}`,
            },
          ],
        },
        {
          title: "TrapContext page: why a fixed slot",
          blocks: [
            { type: "paragraph", text: "The kernel has to save/restore a process's registers, but right after csrw satp the kernel's own data is no longer visible. If TrapContext lives at a fixed slot in the process's own VA (TRAMPOLINE − PAGE_SIZE), trampoline.S can address it with one compile-time constant — no argument passing needed." },
            {
              type: "list",
              ordered: true,
              items: [
                "In __alltraps: use sscratch as a scratch pointer; save all regs to TRAP_CONTEXT_VA",
                "Switch to the kernel stack and call trap_handler",
                "In trap_return: restore regs from TRAP_CONTEXT_VA, then csrw satp → sret",
                "Through the whole dance the kernel needs exactly one constant: TRAMPOLINE − 4KiB",
              ],
            },
          ],
        },
      ],
      exercises: [
        {
          id: "map-one",
          title: "Implement MapArea::map_one",
          description: "Branch on map_type: Identical just wraps vpn as PPN; Framed calls frame_alloc(), inserts into data_frames, then page_table.map(vpn, ppn, V|perm).",
          labFile: LAB_MS,
          pseudocode: `fn map_one(pt, vpn):
  ppn = match self.map_type:
    Identical => PPN(vpn.0)
    Framed    =>
      f = frame_alloc().unwrap()
      ppn = f.ppn
      self.data_frames.insert(vpn, f)   // hold it, else dropped
      ppn
  pt.map(vpn, ppn, V | self.map_perm)`,
          hints: [
            "For Identical, PhysPageNum(vpn.0) is legitimate — the two numbers are equal",
            "Forgetting the .insert() drops the FrameTracker immediately → dangling PTE",
          ],
        },
        {
          id: "from-elf",
          title: "Implement MemorySet::from_elf",
          description: "Walk PT_LOAD program headers, push a Framed MapArea for each; above max_end leave a guard page, then the user stack; then the TrapContext page + trampoline. Return (memory_set, user_sp, entry).",
          labFile: LAB_MS,
          pseudocode: `fn from_elf(elf_bytes):
  ms = MemorySet::new_bare()
  ms.map_trampoline()
  elf = ElfFile::new(elf_bytes)
  max_end = 0
  for ph in elf.program_iter() where ph.get_type() == Load:
    start_va = ph.virtual_addr()
    end_va   = start_va + ph.mem_size()
    perm     = PTEFlags::U |
               (R if ph.flags().R else 0) |
               (W if ph.flags().W else 0) |
               (X if ph.flags().X else 0)
    area = MapArea::new(start_va, end_va, Framed, perm)
    ms.push(area, Some(&elf_bytes[ph.offset()..ph.offset()+ph.file_size()]))
    max_end = max(max_end, end_va)

  user_stack_bottom = max_end + PAGE_SIZE           // guard
  user_stack_top    = user_stack_bottom + USER_STACK_SIZE
  ms.push(MapArea::new(user_stack_bottom, user_stack_top, Framed, R|W|U), None)

  // TrapContext slot
  ms.push(MapArea::new(TRAP_CONTEXT, TRAMPOLINE, Framed, R|W), None)

  return (ms, user_stack_top, elf.header.pt2.entry_point())`,
          hints: [
            "ELF flags come from ph.flags(): bit0=X, bit1=W, bit2=R (mind the order)",
            "push() internally calls map_one per VPN, then memcpy's data into each frame (if supplied)",
            "Don't forget the U bit — otherwise a user process can't even read its own code",
          ],
        },
      ],
      acceptanceCriteria: [
        "memory_set::tests::test_from_elf_hello returns a valid (entry, sp)",
        "memory_set::tests::test_trampoline_shared shows identical PPN in kernel and user",
        "You can draw the user address space and label TRAMPOLINE / TRAP_CONTEXT",
        "You can explain why trampoline has no U bit",
      ],
      references: [
        {
          title: "[Required] rCore-Tutorial v3 · 4.4 Kernel and application address spaces",
          description: "The original MemorySet / MapArea / trampoline design writeup",
          url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/5kernel-app-spaces.html",
        },
        {
          title: "[Required] labs/phase_4_vm/COURSE.en.md · §4.5 trampoline trick",
          description: "This repo's full trampoline explanation (with ASCII diagrams)",
          url: "./labs/phase_4_vm/COURSE.en.md",
        },
        {
          title: "[Deep dive] xv6-riscv book · Ch.4 Traps and system calls",
          description: "C-version trampoline + trapframe walkthrough",
          url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf",
        },
      ],
    },

    // ─────────────────────────────── Lesson 5 ───────────────────────────────
    {
      phaseId: 4,
      lessonId: 5,
      title: "copy_from_user / copy_to_user: crossing address spaces",
      subtitle: "translate_byte_buffer · SUM bit · cross-page copies",
      type: "Concept + Practice",
      duration: "80 min",
      objectives: [
        "Name the two root causes for \"kernel can't just deref user pointers\"",
        "Write the loop structure of translate_byte_buffer from scratch",
        "Know when SUM must be on, when it must be off",
        "Avoid the \"half-page truncation\" bug on cross-page user buffers",
      ],
      sections: [
        {
          title: "Why `unsafe *user_ptr` is wrong",
          blocks: [
            { type: "paragraph", text: "When a syscall runs, satp is usually pointing at the kernel page table (or still pointing at the user page table, depending on design). Either way, naked *ptr has two fatal issues:" },
            {
              type: "list",
              ordered: true,
              items: [
                "Wrong address space: the kernel page table may not even have this user VA mapped — deref = LoadPageFault",
                "Permission mismatch: even if mapped, U=1 pages fault in S-mode unless SUM=1 (a controlled, short-lived exception)",
                "Non-contiguous physics: a 4 KB-crossing user buffer may sit on two non-adjacent frames — a single memcpy overruns the first frame",
              ],
            },
            { type: "callout", variant: "warning", text: "Conclusion: the kernel must explicitly walk the user page table to turn the VA into PAs, then read/write via physical addresses (or the kernel's identity mapping). That is exactly what translate_byte_buffer does." },
          ],
        },
        {
          title: "translate_byte_buffer: one VA range → several PA slices",
          blocks: [
            {
              type: "diagram",
              content: ` User view: contiguous VA [ptr, ptr+len)
   |────────────────────────────────────────────|
   ptr                                        ptr+len

 Physical view: several frames, possibly not adjacent
   ┌─────┐   ┌─────┐         ┌─────┐
   │ PA0 │   │ PA1 │  ……     │ PAn │
   └─────┘   └─────┘         └─────┘
   [...]     [full]          [...]
   first slice:  middle slices:   last slice:
   from ptr&0xFFF full 4KiB       through (ptr+len)&0xFFF
   to 4096`,
            },
            {
              type: "code",
              language: "rust",
              code: `// labs/phase_4_vm/src/mm/page_table.rs
pub fn translated_byte_buffer(
    token: usize,                    // user satp (MODE|ASID|PPN)
    ptr: *const u8,
    len: usize,
) -> Vec<&'static mut [u8]> {
    let page_table = PageTable::from_token(token);
    let mut start = ptr as usize;
    let end = start + len;
    let mut v = Vec::new();
    while start < end {
        let start_va = VirtAddr::from(start);
        let mut vpn: VirtPageNum = start_va.floor();
        let ppn = page_table.translate(vpn).unwrap().ppn();
        vpn.step();                   // next page start
        let mut end_va: VirtAddr = vpn.into();
        end_va = end_va.min(VirtAddr::from(end));
        if end_va.page_offset() == 0 {
            v.push(&mut ppn.get_bytes_array()[start_va.page_offset()..]);
        } else {
            v.push(&mut ppn.get_bytes_array()
                [start_va.page_offset()..end_va.page_offset()]);
        }
        start = end_va.into();
    }
    v
}`,
            },
            { type: "paragraph", text: "Key idea: each iteration handles one page's worth of the buffer. Cross-page user buffers come back as Vec<&mut [u8]> — callers (e.g. sys_write) then iterate those slices, writing each to stdout in turn." },
          ],
        },
        {
          title: "SUM: the kernel's permit to touch user pages",
          blocks: [
            { type: "paragraph", text: "Even when accessing via identity-mapped phys memory, certain designs (or architectures where the kernel stays on the user page table during syscalls) will land on a PTE with U=1. Then sstatus.SUM must be opened:" },
            {
              type: "code",
              language: "rust",
              code: `use riscv::register::sstatus;

pub fn with_sum<R>(f: impl FnOnce() -> R) -> R {
    unsafe { sstatus::set_sum(); }
    let r = f();
    unsafe { sstatus::clear_sum(); }
    r
}`,
            },
            {
              type: "table",
              headers: ["Scenario", "Need SUM=1?"],
              rows: [
                ["Access via identity-mapped phys mem returned by translate_byte_buffer", "No (identity pages have no U bit)"],
                ["Kernel stays on user page table and deref's user VA directly", "Yes (otherwise S-mode access to U page faults)"],
                ["Before sret to user / after returning from user trap_handler", "Must clear to 0 — prevents confused-deputy"],
              ],
            },
            { type: "callout", variant: "tip", text: "\"Confused deputy\": if SUM is left on, kernel code can be tricked into reading arbitrary user pages. Linux handles the same problem with STAC/CLAC and SMAP; RISC-V uses SUM plus software discipline." },
          ],
        },
        {
          title: "Common mistakes across Phase 4",
          blocks: [
            {
              type: "table",
              headers: ["#", "Symptom", "Root cause", "Fix"],
              rows: [
                ["1", "InstructionPageFault right after csrw satp", "Missing sfence.vma — stale TLB", "sfence.vma zero, zero after every satp write"],
                ["2", "PageFault with seemingly valid flags", "W=1, R=0 is a reserved combo", "Use bitflags; always set R with W"],
                ["3", "Random LoadPageFault / reads of other process's data", "FrameTracker not held, frame returned early", "Store it inside MapArea.data_frames"],
                ["4", "Walk jumps to 0xdeadbeef", "Mixed up PPN vs VPN — forgot <<12", "next_pt_base = pte.ppn() << 12 (use PhysAddr::from(PPN))"],
                ["5", "Trap-return sret faults", "Trampoline missing on kernel side, or VA mismatch", "Every MemorySet calls map_trampoline(), VA = 2^39 − 4KiB"],
                ["6", "User stack silently steps on .bss", "Missing guard page", "stack_bottom = max_end + PAGE_SIZE"],
                ["7", "Syscall args garbled on second task", "Switched TCB but not satp", "trap_return first csrw satp, user_satp"],
                ["8", "sys_write output truncated", "Cross-page buffer — only the first slice handled", "Loop translate_byte_buffer until start >= end"],
                ["9", "PPN passed where PA was expected", "PPN and PA differ by 12 bits", "PA = ppn.0 << 12; use PhysAddr::from(ppn), never as usize"],
              ],
            },
          ],
        },
      ],
      exercises: [
        {
          id: "translate-buffer",
          title: "Implement translated_byte_buffer",
          description: "Turn (token, ptr, len) into a Vec<&mut [u8]> — each slice sits inside exactly one physical page.",
          labFile: LAB_PT,
          pseudocode: `v = []
cur = ptr
while cur < ptr + len:
  vpn   = floor(cur)
  ppn   = pt.translate(vpn).ppn
  next  = (vpn + 1).start_va
  slice_end = min(next, ptr + len)
  off_lo = cur - vpn.start_va
  off_hi = slice_end - vpn.start_va   // may equal 4096
  v.push(&mut ppn.bytes[off_lo..off_hi])
  cur = slice_end
return v`,
          hints: [
            "When off_hi == 4096, bytes[off_lo..] and bytes[off_lo..4096] are equivalent",
            "If translate() fails (user passed a bad pointer), propagate an error — don't unwrap; killing the task is the right call",
          ],
        },
        {
          id: "copy-to-user",
          title: "Implement copy_to_user",
          description: "Mirror of translate_byte_buffer — copy a kernel &[u8] into a user VA. Handle cross-page destinations.",
          labFile: LAB_PT,
          pseudocode: `fn copy_to_user(token, dst_user: *mut u8, src: &[u8]):
  offset = 0
  for slice in translated_byte_buffer(token, dst_user, src.len()):
    let n = slice.len()
    slice.copy_from_slice(&src[offset..offset+n])
    offset += n`,
          hints: [
            "Keep a running offset into src across iterations",
            "Early-return on zero length keeps the loop's invariant clean",
          ],
        },
      ],
      acceptanceCriteria: [
        "page_table::tests::test_translate_cross_page passes (buffer spans two pages)",
        "sys_write(stdout, \"hello\", 5) in user code prints correctly",
        "You can answer whether SUM is \"generally needed\" in this repo's design",
        "You can recite at least 3 bugs and their root causes from the Common Mistakes table",
      ],
      references: [
        {
          title: "[Required] labs/phase_4_vm/COURSE.en.md · Common Mistakes",
          description: "This repo's 9-item symptom/root-cause/fix table",
          url: "./labs/phase_4_vm/COURSE.en.md",
        },
        {
          title: "[Required] rCore-Tutorial v3 · 4.5 Time-sharing on address spaces",
          description: "End-to-end user ↔ kernel address-space switching",
          url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/6multitasking-based-on-as.html",
        },
        {
          title: "[Deep dive] Linux SMAP/SMEP vs RISC-V SUM/MXR",
          description: "Cross-architecture comparison of kernel/user isolation",
          url: "https://lwn.net/Articles/517251/",
        },
      ],
    },
  ],
};
