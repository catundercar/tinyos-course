import type { Locale } from "../i18n";

export interface Deliverable {
  name: string;
  desc: string;
  acceptance: string[];
}

export interface Phase {
  id: number;
  week: string;
  duration: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  accent: string;
  goal: string;
  concepts: string[];
  readings: string[];
  deliverable: Deliverable;
}

export interface ArchitectureLayer {
  name: string;
  color: string;
  modules: string[];
}

export interface Architecture {
  layers: ArchitectureLayer[];
}

export interface Principle {
  num: string;
  title: string;
  desc: string;
  color: string;
}

// ─── Architecture (top layer first — Phase 6 at top, Phase 0 at bottom) ───

const ARCHITECTURE: Architecture = {
  layers: [
    { name: "Shell & User",    color: "#DB2777", modules: ["init", "sh", "coreutils", "libc 裁剪"] },
    { name: "File System",     color: "#DC2626", modules: ["VFS", "easy-fs", "BlockCache", "virtio-blk"] },
    { name: "Virtual Memory",  color: "#2563EB", modules: ["PageTable SV39", "FrameAllocator", "MemorySet", "mmap"] },
    { name: "Concurrency",     color: "#7C3AED", modules: ["SpinLock", "SleepLock", "Semaphore", "Condvar"] },
    { name: "Process & Sched", color: "#059669", modules: ["TCB", "__switch", "Round-Robin", "fork/exec"] },
    { name: "Traps & Syscalls",color: "#D97706", modules: ["TrapContext", "Syscall 分发", "时钟中断", "ecall"] },
    { name: "Boot & Entry",    color: "#E8453C", modules: ["entry.asm", "linker.ld", "SBI console", "panic_handler"] },
  ],
};

export function getArchitecture(): Architecture { return ARCHITECTURE; }

// ─── Phases: zh-CN ───

const PHASES_ZH_CN: Phase[] = [
  {
    id: 0, week: "Phase 0", duration: "Week 1-2 · 3 labs",
    title: "启动：从上电到内核 main", subtitle: "Boot & Kernel Entry",
    icon: "⬡", color: "#E8453C", accent: "#FF6B5E",
    goal: "理解 RISC-V 机器模型，从 OpenSBI 接管控制权，设置栈、清零 BSS，跳进 Rust 世界，点亮第一条 println!。",
    concepts: [
      "RISC-V 特权级：M-mode / S-mode / U-mode",
      "链接脚本与内核内存布局（.text / .rodata / .bss / stack）",
      "裸机 Rust：no_std / no_main / panic_handler",
      "UART 驱动与 SBI 调用约定",
      "QEMU 启动流程与调试技巧（gdb-remote）",
    ],
    readings: ["xv6-riscv book, Ch. 1-2", "rCore-Tutorial §1", "RISC-V Privileged Spec v1.12"],
    deliverable: {
      name: "tinyos-boot",
      desc: "一个能在 QEMU RISC-V virt 机器上启动的裸机 Rust 内核：自定义链接脚本 + 汇编跳板 + SBI console + panic handler。",
      acceptance: [
        "make qemu 后串口打印 \"Hello, TinyOS!\"",
        "panic!() 能输出文件名+行号并优雅关机",
        "链接脚本明确 text/rodata/data/bss 边界并在启动时清零 bss",
        "gdb 可从 0x80200000 单步调试",
      ],
    },
  },
  {
    id: 1, week: "Phase 1", duration: "Week 3-4 · 3 labs",
    title: "陷阱：特权级切换与系统调用", subtitle: "Traps & Syscalls",
    icon: "◈", color: "#D97706", accent: "#F59E0B",
    goal: "实现从 U-mode 到 S-mode 的完整 trap 通路：保存上下文、分发原因、执行 syscall、返回现场。",
    concepts: [
      "stvec / sepc / scause / stval / sstatus 寄存器语义",
      "TrapContext 设计与保存/恢复汇编（__alltraps / __restore）",
      "ecall 与系统调用约定（a7=sysno, a0-a5=args, a0=ret）",
      "异常分类：Exception vs Interrupt",
      "第一批 syscall：write / exit / getpid",
    ],
    readings: ["xv6-riscv book, Ch. 4", "rCore-Tutorial §3", "RISC-V ISA Manual Vol II"],
    deliverable: {
      name: "tinyos-trap",
      desc: "一套可运行 U-mode 用户程序并通过 ecall 返回内核的 trap 子系统。",
      acceptance: [
        "用户程序能通过 sys_write 打印字符串",
        "非法指令/缺页异常能被捕获并打印 scause+sepc",
        "trap 来回往返后所有通用寄存器完整保留",
        "所有 syscall 编号集中在 syscall/mod.rs 分发表",
      ],
    },
  },
  {
    id: 2, week: "Phase 2", duration: "Week 5-6 · 3 labs",
    title: "进程：任务抽象与调度", subtitle: "Process & Scheduling",
    icon: "◇", color: "#059669", accent: "#34D399",
    goal: "从单任务走向多任务。实现 PCB、task switch 汇编、时钟中断抢占、最小可扩展调度器。",
    concepts: [
      "Task Control Block：状态机 Ready/Running/Zombie",
      "__switch 汇编：callee-saved + ra + sp 精确切换",
      "时钟中断（sbi_set_timer）与时间片轮转",
      "yield / sleep / exit 内核原语",
      "Idle task 与调度器 loop 骨架",
    ],
    readings: ["OSTEP Ch. 5-10", "xv6-riscv Ch. 7", "rCore-Tutorial §3"],
    deliverable: {
      name: "tinyos-proc",
      desc: "能并发运行 N 个用户任务的调度内核：Round-Robin + 10ms 时间片 + fork/exec/wait/exit 最小实现。",
      acceptance: [
        "3 个用户 app 交错执行，输出可见时间片轮转",
        "__switch 汇编通过 200+ 次切换压测不丢寄存器",
        "父进程 wait 能正确回收 zombie 子进程",
        "进程数达 MAX_TASKS 时 fork 返回 -1 而非崩溃",
      ],
    },
  },
  {
    id: 3, week: "Phase 3", duration: "Week 7 · 2 labs",
    title: "并发：同步原语与锁", subtitle: "Concurrency & Locks",
    icon: "◉", color: "#7C3AED", accent: "#A78BFA",
    goal: "在抢占式调度基础上构建正确的同步原语：自旋锁、睡眠锁、信号量、条件变量；直面死锁。",
    concepts: [
      "race condition 与原子性：读-改-写的危险",
      "SpinLock：AMO + 关中断保证的临界区",
      "SleepLock：持锁时让出 CPU",
      "Semaphore / Condvar / Mutex 层次与实现",
      "死锁四条件、锁排序、lockdep 思维",
    ],
    readings: ["xv6-riscv Ch. 6", "OSTEP Ch. 28-31", "Linux Kernel Development Ch. 10"],
    deliverable: {
      name: "tinyos-sync",
      desc: "一整套可在内核与用户态复用的同步原语：SpinLock / SleepLock / Semaphore / Condvar + 经典 demo。",
      acceptance: [
        "并发计数测试：10 任务 × 10000 次递增结果精确",
        "哲学家就餐 demo 无死锁运行 60s",
        "SpinLock 持锁时拒绝再次抢占",
        "semaphore 的 up/down 通过 stress test",
      ],
    },
  },
  {
    id: 4, week: "Phase 4", duration: "Week 8-9 · 3 labs",
    title: "内存：虚拟内存与分页", subtitle: "Virtual Memory & Paging",
    icon: "⬢", color: "#2563EB", accent: "#60A5FA",
    goal: "启用 SV39 分页，让每个进程拥有独立地址空间。手写页表、物理帧分配、内核/用户空间分离。",
    concepts: [
      "SV39 三级页表：VPN[2:0] → PPN，9/9/9/12 布局",
      "PTE flags：V/R/W/X/U/G/A/D 语义",
      "物理帧分配器（stack allocator）",
      "内核空间 trampoline + 用户 trap context 页",
      "copy_from_user / copy_to_user 跨空间访存",
    ],
    readings: ["xv6-riscv Ch. 3", "rCore-Tutorial §4", "RISC-V Priv Spec Ch. 10"],
    deliverable: {
      name: "tinyos-vm",
      desc: "完整虚拟内存子系统：FrameAllocator + MemorySet + 独立 satp + mmap/munmap + page fault 处理。",
      acceptance: [
        "每个用户进程拥有独立地址空间，指针互不冲突",
        "越界访问触发 page fault 并被 kill",
        "sys_mmap 能按页粒度分配与归还",
        "trampoline 页在所有地址空间同地址映射",
      ],
    },
  },
  {
    id: 5, week: "Phase 5", duration: "Week 10-11 · 3 labs",
    title: "存储：块设备与文件系统", subtitle: "Block Device & File System",
    icon: "⬣", color: "#DC2626", accent: "#F87171",
    goal: "从零搭建简化版 Unix 文件系统：VirtIO 块驱动 → BlockCache → 位图/Inode → 目录 → VFS。",
    concepts: [
      "VirtIO Block 协议与 MMIO 寄存器",
      "磁盘分层：superblock / bitmap / inodes / data",
      "BlockCache：LRU + 写回",
      "Inode 抽象与目录项查找/创建",
      "VFS：File trait 统一 stdin/stdout/文件",
    ],
    readings: ["xv6-riscv Ch. 8", "OSTEP Ch. 39-40", "rCore-Tutorial §6"],
    deliverable: {
      name: "tinyos-fs",
      desc: "可格式化 + 可读写 + 可持久化的 easy-fs：mkfs 工具 + virtio-blk + open/read/write/close/fstat。",
      acceptance: [
        "创建、读写、关闭文件后重启数据仍在",
        "1MB 文件顺序读写吞吐 ≥ 2MB/s",
        "block cache 命中率日志可观测",
        "文件系统镜像格式有完整 spec",
      ],
    },
  },
  {
    id: 6, week: "Phase 6", duration: "Week 12 · 3 labs",
    title: "产品：Shell、管道与用户程序", subtitle: "Shell, Pipes & User Programs",
    icon: "✦", color: "#DB2777", accent: "#F472B6",
    goal: "把一切打包成真正的 Unix 体验：从 /bin/init 启动 shell，支持 fork/exec、I/O 重定向、管道，内置一组 coreutils。",
    concepts: [
      "sys_fork / sys_exec / sys_waitpid 完整语义",
      "文件描述符表与 stdin/stdout/stderr",
      "sys_dup / 重定向（>、<、>>）",
      "Pipe：内核环形缓冲 + 读写端引用计数",
      "Shell 行解析：命令流、管道、后台 &",
    ],
    readings: ["xv6-riscv Ch. 1", "APUE Ch. 15", "rCore-Tutorial §7"],
    deliverable: {
      name: "tinyos v1.0",
      desc: "一个自举的小型 Unix：/bin/init → /bin/sh + 8 个 coreutils + 管道 + 重定向，可发布到 GitHub。",
      acceptance: [
        "cold boot 后进入交互式 shell，可执行所有内置命令",
        "三级管道 cat f | grep x | wc -l 结果正确",
        "重启后文件系统数据持久",
        "总代码 ≤ 8000 行 Rust + 200 行汇编",
      ],
    },
  },
];

// ─── Phases: en ───

const PHASES_EN: Phase[] = [
  {
    id: 0, week: "Phase 0", duration: "Week 1-2 · 3 labs",
    title: "Boot: From Power-On to rust_main", subtitle: "Boot & Kernel Entry",
    icon: "⬡", color: "#E8453C", accent: "#FF6B5E",
    goal: "Understand the RISC-V machine model, take over from OpenSBI, set up the stack, clear BSS, and land in Rust with your first println!.",
    concepts: [
      "RISC-V privilege levels: M-mode / S-mode / U-mode",
      "Linker script & kernel memory layout (.text/.rodata/.bss/stack)",
      "Bare-metal Rust: no_std / no_main / panic_handler",
      "UART & SBI calling convention",
      "QEMU boot flow & gdb-remote debugging",
    ],
    readings: ["xv6-riscv book Ch.1-2", "rCore-Tutorial §1", "RISC-V Privileged Spec v1.12"],
    deliverable: {
      name: "tinyos-boot",
      desc: "A bare-metal Rust kernel that boots on QEMU RISC-V virt: custom linker script, assembly trampoline, SBI console, panic handler.",
      acceptance: [
        "make qemu prints \"Hello, TinyOS!\" on the UART",
        "panic!() emits file+line and shuts down gracefully",
        "Linker script defines all four sections; BSS zeroed at startup",
        "gdb can single-step from 0x80200000",
      ],
    },
  },
  {
    id: 1, week: "Phase 1", duration: "Week 3-4 · 3 labs",
    title: "Traps: Privilege Crossings & Syscalls", subtitle: "Traps & Syscalls",
    icon: "◈", color: "#D97706", accent: "#F59E0B",
    goal: "Implement the full U-mode ↔ S-mode trap path: save context, dispatch the cause, execute syscalls, return.",
    concepts: [
      "stvec / sepc / scause / stval / sstatus semantics",
      "TrapContext design + save/restore asm (__alltraps / __restore)",
      "ecall ABI (a7=sysno, a0-a5=args, a0=ret)",
      "Exception vs interrupt classification",
      "First syscalls: write / exit / getpid",
    ],
    readings: ["xv6-riscv book Ch.4", "rCore-Tutorial §3", "RISC-V ISA Manual Vol II"],
    deliverable: {
      name: "tinyos-trap",
      desc: "A trap subsystem capable of running a U-mode program that returns to the kernel via ecall.",
      acceptance: [
        "User program prints a string via sys_write",
        "Illegal-instruction / page-fault caught with scause+sepc",
        "All GP regs preserved across a full trap round trip",
        "Syscall table centralised in syscall/mod.rs",
      ],
    },
  },
  {
    id: 2, week: "Phase 2", duration: "Week 5-6 · 3 labs",
    title: "Processes: Task Abstraction & Scheduling", subtitle: "Process & Scheduling",
    icon: "◇", color: "#059669", accent: "#34D399",
    goal: "From single-task to multi-task: PCB, __switch assembly, timer-driven preemption, a minimal extensible scheduler.",
    concepts: [
      "Task Control Block state machine (Ready/Running/Zombie)",
      "__switch: callee-saved regs + ra + sp precise swap",
      "Timer interrupt (sbi_set_timer) + Round-Robin slice",
      "yield / sleep / exit kernel primitives",
      "Idle task + scheduler loop skeleton",
    ],
    readings: ["OSTEP Ch.5-10", "xv6-riscv Ch.7", "rCore-Tutorial §3"],
    deliverable: {
      name: "tinyos-proc",
      desc: "Scheduler kernel running N user tasks concurrently with 10ms RR slices and minimal fork/exec/wait/exit.",
      acceptance: [
        "3 user apps interleave visibly on the UART",
        "__switch survives 200+ cycles stress test with no reg loss",
        "Parent wait correctly reaps zombie children",
        "fork returns -1 (not crash) at MAX_TASKS",
      ],
    },
  },
  {
    id: 3, week: "Phase 3", duration: "Week 7 · 2 labs",
    title: "Concurrency: Sync Primitives & Locks", subtitle: "Concurrency & Locks",
    icon: "◉", color: "#7C3AED", accent: "#A78BFA",
    goal: "Build correct synchronization on top of preemption: SpinLock, SleepLock, Semaphore, Condvar — face deadlock head-on.",
    concepts: [
      "Race conditions & atomicity: the read-modify-write hazard",
      "SpinLock: AMO + disabled interrupts bound the critical section",
      "SleepLock: yield CPU while holding the lock",
      "Semaphore / Condvar / Mutex hierarchy",
      "Coffman conditions, lock ordering, lockdep mindset",
    ],
    readings: ["xv6-riscv Ch.6", "OSTEP Ch.28-31", "Linux Kernel Development Ch.10"],
    deliverable: {
      name: "tinyos-sync",
      desc: "A full suite of kernel-reusable sync primitives + classic demos (producer-consumer, philosophers).",
      acceptance: [
        "10 tasks × 10000 increments → exactly 100000",
        "Dining philosophers runs 60s with no deadlock",
        "SpinLock refuses re-preemption while held",
        "Semaphore up/down passes stress tests",
      ],
    },
  },
  {
    id: 4, week: "Phase 4", duration: "Week 8-9 · 3 labs",
    title: "Memory: Virtual Memory & Paging", subtitle: "Virtual Memory & Paging",
    icon: "⬢", color: "#2563EB", accent: "#60A5FA",
    goal: "Enable SV39 so each process owns its address space. Hand-write page tables, frame allocator, kernel/user separation.",
    concepts: [
      "SV39 3-level walk: VPN[2:0] → PPN, 9/9/9/12 split",
      "PTE flags: V/R/W/X/U/G/A/D",
      "Physical frame allocator (stack allocator)",
      "Kernel trampoline + user TRAP_CONTEXT page",
      "Safe copy_from_user / copy_to_user",
    ],
    readings: ["xv6-riscv Ch.3", "rCore-Tutorial §4", "RISC-V Priv Spec Ch.10"],
    deliverable: {
      name: "tinyos-vm",
      desc: "A complete VM subsystem: FrameAllocator + MemorySet + per-proc satp + mmap/munmap + page-fault handling.",
      acceptance: [
        "Each user process has its own address space; pointers don't alias",
        "OOB access triggers a page fault and kills the process",
        "sys_mmap allocates and returns memory at page granularity",
        "Trampoline page mapped at the same VA in every address space",
      ],
    },
  },
  {
    id: 5, week: "Phase 5", duration: "Week 10-11 · 3 labs",
    title: "Storage: Block Device & File System", subtitle: "Block Device & File System",
    icon: "⬣", color: "#DC2626", accent: "#F87171",
    goal: "Build a simplified Unix FS from scratch: VirtIO block driver → block cache → bitmap/inode → directory → VFS.",
    concepts: [
      "VirtIO block protocol over MMIO",
      "Disk layout: superblock / bitmaps / inodes / data",
      "BlockCache: LRU + write-back",
      "Inode abstraction + directory lookup/create",
      "VFS: File trait unifies stdin/stdout/file",
    ],
    readings: ["xv6-riscv Ch.8", "OSTEP Ch.39-40", "rCore-Tutorial §6"],
    deliverable: {
      name: "tinyos-fs",
      desc: "Formattable + read/write + persistent easy-fs: mkfs tool + virtio-blk + open/read/write/close/fstat.",
      acceptance: [
        "Create/write/close a file — after reboot the data is still there",
        "1MB sequential IO throughput ≥ 2MB/s on cache hit",
        "Block-cache hit-rate log is observable",
        "On-disk format has a full spec document",
      ],
    },
  },
  {
    id: 6, week: "Phase 6", duration: "Week 12 · 3 labs",
    title: "Userland: Shell, Pipes & Coreutils", subtitle: "Shell, Pipes & User Programs",
    icon: "✦", color: "#DB2777", accent: "#F472B6",
    goal: "Package everything into a real Unix experience: /bin/init → /bin/sh with fork/exec, I/O redirection, pipes, and coreutils.",
    concepts: [
      "Full sys_fork / sys_exec / sys_waitpid semantics",
      "File-descriptor table + stdin/stdout/stderr",
      "sys_dup + redirection (>, <, >>)",
      "Pipe: kernel ring buffer + Weak<> read/write refcounts",
      "Shell line parser: pipelines, redirects, background &",
    ],
    readings: ["xv6-riscv Ch.1", "APUE Ch.15", "rCore-Tutorial §7"],
    deliverable: {
      name: "tinyos v1.0",
      desc: "A self-hosting mini Unix: /bin/init → /bin/sh + 8 coreutils + pipes + redirection — ship it on GitHub.",
      acceptance: [
        "Cold boot drops you into an interactive shell running all builtins",
        "cat f | grep x | wc -l produces the correct result",
        "FS survives reboot",
        "Total ≤ 8000 lines Rust + 200 lines asm, with tests & CI",
      ],
    },
  },
];

const PHASES_MAP: Record<Locale, Phase[]> = {
  "zh-CN": PHASES_ZH_CN,
  "zh-TW": PHASES_ZH_CN,
  en: PHASES_EN,
};

export function getPhases(locale: Locale): Phase[] {
  return PHASES_MAP[locale] ?? PHASES_ZH_CN;
}

// ─── Principles ───

const PRINCIPLES_ZH_CN: Principle[] = [
  { num: "01", title: "从裸机跑起来，再谈抽象", color: "#E8453C",
    desc: "不要一上来就抄 Linux 的设计文档。先让内核在 QEMU 上点亮一条 println!，每加一层代码都能立刻跑、立刻看结果。能跑的 100 行胜过完美的 10000 行设计稿。" },
  { num: "02", title: "每一层独立可测", color: "#D97706",
    desc: "调度器不依赖 VM，VM 不依赖 FS。每个 Phase 结束后都是一个可以冻结的快照，下一阶段出问题时可以回到这里隔离排查。Bottom-up 分层不是为了漂亮，是为了调试。" },
  { num: "03", title: "scause / sepc 是调试的罗盘", color: "#059669",
    desc: "OS 的 bug 不会给你友好的错误信息——只有一条 trap 和几个寄存器。养成第一反应看 scause/sepc/stval 的习惯，QEMU+gdb 是必备能力，而不是最后手段。" },
  { num: "04", title: "先正确，再并发，最后性能", color: "#7C3AED",
    desc: "并发 bug 是最难复现的。单核跑通功能 → 再加抢占 → 再上锁 → 再谈性能。跳过任何一步，后续调试成本会指数级上升。" },
  { num: "05", title: "用户态可见才是真的完成", color: "#2563EB",
    desc: "任何内核特性——fork、mmap、open——只有能被用户程序通过 syscall 正确使用，才算真正完成。每个 Phase 都要有用户 demo，不能停在\"内核里测过了\"。" },
];

const PRINCIPLES_EN: Principle[] = [
  { num: "01", title: "Boot it before you abstract it", color: "#E8453C",
    desc: "Don't start by copying Linux's design docs. Light up a println! in QEMU first; every new layer must immediately run and show results. 100 lines that run beat 10,000 lines of perfect paperware." },
  { num: "02", title: "Each layer testable in isolation", color: "#D97706",
    desc: "The scheduler doesn't depend on VM; VM doesn't depend on FS. Each phase ends at a freeze-able snapshot you can return to when the next phase breaks. Bottom-up layering is about debuggability, not aesthetics." },
  { num: "03", title: "scause / sepc is your compass", color: "#059669",
    desc: "OS bugs don't come with friendly error messages — just a trap and a few registers. Train the reflex to read scause/sepc/stval first; QEMU+gdb is a required skill, not a last resort." },
  { num: "04", title: "Correctness → concurrency → performance", color: "#7C3AED",
    desc: "Concurrency bugs are the hardest to reproduce. Make it work on one core, then preempt, then lock, then optimise. Skipping any step makes later debugging exponentially more expensive." },
  { num: "05", title: "User-visible = actually done", color: "#2563EB",
    desc: "Any kernel feature — fork, mmap, open — isn't finished until a user program can use it via syscall correctly. Every phase needs a user demo; \"I tested it in the kernel\" doesn't count." },
];

const PRINCIPLES_MAP: Record<Locale, Principle[]> = {
  "zh-CN": PRINCIPLES_ZH_CN,
  "zh-TW": PRINCIPLES_ZH_CN,
  en: PRINCIPLES_EN,
};

export function getPrinciples(locale: Locale): Principle[] {
  return PRINCIPLES_MAP[locale] ?? PRINCIPLES_ZH_CN;
}
