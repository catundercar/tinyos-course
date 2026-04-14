import type { PhaseContent } from "./types";

// ─── Phase 0: Boot & Kernel Entry (zh-CN) ────────────────

export const phase0ZhCN: PhaseContent = {
  phaseId: 0,
  color: "#E8453C",
  accent: "#FF6B5E",
  lessons: [
    {
      phaseId: 0, lessonId: 1,
      title: "Phase 0 导读：从上电到 rust_main",
      subtitle: "为什么第一行 println! 这么难",
      type: "Concept",
      duration: "1.5 hours",
      objectives: [
        "理解 RISC-V 三级特权级（M / S / U mode）的硬件模型",
        "看懂 OpenSBI 启动流程，明白为什么我们从 0x80200000 起步",
        "掌握 no_std Rust 的约束：没有 std、没有 main、没有 panic_handler",
        "能用自己的链接脚本布局内核内存",
      ],
      sections: [
        {
          title: "你在构建什么",
          blocks: [
            { type: "paragraph", text: "Phase 0 结束时，你会亲眼看着一台虚拟 RISC-V 机器从零启动：CPU 加电 → OpenSBI 初始化 → 跳进你写的 rust_main → UART 打印 \"Hello, TinyOS!\" → panic!() 优雅关机。这 5 步看起来简单，但每一步背后都有一整套硬件与约定。" },
            { type: "diagram", content:
`┌──────────────┐    ┌───────────┐    ┌──────────────┐
│  CPU Reset   │ →  │ OpenSBI   │ →  │  你的 _start │
│  at M-mode   │    │ (M-mode)  │    │  at S-mode   │
└──────────────┘    └───────────┘    └──────┬───────┘
                                            ↓
                    ┌───────────────────────────────────┐
                    │  rust_main()                      │
                    │   ├─ clear_bss()                  │
                    │   ├─ println!("Hello, TinyOS!");  │
                    │   └─ loop { wfi }                 │
                    └───────────────────────────────────┘` },
          ],
        },
        {
          title: "心智模型：裸机 Rust 就是 Rust 减掉 std",
          blocks: [
            { type: "paragraph", text: "日常 Rust 靠 libstd 提供的操作系统服务运行：println! 走 stdout、Vec 走 alloc、panic 走 unwind。我们现在要写的就是那个 libstd 的下层——没有它可依赖，一切都要自己来。" },
            { type: "code", language: "rust", code:
`#![no_std]                     // 禁用 libstd
#![no_main]                    // 禁用 libstd 的 main 入口

#[no_mangle]
pub extern "C" fn rust_main() -> ! {
    println!("Hello, TinyOS!");  // 这个 println! 是我们自己定义的
    sbi::shutdown();
    loop {}
}

#[panic_handler]               // 必须手动提供
fn panic(info: &PanicInfo) -> ! { ... }` },
            { type: "list", ordered: true, items: [
              "Lab 1：自己写 entry.asm + linker.ld — 让控制权正确落到 rust_main。",
              "Lab 2：实现 sbi_ecall 与 println! — 让 rust_main 能说话。",
              "Lab 3：写 panic_handler — 让 panic 有尊严地死掉。",
            ]},
          ],
        },
        {
          title: "RISC-V 三级特权级",
          blocks: [
            { type: "table", headers: ["特权级", "谁运行", "能做什么"], rows: [
              ["M-mode (Machine)", "OpenSBI / firmware", "访问所有 CSR、所有物理内存、中断"],
              ["S-mode (Supervisor)", "我们的内核 TinyOS", "管理用户进程、虚拟内存、syscall"],
              ["U-mode (User)", "用户程序", "只能做算术和访问自己的虚拟内存"],
            ]},
            { type: "callout", variant: "info", text: "为什么我们不直接运行在 M-mode？因为 QEMU 启动时 OpenSBI 已经接管了 M-mode 并提供了一套标准 SBI 服务（console、timer、shutdown）。我们在 S-mode 通过 ecall 调用它们，既省事又标准。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1", title: "Lab 1 ⭐ entry.asm + linker.ld",
          description: "让 CPU 从 0x80200000 起步后，正确设置 sp、跳进 rust_main。",
          labFile: "labs/phase_0_boot/src/entry.asm",
          hints: [
            "sp 必须指向内核栈顶——注意栈是向下生长的",
            "用 la（load address）而不是 li；地址在链接期才确定",
            "跳转用 call rust_main；后面接 unimp 做安全网",
          ],
          pseudocode:
`.section .text.entry
.globl _start
_start:
    la sp, boot_stack_top    # sp 指向栈顶
    call rust_main           # 不返回
    unimp                    # 安全网：若 rust_main 错误返回，立即异常`,
        },
        {
          id: "lab2", title: "Lab 2 ⭐⭐ SBI + println!",
          description: "实现 sbi_ecall 内联汇编与 Stdout 类型，让 println! 宏可用。",
          labFile: "labs/phase_0_boot/src/sbi.rs",
          hints: [
            "ecall 的 7 个参数：a7 是 EID, a6 是 FID, a0-a5 是参数",
            "inline asm 记得标 \"memory\" clobber",
            "Stdout 实现 core::fmt::Write trait，print! 基于它",
          ],
        },
        {
          id: "lab3", title: "Lab 3 ⭐⭐ panic_handler",
          description: "实现 #[panic_handler]：打印 location + message，然后 sbi_shutdown。",
          labFile: "labs/phase_0_boot/src/lang_items.rs",
          hints: [
            "PanicInfo::location() 可能是 None，要处理",
            "打完 panic 信息后必须进入死循环或 shutdown —— 函数返回类型是 !",
          ],
        },
      ],
      acceptanceCriteria: [
        "make qemu 后串口打印 \"Hello, TinyOS!\"",
        "panic!() 能输出文件名+行号并优雅关机",
        "链接脚本明确 text/rodata/data/bss 边界并在启动时清零 bss",
        "gdb 可从 0x80200000 单步调试",
      ],
      references: [
        { title: "xv6-riscv book Ch. 1-2", description: "[必读] MIT 6.S081 教材，最清晰的 RISC-V 启动流程 walkthrough", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §1", description: "[必读] 清华 rCore 教学内核，Rust + RISC-V 的起点", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter1/index.html" },
        { title: "RISC-V Privileged Spec v1.12", description: "[深入阅读] 查寄存器语义的最终依据", url: "https://github.com/riscv/riscv-isa-manual/releases" },
        { title: "OpenSBI 文档", description: "[深入阅读] 了解 SBI 服务集", url: "https://github.com/riscv-software-src/opensbi/tree/master/docs" },
      ],
    },
  ],
};

// ─── Phase 0: Boot & Kernel Entry (en) ────────────────

export const phase0En: PhaseContent = {
  phaseId: 0,
  color: "#E8453C",
  accent: "#FF6B5E",
  lessons: [
    {
      phaseId: 0, lessonId: 1,
      title: "Phase 0 Overview: From Power-On to rust_main",
      subtitle: "Why the first println! is so hard",
      type: "Concept",
      duration: "1.5 hours",
      objectives: [
        "Understand RISC-V's three privilege levels (M / S / U mode)",
        "Follow the OpenSBI boot flow and why we start at 0x80200000",
        "Master the constraints of no_std Rust: no std, no main, no panic_handler",
        "Lay out kernel memory with your own linker script",
      ],
      sections: [
        {
          title: "What you're building",
          blocks: [
            { type: "paragraph", text: "By the end of Phase 0 you'll watch a virtual RISC-V machine boot from zero: CPU reset → OpenSBI init → your rust_main → UART prints \"Hello, TinyOS!\" → panic!() cleanly shuts down. Five steps, but every step hides a protocol you now have to know." },
            { type: "diagram", content:
`┌──────────────┐    ┌───────────┐    ┌──────────────┐
│  CPU Reset   │ →  │ OpenSBI   │ →  │  your _start │
│  in M-mode   │    │ (M-mode)  │    │  in S-mode   │
└──────────────┘    └───────────┘    └──────┬───────┘
                                            ↓
                    ┌───────────────────────────────────┐
                    │  rust_main()                      │
                    │   ├─ clear_bss()                  │
                    │   ├─ println!("Hello, TinyOS!");  │
                    │   └─ loop { wfi }                 │
                    └───────────────────────────────────┘` },
          ],
        },
        {
          title: "Mental model: bare-metal Rust = Rust minus std",
          blocks: [
            { type: "paragraph", text: "Day-to-day Rust leans on libstd for OS services: println! uses stdout, Vec uses alloc, panic uses unwind. We are writing that lower layer. Nothing below us to depend on — we build it all." },
            { type: "code", language: "rust", code:
`#![no_std]                     // no libstd
#![no_main]                    // no libstd main entry

#[no_mangle]
pub extern "C" fn rust_main() -> ! {
    println!("Hello, TinyOS!");  // our own println!
    sbi::shutdown();
    loop {}
}

#[panic_handler]               // must be supplied by hand
fn panic(info: &PanicInfo) -> ! { ... }` },
            { type: "list", ordered: true, items: [
              "Lab 1: write entry.asm + linker.ld — land control in rust_main correctly.",
              "Lab 2: implement sbi_ecall + println! — let rust_main speak.",
              "Lab 3: write panic_handler — let panics die with dignity.",
            ]},
          ],
        },
        {
          title: "The three RISC-V privilege levels",
          blocks: [
            { type: "table", headers: ["Level", "Runs", "Can do"], rows: [
              ["M-mode (Machine)", "OpenSBI / firmware", "All CSRs, all physical memory, interrupts"],
              ["S-mode (Supervisor)", "Our kernel TinyOS", "Manages user processes, VM, syscalls"],
              ["U-mode (User)", "User programs", "Arithmetic and its own virtual memory"],
            ]},
            { type: "callout", variant: "info", text: "Why not run in M-mode directly? On boot, QEMU's OpenSBI already took over M-mode and exposes a standard set of SBI services (console, timer, shutdown). We sit in S-mode and ecall into them — simpler and portable." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1", title: "Lab 1 ⭐ entry.asm + linker.ld",
          description: "From 0x80200000, set up sp and jump into rust_main correctly.",
          labFile: "labs/phase_0_boot/src/entry.asm",
          hints: [
            "sp must point to the top of the kernel stack — stacks grow downward",
            "Use la (load address), not li; the address is fixed at link time",
            "Use call rust_main; follow with unimp as a safety net",
          ],
          pseudocode:
`.section .text.entry
.globl _start
_start:
    la sp, boot_stack_top    # sp → stack top
    call rust_main           # never returns
    unimp                    # safety net if it does`,
        },
        {
          id: "lab2", title: "Lab 2 ⭐⭐ SBI + println!",
          description: "Implement sbi_ecall (inline asm) and a Stdout writer so the println! macro works.",
          labFile: "labs/phase_0_boot/src/sbi.rs",
          hints: [
            "ecall takes 7 regs: a7=EID, a6=FID, a0-a5=args",
            "Remember the \"memory\" clobber in inline asm",
            "Stdout implements core::fmt::Write; print! delegates to it",
          ],
        },
        {
          id: "lab3", title: "Lab 3 ⭐⭐ panic_handler",
          description: "Implement #[panic_handler] to print location + message, then sbi_shutdown.",
          labFile: "labs/phase_0_boot/src/lang_items.rs",
          hints: [
            "PanicInfo::location() may be None — handle both",
            "The fn must be ! — loop or shutdown after printing",
          ],
        },
      ],
      acceptanceCriteria: [
        "make qemu prints \"Hello, TinyOS!\" on the UART",
        "panic!() emits file+line and shuts down gracefully",
        "Linker script defines .text/.rodata/.data/.bss; BSS zeroed at startup",
        "gdb can single-step from 0x80200000",
      ],
      references: [
        { title: "xv6-riscv book Ch. 1-2", description: "[Required] MIT 6.S081 textbook — clearest RISC-V boot walkthrough", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §1", description: "[Required] Tsinghua rCore teaching kernel — the Rust+RISC-V starting point", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter1/index.html" },
        { title: "RISC-V Privileged Spec v1.12", description: "[Deep dive] Ultimate reference for CSR semantics", url: "https://github.com/riscv/riscv-isa-manual/releases" },
        { title: "OpenSBI Docs", description: "[Deep dive] SBI service set reference", url: "https://github.com/riscv-software-src/opensbi/tree/master/docs" },
      ],
    },
  ],
};
