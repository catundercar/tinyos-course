import type { PhaseContent } from "./types";

// ─── Phase 5: Block Device & File System (zh-CN) ───────────

export const phase5ZhCN: PhaseContent = {
  phaseId: 5,
  color: "#0891B2",
  accent: "#06B6D4",
  lessons: [
    // ── Lesson 1 ──────────────────────────────────────────
    {
      phaseId: 5, lessonId: 1,
      title: "VirtIO-blk 协议：把 QEMU 的磁盘当成寄存器操作",
      subtitle: "MMIO 寄存器 + virtqueue + 三段描述符请求",
      type: "Concept + Practice",
      duration: "2 hours",
      objectives: [
        "看懂 VirtIO MMIO 寄存器布局：MagicValue / QueueSel / QueuePFN / QueueNotify",
        "理解 virtqueue 三个环（descriptor / avail / used）的作用与内存布局",
        "掌握 virtio-blk 请求的三段描述符链：header + data + status",
        "知道为什么我们直接用 virtio-drivers crate，只实现 Hal trait",
      ],
      sections: [
        {
          title: "Phase 5 的目标：把 RAM 里的一切持久化",
          blocks: [
            { type: "paragraph", text: "Phase 0-4 所有的数据——页表、任务、堆——在 QEMU 关机的瞬间全部蒸发。Phase 5 做的事听起来朴素但意义重大：引入一块真正的磁盘，让 echo hi > f 的结果在 reboot 之后还能被 cat f 读出来。" },
            { type: "diagram", content:
`┌──────────── Phase 5 的软件栈 ────────────┐
│  sys_open / sys_read / sys_write          │  ← Lesson 5
├───────────────────────────────────────────┤
│  File trait  +  OSInode  +  FD 表          │  ← Lesson 5
├───────────────────────────────────────────┤
│  easy_fs::Inode  (目录项 / 名字解析)       │  ← Lesson 4
├───────────────────────────────────────────┤
│  DiskInode  (直接 + 一级 + 二级间接)        │  ← Lesson 4
├───────────────────────────────────────────┤
│  Bitmap 分配  +  5 区磁盘布局               │  ← Lesson 2
├───────────────────────────────────────────┤
│  BlockCache  (16 路 LRU, 写回)              │  ← Lesson 3
├───────────────────────────────────────────┤
│  BlockDevice trait  (read_block/write_block)│  ← Lesson 1
├───────────────────────────────────────────┤
│  VirtIOBlock  (MMIO + virtqueue)            │  ← Lesson 1
└───────────────────────────────────────────┘` },
            { type: "callout", variant: "info", text: "本 Phase 的每一层都只依赖下一层暴露的两个方法：read_block / write_block。整个栈加起来 ~500 行 Rust——易经（easy-fs）的「易」正是指此。" },
          ],
        },
        {
          title: "VirtIO 是什么：一个半虚拟化的标准设备接口",
          blocks: [
            { type: "paragraph", text: "真实磁盘驱动（AHCI、NVMe）动辄几千行；VirtIO 是 Hypervisor 和 Guest OS 之间约定的「简化设备接口」——不模拟真实硬件，而是暴露一组 MMIO 寄存器 + 共享内存中的环形队列。QEMU 用 -device virtio-blk-device 就把它挂到 0x1000_1000 物理地址。" },
            { type: "table", headers: ["offset", "寄存器", "作用"], rows: [
              ["0x000", "MagicValue", "固定 0x74726976（ASCII \"virt\"），驱动启动先读它验身"],
              ["0x004", "Version", "1 = legacy MMIO，2 = 新版（本课用 legacy）"],
              ["0x008", "DeviceID", "2 = block device，其它值代表 net/console/gpu 等"],
              ["0x030", "QueueSel", "选中要配置的队列号（blk 只有 1 个）"],
              ["0x038", "QueueNum", "告诉设备本队列深度（我们用 16）"],
              ["0x040", "QueuePFN", "descriptor 环的物理页号 —— 共享内存起点"],
              ["0x050", "QueueNotify", "向它写队列号 = kick（通知设备有新请求）"],
              ["0x070", "Status", "驱动按位写入 ACK/DRIVER/DRIVER_OK 标志位"],
            ]},
            { type: "callout", variant: "tip", text: "MMIO = Memory-Mapped I/O：对这些地址的 load/store 直接变成设备命令。不需要特殊指令，但一定要用 volatile 访问，否则编译器会把「写两次 QueueNotify」优化成一次。" },
          ],
        },
        {
          title: "virtqueue：共享内存里的三个环",
          blocks: [
            { type: "diagram", content:
`Descriptor Table (16 项)       Avail Ring (驱动→设备)    Used Ring (设备→驱动)
┌──────────────────────┐      ┌───────────────────┐    ┌───────────────────┐
│#0 addr|len|flags|next│      │idx | ring[0..16]  │    │idx | ring[0..16]  │
│#1 addr|len|flags|next│      │     │ desc_head   │    │     │ desc_head   │
│#2 addr|len|flags|next│      │     │   ...       │    │     │    len      │
│...                   │      └───────────────────┘    └───────────────────┘
│#15 ...               │             ▲                         ▲
└──────────────────────┘             │ 驱动 push               │ 设备 push
         ▲                            kick ─┐                   │
         │                                  ▼                   │
       三段链: head→data→status  ┌────────────────┐           │
                                  │ QEMU 后端       │──────────┘
                                  └────────────────┘` },
            { type: "paragraph", text: "三个环都在 guest 物理内存里，hypervisor 直接映射读写——零拷贝。Descriptor Table 存「一段内存」的地址/长度/flags；Avail Ring 是一个 FIFO，驱动把「本次请求链表的头描述符号」塞进去；Used Ring 反向，设备完成后把头号 + 写回字节数塞回来。" },
            { type: "table", headers: ["flag 位", "语义"], rows: [
              ["VIRTQ_DESC_F_NEXT (1)", "有后续描述符，next 字段有效"],
              ["VIRTQ_DESC_F_WRITE (2)", "设备将写入此 buffer（读请求里的 data / 所有请求的 status）"],
              ["VIRTQ_DESC_F_INDIRECT (4)", "本描述符指向另一张描述符表（大请求用，本课不用）"],
            ]},
          ],
        },
        {
          title: "一次读请求的三段描述符链",
          blocks: [
            { type: "diagram", content:
`read_block(sector=42) 展开成：

 desc #0 (RO)           desc #1 (RW)           desc #2 (RW)
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ BlkReqHeader │─next─▶│  data 512 B  │─next─▶│  status 1 B  │
│ type = IN(0) │       │  ← kernel    │       │  ← QEMU 写   │
│ reserved = 0 │       │    buffer    │       │    0 = OK    │
│ sector = 42  │       │              │       │    1 = IOERR │
│ flags: NEXT  │       │ flags:NEXT|W │       │ flags: WRITE │
└──────────────┘       └──────────────┘       └──────────────┘
  16 字节                    512 字节              1 字节
  驱动填，设备读              设备写此 buffer      设备写完后填

Avail.ring[idx++] = 0   (链表头的描述符号)
写 QueueNotify = 0      (kick!)
轮询 Used.ring 看 idx 有没有推进 → 取出完成的链` },
            { type: "callout", variant: "warning", text: "写请求和读请求唯一的区别是：type = OUT(1)，并且 data 描述符的 flags 不带 WRITE 位（数据方向对 virtio 而言是「从驱动视角」——读请求 = 设备写入 data；写请求 = 设备读出 data）。这个反直觉，考试常错。" },
          ],
        },
        {
          title: "为什么我们不自己手写 virtqueue",
          blocks: [
            { type: "paragraph", text: "上面这一切——初始化握手、描述符分配回收、内存对齐、feature negotiation——rCore 生态已经抽成了 virtio-drivers crate。驱动作者的工作被压缩到 2 件事：" },
            { type: "list", ordered: true, items: [
              "实现 Hal trait：告诉 crate 如何分配 DMA 内存、如何做物理地址/虚拟地址翻译",
              "把 VirtIOBlk<Hal, MmioTransport> 包一层 Mutex，实现 BlockDevice trait",
            ]},
            { type: "code", language: "rust", code:
`pub struct VirtIOBlock(Mutex<VirtIOBlk<'static, VirtioHal, MmioTransport>>);

impl BlockDevice for VirtIOBlock {
    fn read_block(&self, block_id: usize, buf: &mut [u8]) {
        self.0.lock().read_blocks(block_id, buf)
            .expect("virtio read failed");
    }
    fn write_block(&self, block_id: usize, buf: &[u8]) {
        self.0.lock().write_blocks(block_id, buf)
            .expect("virtio write failed");
    }
}` },
            { type: "callout", variant: "info", text: "教学目的是「懂得底下在做什么」而不是「把 700 行样板代码再敲一遍」。Phase 7（挑战课）有一节让你去掉 virtio-drivers 直接操作寄存器——到那时你已经读完本课，有能力自己对着 spec 1.1 实现了。" },
          ],
        },
        {
          title: "常见错误与调试线索",
          blocks: [
            { type: "list", ordered: false, items: [
              "DMA 一致性：真机上描述符环写入后必须 fence，否则设备可能看到旧值。QEMU 上「碰巧」不出错，到真板（VisionFive / Allwinner D1）就挂——一定要在 Hal::share 里写 fence.rw。",
              "请求格式：把 status 塞进 data 描述符是 spec 违规，QEMU 会返回 IOERR。一定要三个独立描述符。",
              "死等：轮询 Used Ring 时要限定一个大上限（比如 1_000_000 次），超过就 panic——否则设备坏了整个内核就僵住。",
              "sector 不是 byte offset：BlkReqHeader.sector 的单位是 512 B，别写成字节地址。",
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-virtio-block", title: "Lab 1 ⭐⭐ 实现 VirtIOBlock",
          description: "用 virtio-drivers crate 把 0x1000_1000 的 MMIO 设备包装成 BlockDevice。",
          labFile: "labs/phase_5_fs/src/drivers/virtio_blk.rs",
          hints: [
            "VirtIOBlk::new(MmioTransport::new(header)?)? 三步建对象",
            "VirtioHal 里的 dma_alloc 对齐到 4 KiB",
            "read_blocks / write_blocks 已是同步阻塞——crate 内部在轮询 Used Ring",
            "全局单例用 lazy_static! + Arc<dyn BlockDevice>",
          ],
          pseudocode:
`lazy_static! {
    pub static ref BLOCK_DEVICE: Arc<dyn BlockDevice> = {
        let header = unsafe { &mut *(VIRTIO0 as *mut VirtIOHeader) };
        let transport = MmioTransport::new(header).unwrap();
        let blk = VirtIOBlk::<VirtioHal, _>::new(transport).unwrap();
        Arc::new(VirtIOBlock(Mutex::new(blk)))
    };
}`,
        },
        {
          id: "lab1-hal", title: "Lab 1b ⭐ 实现 VirtioHal",
          description: "Hal trait 的 4 个方法告诉 crate 如何在内核里分配/释放物理连续页，以及虚拟↔物理地址转换（Phase 4 已经有 frame_alloc 可直接调）。",
          labFile: "labs/phase_5_fs/src/drivers/virtio_blk.rs",
          hints: [
            "dma_alloc(pages) → 循环调 frame_alloc，收集成 Vec<FrameTracker> 存入静态表",
            "phys_to_virt 在恒等映射下 = 原值",
            "virt_to_phys 查当前页表，或在内核态直接取低位（内核恒等映射）",
          ],
        },
      ],
      acceptanceCriteria: [
        "cargo test --test test_lab1_blkdev 通过：写入一个块、读回、数据一致",
        "能说明 VIRTQ_DESC_F_WRITE 为什么在读请求里贴在 data 上",
        "能画出从 read_block 到 MMIO 写 QueueNotify 的函数调用链",
      ],
      references: [
        { title: "rCore-Tutorial §6.1", description: "[必读] 块设备与 virtio-drivers 集成", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/1fs-interface.html" },
        { title: "VirtIO 1.1 Spec §4.2 & §5.2", description: "[必读] MMIO 寄存器权威定义 + virtio-blk 请求格式", url: "https://docs.oasis-open.org/virtio/virtio/v1.1/virtio-v1.1.pdf" },
        { title: "virtio-drivers crate docs", description: "[深入阅读] Rust 实现的代码可读性高于 Linux C 版", url: "https://docs.rs/virtio-drivers/" },
        { title: "xv6 kernel/virtio_disk.c", description: "[深入阅读] C 语言手写 virtqueue 的对照组，~300 行", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/virtio_disk.c" },
      ],
    },

    // ── Lesson 2 ──────────────────────────────────────────
    {
      phaseId: 5, lessonId: 2,
      title: "easy-fs 磁盘布局：5 个区划分 8192 个块",
      subtitle: "Superblock + 2 个 bitmap + inode 区 + data 区",
      type: "Concept + Practice",
      duration: "1.5 hours",
      objectives: [
        "掌握 easy-fs 的 5 区布局及各区字段含义",
        "能根据磁盘总大小手算 bitmap 和 inode 区的块数",
        "理解 bitmap 为什么用 [u64; 64] 数组 + trailing_ones 做 O(1) 分配",
        "看懂 SuperBlock 的 magic 校验逻辑",
      ],
      sections: [
        {
          title: "布局总览",
          blocks: [
            { type: "diagram", content:
`block #   0         1..a      a..b       b..c         c..total-1
        ┌─────────┬──────────┬──────────┬──────────┬──────────────────────┐
        │ Super   │ Inode    │ Data     │ Inodes   │ Data Blocks          │
        │ Block   │ Bitmap   │ Bitmap   │ packed   │ (one per file block) │
        │ 1 blk   │ N blks   │ M blks   │ 4/block  │                      │
        └─────────┴──────────┴──────────┴──────────┴──────────────────────┘
          ↑           ↑           ↑           ↑             ↑
        magic +     每位管1个   每位管1个    128 B ×       512 B × 一大片
        各区起点    inode       data block  (4N 个)
        与块数      (≤ 4096N)   (≤ 4096M)

所有「起点 + 块数」字段都写在 block 0 的 SuperBlock 里；
mkfs 计算一次、写进去，之后内核信赖它，不再重算。` },
            { type: "callout", variant: "info", text: "为什么是 5 个区而不是更多？因为 easy-fs 不支持 extent、journaling、reserved-gdt——ext2 那些花哨特性都没有。这是「最朴素但仍正确」的 Unix FS 形态，与 1984 年的 FFS 论文几乎同构。" },
          ],
        },
        {
          title: "SuperBlock：磁盘的元元数据",
          blocks: [
            { type: "code", language: "rust", code:
`#[repr(C)]
pub struct SuperBlock {
    magic: u32,                  // 0x3b800001 —— mkfs 时写入
    pub total_blocks: u32,
    pub inode_bitmap_blocks: u32,
    pub inode_area_blocks: u32,
    pub data_bitmap_blocks: u32,
    pub data_area_blocks: u32,
}

impl SuperBlock {
    pub fn is_valid(&self) -> bool {
        self.magic == EFS_MAGIC
    }
}` },
            { type: "paragraph", text: "加载文件系统时，内核先读 block 0 → 检查 magic → 如果不是 easy-fs 的魔数就 panic（避免把一个 ext4 镜像当 easy-fs 错读）。所有其它区的起点由 SuperBlock 的字段「前缀和」算出，不单独存。" },
          ],
        },
        {
          title: "容量计算：给定 4 MiB 磁盘，如何分？",
          blocks: [
            { type: "table", headers: ["量", "公式 / 值", "说明"], rows: [
              ["块大小", "512 B", "与 virtio-blk sector 一致，避免读写放大"],
              ["total_blocks", "4 MiB / 512 = 8192", "磁盘总块数"],
              ["inode_bitmap_blocks", "1 块 = 4096 bit", "最多 4096 个 inode（足够课程使用）"],
              ["inode_area_blocks", "⌈4096 / 4⌉ = 1024", "每块容 4 个 128 B inode"],
              ["data_bitmap_blocks", "≈ 2 块", "由「剩余块 / (1 + 4096)」解出，下面推导"],
              ["data_area_blocks", "8192 - 1 - 1 - 1024 - 2 = 7164", "实际存文件数据的块"],
            ]},
            { type: "paragraph", text: "data bitmap 自身也占块，还要管理后面的数据块——这是一个自指方程：设 data_bitmap_blocks = M，数据块数 = 8192 - 1 - 1 - 1024 - M，而 1 个 bitmap 块能管 4096 个数据块，所以 M = ⌈(8192-1026-M)/4096⌉。把 M=2 代入：4096×2 = 8192 ≥ 8192-1028 = 7164，成立。" },
            { type: "callout", variant: "tip", text: "可以手算一遍 8 MiB / 16 MiB 磁盘的分配，验证你对 easy-fs-fuse/src/main.rs 里的 EasyFileSystem::create 的理解。这是本课最容易被问到的面试题。" },
          ],
        },
        {
          title: "Bitmap 的 O(1) 分配技巧",
          blocks: [
            { type: "paragraph", text: "一个 bitmap 块 = 512 B = 4096 bit。如果循环 4096 次找第一个 0 位，alloc 就是 O(4096) 的热点。我们借助硬件 ctz 指令把它压成 O(64)。" },
            { type: "code", language: "rust", code:
`type BitmapBlock = [u64; 64];   // 64 × 64 = 4096 bit

pub fn alloc(&self, dev: &Arc<dyn BlockDevice>) -> Option<usize> {
    for block_id in 0..self.blocks {
        let pos = get_block_cache(block_id + self.start, dev).lock()
            .modify(0, |bits: &mut BitmapBlock| {
                // 每 64 bit 一组，找到第一个不是全 1 的
                for (i, w) in bits.iter_mut().enumerate() {
                    if *w != u64::MAX {
                        let bit = w.trailing_ones() as usize;  // ★ O(1)
                        *w |= 1u64 << bit;
                        return Some(i * 64 + bit);
                    }
                }
                None
            });
        if let Some(p) = pos { return Some(block_id * 4096 + p); }
    }
    None
}` },
            { type: "callout", variant: "warning", text: "trailing_ones 在 RISC-V 上编译成 ctz(!w)，单指令完成。千万不要手写 for bit in 0..64 循环——上百万次 alloc 的差距是几十倍。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab2-bitmap", title: "Lab 2a ⭐⭐ 实现 Bitmap::{alloc, dealloc}",
          description: "实现 bitmap 分配/回收。alloc 返回 bit 的全局编号（从本 bitmap 起点算起），dealloc(pos) 把对应位清零。",
          labFile: "labs/phase_5_fs/easy-fs/src/bitmap.rs",
          hints: [
            "alloc 用 trailing_ones；dealloc 直接 &= !(1u64 << bit)",
            "pos % 4096 确定本块内偏移，pos / 4096 确定块号",
            "dealloc 要 assert!(bit == 1) 否则暴露重复回收 bug",
          ],
          pseudocode:
`fn decomposition(pos: usize) -> (usize, usize, usize) {
    let block_pos = pos / BLOCK_BITS;
    let bit = pos % BLOCK_BITS;
    (block_pos, bit / 64, bit % 64)
}`,
        },
        {
          id: "lab2-layout", title: "Lab 2b ⭐ 手算一遍容量表",
          description: "给定 16 MiB 磁盘（32768 块），算出 inode_bitmap_blocks / inode_area_blocks / data_bitmap_blocks / data_area_blocks，并在 easy-fs-fuse 里打印 SuperBlock 验证。",
          hints: [
            "先固定 inode 数上限 = 4096（1 块 inode_bitmap 够）",
            "剩余 = 32768 - 1 - 1 - 1024 = 31742",
            "data_bitmap_blocks = ⌈31742 / 4097⌉ = 8",
          ],
        },
      ],
      acceptanceCriteria: [
        "cargo test --test test_lab2_bitmap 通过：alloc 4097 次后第 4097 个应返回不同 block_id",
        "SuperBlock::is_valid() 能挡住非 easy-fs 镜像",
        "能写出 data_bitmap_blocks 的自指方程并解出",
      ],
      references: [
        { title: "xv6 book Ch. 8.2 Buffer cache layer", description: "[必读] 类似的布局在 xv6 里叫 mkfs.c", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §6.3", description: "[必读] easy-fs 磁盘布局中文讲解", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/3fs-implementation.html" },
        { title: "A Fast File System for UNIX (1984)", description: "[深入阅读] 5 区布局的 30 年前原型", url: "https://dsf.berkeley.edu/cs262/FFS.pdf" },
      ],
    },

    // ── Lesson 3 ──────────────────────────────────────────
    {
      phaseId: 5, lessonId: 3,
      title: "Block Cache：16 路 LRU 为什么能救命",
      subtitle: "缓存块而非文件 + 写回策略 + Arc 强引用驱逐",
      type: "Concept + Practice",
      duration: "1.5 hours",
      objectives: [
        "理解为什么 easy-fs 在「块」而非「文件」粒度上做缓存",
        "掌握 LRU 的 VecDeque 实现与「强引用为 1 才可驱逐」规则",
        "看懂写回 vs 写通策略的权衡，以及 sync_all 在何时调用",
        "能解释一次 open(\"/hello.txt\") 的缓存命中路径（预期 2 次 miss）",
      ],
      sections: [
        {
          title: "为什么要缓存？数一下磁盘 IO 次数",
          blocks: [
            { type: "paragraph", text: "没有缓存时，一次 open(\"/hello.txt\") 需要触及的块：SuperBlock (1) + 根 inode 所在块 (1) + 根 inode 的 data 块若干 (3) + 目标 inode 块 (1) + 目标 inode 的数据块 (若干) ≈ 10 次磁盘读。加一个 16 路 LRU 后，除了 SuperBlock 和根 inode 所在块几乎永驻 MRU，只剩目标 inode 和数据块会 miss ≈ 2 次。" },
            { type: "diagram", content:
`无缓存：
  open    → [超级块][根inode块][根data×3][目标inode块][目标data]  = 7 次磁盘往返
  read    → [目标data×N]                                         = N 次

16 路 LRU：
  open    → 前 5 块全部在 MRU（启动期就加载过），只 miss 2 次
  read    → 顺序访问时前 1 块会 miss，其余 N-1 块若跨块也都 miss
            （数据块缓存收益有限——热点文件才有效）

MRU → [super][root_i][root_d0][root_d1][root_d2][bitmap_i]...[?] ← LRU
          ↑ 每次访问把它提到队首              ↑ 16 满了，选它驱逐` },
          ],
        },
        {
          title: "缓存块 vs 缓存文件",
          blocks: [
            { type: "table", headers: ["策略", "优点", "缺点"], rows: [
              ["块缓存（易经采用）", "元数据与数据统一；inode 块被多文件共享时不重复占用", "跨文件拷贝要经过 kernel memcpy，无 zero-copy"],
              ["文件缓存（Linux page cache）", "mmap/零拷贝友好；文件粒度预读", "元数据另开 dcache/icache；实现复杂度 3 倍"],
            ]},
            { type: "paragraph", text: "Linux 两种都有——struct buffer_head 是块缓存，struct page 是文件缓存。easy-fs 只实现块缓存，简单清晰。Phase 7 的挑战题会引入类似 page cache 的东西。" },
          ],
        },
        {
          title: "数据结构：VecDeque<(block_id, Arc<Mutex<BlockCache>>)>",
          blocks: [
            { type: "code", language: "rust", code:
`const BLOCK_CACHE_SIZE: usize = 16;

pub struct BlockCache {
    cache: [u8; BLOCK_SZ],   // 512
    block_id: usize,
    block_device: Arc<dyn BlockDevice>,
    modified: bool,
}

pub struct BlockCacheManager {
    queue: VecDeque<(usize, Arc<Mutex<BlockCache>>)>,
}` },
            { type: "diagram", content:
`get_block_cache(block_id, dev):
  ┌─ 命中？ (遍历 queue 找 block_id)
  │    └─ 是 → 返回 Arc<Mutex<BlockCache>>.clone()      （O(n) 但 n=16）
  │
  └─ miss：
       1. 若 queue.len() == 16：
             找到第一个 Arc::strong_count == 1 的项 → 踢出
             （它的 Drop 会自动 sync 脏块）
       2. 从磁盘读 block_id 进新 cache
       3. queue.push_back((block_id, Arc::new(...)))
       4. 返回` },
            { type: "callout", variant: "warning", text: "strong_count == 1 的判断是核心安全机制。如果另一线程正借用这个 cache 做长时间的 read_at，强制驱逐会让它的 MutexGuard 指向被替换的数据。规则是「只驱逐无人占用的」——若 16 项全被占用，直接 panic，告诉用户缓存太小。" },
          ],
        },
        {
          title: "写回（write-back）vs 写通（write-through）",
          blocks: [
            { type: "table", headers: ["策略", "write 行为", "crash 安全", "吞吐"], rows: [
              ["write-back（本课）", "改 cache，标记 modified；被驱逐或 sync 时落盘", "不安全——crash 时脏块丢失", "高：合并多次写"],
              ["write-through", "每次 write 立刻落盘", "更安全", "低：每次写都有磁盘延迟"],
            ]},
            { type: "paragraph", text: "BlockCache::drop 里检查 modified 位：如果脏，写回 block_device 再析构。这保证「正常退出时一切落盘」。但「crash / 断电」时有 16 个块的脏数据可能永远丢失——真 FS 用 journaling (ext4) 或 COW (btrfs/zfs) 解决这个问题，本课教学性地忽略。" },
            { type: "code", language: "rust", code:
`pub fn sync(&mut self) {
    if self.modified {
        self.modified = false;
        self.block_device.write_block(self.block_id, &self.cache);
    }
}
impl Drop for BlockCache { fn drop(&mut self) { self.sync(); } }

pub fn block_cache_sync_all() {
    // 关机前内核调一次，把所有缓存全部刷回
    for (_, c) in BLOCK_CACHE_MANAGER.lock().queue.iter() {
        c.lock().sync();
    }
}` },
          ],
        },
        {
          title: "modify / read：闭包传递 &mut T / &T",
          blocks: [
            { type: "code", language: "rust", code:
`impl BlockCache {
    pub fn read<T, V>(&self, offset: usize, f: impl FnOnce(&T) -> V) -> V {
        let type_size = core::mem::size_of::<T>();
        assert!(offset + type_size <= BLOCK_SZ);
        let ptr = (&self.cache[offset] as *const u8) as *const T;
        f(unsafe { &*ptr })
    }
    pub fn modify<T, V>(&mut self, offset: usize, f: impl FnOnce(&mut T) -> V) -> V {
        self.modified = true;
        let ptr = (&mut self.cache[offset] as *mut u8) as *mut T;
        f(unsafe { &mut *ptr })
    }
}` },
            { type: "callout", variant: "info", text: "这种「借出视图再通过闭包修改」的 API 是 Rust 惯用法——它保证 modified 位一定被设置（上层忘不掉），也避免返回指向缓存内部的生借用。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab3-cache", title: "Lab 3 ⭐⭐ 实现 BlockCacheManager",
          description: "实现 get_block_cache / 驱逐逻辑 / block_cache_sync_all。",
          labFile: "labs/phase_5_fs/easy-fs/src/block_cache.rs",
          hints: [
            "queue.iter().find(|(id,_)| *id == block_id) 命中判断",
            "position(|(_, c)| Arc::strong_count(c)==1) 找可驱逐项",
            "全局单例：lazy_static! + Mutex<BlockCacheManager>",
            "sync_all 在 panic_handler 和 shutdown 前都要调",
          ],
          pseudocode:
`pub fn get_block_cache(block_id, dev) -> Arc<Mutex<BlockCache>> {
    if let Some((_, c)) = queue.iter().find(|(id,_)| *id == block_id) {
        return c.clone();
    }
    if queue.len() == BLOCK_CACHE_SIZE {
        let (idx, _) = queue.iter().enumerate()
            .find(|(_, (_, c))| Arc::strong_count(c) == 1)
            .expect("cache full, all lines in use");
        queue.drain(idx..=idx);
    }
    let c = Arc::new(Mutex::new(BlockCache::new(block_id, dev)));
    queue.push_back((block_id, c.clone()));
    c
}`,
        },
      ],
      acceptanceCriteria: [
        "第 17 次访问不同块时触发驱逐，且被驱逐的是最早且无人占用的",
        "shutdown 之前 block_cache_sync_all 被调，脏块全部落盘",
        "cargo test --test test_lab3_cache 通过",
      ],
      references: [
        { title: "xv6 book Ch. 8.2 Buffer cache", description: "[必读] LRU bcache 的 C 实现讲解", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §6.3.2", description: "[必读] BlockCacheManager 代码逐行", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/3fs-implementation.html" },
        { title: "OSTEP Ch. 40 §40.10 Crash consistency", description: "[深入阅读] 写回策略的 crash 风险", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/file-journaling.pdf" },
      ],
    },

    // ── Lesson 4 ──────────────────────────────────────────
    {
      phaseId: 5, lessonId: 4,
      title: "DiskInode 与目录项：指针树和名字解析",
      subtitle: "直接 / 一级 / 二级间接块 + 32 字节目录项",
      type: "Concept + Practice",
      duration: "2 hours",
      objectives: [
        "记住 128 字节 DiskInode 的完整字段布局",
        "看懂 get_block_id(n) 的三段分支：direct / indirect1 / indirect2",
        "能算出最大文件大小 ≈ 8.08 MiB，并理解为什么是这个数",
        "实现 Inode::find / create / ls，掌握目录即文件的思想",
      ],
      sections: [
        {
          title: "DiskInode：128 字节里塞下一个文件",
          blocks: [
            { type: "code", language: "rust", code:
`const INODE_DIRECT_COUNT: usize = 28;
const INODE_INDIRECT1_COUNT: usize = 128;   // 512 B / 4 B
const INODE_INDIRECT2_COUNT: usize = 128 * 128;

#[repr(C)]
pub struct DiskInode {
    pub size: u32,                              // 字节数
    pub direct: [u32; INODE_DIRECT_COUNT],      // 28 个直接指针
    pub indirect1: u32,                          // 一级间接：指向块
    pub indirect2: u32,                          // 二级间接：指向「指针块」
    type_: DiskInodeType,                        // File / Directory
}
// 总大小：4 + 28*4 + 4 + 4 + 4 = 128 B （一块放 4 个，非常整齐）` },
            { type: "callout", variant: "info", text: "为什么不是 inode_bitmap 的每位对应一个 inode 对象——inode 对象本身住在「inode 区」，bitmap 只管分配位图。find 一个空 inode = bitmap.alloc() 返回的 pos 就是全局 inode 编号，pos / 4 → 哪一块，pos % 4 → 块内第几个。" },
          ],
        },
        {
          title: "指针树：从逻辑块号到物理块号",
          blocks: [
            { type: "diagram", content:
`           ┌─ direct[0]  ─────────────────────► block#A0  (512 B)
           ├─ direct[1]  ─────────────────────► block#A1
           │  ...
DiskInode ─┼─ direct[27] ─────────────────────► block#A27        14 KiB 合计
           │
           ├─ indirect1 ──► block#I1
           │                 ┌──────────────┐
           │                 │ u32[128]     │──► block#B0        64 KiB 合计
           │                 │              │──► block#B1
           │                 │              │──► ...
           │                 └──────────────┘
           │
           └─ indirect2 ──► block#I2
                             ┌──────────────┐
                             │ u32[128]     │──► block#C0 (二级指针块)
                             │              │       ┌──────────────┐
                             │              │       │ u32[128]     │──► D0 (数据)
                             │              │       │              │──► D1
                             │              │       └──────────────┘
                             └──────────────┘                    8 MiB 合计

最大文件：28 × 512 + 128 × 512 + 128 × 128 × 512
       = 14 KiB + 64 KiB + 8 MiB ≈ 8.08 MiB` },
            { type: "table", headers: ["范围", "n 的值", "公式"], rows: [
              ["直接块", "0 ≤ n < 28", "direct[n]"],
              ["一级间接", "28 ≤ n < 156", "indirect1_block[n - 28]"],
              ["二级间接", "156 ≤ n < 16540", "indirect2_block[(n-156)/128][(n-156)%128]"],
            ]},
            { type: "code", language: "rust", code:
`pub fn get_block_id(&self, inner_id: u32, dev: &Arc<dyn BlockDevice>) -> u32 {
    let n = inner_id as usize;
    if n < INODE_DIRECT_COUNT {
        self.direct[n]
    } else if n < INODE_DIRECT_COUNT + INODE_INDIRECT1_COUNT {
        get_block_cache(self.indirect1 as usize, dev).lock()
            .read(0, |b: &IndirectBlock| b[n - INODE_DIRECT_COUNT])
    } else {
        let last = n - INODE_DIRECT_COUNT - INODE_INDIRECT1_COUNT;
        let a0 = get_block_cache(self.indirect2 as usize, dev).lock()
            .read(0, |b: &IndirectBlock| b[last / INODE_INDIRECT1_COUNT]);
        get_block_cache(a0 as usize, dev).lock()
            .read(0, |b: &IndirectBlock| b[last % INODE_INDIRECT1_COUNT])
    }
}` },
            { type: "callout", variant: "warning", text: "increase_size 要按顺序分配：先填满 direct，再分配 indirect1 自身 + 128 个槽位，再分配 indirect2 + 若干二级指针块 + 数据块。顺序错了，truncate 时释放次序也会错。" },
          ],
        },
        {
          title: "read_at / write_at 的核心循环",
          blocks: [
            { type: "code", language: "rust", code:
`pub fn read_at(&self, offset: usize, buf: &mut [u8], dev: &Arc<dyn BlockDevice>) -> usize {
    let mut start = offset;
    let end = (offset + buf.len()).min(self.size as usize);
    if start >= end { return 0; }
    let mut start_block = start / BLOCK_SZ;
    let mut out = 0usize;
    while start < end {
        let end_current_block = ((start / BLOCK_SZ + 1) * BLOCK_SZ).min(end);
        let block_read = end_current_block - start;
        let dst = &mut buf[out..out + block_read];
        let block_id = self.get_block_id(start_block as u32, dev);
        get_block_cache(block_id as usize, dev).lock()
            .read(0, |d: &DataBlock| {
                let src = &d[start % BLOCK_SZ..start % BLOCK_SZ + block_read];
                dst.copy_from_slice(src);
            });
        out += block_read;
        start = end_current_block;
        start_block += 1;
    }
    out
}` },
            { type: "paragraph", text: "三个易错点：(1) 起始 / 结尾的「不完整块」要按 % 偏移只拷贝部分；(2) buf 小于文件剩余大小时用 min(offset + buf.len(), size)；(3) write_at 必须确保 offset + buf.len() ≤ size——增长文件是 increase_size 的职责，write_at 不自动扩容。" },
          ],
        },
        {
          title: "DirEntry：目录就是一个文件",
          blocks: [
            { type: "diagram", content:
`byte  0                            27 28        31
     ┌──────────────────────────────┬────────────┐
     │ name (NUL-padded, ≤ 27 字符) │ inode (u32)│
     └──────────────────────────────┴────────────┘
  一项 32 B；一块 512 B 放 16 项。
  目录文件就是 DirEntry 的数组，ls 就是 read_at 全部 + 遍历。

根目录示例：
 ┌──────────────┬──────┐
 │ "hello.txt"  │  12  │
 ├──────────────┼──────┤
 │ "apps/"      │   7  │   ← 本课不分 "/" 结尾，类型在 inode 自带
 ├──────────────┼──────┤
 │ ""   (空项)  │   0  │   ← 删除后不整理，留空
 └──────────────┴──────┘` },
            { type: "code", language: "rust", code:
`pub fn find(&self, name: &str) -> Option<Arc<Inode>> {
    self.read_disk_inode(|d| {
        assert!(d.is_dir());
        let count = (d.size as usize) / DIRENT_SZ;
        for i in 0..count {
            let mut ent = DirEntry::empty();
            d.read_at(i * DIRENT_SZ, ent.as_bytes_mut(), &self.block_device);
            if ent.name() == name {
                return Some(Arc::new(Inode::new(ent.inode_id(), ...)));
            }
        }
        None
    })
}` },
            { type: "callout", variant: "tip", text: "O(n) 的线性搜索对百项内的目录足够快。ext4 的 htree / btrfs 的 B 树是把它升级到 O(log n) 的方案——但在 easy-fs 的教学规模下，linear scan 比任何花哨数据结构都清晰易懂。" },
          ],
        },
        {
          title: "create：把三件事缝起来",
          blocks: [
            { type: "list", ordered: true, items: [
              "fs.alloc_inode() —— inode bitmap 分配一个 pos，得到全局 inode_id",
              "在 inode 区对应位置写入新 DiskInode（type=File，size=0，所有指针 0）",
              "在当前目录末尾 append 一条 DirEntry(name, inode_id)——需要先 increase_size(+32)",
            ]},
            { type: "paragraph", text: "三件事任一步失败都要回滚——本课简化：create 不支持并发，失败直接 panic。真 FS 要在 journal 里记录「原子组」，全部成功才提交。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab4-getblock", title: "Lab 4a ⭐⭐ 实现 DiskInode::get_block_id",
          description: "三段分支，定位逻辑块 n 的物理块号。务必用 get_block_cache 读间接块，不要直接 block_device.read_block。",
          labFile: "labs/phase_5_fs/easy-fs/src/layout.rs",
          hints: [
            "IndirectBlock = [u32; 128] 与 BlockCache::read 的闭包对接",
            "边界条件：n == INODE_DIRECT_COUNT - 1 是 direct 最后一个",
            "避免 as usize 溢出——先检查 n 范围再减偏移",
          ],
        },
        {
          id: "lab4-readat", title: "Lab 4b ⭐⭐⭐ 实现 DiskInode::read_at / write_at",
          description: "循环按块拷贝，处理首尾不完整块。写一个单元测试：创建一个 1.5 KiB 的文件，从 offset=100 读 1200 B，验证跨块正确。",
          labFile: "labs/phase_5_fs/easy-fs/src/layout.rs",
          hints: [
            "max_inner_id = (size + BLOCK_SZ - 1) / BLOCK_SZ",
            "write_at 不扩容——先调 increase_size 再写",
            "end_current_block 用 (start/BLOCK_SZ + 1) * BLOCK_SZ",
          ],
        },
        {
          id: "lab4-vfs", title: "Lab 4c ⭐⭐ 实现 Inode::{find, create, ls}",
          description: "目录操作。find 线性扫描；create 三步走；ls 返回 Vec<String>。",
          labFile: "labs/phase_5_fs/easy-fs/src/vfs.rs",
          hints: [
            "全局 fs 单例通过 Arc<Mutex<EasyFileSystem>> 持有",
            "修改目录后务必 block_cache_sync_all，否则 reboot 后丢失",
            "name > 27 字符应返回错误，别越界",
          ],
        },
      ],
      acceptanceCriteria: [
        "cargo test --test test_lab4_inode 通过：写入 7 MiB 文件 → 关掉 → 重开 → 读回一致",
        "ls / 返回当前目录下所有文件名，且顺序与创建顺序一致",
        "能正确报出最大文件大小（整数字节值）",
      ],
      references: [
        { title: "xv6 book Ch. 8.10 Directory layer", description: "[必读] dirlink / dirlookup 的 C 实现", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "OSTEP Ch. 39 File system implementation", description: "[必读] inode 指针树的经典讲解", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/file-implementation.pdf" },
        { title: "rCore-Tutorial §6.3.5-6.3.6", description: "[必读] DiskInode 与 Inode 中文解析", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/3fs-implementation.html" },
        { title: "Linux fs/ext2/inode.c", description: "[深入阅读] 工业级 inode 的 truncate / extend 逻辑", url: "https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/ext2/inode.c" },
      ],
    },

    // ── Lesson 5 ──────────────────────────────────────────
    {
      phaseId: 5, lessonId: 5,
      title: "VFS 层：File trait 统一文件与流",
      subtitle: "OSInode + stdin/stdout + sys_open/read/write/close",
      type: "Practice + Integration",
      duration: "2 hours",
      objectives: [
        "理解 File trait 为什么是统一「一切皆文件」的关键抽象",
        "实现 OSInode：给 easy-fs Inode 加上游标和读写权限",
        "实现 sys_open/read/write/close 四个系统调用",
        "跑通 cat / echo，重启后数据仍在——Phase 5 验收",
      ],
      sections: [
        {
          title: "File trait：统一抽象",
          blocks: [
            { type: "code", language: "rust", code:
`pub trait File: Send + Sync {
    fn readable(&self) -> bool;
    fn writable(&self) -> bool;
    fn read(&self, buf: UserBuffer) -> usize;
    fn write(&self, buf: UserBuffer) -> usize;
}` },
            { type: "diagram", content:
`                   ┌─ Stdin   (从 sbi_console 读 1 字节)
                   │
trait File ────────┼─ Stdout  (往 println! 写)
                   │
                   └─ OSInode (包装 easy_fs::Inode)

进程的 fd_table: Vec<Option<Arc<dyn File>>>

fd=0 → Stdin
fd=1 → Stdout
fd=2 → Stdout（未实现 stderr，合并）
fd≥3 → OSInode（open 后分配）

sys_read(fd, buf, n):
  file = task.fd_table[fd].clone()?
  assert!(file.readable())
  file.read(UserBuffer::new(buf, n))  ← 统一入口，不关心下层类型` },
            { type: "callout", variant: "info", text: "这个 trait 是 Unix 哲学「一切皆文件」的落地：管道、套接字、终端都能塞进 fd_table。Phase 6 的 pipe 就是实现 File 的第四种类型。" },
          ],
        },
        {
          title: "OSInode：给 easy-fs Inode 加游标",
          blocks: [
            { type: "code", language: "rust", code:
`pub struct OSInode {
    readable: bool,
    writable: bool,
    inner: Mutex<OSInodeInner>,
}
struct OSInodeInner {
    offset: usize,                  // 当前读写位置
    inode: Arc<easy_fs::Inode>,
}

impl File for OSInode {
    fn read(&self, mut buf: UserBuffer) -> usize {
        let mut inner = self.inner.lock();
        let mut total = 0;
        for slice in buf.buffers.iter_mut() {
            let n = inner.inode.read_at(inner.offset, slice);
            if n == 0 { break; }
            inner.offset += n;
            total += n;
        }
        total
    }
    fn write(&self, buf: UserBuffer) -> usize {
        let mut inner = self.inner.lock();
        let mut total = 0;
        for slice in buf.buffers.iter() {
            let n = inner.inode.write_at(inner.offset, slice);
            assert_eq!(n, slice.len());
            inner.offset += n;
            total += n;
        }
        total
    }
}` },
            { type: "paragraph", text: "UserBuffer 是 Phase 4 已有的工具：跨页的用户缓冲区拆成若干连续切片。循环每段调一次 inode.read_at/write_at——下层 easy-fs 根本不知道 buf 在用户态还是内核态。" },
          ],
        },
        {
          title: "Stdin / Stdout：两个退化实现",
          blocks: [
            { type: "code", language: "rust", code:
`pub struct Stdin;
pub struct Stdout;

impl File for Stdin {
    fn readable(&self) -> bool { true }
    fn writable(&self) -> bool { false }
    fn read(&self, mut buf: UserBuffer) -> usize {
        assert_eq!(buf.len(), 1);          // 一次读一个字节（简化）
        let c = loop {
            let c = sbi::console_getchar();
            if c != 0 { break c as u8; }
            suspend_current_and_run_next();    // 没输入就让出
        };
        unsafe { buf.buffers[0].as_mut_ptr().write_volatile(c); }
        1
    }
    fn write(&self, _: UserBuffer) -> usize { panic!("Stdin not writable"); }
}

impl File for Stdout {
    fn readable(&self) -> bool { false }
    fn writable(&self) -> bool { true }
    fn read(&self, _: UserBuffer) -> usize { panic!("Stdout not readable"); }
    fn write(&self, buf: UserBuffer) -> usize {
        for slice in buf.buffers.iter() {
            print!("{}", core::str::from_utf8(slice).unwrap());
        }
        buf.len()
    }
}` },
            { type: "callout", variant: "tip", text: "Stdin 的 console_getchar 非阻塞 —— 返回 0 就 yield 让调度器跑别的任务。这是最朴素的「协作式 I/O 多路复用」。Phase 6 会换成基于信号量的阻塞唤醒。" },
          ],
        },
        {
          title: "open_file：翻译 flags 到 easy-fs 操作",
          blocks: [
            { type: "code", language: "rust", code:
`bitflags! {
    pub struct OpenFlags: u32 {
        const RDONLY = 0;
        const WRONLY = 1 << 0;
        const RDWR   = 1 << 1;
        const CREATE = 1 << 9;
        const TRUNC  = 1 << 10;
    }
}
impl OpenFlags { pub fn read_write(&self) -> (bool, bool) { ... } }

pub fn open_file(name: &str, flags: OpenFlags) -> Option<Arc<OSInode>> {
    let (r, w) = flags.read_write();
    if flags.contains(OpenFlags::CREATE) {
        if let Some(inode) = ROOT.find(name) {
            inode.clear();                      // O_TRUNC 语义
            Some(Arc::new(OSInode::new(r, w, inode)))
        } else {
            let inode = ROOT.create(name)?;
            Some(Arc::new(OSInode::new(r, w, inode)))
        }
    } else {
        let inode = ROOT.find(name)?;
        if flags.contains(OpenFlags::TRUNC) { inode.clear(); }
        Some(Arc::new(OSInode::new(r, w, inode)))
    }
}` },
          ],
        },
        {
          title: "sys_open/read/write/close 四个系统调用",
          blocks: [
            { type: "code", language: "rust", code:
`pub fn sys_open(path: *const u8, flags: u32) -> isize {
    let token = current_user_token();
    let path = translated_str(token, path);
    let flags = OpenFlags::from_bits(flags).unwrap();
    if let Some(inode) = open_file(path.as_str(), flags) {
        let fd = current_task().alloc_fd(inode);
        fd as isize
    } else { -1 }
}
pub fn sys_close(fd: usize) -> isize {
    let t = current_task();
    if t.fd_table[fd].is_none() { return -1; }
    t.fd_table[fd].take();                   // 释放 Arc<dyn File>
    0
}
pub fn sys_read(fd, buf, n) -> isize {
    let file = current_task().fd_table[fd].clone()?;
    if !file.readable() { return -1; }
    let buf = UserBuffer::new(translated_byte_buffer(token, buf, n));
    file.read(buf) as isize
}
// sys_write 镜像对称` },
            { type: "callout", variant: "warning", text: "fd_table 的分配策略：找第一个 None 复用。这保证 fd 不会无限增长，也符合 Unix「open 返回最小未用 fd」的规范。close 之后 Arc 计数归 0，OSInode 析构——但 easy-fs::Inode 可能还被别的 fd 共享，所以 Arc 很重要。" },
          ],
        },
        {
          title: "整合验收流程",
          blocks: [
            { type: "diagram", content:
`user$ echo hello > greeting
        ↓ shell fork+exec
user程序调 sys_open("greeting", WRONLY|CREATE|TRUNC)
        ↓ ecall
sys_open → open_file → ROOT.create("greeting") → 分配 inode + 写 DirEntry
                       block_cache_sync_all
        ↓ 返回 fd=3
sys_write(3, "hello\\n", 6) → OSInode::write → Inode::write_at
                                               → DiskInode::write_at
                                               → BlockCache.modify
                                                 (脏标记，Drop 时刷回)
sys_close(3)                → Arc drop → 最后一个 fd 走，OSInode drop
                                         OSInode drop → Inode drop（如果是最后）

reboot → easy-fs 重新读 SuperBlock → ROOT.find("greeting") → 内容完好 ✓` },
          ],
        },
      ],
      exercises: [
        {
          id: "lab5-osinode", title: "Lab 5a ⭐⭐ 实现 OSInode + open_file",
          description: "让 easy-fs Inode 能充当 File。",
          labFile: "labs/phase_5_fs/src/fs/inode.rs",
          hints: [
            "OSInodeInner 用 Mutex 保护 offset + inode",
            "flags.read_write() 返回 (readable, writable) 二元组",
            "CREATE 但文件已存在的语义 = O_TRUNC 清空后复用",
          ],
        },
        {
          id: "lab5-stdio", title: "Lab 5b ⭐ 实现 Stdin / Stdout",
          description: "在进程启动时把 Stdin/Stdout 的 Arc 填入 fd_table[0..=2]。",
          labFile: "labs/phase_5_fs/src/fs/stdio.rs",
          hints: [
            "fd=2 暂时指向同一个 Stdout（stderr 留到 Phase 6）",
            "Stdin::read 里 sbi_console_getchar 返回 u8",
          ],
        },
        {
          id: "lab5-syscall", title: "Lab 5c ⭐⭐ sys_open/read/write/close",
          description: "接入 syscall 表，读写都要过 UserBuffer 以处理跨页。",
          labFile: "labs/phase_5_fs/src/syscall/fs.rs",
          hints: [
            "path 从用户态指针拷贝用 translated_str",
            "buf 的用户物理内存用 translated_byte_buffer 切片",
            "sys_close 要 take() 而不是仅设为 None，让 Arc 真正 drop",
          ],
          pseudocode:
`pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    match id {
        56 => sys_open(args[0] as *const u8, args[1] as u32, args[2] as u32),
        57 => sys_close(args[0]),
        63 => sys_read(args[0], args[1] as *const u8, args[2]),
        64 => sys_write(args[0], args[1] as *const u8, args[2]),
        ...
    }
}`,
        },
        {
          id: "lab5-integration", title: "Lab 5d ⭐⭐ 端到端验收",
          description: "make fs-img && make run：test_fs 用户程序通过，reboot 后 hello.txt 仍在。",
          labFile: "labs/phase_5_fs/user/src/bin/test_fs.rs",
          hints: [
            "make fs-img 调 easy-fs-fuse 在宿主构造 target/fs.img",
            "QEMU 用 -drive file=target/fs.img 挂载",
            "test_fs 步骤：写 → 读 → 验证 → 删除 → 再 open 期望失败",
          ],
        },
      ],
      acceptanceCriteria: [
        "make qemu 跑 test_fs 输出 \"test_fs OK\"",
        "关 QEMU、重启，test_fs 里上次留下的 hello.txt 能被 cat 读出",
        "scripts/grade.py 打满分（包括 LRU / bitmap / indirect2 的边界测试）",
        "lsof 风格的 task.fd_table 遍历不会泄漏 Arc",
      ],
      references: [
        { title: "xv6 book Ch. 8.6-8.10 File descriptor layer", description: "[必读] File 抽象的经典来源", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §6.4", description: "[必读] OSInode + sys_open 中文实现", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/4fs-syscall.html" },
        { title: "OSTEP Ch. 39 §39.3-39.4", description: "[必读] fd 表、open/read/write 语义", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/file-intro.pdf" },
        { title: "Linux fs/open.c + fs/read_write.c", description: "[深入阅读] 工业级 sys_open / vfs_read 源码", url: "https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs" },
        { title: "Stretch question", description: "[拓展] 如何扩展 File trait 以支持 lseek / fstat / mmap？如果允许 fd 跨进程共享（fork 后），offset 怎么处理？", url: "" },
      ],
    },
  ],
};

// ─── Phase 5: Block Device & File System (en) ──────────────

export const phase5En: PhaseContent = {
  phaseId: 5,
  color: "#0891B2",
  accent: "#06B6D4",
  lessons: [
    // ── Lesson 1 ──────────────────────────────────────────
    {
      phaseId: 5, lessonId: 1,
      title: "The VirtIO-blk protocol: treating the disk as registers",
      subtitle: "MMIO registers + virtqueue + three-descriptor requests",
      type: "Concept + Practice",
      duration: "2 hours",
      objectives: [
        "Read the VirtIO MMIO register map: MagicValue / QueueSel / QueuePFN / QueueNotify",
        "Understand the three rings of a virtqueue (descriptor / avail / used) and their memory layout",
        "Trace a virtio-blk request through its three-descriptor chain: header + data + status",
        "Know why we use the virtio-drivers crate and only implement the Hal trait",
      ],
      sections: [
        {
          title: "Phase 5's mission: persist everything that lived in RAM",
          blocks: [
            { type: "paragraph", text: "Every structure of Phases 0-4 — page tables, tasks, heap — evaporates the instant QEMU halts. Phase 5 is modest-sounding but enormous in consequence: add a real disk so that echo hi > f survives a reboot and cat f reads it back." },
            { type: "diagram", content:
`┌──────────── Phase 5 software stack ────────────┐
│  sys_open / sys_read / sys_write                │  ← Lesson 5
├─────────────────────────────────────────────────┤
│  File trait  +  OSInode  +  fd table            │  ← Lesson 5
├─────────────────────────────────────────────────┤
│  easy_fs::Inode  (dir entries / name lookup)    │  ← Lesson 4
├─────────────────────────────────────────────────┤
│  DiskInode  (direct + indirect1 + indirect2)    │  ← Lesson 4
├─────────────────────────────────────────────────┤
│  Bitmap alloc  +  5-region layout               │  ← Lesson 2
├─────────────────────────────────────────────────┤
│  BlockCache  (16-way LRU, write-back)           │  ← Lesson 3
├─────────────────────────────────────────────────┤
│  BlockDevice trait  (read_block/write_block)    │  ← Lesson 1
├─────────────────────────────────────────────────┤
│  VirtIOBlock  (MMIO + virtqueue)                │  ← Lesson 1
└─────────────────────────────────────────────────┘` },
            { type: "callout", variant: "info", text: "Every layer depends only on the two methods its neighbour exposes: read_block / write_block. The whole stack fits in ~500 lines of Rust — the \"easy\" in easy-fs is earned." },
          ],
        },
        {
          title: "What VirtIO is: a paravirtualised standard device interface",
          blocks: [
            { type: "paragraph", text: "Real disk drivers (AHCI, NVMe) run to thousands of lines. VirtIO is a simpler interface negotiated between the hypervisor and the guest: a handful of MMIO registers plus ring buffers in shared memory. QEMU's -device virtio-blk-device maps such a device at physical address 0x1000_1000." },
            { type: "table", headers: ["offset", "register", "purpose"], rows: [
              ["0x000", "MagicValue", "Constant 0x74726976 (ASCII \"virt\"); driver reads it first to verify"],
              ["0x004", "Version", "1 = legacy MMIO, 2 = modern. We use legacy"],
              ["0x008", "DeviceID", "2 = block device; other values for net/console/gpu"],
              ["0x030", "QueueSel", "Selects which queue we are configuring (blk has only one)"],
              ["0x038", "QueueNum", "Tells the device our ring depth (we use 16)"],
              ["0x040", "QueuePFN", "Physical page number of the descriptor ring — the shared memory root"],
              ["0x050", "QueueNotify", "Writing the queue number here = kick; device wakes up"],
              ["0x070", "Status", "Driver writes ACK / DRIVER / DRIVER_OK bits to complete handshake"],
            ]},
            { type: "callout", variant: "tip", text: "MMIO = Memory-Mapped I/O: loads and stores to these addresses turn into device commands. No special instructions — but you must use volatile accesses, otherwise the compiler will fuse \"write QueueNotify twice\" into a single write." },
          ],
        },
        {
          title: "virtqueue: three rings sharing memory",
          blocks: [
            { type: "diagram", content:
`Descriptor Table (16 entries)   Avail Ring (driver→device)   Used Ring (device→driver)
┌──────────────────────┐        ┌───────────────────┐         ┌───────────────────┐
│#0 addr|len|flags|next│        │idx | ring[0..16]  │         │idx | ring[0..16]  │
│#1 addr|len|flags|next│        │      desc_head    │         │      desc_head    │
│#2 addr|len|flags|next│        │         ...       │         │         len       │
│...                   │        └───────────────────┘         └───────────────────┘
│#15 ...               │               ▲                              ▲
└──────────────────────┘               │ driver push                  │ device push
         ▲                              kick ─┐                        │
         │                                    ▼                        │
       chain: head→data→status  ┌────────────────┐                    │
                                 │ QEMU backend   │─────────────────── ┘
                                 └────────────────┘` },
            { type: "paragraph", text: "All three rings live in guest physical memory; the hypervisor maps them directly — zero-copy. The Descriptor Table stores (addr, len, flags, next) per memory segment. The Avail Ring is a FIFO the driver writes the head descriptor index into; the Used Ring is the reverse, filled by the device with (head, bytes-written) on completion." },
            { type: "table", headers: ["flag bit", "meaning"], rows: [
              ["VIRTQ_DESC_F_NEXT (1)", "Chain continues via the next field"],
              ["VIRTQ_DESC_F_WRITE (2)", "Device will write this buffer (data on reads, status on every request)"],
              ["VIRTQ_DESC_F_INDIRECT (4)", "Points to a secondary descriptor table (large requests, not used here)"],
            ]},
          ],
        },
        {
          title: "A read request as three chained descriptors",
          blocks: [
            { type: "diagram", content:
`read_block(sector=42) expands to:

 desc #0 (RO)           desc #1 (RW)           desc #2 (RW)
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ BlkReqHeader │─next─▶│  data 512 B  │─next─▶│  status 1 B  │
│ type = IN(0) │       │   kernel     │       │ filled by    │
│ reserved = 0 │       │   buffer     │       │ QEMU         │
│ sector = 42  │       │              │       │ 0 = OK       │
│ flags: NEXT  │       │ flags:NEXT|W │       │ flags: WRITE │
└──────────────┘       └──────────────┘       └──────────────┘
  16 bytes                  512 bytes              1 byte
  driver fills,             device writes          device writes
  device reads              into this              after completion

Avail.ring[idx++] = 0   (head descriptor index)
write QueueNotify = 0   (kick!)
poll Used.ring until its idx advances → completion` },
            { type: "callout", variant: "warning", text: "A write request differs only in type = OUT(1) and that the data descriptor lacks WRITE. The direction is expressed from the driver's perspective — a read request means \"the device writes into data\", a write request means \"the device reads from data\". This is the most common exam-style trap." },
          ],
        },
        {
          title: "Why we don't hand-write the virtqueue",
          blocks: [
            { type: "paragraph", text: "All of the above — init handshake, descriptor alloc/free, memory alignment, feature negotiation — is already packaged by the rCore community in the virtio-drivers crate. The driver author's responsibility collapses to two items:" },
            { type: "list", ordered: true, items: [
              "Implement the Hal trait: tell the crate how to allocate DMA memory and translate between physical and virtual addresses",
              "Wrap VirtIOBlk<Hal, MmioTransport> in a Mutex and implement BlockDevice",
            ]},
            { type: "code", language: "rust", code:
`pub struct VirtIOBlock(Mutex<VirtIOBlk<'static, VirtioHal, MmioTransport>>);

impl BlockDevice for VirtIOBlock {
    fn read_block(&self, block_id: usize, buf: &mut [u8]) {
        self.0.lock().read_blocks(block_id, buf)
            .expect("virtio read failed");
    }
    fn write_block(&self, block_id: usize, buf: &[u8]) {
        self.0.lock().write_blocks(block_id, buf)
            .expect("virtio write failed");
    }
}` },
            { type: "callout", variant: "info", text: "The pedagogical goal is \"understand what's underneath\", not \"type 700 lines of boilerplate\". A stretch lab in Phase 7 drops virtio-drivers and asks you to drive the registers by hand — by then this lesson gives you the map." },
          ],
        },
        {
          title: "Common mistakes and debugging clues",
          blocks: [
            { type: "list", ordered: false, items: [
              "DMA coherency — on real hardware you must fence after descriptor writes or the device sees stale values. QEMU happens to forgive you; real RISC-V boards (VisionFive, Allwinner D1) will silently corrupt. Put fence.rw in Hal::share.",
              "Request layout — putting status inside the data descriptor violates the spec; QEMU returns IOERR. Three independent descriptors, always.",
              "Busy-wait forever — bound the poll loop (say 1_000_000 iterations), panic on overflow. A broken device should crash loudly, not hang the kernel.",
              "Sector vs byte — BlkReqHeader.sector is in units of 512 bytes, not bytes.",
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-virtio-block", title: "Lab 1 ⭐⭐ Implement VirtIOBlock",
          description: "Use the virtio-drivers crate to wrap the MMIO device at 0x1000_1000 into a BlockDevice.",
          labFile: "labs/phase_5_fs/src/drivers/virtio_blk.rs",
          hints: [
            "VirtIOBlk::new(MmioTransport::new(header)?)? constructs in three steps",
            "Align dma_alloc in VirtioHal to 4 KiB",
            "read_blocks / write_blocks are synchronous — the crate polls Used Ring internally",
            "Expose the global singleton via lazy_static! + Arc<dyn BlockDevice>",
          ],
          pseudocode:
`lazy_static! {
    pub static ref BLOCK_DEVICE: Arc<dyn BlockDevice> = {
        let header = unsafe { &mut *(VIRTIO0 as *mut VirtIOHeader) };
        let transport = MmioTransport::new(header).unwrap();
        let blk = VirtIOBlk::<VirtioHal, _>::new(transport).unwrap();
        Arc::new(VirtIOBlock(Mutex::new(blk)))
    };
}`,
        },
        {
          id: "lab1-hal", title: "Lab 1b ⭐ Implement VirtioHal",
          description: "The Hal trait's four methods tell the crate how to allocate physically contiguous pages and translate addresses. Phase 4 already gives you frame_alloc.",
          labFile: "labs/phase_5_fs/src/drivers/virtio_blk.rs",
          hints: [
            "dma_alloc(pages) loops frame_alloc and stores FrameTrackers in a static table",
            "phys_to_virt is identity under our kernel identity mapping",
            "virt_to_phys walks the current page table or returns the low bits (kernel identity)",
          ],
        },
      ],
      acceptanceCriteria: [
        "cargo test --test test_lab1_blkdev passes: write a block, read it back, data matches",
        "Can explain why VIRTQ_DESC_F_WRITE is set on the data descriptor of a read request",
        "Can sketch the call chain from read_block down to the MMIO write on QueueNotify",
      ],
      references: [
        { title: "rCore-Tutorial §6.1", description: "[Required] Block devices and virtio-drivers integration", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/1fs-interface.html" },
        { title: "VirtIO 1.1 Spec §4.2 & §5.2", description: "[Required] Authoritative MMIO register map and virtio-blk request format", url: "https://docs.oasis-open.org/virtio/virtio/v1.1/virtio-v1.1.pdf" },
        { title: "virtio-drivers crate docs", description: "[Deep dive] Rust implementation more readable than Linux's C version", url: "https://docs.rs/virtio-drivers/" },
        { title: "xv6 kernel/virtio_disk.c", description: "[Deep dive] A ~300-line C hand-rolled virtqueue for comparison", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/virtio_disk.c" },
      ],
    },

    // ── Lesson 2 ──────────────────────────────────────────
    {
      phaseId: 5, lessonId: 2,
      title: "The easy-fs disk layout: five regions over 8192 blocks",
      subtitle: "Superblock + two bitmaps + inode area + data area",
      type: "Concept + Practice",
      duration: "1.5 hours",
      objectives: [
        "Memorise the five regions of easy-fs and the fields in each",
        "Compute bitmap and inode-region block counts from a total disk size",
        "Understand why the bitmap stores [u64; 64] and uses trailing_ones for O(1) alloc",
        "Read the SuperBlock magic-check logic",
      ],
      sections: [
        {
          title: "The layout at a glance",
          blocks: [
            { type: "diagram", content:
`block #   0         1..a       a..b       b..c         c..total-1
        ┌─────────┬──────────┬──────────┬──────────┬──────────────────────┐
        │ Super   │ Inode    │ Data     │ Inodes   │ Data Blocks          │
        │ Block   │ Bitmap   │ Bitmap   │ packed   │ (one per file block) │
        │ 1 blk   │ N blks   │ M blks   │ 4/block  │                      │
        └─────────┴──────────┴──────────┴──────────┴──────────────────────┘
          ↑           ↑           ↑           ↑             ↑
        magic +     one bit     one bit    128 B x        512 B x many
        region      per inode   per data    (4N total)
        starts      (≤ 4096N)   (≤ 4096M)

Every "start + length" lives in block 0's SuperBlock; mkfs computes it once,
writes it there, and the kernel trusts it forever after.` },
            { type: "callout", variant: "info", text: "Why five regions and not more? Because easy-fs omits extents, journaling, reserved-gdt, quotas — every ext2 feature is stripped. This is the \"simplest thing that still works\", almost isomorphic to the 1984 FFS paper." },
          ],
        },
        {
          title: "SuperBlock: the metadata of metadata",
          blocks: [
            { type: "code", language: "rust", code:
`#[repr(C)]
pub struct SuperBlock {
    magic: u32,                  // 0x3b800001 — written by mkfs
    pub total_blocks: u32,
    pub inode_bitmap_blocks: u32,
    pub inode_area_blocks: u32,
    pub data_bitmap_blocks: u32,
    pub data_area_blocks: u32,
}

impl SuperBlock {
    pub fn is_valid(&self) -> bool { self.magic == EFS_MAGIC }
}` },
            { type: "paragraph", text: "At mount the kernel reads block 0, checks magic, and panics on mismatch — this stops us from silently corrupting an ext4 image we mistook for easy-fs. All other region starts are prefix-sums of the SuperBlock fields, never stored separately." },
          ],
        },
        {
          title: "Capacity math: given a 4 MiB disk, how do we split it?",
          blocks: [
            { type: "table", headers: ["quantity", "formula / value", "note"], rows: [
              ["block size", "512 B", "matches virtio-blk sector — no read/write amplification"],
              ["total_blocks", "4 MiB / 512 = 8192", "total block count"],
              ["inode_bitmap_blocks", "1 block = 4096 bits", "max 4096 inodes (plenty for coursework)"],
              ["inode_area_blocks", "⌈4096 / 4⌉ = 1024", "four 128-byte inodes per block"],
              ["data_bitmap_blocks", "≈ 2 blocks", "solved from a self-referential equation below"],
              ["data_area_blocks", "8192 - 1 - 1 - 1024 - 2 = 7164", "actual file data blocks"],
            ]},
            { type: "paragraph", text: "data bitmap consumes blocks and governs the blocks that follow — a self-referential equation. Let M = data_bitmap_blocks, data_blocks = 8192 - 1 - 1 - 1024 - M, and one bitmap block covers 4096 data blocks, so M = ⌈(8192-1026-M)/4096⌉. Plug M=2: 4096×2 = 8192 ≥ 8192-1028 = 7164. It holds." },
            { type: "callout", variant: "tip", text: "Repeat for 8 MiB / 16 MiB disks by hand — it proves you can read easy-fs-fuse/src/main.rs's EasyFileSystem::create. This is the most common interview-style question on this module." },
          ],
        },
        {
          title: "O(1) bitmap allocation",
          blocks: [
            { type: "paragraph", text: "A bitmap block is 512 B = 4096 bits. A naive linear scan would be O(4096) on the hot path. We compress it to O(64) via the hardware count-trailing-zeros instruction." },
            { type: "code", language: "rust", code:
`type BitmapBlock = [u64; 64];   // 64 × 64 = 4096 bits

pub fn alloc(&self, dev: &Arc<dyn BlockDevice>) -> Option<usize> {
    for block_id in 0..self.blocks {
        let pos = get_block_cache(block_id + self.start, dev).lock()
            .modify(0, |bits: &mut BitmapBlock| {
                // every 64-bit word: find the first not all-ones
                for (i, w) in bits.iter_mut().enumerate() {
                    if *w != u64::MAX {
                        let bit = w.trailing_ones() as usize;  // ★ O(1)
                        *w |= 1u64 << bit;
                        return Some(i * 64 + bit);
                    }
                }
                None
            });
        if let Some(p) = pos { return Some(block_id * 4096 + p); }
    }
    None
}` },
            { type: "callout", variant: "warning", text: "trailing_ones compiles to ctz(!w) on RISC-V — a single instruction. Do not write for bit in 0..64; the naive version is tens of times slower over a million allocations." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab2-bitmap", title: "Lab 2a ⭐⭐ Implement Bitmap::{alloc, dealloc}",
          description: "Implement bitmap allocation and free. alloc returns the global bit index (relative to this bitmap's start); dealloc(pos) clears the corresponding bit.",
          labFile: "labs/phase_5_fs/easy-fs/src/bitmap.rs",
          hints: [
            "alloc uses trailing_ones; dealloc uses &= !(1u64 << bit)",
            "pos % 4096 gives the in-block offset, pos / 4096 gives the block index",
            "dealloc should assert the bit was 1 — catches double-free bugs",
          ],
          pseudocode:
`fn decomposition(pos: usize) -> (usize, usize, usize) {
    let block_pos = pos / BLOCK_BITS;
    let bit = pos % BLOCK_BITS;
    (block_pos, bit / 64, bit % 64)
}`,
        },
        {
          id: "lab2-layout", title: "Lab 2b ⭐ Hand-compute a capacity table",
          description: "Given a 16 MiB disk (32768 blocks), compute inode_bitmap_blocks / inode_area_blocks / data_bitmap_blocks / data_area_blocks. Print the resulting SuperBlock in easy-fs-fuse to verify.",
          hints: [
            "Fix inode_bitmap_blocks = 1 → 4096 inodes max",
            "Remaining = 32768 - 1 - 1 - 1024 = 31742",
            "data_bitmap_blocks = ⌈31742 / 4097⌉ = 8",
          ],
        },
      ],
      acceptanceCriteria: [
        "cargo test --test test_lab2_bitmap passes: after 4096 allocations, the 4097th returns a different block id",
        "SuperBlock::is_valid() rejects non-easy-fs images",
        "Can derive the self-referential equation for data_bitmap_blocks and solve it",
      ],
      references: [
        { title: "xv6 book Ch. 8.2 Buffer cache layer", description: "[Required] Analogous layout in xv6 (mkfs.c)", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §6.3", description: "[Required] Layout walk-through in Chinese", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/3fs-implementation.html" },
        { title: "A Fast File System for UNIX (1984)", description: "[Deep dive] The 30-year-old prototype of the five-region layout", url: "https://dsf.berkeley.edu/cs262/FFS.pdf" },
      ],
    },

    // ── Lesson 3 ──────────────────────────────────────────
    {
      phaseId: 5, lessonId: 3,
      title: "Block Cache: why 16-way LRU saves us",
      subtitle: "Caching blocks (not files) + write-back + strong-count eviction",
      type: "Concept + Practice",
      duration: "1.5 hours",
      objectives: [
        "Understand why easy-fs caches at block granularity rather than file granularity",
        "Implement LRU with VecDeque and the \"evict only if strong_count == 1\" rule",
        "Compare write-back vs write-through and know when sync_all is called",
        "Trace a cache-hit path for a typical open(\"/hello.txt\") (~2 misses)",
      ],
      sections: [
        {
          title: "Why cache? Count the disk round-trips",
          blocks: [
            { type: "paragraph", text: "Without a cache, one open(\"/hello.txt\") touches: the SuperBlock (1) + root-inode block (1) + root directory data blocks (~3) + target inode block (1) + target data blocks (several) ≈ 10 disk reads. With a 16-way LRU, SuperBlock and root-inode block are permanently near MRU, leaving only target inode and data — ≈ 2 misses." },
            { type: "diagram", content:
`No cache:
  open    → [super][root_inode][root_data ×3][target_inode][target_data] = 7 round-trips
  read    → [target_data × N]                                             = N trips

16-way LRU:
  open    → first 5 blocks already MRU (loaded at boot), only 2 misses
  read    → first data block misses; subsequent blocks miss only if they cross
            (data-block caching is marginal — only hot files benefit)

MRU → [super][root_i][root_d0][root_d1][root_d2][bitmap_i]...[?] ← LRU
           ↑ each access promotes                 ↑ 16 full → evict this` },
          ],
        },
        {
          title: "Block cache vs file cache",
          blocks: [
            { type: "table", headers: ["strategy", "pros", "cons"], rows: [
              ["Block cache (easy-fs choice)", "Metadata and data unified; shared inode blocks not duplicated", "No zero-copy across files; all reads go through kernel memcpy"],
              ["File cache (Linux page cache)", "mmap and zero-copy friendly; file-level readahead", "Separate dcache/icache needed; implementation ~3× complexity"],
            ]},
            { type: "paragraph", text: "Linux runs both: struct buffer_head is a block cache, struct page backs the page cache. easy-fs keeps only the block cache for clarity. Phase 7's stretch work introduces page-cache-like structures." },
          ],
        },
        {
          title: "Data structure: VecDeque<(block_id, Arc<Mutex<BlockCache>>)>",
          blocks: [
            { type: "code", language: "rust", code:
`const BLOCK_CACHE_SIZE: usize = 16;

pub struct BlockCache {
    cache: [u8; BLOCK_SZ],   // 512
    block_id: usize,
    block_device: Arc<dyn BlockDevice>,
    modified: bool,
}

pub struct BlockCacheManager {
    queue: VecDeque<(usize, Arc<Mutex<BlockCache>>)>,
}` },
            { type: "diagram", content:
`get_block_cache(block_id, dev):
  ┌─ hit? (scan queue for block_id)
  │    └─ yes → return Arc<Mutex<BlockCache>>.clone()      (O(n) but n=16)
  │
  └─ miss:
       1. if queue.len() == 16:
            find first entry with Arc::strong_count == 1 → evict it
            (its Drop auto-syncs dirty contents)
       2. read block_id from disk into a new cache
       3. queue.push_back((block_id, Arc::new(...)))
       4. return the clone` },
            { type: "callout", variant: "warning", text: "The strong_count == 1 check is the safety kernel here. If some thread holds a long-running MutexGuard on a cache line and we force-evict, its guard points into freed memory. Rule: evict only lines nobody holds. If all 16 are busy, panic — it signals the cache is too small for the workload." },
          ],
        },
        {
          title: "Write-back vs write-through",
          blocks: [
            { type: "table", headers: ["strategy", "write behaviour", "crash safety", "throughput"], rows: [
              ["write-back (this course)", "Modifies cache, marks modified; flushed on evict or sync", "Unsafe — dirty blocks lost on crash", "High: multiple writes coalesce"],
              ["write-through", "Every write hits disk immediately", "Safer", "Low: every write pays disk latency"],
            ]},
            { type: "paragraph", text: "BlockCache::drop checks modified and, if set, writes back before destructing. This gives \"everything flushes on clean shutdown\". But crash or power loss can lose up to 16 dirty blocks — real filesystems use journaling (ext4) or COW (btrfs/zfs) for crash consistency; we deliberately skip that." },
            { type: "code", language: "rust", code:
`pub fn sync(&mut self) {
    if self.modified {
        self.modified = false;
        self.block_device.write_block(self.block_id, &self.cache);
    }
}
impl Drop for BlockCache { fn drop(&mut self) { self.sync(); } }

pub fn block_cache_sync_all() {
    // Kernel calls this before shutdown to drain every dirty line
    for (_, c) in BLOCK_CACHE_MANAGER.lock().queue.iter() {
        c.lock().sync();
    }
}` },
          ],
        },
        {
          title: "modify / read: closure-style &mut T / &T",
          blocks: [
            { type: "code", language: "rust", code:
`impl BlockCache {
    pub fn read<T, V>(&self, offset: usize, f: impl FnOnce(&T) -> V) -> V {
        assert!(offset + core::mem::size_of::<T>() <= BLOCK_SZ);
        let ptr = (&self.cache[offset] as *const u8) as *const T;
        f(unsafe { &*ptr })
    }
    pub fn modify<T, V>(&mut self, offset: usize, f: impl FnOnce(&mut T) -> V) -> V {
        self.modified = true;
        let ptr = (&mut self.cache[offset] as *mut u8) as *mut T;
        f(unsafe { &mut *ptr })
    }
}` },
            { type: "callout", variant: "info", text: "This \"lend a view through a closure\" idiom is idiomatic Rust — it guarantees the modified flag is set (callers cannot forget) and prevents returning borrows that would alias the cache internals." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab3-cache", title: "Lab 3 ⭐⭐ Implement BlockCacheManager",
          description: "Implement get_block_cache, eviction, and block_cache_sync_all.",
          labFile: "labs/phase_5_fs/easy-fs/src/block_cache.rs",
          hints: [
            "queue.iter().find(|(id,_)| *id == block_id) for the hit path",
            "position(|(_, c)| Arc::strong_count(c)==1) for the evict candidate",
            "Global singleton via lazy_static! + Mutex<BlockCacheManager>",
            "Call sync_all from the panic handler and before shutdown",
          ],
          pseudocode:
`pub fn get_block_cache(block_id, dev) -> Arc<Mutex<BlockCache>> {
    if let Some((_, c)) = queue.iter().find(|(id,_)| *id == block_id) {
        return c.clone();
    }
    if queue.len() == BLOCK_CACHE_SIZE {
        let (idx, _) = queue.iter().enumerate()
            .find(|(_, (_, c))| Arc::strong_count(c) == 1)
            .expect("cache full, all lines in use");
        queue.drain(idx..=idx);
    }
    let c = Arc::new(Mutex::new(BlockCache::new(block_id, dev)));
    queue.push_back((block_id, c.clone()));
    c
}`,
        },
      ],
      acceptanceCriteria: [
        "The 17th distinct-block access triggers eviction, and the earliest non-busy entry leaves",
        "block_cache_sync_all runs before shutdown and drains every dirty line",
        "cargo test --test test_lab3_cache passes",
      ],
      references: [
        { title: "xv6 book Ch. 8.2 Buffer cache", description: "[Required] LRU bcache in C, line by line", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §6.3.2", description: "[Required] BlockCacheManager walk-through in Chinese", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/3fs-implementation.html" },
        { title: "OSTEP Ch. 40 §40.10 Crash consistency", description: "[Deep dive] The crash hazards of write-back caches", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/file-journaling.pdf" },
      ],
    },

    // ── Lesson 4 ──────────────────────────────────────────
    {
      phaseId: 5, lessonId: 4,
      title: "DiskInode and directory entries: pointer trees and name lookup",
      subtitle: "direct / indirect1 / indirect2 + 32-byte dir entries",
      type: "Concept + Practice",
      duration: "2 hours",
      objectives: [
        "Memorise the 128-byte DiskInode layout",
        "Trace get_block_id(n) through its three branches: direct, indirect1, indirect2",
        "Derive the maximum file size ≈ 8.08 MiB and understand why",
        "Implement Inode::find / create / ls, internalising \"a directory is a file\"",
      ],
      sections: [
        {
          title: "DiskInode: a whole file in 128 bytes",
          blocks: [
            { type: "code", language: "rust", code:
`const INODE_DIRECT_COUNT: usize = 28;
const INODE_INDIRECT1_COUNT: usize = 128;   // 512 / 4
const INODE_INDIRECT2_COUNT: usize = 128 * 128;

#[repr(C)]
pub struct DiskInode {
    pub size: u32,                              // bytes
    pub direct: [u32; INODE_DIRECT_COUNT],      // 28 direct pointers
    pub indirect1: u32,                          // single indirect
    pub indirect2: u32,                          // double indirect
    type_: DiskInodeType,                        // File / Directory
}
// Total: 4 + 28*4 + 4 + 4 + 4 = 128 B — exactly 4 fit in a 512-byte block.` },
            { type: "callout", variant: "info", text: "Why doesn't inode_bitmap bit N point to inode object N directly? Because the object lives in the inode area — the bitmap only allocates positions. Allocating a new inode = bitmap.alloc() returns pos; pos / 4 is the block, pos % 4 is the slot within it." },
          ],
        },
        {
          title: "The pointer tree: from logical to physical block",
          blocks: [
            { type: "diagram", content:
`           ┌─ direct[0]  ─────────────────────► block #A0  (512 B)
           ├─ direct[1]  ─────────────────────► block #A1
           │  ...
DiskInode ─┼─ direct[27] ─────────────────────► block #A27     14 KiB total
           │
           ├─ indirect1 ──► block #I1
           │                 ┌──────────────┐
           │                 │ u32[128]     │──► block #B0      64 KiB total
           │                 │              │──► block #B1
           │                 │              │──► ...
           │                 └──────────────┘
           │
           └─ indirect2 ──► block #I2
                             ┌──────────────┐
                             │ u32[128]     │──► block #C0 (indirect-1 block)
                             │              │       ┌──────────────┐
                             │              │       │ u32[128]     │──► D0 (data)
                             │              │       │              │──► D1
                             │              │       └──────────────┘
                             └──────────────┘                    8 MiB total

Max file size: 28 × 512 + 128 × 512 + 128 × 128 × 512
            = 14 KiB + 64 KiB + 8 MiB ≈ 8.08 MiB` },
            { type: "table", headers: ["range", "n values", "formula"], rows: [
              ["direct", "0 ≤ n < 28", "direct[n]"],
              ["indirect1", "28 ≤ n < 156", "indirect1_block[n - 28]"],
              ["indirect2", "156 ≤ n < 16540", "indirect2_block[(n-156)/128][(n-156)%128]"],
            ]},
            { type: "code", language: "rust", code:
`pub fn get_block_id(&self, inner_id: u32, dev: &Arc<dyn BlockDevice>) -> u32 {
    let n = inner_id as usize;
    if n < INODE_DIRECT_COUNT {
        self.direct[n]
    } else if n < INODE_DIRECT_COUNT + INODE_INDIRECT1_COUNT {
        get_block_cache(self.indirect1 as usize, dev).lock()
            .read(0, |b: &IndirectBlock| b[n - INODE_DIRECT_COUNT])
    } else {
        let last = n - INODE_DIRECT_COUNT - INODE_INDIRECT1_COUNT;
        let a0 = get_block_cache(self.indirect2 as usize, dev).lock()
            .read(0, |b: &IndirectBlock| b[last / INODE_INDIRECT1_COUNT]);
        get_block_cache(a0 as usize, dev).lock()
            .read(0, |b: &IndirectBlock| b[last % INODE_INDIRECT1_COUNT])
    }
}` },
            { type: "callout", variant: "warning", text: "increase_size must allocate in order: fill direct first, then indirect1 itself + its 128 slots, then indirect2 + the second-level pointer blocks + data blocks. Get the order wrong and truncate's free order mirrors the mistake." },
          ],
        },
        {
          title: "read_at / write_at: the core loop",
          blocks: [
            { type: "code", language: "rust", code:
`pub fn read_at(&self, offset: usize, buf: &mut [u8], dev: &Arc<dyn BlockDevice>) -> usize {
    let mut start = offset;
    let end = (offset + buf.len()).min(self.size as usize);
    if start >= end { return 0; }
    let mut start_block = start / BLOCK_SZ;
    let mut out = 0usize;
    while start < end {
        let end_current_block = ((start / BLOCK_SZ + 1) * BLOCK_SZ).min(end);
        let block_read = end_current_block - start;
        let dst = &mut buf[out..out + block_read];
        let block_id = self.get_block_id(start_block as u32, dev);
        get_block_cache(block_id as usize, dev).lock()
            .read(0, |d: &DataBlock| {
                let src = &d[start % BLOCK_SZ..start % BLOCK_SZ + block_read];
                dst.copy_from_slice(src);
            });
        out += block_read;
        start = end_current_block;
        start_block += 1;
    }
    out
}` },
            { type: "paragraph", text: "Three classic traps: (1) partial start/end blocks must be offset-copied; (2) if buf is smaller than the file remainder, clamp with min(offset + buf.len(), size); (3) write_at does not grow the file — increase_size is its own step, and write_at must assert offset + buf.len() ≤ size." },
          ],
        },
        {
          title: "DirEntry: a directory is literally a file",
          blocks: [
            { type: "diagram", content:
`byte  0                           27 28        31
     ┌──────────────────────────────┬────────────┐
     │ name (NUL-padded, ≤ 27 chars)│ inode (u32)│
     └──────────────────────────────┴────────────┘
  Each entry is 32 B; a 512-B block holds 16 entries.
  A directory file is just an array of DirEntry; ls = read_at all + iterate.

Sample root:
 ┌──────────────┬──────┐
 │ "hello.txt"  │  12  │
 ├──────────────┼──────┤
 │ "apps/"      │   7  │   ← no trailing slash here; type lives in the inode
 ├──────────────┼──────┤
 │ ""  (empty)  │   0  │   ← tombstone left after deletion; never compacted
 └──────────────┴──────┘` },
            { type: "code", language: "rust", code:
`pub fn find(&self, name: &str) -> Option<Arc<Inode>> {
    self.read_disk_inode(|d| {
        assert!(d.is_dir());
        let count = (d.size as usize) / DIRENT_SZ;
        for i in 0..count {
            let mut ent = DirEntry::empty();
            d.read_at(i * DIRENT_SZ, ent.as_bytes_mut(), &self.block_device);
            if ent.name() == name {
                return Some(Arc::new(Inode::new(ent.inode_id(), ...)));
            }
        }
        None
    })
}` },
            { type: "callout", variant: "tip", text: "O(n) linear search is fine at the course scale. ext4's htree or btrfs's B-trees exist to push this toward O(log n); at hundreds of entries, linear scan is clearer than any fancier structure." },
          ],
        },
        {
          title: "create: three operations that must look atomic",
          blocks: [
            { type: "list", ordered: true, items: [
              "fs.alloc_inode() — bitmap gives you a pos, which is the global inode_id",
              "Write a fresh DiskInode at the inode-area location (type=File, size=0, pointers zero)",
              "Append a DirEntry(name, inode_id) to the current directory — remember to increase_size(+32) first",
            ]},
            { type: "paragraph", text: "Any of the three failing leaves the FS inconsistent — a real rollback would use a journal. easy-fs simplifies by panicking on failure and assuming a single-threaded FS; Phase 7 asks you to add an atomic group." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab4-getblock", title: "Lab 4a ⭐⭐ Implement DiskInode::get_block_id",
          description: "Three branches, locating the physical block for logical block n. Always go through get_block_cache for indirect blocks, never block_device.read_block directly.",
          labFile: "labs/phase_5_fs/easy-fs/src/layout.rs",
          hints: [
            "IndirectBlock = [u32; 128] pairs naturally with BlockCache::read",
            "Boundary: n == INODE_DIRECT_COUNT - 1 is the last direct slot",
            "Beware of as usize overflow — range-check before subtracting offsets",
          ],
        },
        {
          id: "lab4-readat", title: "Lab 4b ⭐⭐⭐ Implement DiskInode::read_at / write_at",
          description: "Loop block-by-block, handle partial start and end blocks. Unit test: write a 1.5 KiB file, read 1200 bytes starting at offset 100, verify cross-block correctness.",
          labFile: "labs/phase_5_fs/easy-fs/src/layout.rs",
          hints: [
            "max_inner_id = (size + BLOCK_SZ - 1) / BLOCK_SZ",
            "write_at does not grow — call increase_size first",
            "end_current_block = (start/BLOCK_SZ + 1) * BLOCK_SZ",
          ],
        },
        {
          id: "lab4-vfs", title: "Lab 4c ⭐⭐ Implement Inode::{find, create, ls}",
          description: "Directory operations. find linear-scans; create runs the three-step sequence; ls returns Vec<String>.",
          labFile: "labs/phase_5_fs/easy-fs/src/vfs.rs",
          hints: [
            "Global fs singleton is Arc<Mutex<EasyFileSystem>>",
            "After any directory modification, call block_cache_sync_all so a reboot preserves it",
            "Names longer than 27 chars should return an error — never overflow",
          ],
        },
      ],
      acceptanceCriteria: [
        "cargo test --test test_lab4_inode passes: write a 7 MiB file, remount, read identical bytes back",
        "ls / returns all entries in creation order",
        "You can state the maximum file size as an exact integer byte count",
      ],
      references: [
        { title: "xv6 book Ch. 8.10 Directory layer", description: "[Required] dirlink / dirlookup in C", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "OSTEP Ch. 39 File system implementation", description: "[Required] Canonical pointer-tree explanation", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/file-implementation.pdf" },
        { title: "rCore-Tutorial §6.3.5-6.3.6", description: "[Required] DiskInode and Inode in Chinese", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/3fs-implementation.html" },
        { title: "Linux fs/ext2/inode.c", description: "[Deep dive] Industrial truncate/extend logic for comparison", url: "https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/ext2/inode.c" },
      ],
    },

    // ── Lesson 5 ──────────────────────────────────────────
    {
      phaseId: 5, lessonId: 5,
      title: "The VFS layer: a File trait for files and streams",
      subtitle: "OSInode + stdin/stdout + sys_open/read/write/close",
      type: "Practice + Integration",
      duration: "2 hours",
      objectives: [
        "Understand why the File trait is the keystone of \"everything is a file\"",
        "Implement OSInode: attach a cursor and R/W flags to an easy-fs Inode",
        "Implement sys_open/read/write/close",
        "Run cat / echo end-to-end; data survives reboot — the Phase 5 acceptance gate",
      ],
      sections: [
        {
          title: "The File trait: unifying storage and streams",
          blocks: [
            { type: "code", language: "rust", code:
`pub trait File: Send + Sync {
    fn readable(&self) -> bool;
    fn writable(&self) -> bool;
    fn read(&self, buf: UserBuffer) -> usize;
    fn write(&self, buf: UserBuffer) -> usize;
}` },
            { type: "diagram", content:
`                   ┌─ Stdin   (reads 1 byte via sbi_console)
                   │
trait File ────────┼─ Stdout  (writes via println!)
                   │
                   └─ OSInode (wraps an easy_fs::Inode)

Per-process fd_table: Vec<Option<Arc<dyn File>>>

fd=0 → Stdin
fd=1 → Stdout
fd=2 → Stdout (stderr not yet separate; merged for simplicity)
fd≥3 → OSInode (allocated on open)

sys_read(fd, buf, n):
  file = task.fd_table[fd].clone()?
  assert!(file.readable())
  file.read(UserBuffer::new(buf, n))   ← one entry point, type-agnostic` },
            { type: "callout", variant: "info", text: "This trait makes \"everything is a file\" concrete: pipes, sockets, ttys all slot into fd_table. Phase 6's pipe is the fourth File impl." },
          ],
        },
        {
          title: "OSInode: give easy-fs Inode a cursor",
          blocks: [
            { type: "code", language: "rust", code:
`pub struct OSInode {
    readable: bool,
    writable: bool,
    inner: Mutex<OSInodeInner>,
}
struct OSInodeInner {
    offset: usize,                  // current R/W position
    inode: Arc<easy_fs::Inode>,
}

impl File for OSInode {
    fn read(&self, mut buf: UserBuffer) -> usize {
        let mut inner = self.inner.lock();
        let mut total = 0;
        for slice in buf.buffers.iter_mut() {
            let n = inner.inode.read_at(inner.offset, slice);
            if n == 0 { break; }
            inner.offset += n;
            total += n;
        }
        total
    }
    fn write(&self, buf: UserBuffer) -> usize {
        let mut inner = self.inner.lock();
        let mut total = 0;
        for slice in buf.buffers.iter() {
            let n = inner.inode.write_at(inner.offset, slice);
            assert_eq!(n, slice.len());
            inner.offset += n;
            total += n;
        }
        total
    }
}` },
            { type: "paragraph", text: "UserBuffer is already defined in Phase 4: a page-spanning user buffer decomposed into contiguous slices. We loop each slice through inode.read_at/write_at — the lower easy-fs layer never needs to know whether buf lives in user or kernel memory." },
          ],
        },
        {
          title: "Stdin / Stdout: two degenerate implementations",
          blocks: [
            { type: "code", language: "rust", code:
`pub struct Stdin;
pub struct Stdout;

impl File for Stdin {
    fn readable(&self) -> bool { true }
    fn writable(&self) -> bool { false }
    fn read(&self, mut buf: UserBuffer) -> usize {
        assert_eq!(buf.len(), 1);          // one byte at a time (simplified)
        let c = loop {
            let c = sbi::console_getchar();
            if c != 0 { break c as u8; }
            suspend_current_and_run_next();    // no input yet — yield
        };
        unsafe { buf.buffers[0].as_mut_ptr().write_volatile(c); }
        1
    }
    fn write(&self, _: UserBuffer) -> usize { panic!("Stdin not writable"); }
}

impl File for Stdout {
    fn readable(&self) -> bool { false }
    fn writable(&self) -> bool { true }
    fn read(&self, _: UserBuffer) -> usize { panic!("Stdout not readable"); }
    fn write(&self, buf: UserBuffer) -> usize {
        for slice in buf.buffers.iter() {
            print!("{}", core::str::from_utf8(slice).unwrap());
        }
        buf.len()
    }
}` },
            { type: "callout", variant: "tip", text: "Stdin's console_getchar is non-blocking — returning 0 means \"yield and let the scheduler run other tasks\". This is the most primitive cooperative I/O multiplexing. Phase 6 swaps it for semaphore-based blocking wakeup." },
          ],
        },
        {
          title: "open_file: translating flags into easy-fs operations",
          blocks: [
            { type: "code", language: "rust", code:
`bitflags! {
    pub struct OpenFlags: u32 {
        const RDONLY = 0;
        const WRONLY = 1 << 0;
        const RDWR   = 1 << 1;
        const CREATE = 1 << 9;
        const TRUNC  = 1 << 10;
    }
}
impl OpenFlags { pub fn read_write(&self) -> (bool, bool) { ... } }

pub fn open_file(name: &str, flags: OpenFlags) -> Option<Arc<OSInode>> {
    let (r, w) = flags.read_write();
    if flags.contains(OpenFlags::CREATE) {
        if let Some(inode) = ROOT.find(name) {
            inode.clear();                      // O_TRUNC semantics
            Some(Arc::new(OSInode::new(r, w, inode)))
        } else {
            let inode = ROOT.create(name)?;
            Some(Arc::new(OSInode::new(r, w, inode)))
        }
    } else {
        let inode = ROOT.find(name)?;
        if flags.contains(OpenFlags::TRUNC) { inode.clear(); }
        Some(Arc::new(OSInode::new(r, w, inode)))
    }
}` },
          ],
        },
        {
          title: "The four syscalls: sys_open/read/write/close",
          blocks: [
            { type: "code", language: "rust", code:
`pub fn sys_open(path: *const u8, flags: u32) -> isize {
    let token = current_user_token();
    let path = translated_str(token, path);
    let flags = OpenFlags::from_bits(flags).unwrap();
    if let Some(inode) = open_file(path.as_str(), flags) {
        let fd = current_task().alloc_fd(inode);
        fd as isize
    } else { -1 }
}
pub fn sys_close(fd: usize) -> isize {
    let t = current_task();
    if t.fd_table[fd].is_none() { return -1; }
    t.fd_table[fd].take();                   // drops Arc<dyn File>
    0
}
pub fn sys_read(fd, buf, n) -> isize {
    let file = current_task().fd_table[fd].clone()?;
    if !file.readable() { return -1; }
    let buf = UserBuffer::new(translated_byte_buffer(token, buf, n));
    file.read(buf) as isize
}
// sys_write is symmetric` },
            { type: "callout", variant: "warning", text: "fd_table allocation: grab the first None slot. This keeps fds bounded and matches Unix's \"open returns the smallest free fd\". close() via take() drops the Arc to zero — but easy-fs::Inode may still be shared by another fd, hence the Arc." },
          ],
        },
        {
          title: "End-to-end acceptance flow",
          blocks: [
            { type: "diagram", content:
`user$ echo hello > greeting
        ↓ shell fork+exec
user binary calls sys_open("greeting", WRONLY|CREATE|TRUNC)
        ↓ ecall
sys_open → open_file → ROOT.create("greeting") → alloc inode + write DirEntry
                                                  block_cache_sync_all
        ↓ returns fd=3
sys_write(3, "hello\\n", 6) → OSInode::write → Inode::write_at
                                              → DiskInode::write_at
                                              → BlockCache.modify
                                                (mark dirty; flush on Drop)
sys_close(3)                → Arc drop → last fd gone, OSInode drop
                                         OSInode drop → Inode drop (if last)

reboot → easy-fs re-reads SuperBlock → ROOT.find("greeting") → bytes intact ✓` },
          ],
        },
      ],
      exercises: [
        {
          id: "lab5-osinode", title: "Lab 5a ⭐⭐ Implement OSInode + open_file",
          description: "Make an easy-fs Inode behave like a File.",
          labFile: "labs/phase_5_fs/src/fs/inode.rs",
          hints: [
            "OSInodeInner under a Mutex, holding (offset, inode)",
            "flags.read_write() returns (readable, writable)",
            "CREATE on an existing file equals O_TRUNC + reuse",
          ],
        },
        {
          id: "lab5-stdio", title: "Lab 5b ⭐ Implement Stdin / Stdout",
          description: "During task spawn, populate fd_table[0..=2] with Stdin/Stdout Arcs.",
          labFile: "labs/phase_5_fs/src/fs/stdio.rs",
          hints: [
            "fd=2 points at the same Stdout for now (stderr deferred to Phase 6)",
            "Stdin::read reads a single u8 via sbi_console_getchar",
          ],
        },
        {
          id: "lab5-syscall", title: "Lab 5c ⭐⭐ sys_open/read/write/close",
          description: "Wire the four calls into the syscall table; both read and write flow through UserBuffer for page-spanning safety.",
          labFile: "labs/phase_5_fs/src/syscall/fs.rs",
          hints: [
            "Copy path from userspace via translated_str",
            "Slice the user physical memory via translated_byte_buffer",
            "sys_close uses take(), not set-to-None — otherwise the Arc is never dropped",
          ],
          pseudocode:
`pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    match id {
        56 => sys_open(args[0] as *const u8, args[1] as u32, args[2] as u32),
        57 => sys_close(args[0]),
        63 => sys_read(args[0], args[1] as *const u8, args[2]),
        64 => sys_write(args[0], args[1] as *const u8, args[2]),
        ...
    }
}`,
        },
        {
          id: "lab5-integration", title: "Lab 5d ⭐⭐ End-to-end acceptance",
          description: "make fs-img && make run: test_fs passes, reboot, hello.txt still present.",
          labFile: "labs/phase_5_fs/user/src/bin/test_fs.rs",
          hints: [
            "make fs-img invokes easy-fs-fuse on the host and produces target/fs.img",
            "QEMU attaches via -drive file=target/fs.img",
            "test_fs steps: write → read → verify → delete → reopen expecting failure",
          ],
        },
      ],
      acceptanceCriteria: [
        "make qemu runs test_fs and prints \"test_fs OK\"",
        "After quitting QEMU and restarting, a hello.txt created in a previous run is cat-able",
        "scripts/grade.py gives full marks (including LRU / bitmap / indirect2 edge cases)",
        "An lsof-style walk over task.fd_table leaks no Arcs",
      ],
      references: [
        { title: "xv6 book Ch. 8.6-8.10 File descriptor layer", description: "[Required] The canonical source of the File abstraction", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §6.4", description: "[Required] OSInode + sys_open walk-through in Chinese", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/4fs-syscall.html" },
        { title: "OSTEP Ch. 39 §39.3-39.4", description: "[Required] fd table, open/read/write semantics", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/file-intro.pdf" },
        { title: "Linux fs/open.c + fs/read_write.c", description: "[Deep dive] Industrial sys_open / vfs_read sources", url: "https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs" },
        { title: "Stretch question", description: "[Stretch] How would you extend the File trait with lseek / fstat / mmap? If fork can share fds, how should offset be handled (per-fd vs per-inode)?", url: "" },
      ],
    },
  ],
};
