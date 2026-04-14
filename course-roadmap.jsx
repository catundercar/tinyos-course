import { useState } from "react";

// ─── Data ─────────────────────────────────────────────
const PHASES = [
  {
    id: 0,
    week: "Phase 0",
    duration: "Week 1-2 · 3 labs",
    title: "启动：从上电到内核 main",
    subtitle: "Boot & Kernel Entry",
    icon: "⬡",
    color: "#E8453C",
    accent: "#FF6B5E",
    goal: "理解 RISC-V 机器模型，从 OpenSBI 接管控制权，设置栈、清零 BSS，跳进 Rust 世界，点亮第一条 println!。",
    concepts: [
      "RISC-V 特权级：M-mode / S-mode / U-mode",
      "链接脚本与内核内存布局（.text / .rodata / .bss / stack）",
      "裸机 Rust：no_std / no_main / panic_handler",
      "UART 驱动与 SBI 调用约定",
      "QEMU 启动流程与调试技巧（gdb-remote）",
    ],
    readings: [
      "xv6-riscv book, Ch. 1-2",
      "rCore-Tutorial §1 应用程序与基本执行环境",
      "RISC-V Privileged Spec v1.12",
    ],
    deliverable: {
      name: "tinyos-boot",
      desc: "一个能在 QEMU RISC-V virt 机器上启动的裸机 Rust 内核：① 使用自定义链接脚本放置 .text 于 0x80200000 ② 汇编跳板设置栈指针并跳进 Rust 的 rust_main ③ 实现基于 SBI 的 console_putchar 与 print! / println! 宏 ④ 执行 panic 时打印定位信息并 shutdown。",
      acceptance: [
        "make qemu 后串口打印 \"Hello, TinyOS!\"",
        "panic!() 能输出文件名+行号并优雅关机",
        "链接脚本明确 text/rodata/data/bss 边界并在启动时清零 bss",
        "gdb 可从 0x80200000 单步调试",
      ],
    },
  },
  {
    id: 1,
    week: "Phase 1",
    duration: "Week 3-4 · 3 labs",
    title: "陷阱：特权级切换与系统调用",
    subtitle: "Traps & Syscalls",
    icon: "◈",
    color: "#D97706",
    accent: "#F59E0B",
    goal: "实现从 U-mode 到 S-mode 的完整 trap 通路：保存上下文、分发原因、执行 syscall、返回现场。这是用户态与内核态的分界线。",
    concepts: [
      "stvec / sepc / scause / stval / sstatus 寄存器语义",
      "TrapContext 设计与保存/恢复汇编（__alltraps / __restore）",
      "ecall 与系统调用约定（a7=sysno, a0-a5=args, a0=ret）",
      "异常分类：Exception vs Interrupt，可恢复 vs 致命",
      "第一批 syscall：write / exit / getpid",
    ],
    readings: [
      "xv6-riscv book, Ch. 4 Traps and system calls",
      "rCore-Tutorial §3 多道程序与分时多任务（trap 部分）",
      "RISC-V ISA Manual Vol II, Ch. 10 Supervisor ISA",
    ],
    deliverable: {
      name: "tinyos-trap",
      desc: "一套可运行 U-mode 用户程序并通过 ecall 返回内核的 trap 子系统：① TrapContext 34 寄存器保存/恢复 ② trap_handler 分发异常/中断/syscall ③ sys_write 把用户缓冲区内容写到串口 ④ sys_exit 结束进程并切回 idle。",
      acceptance: [
        "用户程序能通过 sys_write 打印字符串",
        "非法指令/缺页异常能被捕获并打印 scause+sepc",
        "trap 来回往返后所有通用寄存器完整保留",
        "所有 syscall 编号集中在 syscall/mod.rs 分发表",
      ],
    },
  },
  {
    id: 2,
    week: "Phase 2",
    duration: "Week 5-6 · 3 labs",
    title: "进程：任务抽象与调度",
    subtitle: "Process & Scheduling",
    icon: "◇",
    color: "#059669",
    accent: "#34D399",
    goal: "从单任务走向多任务。实现 PCB、task switch 汇编、时钟中断抢占、一个最小但可扩展的调度器。",
    concepts: [
      "Task Control Block：状态机 Ready/Running/Zombie",
      "__switch 汇编：callee-saved 寄存器 + ra + sp 的精确切换",
      "时钟中断（sbi_set_timer）与时间片轮转",
      "yield / sleep / exit 的内核原语",
      "Idle task 与调度器 loop 的骨架",
    ],
    readings: [
      "OSTEP Ch. 5-10 Processes & Scheduling",
      "xv6-riscv book, Ch. 7 Scheduling",
      "rCore-Tutorial §3 任务切换",
    ],
    deliverable: {
      name: "tinyos-proc",
      desc: "能并发运行 N 个用户任务的调度内核：① 任务加载到独立内存区 ② Round-Robin 调度 + 10ms 时间片 ③ fork/exec/wait/exit 的最小实现（可先用静态 apps）④ 进程树与父子关系。",
      acceptance: [
        "3 个用户 app 交错执行，输出可见时间片轮转",
        "__switch 汇编通过 200+ 次切换压测不丢寄存器",
        "父进程 wait 能正确回收 zombie 子进程",
        "进程数达到 MAX_TASKS 时 fork 返回 -1 而非崩溃",
      ],
    },
  },
  {
    id: 3,
    week: "Phase 3",
    duration: "Week 7 · 2 labs",
    title: "并发：同步原语与锁",
    subtitle: "Concurrency & Locks",
    icon: "◉",
    color: "#7C3AED",
    accent: "#A78BFA",
    goal: "在已有抢占式调度基础上，构建正确的同步原语：自旋锁（关中断保护）、睡眠锁、信号量、条件变量。直面死锁与优先级反转。",
    concepts: [
      "race condition 与原子性：读-改-写的危险",
      "SpinLock：amo 原子指令 + 关中断保证的临界区",
      "SleepLock：持锁时让出 CPU 给其他任务",
      "Semaphore / Condvar / Mutex 的层次与实现",
      "死锁四条件、锁排序、lockdep 思维",
    ],
    readings: [
      "xv6-riscv book, Ch. 6 Locking",
      "OSTEP Ch. 28-31 Concurrency",
      "Linux Kernel Development Ch. 10",
    ],
    deliverable: {
      name: "tinyos-sync",
      desc: "一整套可在内核与用户态复用的同步原语：① SpinLock<T> 带 RAII guard ② SleepLock 基于等待队列 ③ sys_sem_create/up/down ④ 生产者-消费者与哲学家就餐 demo。",
      acceptance: [
        "并发计数测试：10 任务 × 10000 次递增结果精确",
        "哲学家就餐 demo 无死锁运行 60s",
        "SpinLock 持锁时拒绝再次抢占（关中断断言）",
        "semaphore 的 up/down 与等待队列通过 stress test",
      ],
    },
  },
  {
    id: 4,
    week: "Phase 4",
    duration: "Week 8-9 · 3 labs",
    title: "内存：虚拟内存与分页",
    subtitle: "Virtual Memory & Paging",
    icon: "⬢",
    color: "#2563EB",
    accent: "#60A5FA",
    goal: "启用 SV39 分页机制，让每个进程拥有独立地址空间。手写页表、实现物理帧分配器、区分内核与用户地址空间。",
    concepts: [
      "SV39 三级页表：VPN[2:0] → PPN，9/9/9/12 位布局",
      "PTE flags：V/R/W/X/U/G/A/D 的语义与权限检查",
      "物理帧分配器（bitmap / stack allocator）",
      "内核空间 trampoline + 用户空间 trap context 页",
      "copy_from_user / copy_to_user 的安全跨空间访存",
    ],
    readings: [
      "xv6-riscv book, Ch. 3 Page tables",
      "rCore-Tutorial §4 地址空间",
      "RISC-V Privileged Spec Ch. 10 Supervisor-Level Memory Management (SV39)",
    ],
    deliverable: {
      name: "tinyos-vm",
      desc: "完整的虚拟内存子系统：① FrameAllocator 管理物理帧 ② MemorySet 表示一个地址空间（vec of MapArea）③ 每进程独立 satp，context switch 时一并切换 ④ mmap/munmap 系统调用与缺页处理雏形。",
      acceptance: [
        "每个用户进程拥有独立地址空间，指针互不冲突",
        "越界访问触发 page fault 并被 kill 掉该进程",
        "sys_mmap 能按页粒度分配并在 unmap 时归还",
        "trampoline 页在所有地址空间中同地址映射（切换 satp 不中断）",
      ],
    },
  },
  {
    id: 5,
    week: "Phase 5",
    duration: "Week 10-11 · 3 labs",
    title: "存储：块设备与文件系统",
    subtitle: "Block Device & File System",
    icon: "⬣",
    color: "#DC2626",
    accent: "#F87171",
    goal: "从零搭建一个简化版 Unix 文件系统：VirtIO 块驱动 → 缓冲区缓存 → 位图/Inode → 目录 → VFS 接口 → open/read/write/close。",
    concepts: [
      "VirtIO Block 协议与 MMIO 寄存器",
      "磁盘分层：superblock / inode bitmap / data bitmap / inodes / data",
      "Block Cache：LRU + 写回（类 Linux buffer cache）",
      "Inode 抽象与目录项的查找/创建",
      "VFS：File trait + OSInode + stdin/stdout 统一",
    ],
    readings: [
      "xv6-riscv book, Ch. 8 File system",
      "OSTEP Ch. 39-40 File Systems",
      "rCore-Tutorial §6 文件系统与I/O重定向",
    ],
    deliverable: {
      name: "tinyos-fs",
      desc: "可格式化 + 可读写 + 可持久化的 easy-fs：① mkfs 工具在主机上生成镜像 ② 内核挂载 virtio-blk 镜像 ③ sys_open/read/write/close/fstat ④ 简易目录操作 ls/cat。",
      acceptance: [
        "在 QEMU 中创建、读写、关闭文件后重启数据仍在",
        "1MB 文件顺序读写吞吐量 ≥ 2MB/s（cache 命中路径）",
        "block cache 命中率日志可观测",
        "文件系统镜像格式有完整 spec 文档",
      ],
    },
  },
  {
    id: 6,
    week: "Phase 6",
    duration: "Week 12 · 3 labs",
    title: "产品：Shell、管道与用户程序",
    subtitle: "Shell, Pipes & User Programs",
    icon: "✦",
    color: "#DB2777",
    accent: "#F472B6",
    goal: "把一切打包成真正的 Unix-like 体验：从 /bin/init 启动 shell，支持 fork/exec、I/O 重定向、管道，内置一组 coreutils。",
    concepts: [
      "sys_fork / sys_exec / sys_waitpid 的完整语义",
      "文件描述符表与 stdin/stdout/stderr",
      "sys_dup / 重定向（>、<、>>）",
      "Pipe：内核环形缓冲 + 读端写端引用计数",
      "Shell 行解析：命令流、管道、后台 &",
    ],
    readings: [
      "xv6-riscv book, Ch. 1 Operating system interfaces",
      "APUE Ch. 15 Interprocess Communication",
      "rCore-Tutorial §7 进程间通信",
    ],
    deliverable: {
      name: "tinyos v1.0",
      desc: "一个自举的小型 Unix：① /bin/init → /bin/sh ② 实现 ls/cat/echo/mkdir/rm/ps/kill 等 8 个 coreutils ③ 支持管道 ls | cat ④ 支持重定向 ls > out.txt ⑤ README + 演示 GIF 可发布到 GitHub。",
      acceptance: [
        "cold boot 后进入交互式 shell，可执行所有内置命令",
        "三级管道 cat f | grep x | wc -l 结果正确",
        "重启后文件系统数据持久",
        "总代码 ≤ 8000 行 Rust + 200 行汇编，有测试与 CI",
      ],
    },
  },
];

const ARCHITECTURE = [
  { layer: 6, label: "Layer 6 · Shell & User Programs", color: "#DB2777", modules: ["init", "sh", "coreutils", "libc 裁剪"], phase: "Phase 6" },
  { layer: 5, label: "Layer 5 · File System",          color: "#DC2626", modules: ["VFS", "easy-fs", "BlockCache", "virtio-blk"], phase: "Phase 5" },
  { layer: 4, label: "Layer 4 · Virtual Memory",        color: "#2563EB", modules: ["PageTable SV39", "FrameAllocator", "MemorySet", "mmap"], phase: "Phase 4" },
  { layer: 3, label: "Layer 3 · Concurrency & Locks",   color: "#7C3AED", modules: ["SpinLock", "SleepLock", "Semaphore", "Condvar"], phase: "Phase 3" },
  { layer: 2, label: "Layer 2 · Process & Scheduling",  color: "#059669", modules: ["TCB", "__switch", "Round-Robin", "fork/exec"], phase: "Phase 2" },
  { layer: 1, label: "Layer 1 · Traps & Syscalls",      color: "#D97706", modules: ["TrapContext", "Syscall 分发", "时钟中断", "ecall 通路"], phase: "Phase 1" },
  { layer: 0, label: "Layer 0 · Boot & Kernel Entry",   color: "#E8453C", modules: ["entry.asm", "linker.ld", "SBI console", "panic_handler"], phase: "Phase 0" },
];

const PRINCIPLES = [
  { num: "01", title: "从裸机跑起来，再谈抽象",
    desc: "不要一上来就抄 Linux 的设计文档。先让内核在 QEMU 上点亮一条 println!，每加一层代码都能立刻跑、立刻看结果。能跑的 100 行胜过完美的 10000 行设计稿。",
    color: "#E8453C" },
  { num: "02", title: "每一层独立可测",
    desc: "调度器不依赖 VM，VM 不依赖 FS。每个 Phase 结束后都是一个可以冻结的快照，下一阶段出问题时可以回到这里隔离排查。Bottom-up 分层不是为了漂亮，是为了调试。",
    color: "#D97706" },
  { num: "03", title: "scause / sepc 是调试的罗盘",
    desc: "操作系统的 bug 不会给你友好的错误信息——只有一条 trap 和几个寄存器。养成第一反应看 scause/sepc/stval 的习惯，QEMU+gdb 是必备能力，而不是最后手段。",
    color: "#059669" },
  { num: "04", title: "先正确，再并发，最后性能",
    desc: "并发 bug 是最难复现的。单核跑通功能 → 再加抢占 → 再上锁 → 再谈性能。跳过任何一步，后续调试成本会指数级上升。",
    color: "#7C3AED" },
  { num: "05", title: "用户态可见才是真的完成",
    desc: "任何内核特性——fork、mmap、open——只有能被用户程序通过 syscall 正确使用，才算真正完成。每个 Phase 都要有用户程序 demo 可运行，不能停在 \"内核里测过了\"。",
    color: "#2563EB" },
];

// ─── Component ────────────────────────────────────────
export default function CourseRoadmap() {
  const [activePhase, setActivePhase] = useState(null);
  const [activeTab, setActiveTab] = useState("roadmap");

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      background: "#0A0A0B",
      color: "#E4E4E7",
      minHeight: "100vh",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(228,228,231,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(228,228,231,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />

      <header style={{
        position: "relative", zIndex: 10,
        padding: "48px 32px 24px",
        borderBottom: "1px solid rgba(228,228,231,0.08)",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "rgba(232,69,60,0.15)",
            border: "1px solid rgba(232,69,60,0.3)",
            borderRadius: 4,
            fontSize: 11,
            letterSpacing: "0.1em",
            color: "#E8453C",
            marginBottom: 16,
            textTransform: "uppercase",
          }}>
            Engineering Practicum · 12 Weeks · Rust + RISC-V
          </div>
          <h1 style={{
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1.2,
            margin: "0 0 8px",
            background: "linear-gradient(135deg, #E4E4E7 0%, #A1A1AA 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            从零构建 TinyOS
          </h1>
          <p style={{
            fontSize: 15,
            color: "#71717A",
            margin: 0,
            maxWidth: 600,
            lineHeight: 1.6,
          }}>
            用 Rust 在 QEMU RISC-V 上实现一个可启动、可分时、可分页、可持久化文件、可 shell 交互的小型 Unix-like 内核。<br/>
            每个 Phase 都有可运行的交付物，最终产出一个 star-ready 的开源 OS。
          </p>

          <div style={{ display: "flex", gap: 2, marginTop: 32 }}>
            {[
              { key: "roadmap", label: "课程路线" },
              { key: "arch", label: "系统架构" },
              { key: "principles", label: "设计原则" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "8px 20px",
                  background: activeTab === tab.key ? "rgba(228,228,231,0.1)" : "transparent",
                  border: "1px solid",
                  borderColor: activeTab === tab.key ? "rgba(228,228,231,0.15)" : "transparent",
                  borderRadius: 4,
                  color: activeTab === tab.key ? "#E4E4E7" : "#52525B",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ position: "relative", zIndex: 10, maxWidth: 960, margin: "0 auto", padding: "32px 32px 80px" }}>

        {activeTab === "roadmap" && (
          <div>
            {PHASES.map((phase, i) => {
              const isOpen = activePhase === phase.id;
              return (
                <div key={phase.id} style={{ position: "relative", marginBottom: 2 }}>
                  {i < PHASES.length - 1 && (
                    <div style={{
                      position: "absolute",
                      left: 19,
                      top: 44,
                      bottom: -2,
                      width: 1,
                      background: `linear-gradient(to bottom, ${phase.color}44, ${PHASES[i+1].color}44)`,
                    }} />
                  )}

                  <button
                    onClick={() => setActivePhase(isOpen ? null : phase.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 16,
                      width: "100%",
                      padding: "16px 0",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: `${phase.color}18`,
                      border: `1px solid ${phase.color}44`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      flexShrink: 0,
                      transition: "all 0.3s",
                      boxShadow: isOpen ? `0 0 20px ${phase.color}33` : "none",
                    }}>
                      {phase.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: phase.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          {phase.week}
                        </span>
                        <span style={{ fontSize: 11, color: "#52525B" }}>
                          {phase.duration}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#E4E4E7",
                        margin: "4px 0 2px",
                      }}>
                        {phase.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#52525B", fontStyle: "italic" }}>
                        {phase.subtitle}
                      </div>
                    </div>

                    <div style={{
                      color: "#52525B",
                      fontSize: 14,
                      transform: isOpen ? "rotate(90deg)" : "rotate(0)",
                      transition: "transform 0.2s",
                      marginTop: 8,
                    }}>
                      →
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{
                      marginLeft: 56,
                      marginBottom: 24,
                      animation: "fadeIn 0.3s ease",
                    }}>
                      <div style={{
                        padding: "16px 20px",
                        background: `${phase.color}08`,
                        borderLeft: `2px solid ${phase.color}66`,
                        borderRadius: "0 8px 8px 0",
                        marginBottom: 24,
                        fontSize: 13,
                        lineHeight: 1.7,
                        color: "#A1A1AA",
                      }}>
                        {phase.goal}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                        <div style={{
                          padding: 16,
                          background: "rgba(228,228,231,0.03)",
                          border: "1px solid rgba(228,228,231,0.06)",
                          borderRadius: 8,
                        }}>
                          <div style={{ fontSize: 10, color: "#71717A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                            核心知识点
                          </div>
                          {phase.concepts.map((c, j) => (
                            <div key={j} style={{
                              fontSize: 12,
                              color: "#A1A1AA",
                              padding: "6px 0",
                              borderBottom: j < phase.concepts.length - 1 ? "1px solid rgba(228,228,231,0.04)" : "none",
                              display: "flex",
                              gap: 8,
                            }}>
                              <span style={{ color: phase.color, opacity: 0.6 }}>›</span>
                              {c}
                            </div>
                          ))}
                        </div>

                        <div style={{
                          padding: 16,
                          background: "rgba(228,228,231,0.03)",
                          border: "1px solid rgba(228,228,231,0.06)",
                          borderRadius: 8,
                        }}>
                          <div style={{ fontSize: 10, color: "#71717A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                            参考资料
                          </div>
                          {phase.readings.map((r, j) => (
                            <div key={j} style={{
                              fontSize: 12,
                              color: "#A1A1AA",
                              padding: "6px 0",
                              borderBottom: j < phase.readings.length - 1 ? "1px solid rgba(228,228,231,0.04)" : "none",
                              display: "flex",
                              gap: 8,
                            }}>
                              <span style={{ color: "#52525B" }}>📄</span>
                              {r}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{
                        padding: 20,
                        background: `linear-gradient(135deg, ${phase.color}0A, ${phase.accent}06)`,
                        border: `1px solid ${phase.color}22`,
                        borderRadius: 8,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <div style={{
                            fontSize: 10,
                            color: phase.color,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            fontWeight: 700,
                          }}>
                            ✦ 交付物
                          </div>
                          <code style={{
                            fontSize: 13,
                            color: phase.accent,
                            background: `${phase.color}15`,
                            padding: "2px 8px",
                            borderRadius: 4,
                          }}>
                            {phase.deliverable.name}
                          </code>
                        </div>
                        <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.7, margin: "0 0 16px" }}>
                          {phase.deliverable.desc}
                        </p>
                        <div style={{ fontSize: 10, color: "#71717A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                          验收标准
                        </div>
                        {phase.deliverable.acceptance.map((a, j) => (
                          <div key={j} style={{
                            fontSize: 12,
                            color: "#A1A1AA",
                            padding: "5px 0",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                          }}>
                            <span style={{
                              display: "inline-block",
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              border: `1px solid ${phase.color}44`,
                              flexShrink: 0,
                              marginTop: 1,
                            }} />
                            {a}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "arch" && (
          <div>
            <p style={{ fontSize: 13, color: "#71717A", marginBottom: 32, lineHeight: 1.7 }}>
              整体架构采用自底向上的分层设计：每一层对应一个 Phase 的交付物，上层依赖下层，下层不感知上层。
              任何一层的 bug 都应该可以在它自己的 phase 内被定位和修复，而不需要回到下层。
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ARCHITECTURE.map((layer, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 0,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: `1px solid ${layer.color}22`,
                }}>
                  <div style={{
                    width: 220,
                    padding: "16px 20px",
                    background: `${layer.color}12`,
                    borderRight: `1px solid ${layer.color}22`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: layer.color }}>
                      {layer.label}
                    </div>
                    <div style={{ fontSize: 10, color: "#52525B", marginTop: 2 }}>
                      {layer.phase}
                    </div>
                  </div>
                  <div style={{
                    flex: 1,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    padding: 12,
                    background: "rgba(228,228,231,0.02)",
                    alignItems: "center",
                  }}>
                    {layer.modules.map((mod, j) => (
                      <div key={j} style={{
                        padding: "6px 12px",
                        background: `${layer.color}0A`,
                        border: `1px solid ${layer.color}18`,
                        borderRadius: 4,
                        fontSize: 11,
                        color: "#A1A1AA",
                      }}>
                        {mod}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 32,
              padding: 24,
              background: "rgba(228,228,231,0.03)",
              border: "1px solid rgba(228,228,231,0.06)",
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 10, color: "#71717A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
                一次 sys_read 的完整数据流
              </div>
              <div style={{ fontFamily: "inherit", fontSize: 12, color: "#71717A", lineHeight: 2.2 }}>
                <span style={{ color: "#DB2777" }}>shell 用户态</span>
                {" → "}
                <span style={{ color: "#D97706" }}>ecall</span>
                {" → "}
                <span style={{ color: "#D97706" }}>trap_handler</span>
                {" → "}
                <span style={{ color: "#DC2626" }}>sys_read 分发</span>
                {" → "}
                <span style={{ color: "#DC2626" }}>OSInode.read</span>
                {" → "}
                <span style={{ color: "#DC2626" }}>BlockCache</span>
                {" → "}
                <span style={{ color: "#DC2626" }}>virtio-blk</span>
                {" → "}
                <span style={{ color: "#2563EB" }}>translate VA→PA</span>
                {" → "}
                <span style={{ color: "#2563EB" }}>copy_to_user</span>
                {" → "}
                <span style={{ color: "#D97706" }}>restore context</span>
                {" → "}
                <span style={{ color: "#DB2777" }}>sret 回用户态</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "principles" && (
          <div>
            <p style={{ fontSize: 13, color: "#71717A", marginBottom: 32, lineHeight: 1.7 }}>
              这 5 条原则源自 xv6 / rCore / OSTEP 的教学经验，贯穿整个课程。如果某一步觉得走不下去了，回来对照这几条原则通常能找到症结。
            </p>
            {PRINCIPLES.map((p, i) => (
              <div key={i} style={{
                display: "flex",
                gap: 20,
                padding: "24px 0",
                borderBottom: i < PRINCIPLES.length - 1 ? "1px solid rgba(228,228,231,0.06)" : "none",
              }}>
                <div style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: `${p.color}33`,
                  lineHeight: 1,
                  flexShrink: 0,
                  width: 48,
                }}>
                  {p.num}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#E4E4E7", marginBottom: 8 }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 13, color: "#71717A", lineHeight: 1.7 }}>
                    {p.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        button:hover { opacity: 0.9; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #27272A; border-radius: 3px; }
      `}</style>
    </div>
  );
}
