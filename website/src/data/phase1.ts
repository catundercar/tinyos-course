import type { PhaseContent } from "./types";

// ─── Phase 1: Traps & Syscalls (zh-CN) ──────────────────

export const phase1ZhCN: PhaseContent = {
  phaseId: 1,
  color: "#D97706",
  accent: "#F59E0B",
  lessons: [
    // ── Lesson 1 ──────────────────────────────────────────
    {
      phaseId: 1, lessonId: 1,
      title: "Phase 1 导读：为什么需要 trap",
      subtitle: "U-mode ⇄ S-mode 的硬件边界",
      type: "Concept",
      duration: "1 hour",
      objectives: [
        "理解什么是 trap、异常、中断、系统调用，以及它们的关系",
        "看懂从 U-mode 触发 ecall 到 S-mode 处理并返回的完整硬件流程",
        "掌握本 phase 5 个课时之间的依赖关系与完成顺序",
        "知道为什么 trap 处理必须先用汇编而不能直接写 Rust",
      ],
      sections: [
        {
          title: "从单一特权级到双特权级",
          blocks: [
            { type: "paragraph", text: "Phase 0 里一切都跑在 S-mode：代码、栈、数据都是内核的。Phase 1 的任务是把用户程序放到 U-mode 去跑——这件事一旦做成，你就拥有了两个相互不信任的世界，以及一条受控通道连接它们。这条通道就是 trap。" },
            { type: "diagram", content:
`U-mode (用户程序)                       S-mode (内核)
─────────────                          ────────────
  li a7, 64
  li a0, 1
  la a1, msg                 硬件自动：
  li a2, 12       ───ecall──▶  1) sepc    ← pc
                                2) scause  ← 8 (ecall from U)
                                3) sstatus.SPP ← 0 (来自 U-mode)
                                4) sstatus.SIE ← SPIE
                                5) pc      ← stvec
                                6) 特权级  ← S
                                          ↓
                              __alltraps:
                                保存 32 x 寄存器 + sstatus + sepc
                                调用 Rust trap_handler(cx)
                                恢复所有寄存器
                                sret ──────┐
                                           │
  继续下一条指令       ◀──────────────────┘` },
            { type: "callout", variant: "info", text: "trap 的本质是硬件逼迫 CPU 放下手上的事去运行内核指定的代码。它是唯一能把 CPU 从 U-mode 带到 S-mode 的合法途径——没有 trap，内核对用户程序就没有任何控制力。" },
          ],
        },
        {
          title: "trap 的三种来源",
          blocks: [
            { type: "table", headers: ["类型", "触发方式", "scause 高位", "典型例子"], rows: [
              ["Exception", "当前指令本身出错或主动 ecall", "0", "非法指令 (2)、缺页 (13/15)、ecall (8)"],
              ["Interrupt", "外部异步事件", "1", "时钟 (5)、外部设备 (9)、软中断 (1)"],
              ["Syscall", "Exception 的子集——code=8", "0", "用户程序 ecall 主动请求内核服务"],
            ]},
            { type: "paragraph", text: "scause 最高位区分中断和异常，低位是原因编号。Phase 1 只处理 ecall (=8)，中断留给 Phase 2 的时钟。但你的 trap_handler 骨架现在就要写成能分发所有类型——后面只是往 match 里加分支。" },
          ],
        },
        {
          title: "本 Phase 的 5 个课时",
          blocks: [
            { type: "list", ordered: true, items: [
              "Lesson 1（本页）：导读——理解为什么要 trap、何时要 trap。",
              "Lesson 2：CSR 硬件模型——stvec/sepc/scause/stval/sstatus 的精确语义。",
              "Lesson 3：TrapContext 设计——为什么是 34 个 u64、栈上怎么排。",
              "Lesson 4：__alltraps / __restore 汇编——保存/恢复每一条的原因。",
              "Lesson 5：Syscall ABI + 让第一个 U-mode 程序跑起来。",
            ]},
            { type: "callout", variant: "tip", text: "做完 Lesson 5 的综合实验，你就拥有了一个能跑任意用户程序的最小内核——虽然只有一个进程，但 Phase 2 所有的进程/调度都建立在这条 trap 通路之上。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab0-read", title: "阅读任务：画出 ecall 时序图",
          description: "不看文档，在纸上画出从 U-mode 执行 ecall 到 S-mode trap_handler 的前 10 条硬件步骤。下一课我们会对照标准答案。",
          hints: [
            "关注 CSR 状态变化，不要只盯 pc",
            "sstatus.SPP 和 sstatus.SPIE 在 trap 前后各是什么值？",
            "为什么 sepc 存的是 ecall 本身的地址、不是下一条？",
          ],
        },
      ],
      acceptanceCriteria: [
        "能用自己的话向别人解释 exception / interrupt / syscall 的区别",
        "知道 Phase 1 将交付什么（可跑 U-mode 程序 + sys_write + sys_exit）",
        "明白为什么 trap 入口必须是汇编",
      ],
      references: [
        { title: "xv6-riscv book Ch. 4", description: "[必读] Traps and system calls——概念与实现的黄金参考", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §2", description: "[必读] 批处理系统与特权级切换（Rust 实现）", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter2/index.html" },
        { title: "RISC-V Privileged Spec Ch. 4", description: "[深入阅读] Supervisor-Level ISA——CSR 权威定义", url: "https://github.com/riscv/riscv-isa-manual/releases" },
      ],
    },

    // ── Lesson 2 ──────────────────────────────────────────
    {
      phaseId: 1, lessonId: 2,
      title: "CSR 硬件模型：5 个寄存器撑起整个 trap",
      subtitle: "stvec / sepc / scause / stval / sstatus",
      type: "Concept",
      duration: "1.5 hours",
      objectives: [
        "记住 5 个 trap 相关 CSR 的完整语义及读写时机",
        "看懂 sstatus 中 SPP / SIE / SPIE 的位布局与状态机",
        "理解 sepc 为什么指向「触发指令本身」，ecall 返回时为什么要 +4",
        "会写 csrr / csrw / csrrw 三种读写指令",
      ],
      sections: [
        {
          title: "5 个核心 CSR",
          blocks: [
            { type: "table", headers: ["CSR", "写入者", "读取者", "作用"], rows: [
              ["stvec", "内核启动时一次", "硬件 trap 时", "trap 入口地址 + MODE"],
              ["sepc", "硬件 trap 时", "内核 sret 时", "被中断指令的 PC"],
              ["scause", "硬件 trap 时", "trap_handler", "trap 原因编码"],
              ["stval", "硬件 trap 时", "trap_handler", "附加信息（缺页地址、非法指令码等）"],
              ["sstatus", "内核、硬件", "内核", "S-mode 状态字，含 SPP/SIE/SPIE"],
            ]},
          ],
        },
        {
          title: "stvec：trap 入口的路标",
          blocks: [
            { type: "diagram", content:
` 63                                           2  1  0
┌──────────────────────────────────────────────┬────┐
│              BASE (trap 入口地址 >> 2)        │MODE│
└──────────────────────────────────────────────┴────┘
MODE = 0  Direct   —— 所有 trap 都跳到 BASE
MODE = 1  Vectored —— 中断跳到 BASE + cause*4，异常仍到 BASE` },
            { type: "paragraph", text: "TinyOS 用 Direct 模式：在 trap::init() 里一次性把 stvec 写成 __alltraps 的地址。Vectored 模式在多中断源的高性能内核（Linux）里才有优势，教学阶段不值得复杂度。" },
            { type: "code", language: "rust", code:
`pub fn init() {
    extern "C" { fn __alltraps(); }
    unsafe {
        stvec::write(__alltraps as usize, TrapMode::Direct);
    }
}` },
          ],
        },
        {
          title: "sepc：被中断的那条指令",
          blocks: [
            { type: "callout", variant: "warning", text: "sepc 指向触发 trap 的指令本身，不是下一条。对 ecall，我们希望返回后执行「ecall 之后」的指令——所以 trap_handler 必须显式执行 cx.sepc += 4。忘了这一步，用户程序会陷入死循环：返回去又 ecall、又进 trap……" },
            { type: "code", language: "rust", code:
`Trap::Exception(Exception::UserEnvCall) => {
    cx.sepc += 4;                // ★ 必须，不能省
    cx.x[10] = syscall(cx.x[17], [cx.x[10], cx.x[11], cx.x[12]]) as usize;
}` },
            { type: "paragraph", text: "缺页异常不同：我们希望重新执行那条访存指令（修完页表之后它应该成功），所以不 +4。Phase 4 会用到。" },
          ],
        },
        {
          title: "sstatus：S-mode 的心脏",
          blocks: [
            { type: "diagram", content:
`关心的 4 个位：
  SPP  (bit 8)   trap 来自哪个特权级（0=U，1=S）
  SPIE (bit 5)   trap 前 SIE 的值（硬件备份位）
  SIE  (bit 1)   S-mode 中断使能
  SUM  (bit 18)  S-mode 访问 U-mode 内存的许可（Phase 4）

状态机：trap 进入时
  SPP  ← 当前特权级
  SPIE ← SIE
  SIE  ← 0          （自动关中断，防止嵌套）
  特权级 ← S

sret 时
  特权级 ← SPP
  SIE    ← SPIE
  SPP    ← 0
  SPIE   ← 1` },
            { type: "callout", variant: "info", text: "这个自动关中断 + 自动恢复的机制是 RISC-V 处理嵌套中断的优雅之处——内核在 trap_handler 开头天然就是关中断的，想再开只需写 sstatus.SIE=1。Phase 3 做抢占式同步时会频繁用到。" },
          ],
        },
        {
          title: "读写 CSR 的三条指令",
          blocks: [
            { type: "code", language: "asm", code:
`csrr  rd, csr           # rd = csr
csrw  csr, rs           # csr = rs
csrrw rd, csr, rs       # 原子交换：tmp=csr; csr=rs; rd=tmp` },
            { type: "paragraph", text: "csrrw 的原子性是 trap 保存用户 sp 的关键——Lesson 4 会看到 __alltraps 开头用 csrrw sp, sscratch, sp 一条指令换出用户 sp 并换入内核 sp。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-trap-init", title: "Lab 1a ⭐ 实现 trap::init()",
          description: "写一个 pub fn init() 把 stvec 指向 __alltraps（Direct 模式）。这是整个 Phase 1 第一行真正运行起来的代码。",
          labFile: "labs/phase_1_trap/src/trap/mod.rs",
          hints: [
            "用 riscv 这个 crate 的 stvec::write 高层 API，比手写 csrw 可读",
            "MODE=Direct",
            "extern \"C\" { fn __alltraps(); }",
          ],
          pseudocode:
`pub fn init() {
    extern "C" { fn __alltraps(); }
    unsafe {
        stvec::write(__alltraps as usize, TrapMode::Direct);
    }
}`,
        },
      ],
      acceptanceCriteria: [
        "能盲写出 5 个 CSR 的作用",
        "能解释「为什么 ecall 的 cx.sepc 要 +4 但缺页不要」",
        "trap::init() 跑通（gdb 里读 stvec 看到 __alltraps 地址）",
      ],
      references: [
        { title: "RISC-V Privileged Spec §4.1.1", description: "[必读] sstatus 的完整位布局", url: "https://github.com/riscv/riscv-isa-manual/releases" },
        { title: "riscv crate docs", description: "[必读] Rust 侧的 CSR 封装", url: "https://docs.rs/riscv/latest/riscv/" },
        { title: "xv6-riscv kernel/riscv.h", description: "[深入阅读] 对照 C 版的 CSR 宏", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/riscv.h" },
      ],
    },

    // ── Lesson 3 ──────────────────────────────────────────
    {
      phaseId: 1, lessonId: 3,
      title: "TrapContext：为什么是 34 个 u64",
      subtitle: "上下文数据结构的精确设计",
      type: "Concept + Practice",
      duration: "1.5 hours",
      objectives: [
        "掌握 TrapContext 为什么包含 32 个通用寄存器 + sstatus + sepc",
        "理解结构体内存布局（#[repr(C)]）与汇编偏移的对应关系",
        "能解释「为什么保存 x0 也占一个槽位而不是跳过」",
        "会写 TrapContext::app_init_context() 为用户程序构造初始现场",
      ],
      sections: [
        {
          title: "字段清单",
          blocks: [
            { type: "code", language: "rust", code:
`#[repr(C)]
pub struct TrapContext {
    pub x: [usize; 32],   // x0..x31 通用寄存器
    pub sstatus: Sstatus, // S-mode 状态（主要是 SPP，决定 sret 去哪）
    pub sepc: usize,      // 返回用户的 PC
}
// sizeof = 34 * 8 = 272 bytes` },
            { type: "paragraph", text: "34 个 usize 是最小可行集。Phase 1 不保存浮点寄存器（我们的用户程序不用），不保存 satp（单地址空间）。Phase 4 上了虚拟内存后，TrapContext 会长到 37+ 个 usize——但那是后话。" },
          ],
        },
        {
          title: "为什么保留 x0？",
          blocks: [
            { type: "callout", variant: "info", text: "x0 永远是 0，按理可以省。但汇编里我们希望 sd x0, 0*8(sp) 和 sd x1, 1*8(sp) ... 的循环对称——偏移 = 寄存器号 * 8。省掉 x0 会让偏移计算出错概率飙升。一个 u64 换 32 行代码的对称性，非常划算。" },
          ],
        },
        {
          title: "栈上的布局图",
          blocks: [
            { type: "diagram", content:
`内核栈 (kernel_stack[0..8192])                         地址高
                                 ┌───────────────┐  ← stack_top
                                 │  (保留/对齐)    │
                                 ├───────────────┤
                                 │  sepc         │  ← sp+33*8
                                 │  sstatus      │  ← sp+32*8
                                 │  x31 = t6     │  ← sp+31*8
                                 │       ...     │
                                 │  x2  = sp(u)  │  ← sp+2*8   用户栈指针快照
                                 │  x1  = ra     │  ← sp+1*8
                                 │  x0  = 0      │  ← sp+0*8
                                 └───────────────┘  ← sp (进入 trap_handler 时)` },
            { type: "paragraph", text: "关键不变量：trap_handler(cx: &mut TrapContext) 里 cx 就等于当前 sp。这是通过汇编 mv a0, sp 实现的——保存完 34 个字段后栈顶正好指向第一个字段，符合 #[repr(C)] 的布局。" },
          ],
        },
        {
          title: "app_init_context：首次进入 U-mode 的伪造现场",
          blocks: [
            { type: "paragraph", text: "用户程序第一次运行时还没进过 trap——没人给它保存过上下文。我们必须手工构造一个 TrapContext，让 sret 能正确把它「送」进 U-mode。这是 TinyOS 里最 hacky 也最有教育意义的一段代码。" },
            { type: "code", language: "rust", code:
`impl TrapContext {
    pub fn app_init_context(entry: usize, sp: usize) -> Self {
        let mut sstatus = sstatus::read();
        sstatus.set_spp(SPP::User);   // sret 将进入 U-mode
        let mut cx = Self {
            x: [0; 32],
            sstatus,
            sepc: entry,              // sret 的目的地
        };
        cx.set_sp(sp);                // x[2] = sp (用户栈)
        cx
    }
    pub fn set_sp(&mut self, sp: usize) { self.x[2] = sp; }
}` },
            { type: "callout", variant: "tip", text: "注意 sstatus.SPP=User 后，sret 执行时硬件会：特权级←SPP、pc←sepc、SIE←SPIE。于是 CPU 跳进 0x80400000（用户程序入口）且处于 U-mode——第一次 trap 就这样被逆向「伪造」。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-context", title: "Lab 1b ⭐⭐ TrapContext + app_init_context",
          description: "补全 TrapContext 结构体与 app_init_context()。后者会在 Lesson 5 综合实验里被 loader 调用。",
          labFile: "labs/phase_1_trap/src/trap/context.rs",
          hints: [
            "#[repr(C)] 必不可少——汇编硬编码了偏移",
            "sstatus::read() 读当前 S-mode 状态字，再 set_spp(User)",
            "sepc = entry（用户程序入口地址）",
            "x[2] = sp（用户栈顶）",
          ],
          pseudocode:
`#[repr(C)]
pub struct TrapContext {
    pub x: [usize; 32],
    pub sstatus: Sstatus,
    pub sepc: usize,
}
impl TrapContext {
    pub fn set_sp(&mut self, sp: usize) { self.x[2] = sp; }
    pub fn app_init_context(entry: usize, sp: usize) -> Self {
        let mut s = sstatus::read();
        s.set_spp(SPP::User);
        let mut cx = Self { x: [0; 32], sstatus: s, sepc: entry };
        cx.set_sp(sp);
        cx
    }
}`,
        },
      ],
      acceptanceCriteria: [
        "TrapContext size 正好是 272 字节（cargo test 检查）",
        "app_init_context 返回值的 sstatus.SPP == User、sepc == entry、x[2] == sp",
        "能口头解释「为什么不能省 x0」",
      ],
      references: [
        { title: "rCore-Tutorial §2.3", description: "[必读] TrapContext 的逐行讲解", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter2/4trap-handling.html" },
        { title: "Rust Reference: repr(C)", description: "[深入阅读] 为什么内存布局必须确定", url: "https://doc.rust-lang.org/reference/type-layout.html#the-c-representation" },
      ],
    },

    // ── Lesson 4 ──────────────────────────────────────────
    {
      phaseId: 1, lessonId: 4,
      title: "__alltraps / __restore：那 60 行汇编",
      subtitle: "保存、分发、恢复，一行都不能错",
      type: "Practice",
      duration: "2 hours",
      objectives: [
        "能逐行解释 __alltraps 的每一条指令在干什么、为什么这个顺序",
        "理解 csrrw sp, sscratch, sp 的原子用户/内核栈切换",
        "会写 __restore 并知道它的第二个身份——首次进入 U-mode",
        "会用 .altmacro + .rept 简化寄存器保存循环",
      ],
      sections: [
        {
          title: "任务分解",
          blocks: [
            { type: "list", ordered: true, items: [
              "切换到内核栈（csrrw sp, sscratch, sp）",
              "在栈上腾出 34*8 字节",
              "保存 x0..x31（除了 x2 需要从 sscratch 读出来）",
              "保存 sstatus、sepc",
              "mv a0, sp；call trap_handler",
              "trap_handler 返回后，__restore 恢复全部 34 个字段",
              "csrrw sp, sscratch, sp 切回用户栈",
              "sret",
            ]},
          ],
        },
        {
          title: "用户/内核栈切换：csrrw 的妙用",
          blocks: [
            { type: "paragraph", text: "进入 trap 时 sp 还指向用户栈——不能直接 push，会写坏用户内存。我们预先在内核 trap_init 时把内核栈顶存到 sscratch。于是第一条指令是：" },
            { type: "code", language: "asm", code:
`csrrw sp, sscratch, sp    # 原子地：tmp=sscratch; sscratch=sp(用户); sp=tmp(内核)` },
            { type: "paragraph", text: "一条指令就同时做到「把用户 sp 藏进 sscratch、把内核 sp 拿进 sp」。如果用两条指令会有 race——被中断夹击时可能崩。Phase 3 你会更深刻地体会到。" },
          ],
        },
        {
          title: "__alltraps 完整代码",
          blocks: [
            { type: "code", language: "asm", code:
`    .altmacro
    .macro SAVE_GP n
        sd x\\n, \\n*8(sp)
    .endm
    .macro LOAD_GP n
        ld x\\n, \\n*8(sp)
    .endm

    .section .text
    .globl __alltraps
    .align 2
__alltraps:
    csrrw sp, sscratch, sp       # sp → 内核栈；sscratch → 用户栈
    addi sp, sp, -34*8           # 腾出 TrapContext 空间

    sd x1, 1*8(sp)
    # x2 (=用户 sp) 暂时不存，x4 保留
    .set n, 3
    .rept 29
        SAVE_GP %n
        .set n, n+1
    .endr                        # 保存 x3..x31

    csrr t0, sstatus
    csrr t1, sepc
    sd t0, 32*8(sp)
    sd t1, 33*8(sp)

    csrr t2, sscratch            # 读回用户 sp
    sd t2, 2*8(sp)               # 存到 x[2] 槽

    mv a0, sp                    # trap_handler 的参数
    call trap_handler            # 调用 Rust

    # 落下来就是 __restore
    .globl __restore
__restore:
    ld t0, 32*8(sp)
    ld t1, 33*8(sp)
    csrw sstatus, t0
    csrw sepc, t1

    ld t2, 2*8(sp)
    csrw sscratch, t2            # 用户 sp 存回 sscratch

    ld x1, 1*8(sp)
    .set n, 3
    .rept 29
        LOAD_GP %n
        .set n, n+1
    .endr

    addi sp, sp, 34*8            # 释放 TrapContext
    csrrw sp, sscratch, sp       # 切回用户栈
    sret` },
          ],
        },
        {
          title: "__restore 的两个身份",
          blocks: [
            { type: "callout", variant: "warning", text: "__restore 不只是 trap 返回——它还是首次进入 U-mode 的唯一入口。Loader 把手工构造的 TrapContext 推到内核栈顶，然后 jr __restore。__restore 不问上下文怎么来的，只负责忠实地把 34 个字段 pop 进寄存器和 CSR，再 sret。这个「去源化」设计是 Phase 2 任务切换的基础。" },
          ],
        },
        {
          title: "常见错误",
          blocks: [
            { type: "list", ordered: false, items: [
              "保存前没切栈 → 用户 sp 指向哪里就写哪里，经常段错误",
              "x[2] 直接 sd x2, 2*8(sp) → 存进去的是内核 sp，错成一团",
              "忘了 mv a0, sp → trap_handler 收到垃圾指针",
              "__restore 里忘了 csrw sscratch → 下一次 trap 用错栈",
              "sret 之前没切回用户 sp → 在内核栈上跑用户代码",
              "忘了 .align 2 → stvec 低 2 位被当成 MODE，会崩",
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab2", title: "Lab 2 ⭐⭐⭐ 写 trap.S",
          description: "把上面的 __alltraps / __restore 完整实现并通过 make test。这是整个 Phase 1 最有挑战的一关。",
          labFile: "labs/phase_1_trap/src/trap/trap.S",
          hints: [
            "先写 SAVE_GP / LOAD_GP 宏再展开",
            "sscratch 的 init 在 trap::init() 里做——把内核栈顶写进去",
            "调试技巧：在 mv a0, sp 后下断点，用 info reg 检查 34 个字段值",
            "不确定哪里错？gdb 的 x/34gx $a0 一眼看穿 TrapContext",
          ],
          pseudocode:
`__alltraps:
    csrrw sp, sscratch, sp
    addi sp, sp, -34*8
    save x1, x3..x31 into TrapContext
    save sstatus, sepc from CSR
    save user sp from sscratch into x[2]
    mv a0, sp
    call trap_handler
__restore:
    restore sstatus, sepc
    save x[2] back into sscratch
    restore x1, x3..x31
    addi sp, sp, 34*8
    csrrw sp, sscratch, sp
    sret`,
        },
      ],
      acceptanceCriteria: [
        "make test 中 trap.S 的单元测试通过（保存后 34 个字段位置精确）",
        "能用 gdb 单步走完 __alltraps 到 __restore，每一步符合预期",
        "能解释：为什么 x[2] 的保存不能在循环里和其它寄存器一起做",
      ],
      references: [
        { title: "rCore-Tutorial trap.S 解析", description: "[必读] 每条指令的中文逐行注释", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter2/4trap-handling.html#trap" },
        { title: "RISC-V Asm Manual", description: "[深入阅读] .altmacro / .rept 的用法", url: "https://github.com/riscv-non-isa/riscv-asm-manual/blob/master/src/asm-manual.adoc" },
        { title: "xv6 kernel/trampoline.S", description: "[深入阅读] C 内核的等价实现（用 trampoline 页而非 sscratch）", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/trampoline.S" },
      ],
    },

    // ── Lesson 5 ──────────────────────────────────────────
    {
      phaseId: 1, lessonId: 5,
      title: "Syscall 分发与第一个用户程序",
      subtitle: "sys_write / sys_exit / 整合验收",
      type: "Practice + Integration",
      duration: "2 hours",
      objectives: [
        "掌握 RISC-V syscall 调用约定：a7=号、a0-a5=参、a0=返回",
        "实现 trap_handler 的异常分发：ecall → syscall、其它 → 诊断 + kill",
        "实现 sys_write / sys_exit，让用户程序能说话、能退出",
        "把 Lesson 1-4 串起来：载入用户程序并运行到退出",
      ],
      sections: [
        {
          title: "syscall ABI",
          blocks: [
            { type: "table", headers: ["寄存器", "用途"], rows: [
              ["a7 (x17)", "syscall 号"],
              ["a0-a5 (x10-x15)", "参数 1-6"],
              ["a0 (x10)", "返回值（覆盖参数 1）"],
            ]},
            { type: "paragraph", text: "这与 Linux RISC-V 的约定完全一致——未来你的用户程序可以复用 musl 的 syscall 封装。TinyOS Phase 1 只实现 2 个号：" },
            { type: "table", headers: ["号", "名字", "语义"], rows: [
              ["64", "sys_write(fd, buf, len)", "把 buf 的 len 字节打印到 stdout（fd 必须是 1）"],
              ["93", "sys_exit(code)", "退出当前任务，打印 code，调 shutdown（Phase 2 会改）"],
            ]},
          ],
        },
        {
          title: "trap_handler 分发骨架",
          blocks: [
            { type: "code", language: "rust", code:
`#[no_mangle]
pub fn trap_handler(cx: &mut TrapContext) -> &mut TrapContext {
    let scause = scause::read();
    let stval = stval::read();
    match scause.cause() {
        Trap::Exception(Exception::UserEnvCall) => {
            cx.sepc += 4;                      // ★ 跳过 ecall 指令
            cx.x[10] = syscall(
                cx.x[17],                       // sysno
                [cx.x[10], cx.x[11], cx.x[12]], // args
            ) as usize;
        }
        Trap::Exception(Exception::StoreFault)
        | Trap::Exception(Exception::StorePageFault) => {
            println!("[kernel] PageFault @ {:#x}, killing app", stval);
            run_next_app();                    // 见 Lesson 5 loader
        }
        Trap::Exception(Exception::IllegalInstruction) => {
            println!("[kernel] IllegalInstruction, killing app");
            run_next_app();
        }
        _ => panic!("unhandled trap: {:?}, stval={:#x}", scause.cause(), stval),
    }
    cx
}` },
            { type: "callout", variant: "info", text: "返回 &mut TrapContext 是为了让 __restore 不用重新计算 sp——调用约定保证 a0 返回的就是 cx 指针，__restore 拿到后直接当 sp 用。" },
          ],
        },
        {
          title: "sys_write 与 sys_exit",
          blocks: [
            { type: "code", language: "rust", code:
`pub fn sys_write(fd: usize, buf: *const u8, len: usize) -> isize {
    if fd != 1 { return -1; }
    let slice = unsafe { core::slice::from_raw_parts(buf, len) };
    let s = core::str::from_utf8(slice).unwrap_or("<non-utf8>");
    print!("{}", s);
    len as isize
}

pub fn sys_exit(code: i32) -> ! {
    println!("[kernel] app exited with code {}", code);
    run_next_app();
}` },
            { type: "callout", variant: "warning", text: "sys_write 这里直接 from_raw_parts 用了用户指针——在 Phase 1 的单地址空间里 OK，但 Phase 4 有了虚拟内存后必须改成 translate_byte_buffer()。先记住这个 TODO。" },
          ],
        },
        {
          title: "app loader：把 ELF 搬到 0x80400000",
          blocks: [
            { type: "paragraph", text: "loader 的职责：把 link_app.S 里 pack 进内核 .data 段的用户二进制 copy 到约定的运行地址（Phase 1 用 0x80400000 + app_id * 0x20000），然后在内核栈顶构造 TrapContext 并 jr __restore。" },
            { type: "code", language: "rust", code:
`pub fn run_next_app() -> ! {
    let cur = APP_MANAGER.next_app();
    APP_MANAGER.load_app(cur);                  // memcpy 到 0x80400000
    extern "C" { fn __restore(cx_addr: usize); }
    unsafe {
        __restore(KERNEL_STACK.push_context(
            TrapContext::app_init_context(APP_BASE + cur * APP_SIZE, USER_STACK.top())
        ) as *const _ as usize);
    }
    unreachable!();
}` },
          ],
        },
      ],
      exercises: [
        {
          id: "lab3", title: "Lab 3 ⭐⭐ syscall 分发 + sys_write + sys_exit",
          description: "把 trap_handler、syscall 分发表、sys_write、sys_exit 补完整。make qemu 应看到内置用户程序打印 hello 并退出。",
          labFile: "labs/phase_1_trap/src/syscall/mod.rs",
          hints: [
            "syscall(sysno, args) 是个大 match——先只处理 64/93，其它 panic",
            "sepc += 4 不能忘，否则死循环",
            "sys_exit 不返回：类型是 ! 或 -> isize { unreachable!() }",
            "fd==1 才允许写；其它返回 -1",
          ],
          pseudocode:
`pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    match id {
        64 => sys_write(args[0], args[1] as *const u8, args[2]),
        93 => sys_exit(args[0] as i32),
        _ => panic!("unknown syscall {}", id),
    }
}`,
        },
        {
          id: "integration", title: "综合验收：跑三个用户程序",
          description: "在 labs/phase_1_trap/user/src/bin/ 已有 3 个示例用户程序（hello_world / bad_address / power）。make qemu 应依次执行它们，各自输出并退出。",
          hints: [
            "hello_world：sys_write + sys_exit 的最小演示",
            "bad_address：故意访问非法地址，触发 PageFault 被 kill",
            "power：循环计算 pow(3,10) 并打印",
          ],
        },
      ],
      acceptanceCriteria: [
        "make qemu 按顺序运行 3 个用户程序，输出与 README 对齐",
        "bad_address 触发 StoreFault 被 kill，内核继续运行下一个",
        "scripts/grade.py 报满分",
        "所有 syscall 分发都在 syscall/mod.rs 单一入口表里",
      ],
      references: [
        { title: "xv6-riscv Ch. 4.3 Code: Calling system calls", description: "[必读] syscall 分发的 C 等价物", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §2.4 & §2.5", description: "[必读] 批处理 + ecall 完整链路", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter2/5exercise.html" },
        { title: "Linux RISC-V syscall ABI", description: "[深入阅读] 我们的号码沿用这里——兼容未来扩展", url: "https://man7.org/linux/man-pages/man2/syscalls.2.html" },
        { title: "扩展思考", description: "[扩展] 如果想支持 fd=2 (stderr)，需要改哪几处？如果一个用户程序疯狂 ecall 不做事，内核能限速吗？", url: "" },
      ],
    },
  ],
};

// ─── Phase 1: Traps & Syscalls (en) ───────────────────

export const phase1En: PhaseContent = {
  phaseId: 1,
  color: "#D97706",
  accent: "#F59E0B",
  lessons: [
    // ── Lesson 1 ──────────────────────────────────────────
    {
      phaseId: 1, lessonId: 1,
      title: "Phase 1 Overview: Why we need traps",
      subtitle: "The hardware boundary between U-mode and S-mode",
      type: "Concept",
      duration: "1 hour",
      objectives: [
        "Understand what trap / exception / interrupt / syscall mean and how they relate",
        "Follow the full hardware sequence from a U-mode ecall to S-mode handling and return",
        "Know how the 5 lessons of this phase depend on each other",
        "See why trap entry must be assembly, not Rust",
      ],
      sections: [
        {
          title: "From one privilege level to two",
          blocks: [
            { type: "paragraph", text: "In Phase 0 everything ran in S-mode: code, stack, data — all kernel. The job of Phase 1 is to launch user programs in U-mode. The moment you succeed, you own two mutually-distrustful worlds plus one controlled channel between them. That channel is the trap." },
            { type: "diagram", content:
`U-mode (user)                           S-mode (kernel)
─────────────                          ────────────
  li a7, 64
  li a0, 1
  la a1, msg                 Hardware automatically:
  li a2, 12       ───ecall──▶  1) sepc    ← pc
                                2) scause  ← 8 (ecall from U)
                                3) sstatus.SPP ← 0
                                4) sstatus.SIE ← SPIE
                                5) pc      ← stvec
                                6) priv    ← S
                                          ↓
                              __alltraps:
                                save 32 x regs + sstatus + sepc
                                call rust trap_handler(cx)
                                restore everything
                                sret ──────┐
                                           │
  next instruction      ◀──────────────────┘` },
            { type: "callout", variant: "info", text: "A trap is hardware forcing the CPU to drop what it's doing and run code the kernel pre-designated. It's the only legal route from U to S mode — without it the kernel has zero control over user code." },
          ],
        },
        {
          title: "Three flavors of trap",
          blocks: [
            { type: "table", headers: ["Kind", "Triggered by", "scause MSB", "Examples"], rows: [
              ["Exception", "Current instruction faults or ecalls", "0", "Illegal insn (2), page fault (13/15), ecall (8)"],
              ["Interrupt", "External async event", "1", "Timer (5), external device (9), software (1)"],
              ["Syscall", "Subset of Exception — code=8", "0", "User ecall asking kernel for a service"],
            ]},
            { type: "paragraph", text: "scause's MSB distinguishes interrupts from exceptions; the low bits encode the cause. Phase 1 only handles ecall (=8); timer comes in Phase 2. But the skeleton dispatcher is written for all cases from day one — later phases just add match arms." },
          ],
        },
        {
          title: "The 5 lessons of this Phase",
          blocks: [
            { type: "list", ordered: true, items: [
              "Lesson 1 (this page): Overview — why traps, when traps.",
              "Lesson 2: CSR hardware model — precise semantics of stvec/sepc/scause/stval/sstatus.",
              "Lesson 3: TrapContext — why 34 u64s, how they sit on the stack.",
              "Lesson 4: __alltraps / __restore — assembly, every line justified.",
              "Lesson 5: Syscall ABI + running your first U-mode program.",
            ]},
            { type: "callout", variant: "tip", text: "After Lesson 5 you'll own a minimal kernel that can run any user program. One process only — but every process/scheduler of Phase 2 is built on this trap path." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab0-read", title: "Reading task: draw the ecall timeline",
          description: "Without the docs, draw the first 10 hardware steps from U-mode ecall to S-mode trap_handler. Next lesson we'll match it against the spec.",
          hints: [
            "Track CSR state changes, not just pc",
            "What are sstatus.SPP and SPIE before and after?",
            "Why does sepc point at the ecall itself, not the next instruction?",
          ],
        },
      ],
      acceptanceCriteria: [
        "You can explain exception / interrupt / syscall in your own words",
        "You know Phase 1's deliverable (run U-mode apps + sys_write + sys_exit)",
        "You see why the trap entry point must be assembly",
      ],
      references: [
        { title: "xv6-riscv book Ch. 4", description: "[Required] Traps and system calls — the golden reference", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §2", description: "[Required] Batch system & privilege switching in Rust", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter2/index.html" },
        { title: "RISC-V Privileged Spec Ch. 4", description: "[Deep dive] Supervisor-Level ISA — CSR bible", url: "https://github.com/riscv/riscv-isa-manual/releases" },
      ],
    },

    // ── Lesson 2 ──────────────────────────────────────────
    {
      phaseId: 1, lessonId: 2,
      title: "CSR hardware model: 5 registers hold up every trap",
      subtitle: "stvec / sepc / scause / stval / sstatus",
      type: "Concept",
      duration: "1.5 hours",
      objectives: [
        "Memorize the semantics and write-times of all 5 trap CSRs",
        "Read the SPP / SIE / SPIE bit layout and state machine in sstatus",
        "Understand why sepc points at the faulting insn and why ecall needs sepc += 4",
        "Write csrr / csrw / csrrw fluently",
      ],
      sections: [
        {
          title: "Five core CSRs",
          blocks: [
            { type: "table", headers: ["CSR", "Written by", "Read by", "Role"], rows: [
              ["stvec", "Kernel once at boot", "Hardware on trap", "Trap entry address + MODE"],
              ["sepc", "Hardware on trap", "Kernel at sret", "PC of the trapped instruction"],
              ["scause", "Hardware on trap", "trap_handler", "Encoded cause"],
              ["stval", "Hardware on trap", "trap_handler", "Aux info (faulting addr, bad opcode)"],
              ["sstatus", "Kernel + hardware", "Kernel", "S-mode status word — SPP/SIE/SPIE"],
            ]},
          ],
        },
        {
          title: "stvec: the signpost",
          blocks: [
            { type: "diagram", content:
` 63                                           2  1  0
┌──────────────────────────────────────────────┬────┐
│              BASE (entry address >> 2)        │MODE│
└──────────────────────────────────────────────┴────┘
MODE = 0  Direct   — every trap jumps to BASE
MODE = 1  Vectored — interrupts go to BASE + cause*4, exceptions to BASE` },
            { type: "paragraph", text: "TinyOS uses Direct mode: trap::init() writes stvec once to the address of __alltraps. Vectored only pays off in high-performance kernels with many interrupt sources (Linux). Not worth the complexity here." },
            { type: "code", language: "rust", code:
`pub fn init() {
    extern "C" { fn __alltraps(); }
    unsafe {
        stvec::write(__alltraps as usize, TrapMode::Direct);
    }
}` },
          ],
        },
        {
          title: "sepc: the interrupted instruction",
          blocks: [
            { type: "callout", variant: "warning", text: "sepc holds the PC of the instruction that caused the trap, not the next one. For ecall we want to resume after it — so trap_handler must explicitly do cx.sepc += 4. Skip this and the app loops forever: return, re-ecall, trap again, repeat." },
            { type: "code", language: "rust", code:
`Trap::Exception(Exception::UserEnvCall) => {
    cx.sepc += 4;                // required, not optional
    cx.x[10] = syscall(cx.x[17], [cx.x[10], cx.x[11], cx.x[12]]) as usize;
}` },
            { type: "paragraph", text: "Page faults are different: we want to retry the faulting load/store after fixing the page table — so we don't increment. Phase 4 will need this." },
          ],
        },
        {
          title: "sstatus: the heart of S-mode",
          blocks: [
            { type: "diagram", content:
`The 4 bits we care about:
  SPP  (bit 8)   Which privilege the trap came from (0=U, 1=S)
  SPIE (bit 5)   SIE's value before the trap (hardware backup)
  SIE  (bit 1)   S-mode interrupt enable
  SUM  (bit 18)  Allow S-mode to read U-mode memory (Phase 4)

On trap entry:
  SPP  ← current privilege
  SPIE ← SIE
  SIE  ← 0          (auto-disable interrupts to prevent nesting)
  priv ← S

On sret:
  priv ← SPP
  SIE  ← SPIE
  SPP  ← 0
  SPIE ← 1` },
            { type: "callout", variant: "info", text: "The auto-disable + auto-restore of interrupts is one of RISC-V's cleanest pieces of design — trap_handler starts with interrupts disabled naturally, and you only re-enable when you want to. Phase 3's synchronization relies on this constantly." },
          ],
        },
        {
          title: "The three CSR instructions",
          blocks: [
            { type: "code", language: "asm", code:
`csrr  rd, csr           # rd = csr
csrw  csr, rs           # csr = rs
csrrw rd, csr, rs       # atomic swap: tmp=csr; csr=rs; rd=tmp` },
            { type: "paragraph", text: "csrrw's atomicity is the key to stack-switching in Lesson 4: one instruction — csrrw sp, sscratch, sp — swaps user sp out and kernel sp in." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-trap-init", title: "Lab 1a ⭐ implement trap::init()",
          description: "Write pub fn init() that points stvec at __alltraps (Direct mode). The first live line of Phase 1.",
          labFile: "labs/phase_1_trap/src/trap/mod.rs",
          hints: [
            "Use the riscv crate's high-level stvec::write — far more readable than csrw",
            "MODE = Direct",
            "extern \"C\" { fn __alltraps(); }",
          ],
          pseudocode:
`pub fn init() {
    extern "C" { fn __alltraps(); }
    unsafe {
        stvec::write(__alltraps as usize, TrapMode::Direct);
    }
}`,
        },
      ],
      acceptanceCriteria: [
        "You can name the role of each of the 5 CSRs from memory",
        "You can explain why ecall does cx.sepc += 4 but page faults don't",
        "trap::init() works — gdb shows stvec pointing to __alltraps",
      ],
      references: [
        { title: "RISC-V Privileged Spec §4.1.1", description: "[Required] The full sstatus bit layout", url: "https://github.com/riscv/riscv-isa-manual/releases" },
        { title: "riscv crate docs", description: "[Required] Rust-side CSR wrappers", url: "https://docs.rs/riscv/latest/riscv/" },
        { title: "xv6-riscv kernel/riscv.h", description: "[Deep dive] CSR macros in the C version", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/riscv.h" },
      ],
    },

    // ── Lesson 3 ──────────────────────────────────────────
    {
      phaseId: 1, lessonId: 3,
      title: "TrapContext: why 34 u64s",
      subtitle: "The precise design of the context struct",
      type: "Concept + Practice",
      duration: "1.5 hours",
      objectives: [
        "Know why TrapContext holds 32 GPRs + sstatus + sepc",
        "Match the Rust struct layout (#[repr(C)]) to the asm offsets",
        "Explain why we keep a slot for x0 instead of skipping it",
        "Write TrapContext::app_init_context() to forge the first user context",
      ],
      sections: [
        {
          title: "The fields",
          blocks: [
            { type: "code", language: "rust", code:
`#[repr(C)]
pub struct TrapContext {
    pub x: [usize; 32],   // x0..x31 general registers
    pub sstatus: Sstatus, // S-mode status (mainly SPP — where sret goes)
    pub sepc: usize,      // PC to resume at
}
// sizeof = 34 * 8 = 272 bytes` },
            { type: "paragraph", text: "34 usize is the minimum viable set. Phase 1 doesn't save FP regs (no user FP yet) or satp (single address space). Phase 4, with VM, will push it to 37+ — but that's for later." },
          ],
        },
        {
          title: "Why keep x0?",
          blocks: [
            { type: "callout", variant: "info", text: "x0 is hard-wired to 0, so you could omit it. But the asm wants a clean loop: sd x0, 0*8(sp); sd x1, 1*8(sp); ... where offset = reg_num * 8. Dropping x0 breaks the symmetry and invites off-by-ones. A free u64 buys 32 lines of boring regularity. Trade made." },
          ],
        },
        {
          title: "Stack layout diagram",
          blocks: [
            { type: "diagram", content:
`kernel stack (kernel_stack[0..8192])                  high addr
                                 ┌───────────────┐  ← stack_top
                                 │  (reserve/pad) │
                                 ├───────────────┤
                                 │  sepc          │  ← sp+33*8
                                 │  sstatus       │  ← sp+32*8
                                 │  x31 = t6      │  ← sp+31*8
                                 │       ...      │
                                 │  x2  = sp(u)   │  ← sp+2*8  user sp snapshot
                                 │  x1  = ra      │  ← sp+1*8
                                 │  x0  = 0       │  ← sp+0*8
                                 └───────────────┘  ← sp on enter` },
            { type: "paragraph", text: "Key invariant: inside trap_handler(cx: &mut TrapContext), cx equals the current sp. This is achieved by mv a0, sp after saving — because with #[repr(C)] the first field's offset is 0, the struct header sits right at sp." },
          ],
        },
        {
          title: "app_init_context: forging the first context",
          blocks: [
            { type: "paragraph", text: "A user program booting up has never been in a trap — no one ever saved its context. We have to manually forge a TrapContext so that sret 'delivers' it into U-mode. This is the hackiest and most instructive snippet in TinyOS." },
            { type: "code", language: "rust", code:
`impl TrapContext {
    pub fn app_init_context(entry: usize, sp: usize) -> Self {
        let mut sstatus = sstatus::read();
        sstatus.set_spp(SPP::User);   // sret lands in U-mode
        let mut cx = Self {
            x: [0; 32],
            sstatus,
            sepc: entry,              // sret's destination
        };
        cx.set_sp(sp);                // x[2] = sp (user stack)
        cx
    }
    pub fn set_sp(&mut self, sp: usize) { self.x[2] = sp; }
}` },
            { type: "callout", variant: "tip", text: "With SPP=User, sret does: priv←SPP, pc←sepc, SIE←SPIE. The CPU jumps to 0x80400000 in U-mode. We've 'reverse-forged' the first trap." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-context", title: "Lab 1b ⭐⭐ TrapContext + app_init_context",
          description: "Fill in TrapContext and app_init_context(). The loader in Lesson 5 will call it.",
          labFile: "labs/phase_1_trap/src/trap/context.rs",
          hints: [
            "#[repr(C)] is mandatory — the asm hardcodes offsets",
            "sstatus::read() then set_spp(User)",
            "sepc = entry (user program entry)",
            "x[2] = sp (user stack top)",
          ],
          pseudocode:
`#[repr(C)]
pub struct TrapContext {
    pub x: [usize; 32],
    pub sstatus: Sstatus,
    pub sepc: usize,
}
impl TrapContext {
    pub fn set_sp(&mut self, sp: usize) { self.x[2] = sp; }
    pub fn app_init_context(entry: usize, sp: usize) -> Self {
        let mut s = sstatus::read();
        s.set_spp(SPP::User);
        let mut cx = Self { x: [0; 32], sstatus: s, sepc: entry };
        cx.set_sp(sp);
        cx
    }
}`,
        },
      ],
      acceptanceCriteria: [
        "sizeof(TrapContext) == 272 (cargo test checks it)",
        "app_init_context result has sstatus.SPP == User, sepc == entry, x[2] == sp",
        "You can explain out loud why we keep x0",
      ],
      references: [
        { title: "rCore-Tutorial §2.3", description: "[Required] Line-by-line TrapContext walkthrough", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter2/4trap-handling.html" },
        { title: "Rust Reference: repr(C)", description: "[Deep dive] Why layout must be fixed", url: "https://doc.rust-lang.org/reference/type-layout.html#the-c-representation" },
      ],
    },

    // ── Lesson 4 ──────────────────────────────────────────
    {
      phaseId: 1, lessonId: 4,
      title: "__alltraps / __restore: those 60 lines of asm",
      subtitle: "Save, dispatch, restore — no line can be wrong",
      type: "Practice",
      duration: "2 hours",
      objectives: [
        "Explain every line of __alltraps and why the order matters",
        "Understand csrrw sp, sscratch, sp as an atomic user/kernel stack swap",
        "Write __restore and know its second role — entering U-mode for the first time",
        "Use .altmacro + .rept to collapse the save/restore loops",
      ],
      sections: [
        {
          title: "Task breakdown",
          blocks: [
            { type: "list", ordered: true, items: [
              "Switch to kernel stack (csrrw sp, sscratch, sp)",
              "Reserve 34*8 bytes on it",
              "Save x0..x31 (x2 comes from sscratch, not the current sp)",
              "Save sstatus, sepc",
              "mv a0, sp; call trap_handler",
              "After return, __restore pops all 34 fields",
              "csrrw sp, sscratch, sp to swap back to user stack",
              "sret",
            ]},
          ],
        },
        {
          title: "Stack swap: csrrw's magic",
          blocks: [
            { type: "paragraph", text: "On trap entry, sp still points at the user stack — we can't push directly, that'd trash user memory. We pre-stashed the kernel stack top into sscratch at trap_init. So the first instruction is:" },
            { type: "code", language: "asm", code:
`csrrw sp, sscratch, sp    # atomic: tmp=sscratch; sscratch=sp(user); sp=tmp(kernel)` },
            { type: "paragraph", text: "One instruction simultaneously hides user sp in sscratch and brings in kernel sp. Splitting into two would open a nested-interrupt window. Phase 3 will make this painfully clear." },
          ],
        },
        {
          title: "Full __alltraps code",
          blocks: [
            { type: "code", language: "asm", code:
`    .altmacro
    .macro SAVE_GP n
        sd x\\n, \\n*8(sp)
    .endm
    .macro LOAD_GP n
        ld x\\n, \\n*8(sp)
    .endm

    .section .text
    .globl __alltraps
    .align 2
__alltraps:
    csrrw sp, sscratch, sp       # sp → kernel; sscratch → user sp
    addi sp, sp, -34*8           # reserve TrapContext

    sd x1, 1*8(sp)
    # x2 (=user sp) later, x4 reserved
    .set n, 3
    .rept 29
        SAVE_GP %n
        .set n, n+1
    .endr                        # save x3..x31

    csrr t0, sstatus
    csrr t1, sepc
    sd t0, 32*8(sp)
    sd t1, 33*8(sp)

    csrr t2, sscratch            # read user sp back
    sd t2, 2*8(sp)               # store into x[2] slot

    mv a0, sp                    # arg for trap_handler
    call trap_handler            # Rust

    # falls into __restore
    .globl __restore
__restore:
    ld t0, 32*8(sp)
    ld t1, 33*8(sp)
    csrw sstatus, t0
    csrw sepc, t1

    ld t2, 2*8(sp)
    csrw sscratch, t2            # user sp → sscratch

    ld x1, 1*8(sp)
    .set n, 3
    .rept 29
        LOAD_GP %n
        .set n, n+1
    .endr

    addi sp, sp, 34*8            # free TrapContext
    csrrw sp, sscratch, sp       # swap back to user stack
    sret` },
          ],
        },
        {
          title: "__restore's double life",
          blocks: [
            { type: "callout", variant: "warning", text: "__restore is not only trap return — it's also the only path into U-mode for the first time. The loader pushes a forged TrapContext onto the kernel stack and does jr __restore. __restore doesn't ask where the context came from; it just faithfully pops the 34 fields and sret. That source-agnosticism is the foundation Phase 2's task switching is built on." },
          ],
        },
        {
          title: "Common mistakes",
          blocks: [
            { type: "list", ordered: false, items: [
              "No stack swap before saving → writes wherever user sp pointed, usually segfault",
              "sd x2 directly → you stored kernel sp, not user sp, into the x[2] slot",
              "Forgot mv a0, sp → trap_handler receives a garbage pointer",
              "__restore forgot csrw sscratch → next trap uses the wrong stack",
              "Didn't swap back before sret → user code starts executing on the kernel stack",
              "Forgot .align 2 → stvec's low 2 bits become MODE, machine crashes",
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab2", title: "Lab 2 ⭐⭐⭐ write trap.S",
          description: "Implement __alltraps / __restore fully and pass make test. The hardest gate in Phase 1.",
          labFile: "labs/phase_1_trap/src/trap/trap.S",
          hints: [
            "Write SAVE_GP / LOAD_GP macros first, then unroll",
            "sscratch init lives in trap::init() — store kernel stack top into it",
            "Debug: breakpoint after mv a0, sp, then info reg to verify the 34 fields",
            "x/34gx $a0 in gdb shows the full TrapContext at once",
          ],
          pseudocode:
`__alltraps:
    csrrw sp, sscratch, sp
    addi sp, sp, -34*8
    save x1, x3..x31 into TrapContext
    save sstatus, sepc from CSR
    save user sp (from sscratch) into x[2]
    mv a0, sp
    call trap_handler
__restore:
    restore sstatus, sepc
    save x[2] back into sscratch
    restore x1, x3..x31
    addi sp, sp, 34*8
    csrrw sp, sscratch, sp
    sret`,
        },
      ],
      acceptanceCriteria: [
        "make test's trap.S unit tests pass (field placements correct)",
        "You can single-step through __alltraps → __restore in gdb and match every move",
        "You can explain: why x[2] must be saved separately, not inside the loop",
      ],
      references: [
        { title: "rCore-Tutorial trap.S walkthrough", description: "[Required] Line-by-line annotation", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter2/4trap-handling.html#trap" },
        { title: "RISC-V Asm Manual", description: "[Deep dive] .altmacro / .rept syntax", url: "https://github.com/riscv-non-isa/riscv-asm-manual/blob/master/src/asm-manual.adoc" },
        { title: "xv6 kernel/trampoline.S", description: "[Deep dive] Equivalent in the C kernel (trampoline-page variant)", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/trampoline.S" },
      ],
    },

    // ── Lesson 5 ──────────────────────────────────────────
    {
      phaseId: 1, lessonId: 5,
      title: "Syscall dispatch + your first user program",
      subtitle: "sys_write / sys_exit / end-to-end integration",
      type: "Practice + Integration",
      duration: "2 hours",
      objectives: [
        "Master the RISC-V syscall ABI: a7=number, a0-a5=args, a0=return",
        "Implement trap_handler dispatch: ecall → syscall, others → diagnose + kill",
        "Implement sys_write / sys_exit so user programs can speak and exit",
        "Wire Lessons 1-4 together: load a user program and run it to exit",
      ],
      sections: [
        {
          title: "Syscall ABI",
          blocks: [
            { type: "table", headers: ["Register", "Purpose"], rows: [
              ["a7 (x17)", "syscall number"],
              ["a0-a5 (x10-x15)", "arguments 1-6"],
              ["a0 (x10)", "return value (overwrites arg 1)"],
            ]},
            { type: "paragraph", text: "This matches Linux RISC-V exactly — in the future you could reuse musl's syscall wrappers. Phase 1 implements two numbers:" },
            { type: "table", headers: ["No.", "Name", "Semantics"], rows: [
              ["64", "sys_write(fd, buf, len)", "Write len bytes of buf to stdout (fd must be 1)"],
              ["93", "sys_exit(code)", "Exit current task, print code, call shutdown (Phase 2 changes this)"],
            ]},
          ],
        },
        {
          title: "trap_handler dispatch skeleton",
          blocks: [
            { type: "code", language: "rust", code:
`#[no_mangle]
pub fn trap_handler(cx: &mut TrapContext) -> &mut TrapContext {
    let scause = scause::read();
    let stval = stval::read();
    match scause.cause() {
        Trap::Exception(Exception::UserEnvCall) => {
            cx.sepc += 4;                      // skip the ecall
            cx.x[10] = syscall(
                cx.x[17],                       // sysno
                [cx.x[10], cx.x[11], cx.x[12]], // args
            ) as usize;
        }
        Trap::Exception(Exception::StoreFault)
        | Trap::Exception(Exception::StorePageFault) => {
            println!("[kernel] PageFault @ {:#x}, killing app", stval);
            run_next_app();                    // see loader in this lesson
        }
        Trap::Exception(Exception::IllegalInstruction) => {
            println!("[kernel] IllegalInstruction, killing app");
            run_next_app();
        }
        _ => panic!("unhandled trap: {:?}, stval={:#x}", scause.cause(), stval),
    }
    cx
}` },
            { type: "callout", variant: "info", text: "Returning &mut TrapContext saves __restore from recomputing sp — by the RISC-V C ABI, a0 == cx pointer == sp. __restore takes a0 and treats it as sp." },
          ],
        },
        {
          title: "sys_write & sys_exit",
          blocks: [
            { type: "code", language: "rust", code:
`pub fn sys_write(fd: usize, buf: *const u8, len: usize) -> isize {
    if fd != 1 { return -1; }
    let slice = unsafe { core::slice::from_raw_parts(buf, len) };
    let s = core::str::from_utf8(slice).unwrap_or("<non-utf8>");
    print!("{}", s);
    len as isize
}

pub fn sys_exit(code: i32) -> ! {
    println!("[kernel] app exited with code {}", code);
    run_next_app();
}` },
            { type: "callout", variant: "warning", text: "sys_write here uses the user pointer directly — OK in Phase 1's single address space, but once Phase 4 introduces VM it must switch to translate_byte_buffer(). Note this TODO now." },
          ],
        },
        {
          title: "App loader: copy ELF to 0x80400000",
          blocks: [
            { type: "paragraph", text: "The loader's job: copy user binaries — packed into the kernel's .data by link_app.S — to their run address (Phase 1 uses 0x80400000 + app_id * 0x20000). Then it builds a TrapContext on the kernel stack top and does jr __restore." },
            { type: "code", language: "rust", code:
`pub fn run_next_app() -> ! {
    let cur = APP_MANAGER.next_app();
    APP_MANAGER.load_app(cur);                  // memcpy to 0x80400000
    extern "C" { fn __restore(cx_addr: usize); }
    unsafe {
        __restore(KERNEL_STACK.push_context(
            TrapContext::app_init_context(APP_BASE + cur * APP_SIZE, USER_STACK.top())
        ) as *const _ as usize);
    }
    unreachable!();
}` },
          ],
        },
      ],
      exercises: [
        {
          id: "lab3", title: "Lab 3 ⭐⭐ syscall dispatch + sys_write + sys_exit",
          description: "Fill in trap_handler, the syscall dispatch table, sys_write, sys_exit. make qemu should print hello from the built-in user app and exit.",
          labFile: "labs/phase_1_trap/src/syscall/mod.rs",
          hints: [
            "syscall(sysno, args) is one big match — handle 64/93, panic on unknown",
            "Don't forget sepc += 4 — otherwise infinite loop",
            "sys_exit doesn't return: fn ... -> ! { unreachable!() }",
            "Only fd==1 is writable; else return -1",
          ],
          pseudocode:
`pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    match id {
        64 => sys_write(args[0], args[1] as *const u8, args[2]),
        93 => sys_exit(args[0] as i32),
        _ => panic!("unknown syscall {}", id),
    }
}`,
        },
        {
          id: "integration", title: "End-to-end: run three user programs",
          description: "labs/phase_1_trap/user/src/bin/ contains 3 sample programs (hello_world / bad_address / power). make qemu should run all three in order, each producing its expected output and exiting.",
          hints: [
            "hello_world: minimal sys_write + sys_exit demo",
            "bad_address: intentionally writes an illegal address — triggers PageFault, gets killed",
            "power: loops computing pow(3,10) and prints the result",
          ],
        },
      ],
      acceptanceCriteria: [
        "make qemu runs all 3 user programs in order, outputs match the README",
        "bad_address triggers StoreFault, gets killed, kernel proceeds to the next app",
        "scripts/grade.py reports full score",
        "All syscall dispatch goes through a single table in syscall/mod.rs",
      ],
      references: [
        { title: "xv6-riscv Ch. 4.3 Code: Calling system calls", description: "[Required] C equivalent of syscall dispatch", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §2.4 & §2.5", description: "[Required] Full ecall path of the batch system", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter2/5exercise.html" },
        { title: "Linux RISC-V syscall ABI", description: "[Deep dive] Our numbering follows this — future-compatible", url: "https://man7.org/linux/man-pages/man2/syscalls.2.html" },
        { title: "Stretch question", description: "[Stretch] What changes are needed to support fd=2 (stderr)? If a user program spams ecalls, can the kernel rate-limit it?", url: "" },
      ],
    },
  ],
};
