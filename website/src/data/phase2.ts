import type { PhaseContent } from "./types";

// ─── Phase 2: Process & Scheduling (zh-CN) ──────────────────

export const phase2ZhCN: PhaseContent = {
  phaseId: 2,
  color: "#059669",
  accent: "#34D399",
  lessons: [
    // ── Lesson 1 ──────────────────────────────────────────
    {
      phaseId: 2, lessonId: 1,
      title: "进程抽象与 TCB",
      subtitle: "什么是「一个任务」——TCB + 内核栈 + 用户栈",
      type: "Concept",
      duration: "1.5 hours",
      objectives: [
        "理解「进程」在内核里到底是哪几块内存",
        "掌握 TaskControlBlock (TCB) 的字段与状态机",
        "看懂每个任务为什么需要一条独立的内核栈",
        "能画出 UnInit → Ready → Running → Exited 的状态迁移",
      ],
      sections: [
        {
          title: "从单任务到多任务",
          blocks: [
            { type: "paragraph", text: "Phase 1 里整个内核只有一条执行流：_start → ecall → trap_handler → sret → 用户代码 → exit。所有寄存器、一条内核栈就够了。Phase 2 要同时跑 N 个用户程序，意味着必须能「暂停 A、切去 B」——而这之前，我们得先回答：内核里一个任务到底是什么？" },
            { type: "callout", variant: "info", text: "一个任务 = 一个 TaskControlBlock (TCB) + 一条内核栈 + 一条用户栈。进程不是飘在以太里的抽象对象——它就是这三块内存的总和。Phase 3-5 会给它加上地址空间、文件表、父指针，但骨架就这三样。" },
          ],
        },
        {
          title: "TCB 的字段",
          blocks: [
            { type: "code", language: "rust", code:
`#[derive(Copy, Clone)]
pub struct TaskControlBlock {
    pub task_status: TaskStatus,   // UnInit / Ready / Running / Exited
    pub task_cx: TaskContext,      // 14 字的寄存器快照（下节课讲）
}

#[derive(Copy, Clone, PartialEq)]
pub enum TaskStatus { UnInit, Ready, Running, Exited }` },
            { type: "paragraph", text: "TCB 是一个纯 Rust 结构体，躺在内核 .data 段的一个固定大小数组里。Phase 2 不做动态分配——MAX_APP_NUM 在编译期定死，loader 扫描链接进来的用户 ELF 个数并填好对应槽位。" },
            { type: "callout", variant: "tip", text: "Phase 5 里 TCB 会搬到堆上并用 Arc<Mutex<TCB>> 包裹（fork/exec 需要动态创建）。现在先用静态数组——变量少一个，思路清晰一个。" },
          ],
        },
        {
          title: "三块内存的空间布局",
          blocks: [
            { type: "diagram", content:
`kernel .bss / .data                                          高地址
┌─────────────────────────────────────────────────────────┐
│ KERNEL_STACK[MAX_APP_NUM]   每个任务 8 KiB 内核栈         │
│   ┌─ KernelStack[0] ─┐                                   │
│   │    8192 bytes    │  ← 任务 0 ecall 进来时 sp 指向这   │
│   └──────────────────┘                                   │
│   ┌─ KernelStack[1] ─┐                                   │
│   │    8192 bytes    │                                   │
│   └──────────────────┘                                   │
│        ......                                            │
├─────────────────────────────────────────────────────────┤
│ USER_STACK[MAX_APP_NUM]     每个任务 8 KiB 用户栈          │
├─────────────────────────────────────────────────────────┤
│ TASK_MANAGER {                                           │
│   num_app: usize,                                        │
│   inner: UPSafeCell<TaskManagerInner> {                  │
│     tasks: [TCB; MAX_APP_NUM],                           │
│     current_task: usize,                                 │
│   }                                                      │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
用户程序 .text/.data 被 loader 从 app_N_start 拷到 APP_BASE + N * APP_SIZE_LIMIT` },
            { type: "paragraph", text: "为什么每个任务要一条独立的内核栈？想象任务 A 陷入 trap_handler 执行到一半时，时钟中断触发切换到任务 B；B 也会走 trap_handler。如果共用一条内核栈，B 的栈帧会覆盖 A 的，A 醒来时栈顶已被改写，必崩。一人一条才干净。" },
          ],
        },
        {
          title: "状态机",
          blocks: [
            { type: "diagram", content:
`            loader::init_app_cx()
   UnInit ───────────────────────► Ready ◀─────────┐
                                     │              │ suspend
                                     ▼              │
                                  Running ──────────┘
                                     │
                                     │ exit (sys_exit)
                                     ▼
                                   Exited` },
            { type: "table", headers: ["状态", "含义", "下一步的触发者"], rows: [
              ["UnInit", "槽位未使用，或 loader 还没为其构造 TrapContext", "loader"],
              ["Ready", "可运行，等待 CPU", "scheduler"],
              ["Running", "正在某个 hart 上执行", "时钟中断 / sys_yield / sys_exit"],
              ["Exited", "已退出，内核栈不再会被切回", "无（Phase 5 会由父进程 wait 回收）"],
            ]},
            { type: "callout", variant: "info", text: "Phase 3 会加 Sleeping（阻塞在锁上），Phase 5 会加 Zombie（已退出但父进程未 wait）。现在只要四个状态——多一个都是提前复杂度。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-tcb", title: "Lab 1a ⭐ TCB 与状态枚举",
          description: "在 task/task.rs 中补全 TaskStatus 与 TaskControlBlock。所有字段都是 Copy——TCB 数组按值存放，方便被 UPSafeCell 管理。",
          labFile: "labs/phase_2_proc/src/task/task.rs",
          hints: [
            "TaskStatus 要 derive Copy, Clone, PartialEq, Debug",
            "TaskControlBlock 要 derive Copy, Clone",
            "task_cx 字段类型是 TaskContext（下节课定义）",
          ],
          pseudocode:
`#[derive(Copy, Clone, PartialEq, Debug)]
pub enum TaskStatus { UnInit, Ready, Running, Exited }

#[derive(Copy, Clone)]
pub struct TaskControlBlock {
    pub task_status: TaskStatus,
    pub task_cx: TaskContext,
}`,
        },
      ],
      acceptanceCriteria: [
        "能口头解释「一个任务由哪三块内存构成」",
        "能画出 4 个状态之间的迁移图",
        "TaskControlBlock 的尺寸等于 1 字节状态 + 填充 + 112 字节 TaskContext（按 8 对齐约 120）",
      ],
      references: [
        { title: "OSTEP Ch.4-6: The Abstraction: The Process", description: "[必读] 进程抽象的经典文本", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf" },
        { title: "xv6-riscv book Ch.7", description: "[必读] Scheduling——和我们的 Rust 版对照看", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §3.1", description: "[深入阅读] 多道程序与分时多任务", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/index.html" },
      ],
    },

    // ── Lesson 2 ──────────────────────────────────────────
    {
      phaseId: 2, lessonId: 2,
      title: "TaskContext vs TrapContext",
      subtitle: "为什么一个 14 字、另一个 34 字",
      type: "Concept",
      duration: "1.5 hours",
      objectives: [
        "清楚两种上下文各自保护的是哪条边界",
        "理解「只保存 callee-saved 寄存器」为什么够用",
        "知道 TaskContext 的 ra 指向哪里、sp 指向哪条内核栈",
        "能用一张表准确说出两者的差异",
      ],
      sections: [
        {
          title: "两条边界、两套上下文",
          blocks: [
            { type: "paragraph", text: "Phase 1 已经有了 TrapContext——它保护的是「U-mode ⇄ S-mode」这条特权级边界。Phase 2 再加一个 TaskContext——它保护的是「内核线程 A ⇄ 内核线程 B」这条语言级边界。两者的寄存器集合、触发时机、写入方完全不同。" },
            { type: "diagram", content:
`            U-mode 用户代码
                │
                │ ecall / timer
                │                  ┌─ TrapContext 34 字：硬件驱动
                ▼                  │  任何指令都可能 trap，
          ─────┴──────────         │  所以通用寄存器全要保存
          S-mode trap handler ─────┘
                │
                │ suspend_current_and_run_next()
                │                  ┌─ TaskContext 14 字：函数调用
                ▼                  │  __switch 是 Rust 调用的，
          ─────┴──────────         │  caller-saved 编译器已帮忙保存
          S-mode trap handler      │  我们只要存 callee-saved
                │                  └─
                │ sret
                ▼
            U-mode 用户代码（但也许是另一个 app）` },
          ],
        },
        {
          title: "TaskContext：14 个 usize",
          blocks: [
            { type: "code", language: "rust", code:
`#[derive(Copy, Clone)]
#[repr(C)]
pub struct TaskContext {
    ra: usize,       // +0   下次 __switch 返回时跳去哪
    sp: usize,       // +8   这个任务的内核栈顶
    s: [usize; 12],  // +16 .. +104   s0 .. s11
}
// sizeof = 14 * 8 = 112 字节` },
            { type: "paragraph", text: "为什么只保存 ra、sp、s0-s11？因为 __switch 是被 Rust 代码通过正常的函数调用约定调用的。RISC-V calling convention 规定：caller-saved 寄存器（t0-t6、a0-a7、ft0-ft11）由调用方自行保存。编译器已经在 __switch 的 call site 把还需要用的值写回栈或重新读出——__switch 根本不需要管它们。" },
            { type: "callout", variant: "warning", text: "这和 TrapContext 的「保存全部」思路截然相反：trap 由硬件异步触发，没人帮你 spill caller-saved。而 __switch 是你自己调的函数，编译器会帮你 spill——所以省。" },
          ],
        },
        {
          title: "对比表",
          blocks: [
            { type: "table", headers: ["维度", "TrapContext", "TaskContext"], rows: [
              ["大小", "34 × 8 = 272 字节", "14 × 8 = 112 字节"],
              ["保护的边界", "U-mode ⇄ S-mode（特权级）", "内核线程 A ⇄ 内核线程 B（语言级）"],
              ["触发时机", "硬件 trap（异步 + 任何指令）", "内核主动 __switch() 调用"],
              ["保存者", "__alltraps 汇编（硬件驱动）", "__switch 汇编（函数调用驱动）"],
              ["寄存器集", "x0-x31 全部 + sstatus + sepc", "ra + sp + s0-s11（callee-saved）"],
              ["为什么不保存 caller-saved", "——（必须全保存）", "Rust 调用者已经 spill 过了"],
              ["结构所在位置", "任务的内核栈上", "任务的 TCB 里"],
              ["首次构造者", "loader::init_app_cx()", "TaskContext::goto_restore()"],
            ]},
          ],
        },
        {
          title: "goto_restore：把新任务的 ra 指向 __restore",
          blocks: [
            { type: "paragraph", text: "一个从未跑过的任务，它的 TaskContext 该怎么初始化？思路：让调度器第一次切到它时，__switch 的 ret 指令把控制权送到汇编例程 __restore——__restore 会从内核栈上加载我们预先伪造好的 TrapContext，sret 回 U-mode。" },
            { type: "code", language: "rust", code:
`impl TaskContext {
    pub fn goto_restore(kstack_ptr: usize) -> Self {
        extern "C" { fn __restore(); }
        Self {
            ra: __restore as usize,   // ★ 调度切入后第一条要执行的汇编
            sp: kstack_ptr,           // ★ 内核栈顶：TrapContext 就躺在上面
            s:  [0; 12],
        }
    }
}` },
            { type: "callout", variant: "tip", text: "loader 在启动时先在每条内核栈上构造 TrapContext（通过 push_context），然后返回栈顶地址给 goto_restore——两者一拼接，整条启动链路就通了：__switch → ret → __restore → sret → 用户程序。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-context", title: "Lab 1b ⭐⭐ TaskContext + goto_restore",
          description: "补全 task/context.rs。定义 14 字的结构体，并写出 zero_init() 与 goto_restore(kstack_ptr)。",
          labFile: "labs/phase_2_proc/src/task/context.rs",
          hints: [
            "#[repr(C)] 不能省——switch.S 硬编码偏移 0/8/16 ...",
            "extern \"C\" { fn __restore(); } 用来取汇编符号地址",
            "zero_init() 给 UnInit 槽位用，全填 0 即可",
            "goto_restore 只初始化 ra 和 sp，s[0..12] 留 0",
          ],
          pseudocode:
`#[repr(C)]
#[derive(Copy, Clone)]
pub struct TaskContext { ra: usize, sp: usize, s: [usize; 12] }

impl TaskContext {
    pub fn zero_init() -> Self { Self { ra: 0, sp: 0, s: [0; 12] } }
    pub fn goto_restore(kstack_ptr: usize) -> Self {
        extern "C" { fn __restore(); }
        Self { ra: __restore as usize, sp: kstack_ptr, s: [0; 12] }
    }
}`,
        },
      ],
      acceptanceCriteria: [
        "sizeof::<TaskContext>() == 112",
        "能回答「为什么不保存 t0-t6 和 a0-a7」",
        "能画出 TrapContext vs TaskContext 对比表",
      ],
      references: [
        { title: "RISC-V Calling Convention", description: "[必读] 哪些寄存器 caller-saved、哪些 callee-saved", url: "https://riscv.org/wp-content/uploads/2015/01/riscv-calling.pdf" },
        { title: "rCore-Tutorial §3.2", description: "[必读] 任务切换——TaskContext 的中文讲解", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/2task-switching.html" },
        { title: "xv6-riscv kernel/proc.h", description: "[深入阅读] 对照 C 版的 struct context", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/proc.h" },
      ],
    },

    // ── Lesson 3 ──────────────────────────────────────────
    {
      phaseId: 2, lessonId: 3,
      title: "__switch：29 条指令的魔法",
      subtitle: "sd / ld / ret——多任务的心脏",
      type: "Practice",
      duration: "2 hours",
      objectives: [
        "能逐行写出 switch.S 的全部 29 条指令",
        "理解「为什么最后一条 ret 能跳去另一个任务」",
        "知道为什么必须用汇编而不能写 Rust",
        "会用 gdb 在 __switch 前后打断点观察 ra/sp 变化",
      ],
      sections: [
        {
          title: "__switch 的签名",
          blocks: [
            { type: "code", language: "rust", code:
`extern "C" {
    pub fn __switch(
        current_task_cx_ptr: *mut TaskContext,   // a0
        next_task_cx_ptr:    *const TaskContext, // a1
    );
}` },
            { type: "paragraph", text: "a0 是「存到哪里」——当前任务的 TaskContext 地址；a1 是「从哪里加载」——下一个任务的 TaskContext 地址。按 RISC-V C ABI，前两个指针参数分别落在 a0、a1，汇编里直接用。" },
          ],
        },
        {
          title: "寄存器快照：before / after",
          blocks: [
            { type: "diagram", content:
`调用 __switch(&A.cx, &B.cx) 之前：

  ┌── CPU ──────────────┐    ┌── 内存 A.cx ──┐   ┌── 内存 B.cx ──┐
  │ ra   = return_to_A  │    │ ra   = ???    │   │ ra   = __restore │
  │ sp   = A_kstack_top │    │ sp   = ???    │   │ sp   = B_kstack  │
  │ s0   = A_s0         │    │ s0   = ???    │   │ s0   = B_s0_old  │
  │  ...                │    │  ...          │   │  ...             │
  └─────────────────────┘    └───────────────┘   └──────────────────┘

执行 14 次 sd 保存到 A.cx、14 次 ld 从 B.cx 加载：

  ┌── CPU ──────────────┐    ┌── 内存 A.cx ──┐   ┌── 内存 B.cx ──┐
  │ ra   = __restore    │    │ ra = return_to_A │ │ ra   = __restore │
  │ sp   = B_kstack     │    │ sp = A_kstack  │  │ sp   = B_kstack  │
  │ s0   = B_s0_old     │    │ s0 = A_s0      │  │ s0   = B_s0_old  │
  │  ...                │    │  ...           │  │  ...             │
  └─────────────────────┘    └────────────────┘  └──────────────────┘

最后 ret = jr ra —— 跳到 __restore，用 B_kstack 作栈，开始跑 B。` },
          ],
        },
        {
          title: "switch.S 完整代码",
          blocks: [
            { type: "code", language: "asm", code:
`    .section .text
    .globl __switch
__switch:
    # a0 = &mut current_task_cx
    # a1 = &next_task_cx
    sd   ra,  0*8(a0)
    sd   sp,  1*8(a0)
    sd   s0,  2*8(a0)
    sd   s1,  3*8(a0)
    sd   s2,  4*8(a0)
    sd   s3,  5*8(a0)
    sd   s4,  6*8(a0)
    sd   s5,  7*8(a0)
    sd   s6,  8*8(a0)
    sd   s7,  9*8(a0)
    sd   s8, 10*8(a0)
    sd   s9, 11*8(a0)
    sd   s10,12*8(a0)
    sd   s11,13*8(a0)

    ld   ra,  0*8(a1)
    ld   sp,  1*8(a1)
    ld   s0,  2*8(a1)
    ld   s1,  3*8(a1)
    ld   s2,  4*8(a1)
    ld   s3,  5*8(a1)
    ld   s4,  6*8(a1)
    ld   s5,  7*8(a1)
    ld   s6,  8*8(a1)
    ld   s7,  9*8(a1)
    ld   s8, 10*8(a1)
    ld   s9, 11*8(a1)
    ld   s10,12*8(a1)
    ld   s11,13*8(a1)

    ret
` },
            { type: "callout", variant: "info", text: "14 sd + 14 ld + 1 ret = 29 条指令。最后那条 ret = jr ra——但 ra 和 sp 刚刚被我们整体换掉，所以这条「返回指令」其实是跳进了另一个任务的栈和 PC。整个多任务的魔法就浓缩在这一条 ret 里。" },
          ],
        },
        {
          title: "为什么不能用 Rust 写？",
          blocks: [
            { type: "paragraph", text: "看似「我在 Rust 里手动读写 ra/sp 不就行了」——不行。Rust 函数有自己的 prologue/epilogue：编译器会在入口处把 ra 压栈、申请栈帧，出口处又恢复。你没办法精确控制「sd ra 的那一刻 ra 还是旧的、ld sp 的那一刻 sp 还没变」——这些顺序一旦被编译器改写，栈就被撕成两半。" },
            { type: "callout", variant: "warning", text: "所以 __switch 必须整段汇编、不许有 Rust 代码混入。而且 naked function（去掉 prologue）在 stable Rust 里还不稳定——不如直接 .S 文件省事。" },
          ],
        },
        {
          title: "常见错误",
          blocks: [
            { type: "list", ordered: true, items: [
              "偏移写错：结构体第 0 个字段是 ra，但你以为第 0 个是 sp——结果切换后崩在第一条 ld 上。",
              "把 sd/ld 的 a0/a1 搞反：写进了 next、从 current 读——相当于把当前任务的现场覆盖掉下一个的。",
              "漏保存 ra：下一次切回来时找不到返回地址，跳进空指针。",
              "多存了 caller-saved（t0-t6）：不仅浪费栈空间，还容易漏掉其中一个，形成间歇性数据竞争——非常难调试。",
              "忘记 ret：__switch 走完后直接掉进下一个函数的开头——症状通常是「莫名其妙执行到某个无关符号」。",
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-switch", title: "Lab 1c ⭐⭐ switch.S",
          description: "在 task/switch.S 写出 29 条指令。配合 Lab 1b 的 goto_restore，第一次 __switch 应该能把控制权送到 __restore。",
          labFile: "labs/phase_2_proc/src/task/switch.S",
          hints: [
            "结构体偏移：ra=0, sp=8, s0=16, s1=24, ..., s11=104",
            "sd/ld 的立即数必须是 8 的倍数",
            ".globl __switch 别忘",
            "gdb 里 b __switch、stepi 观察每条指令",
          ],
          pseudocode:
`.section .text
.globl __switch
__switch:
    # save current (a0)
    sd ra,  0*8(a0)
    sd sp,  1*8(a0)
    .set n, 0
    .rept 12
        sd s\\n, (2+n)*8(a0)
        .set n, n+1
    .endr
    # load next (a1)
    ld ra,  0*8(a1)
    ld sp,  1*8(a1)
    ...
    ret`,
        },
      ],
      acceptanceCriteria: [
        "gdb 在 __switch 单步能看到 ra/sp 先写入 a0 指向的内存、再从 a1 加载",
        "ret 之后 PC 跳到 __restore（或上一次暂停处）",
        "完成 Lab 1 后 make qemu 至少能跑起第一个 app",
      ],
      references: [
        { title: "rCore-Tutorial §3.2.2", description: "[必读] __switch 的中文逐行讲解", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/2task-switching.html" },
        { title: "xv6-riscv kernel/swtch.S", description: "[必读] C 版的 swtch——结构几乎一样", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/swtch.S" },
        { title: "RISC-V Unprivileged ISA", description: "[深入阅读] sd/ld/jalr/ret 的形式化语义", url: "https://riscv.org/technical/specifications/" },
      ],
    },

    // ── Lesson 4 ──────────────────────────────────────────
    {
      phaseId: 2, lessonId: 4,
      title: "Round-Robin 调度器",
      subtitle: "run_first_task / find_next_task / run_next_task",
      type: "Practice",
      duration: "2 hours",
      objectives: [
        "实现 TaskManager 的三个关键方法",
        "理解「持锁调用 __switch」为什么会死锁",
        "掌握 cooperative 调度（sys_yield / sys_exit）的控制流",
        "能在 gdb 里观察任务的 A/B/C 交替输出",
      ],
      sections: [
        {
          title: "TaskManager 的骨架",
          blocks: [
            { type: "code", language: "rust", code:
`pub struct TaskManager {
    num_app: usize,
    inner: UPSafeCell<TaskManagerInner>,
}

pub struct TaskManagerInner {
    tasks: [TaskControlBlock; MAX_APP_NUM],
    current_task: usize,
}

lazy_static! {
    pub static ref TASK_MANAGER: TaskManager = {
        let num_app = loader::get_num_app();
        let mut tasks = [TCB { task_cx: TaskContext::zero_init(),
                               task_status: TaskStatus::UnInit };
                         MAX_APP_NUM];
        for i in 0..num_app {
            tasks[i].task_cx = TaskContext::goto_restore(loader::init_app_cx(i));
            tasks[i].task_status = TaskStatus::Ready;
        }
        TaskManager { num_app, inner: UPSafeCell::new(TaskManagerInner {
            tasks, current_task: 0,
        })}
    };
}` },
            { type: "paragraph", text: "UPSafeCell 是 Phase 1 我们写的单核「假互斥」——内部是 RefCell，借出时 panic 而不是阻塞。到 Phase 3 才会换成真正的 SpinLock。" },
          ],
        },
        {
          title: "三个核心方法",
          blocks: [
            { type: "code", language: "rust", code:
`impl TaskManager {
    // 永不返回——被 rust_main 最后调用，开启多任务世界
    fn run_first_task(&self) -> ! {
        let mut inner = self.inner.exclusive_access();
        let task0 = &mut inner.tasks[0];
        task0.task_status = TaskStatus::Running;
        let next_cx_ptr = &task0.task_cx as *const TaskContext;
        drop(inner);                              // ★ 切换前必须释放
        let mut unused = TaskContext::zero_init();
        unsafe { __switch(&mut unused, next_cx_ptr); }
        unreachable!("after __switch to first task")
    }

    // Round-robin 扫描
    fn find_next_task(&self) -> Option<usize> {
        let inner = self.inner.exclusive_access();
        let cur = inner.current_task;
        (cur + 1 .. cur + self.num_app + 1)
            .map(|i| i % self.num_app)
            .find(|&i| inner.tasks[i].task_status == TaskStatus::Ready)
    }

    // suspend / yield / timer 都走它
    fn run_next_task(&self) {
        if let Some(next) = self.find_next_task() {
            let mut inner = self.inner.exclusive_access();
            let cur = inner.current_task;
            inner.tasks[next].task_status = TaskStatus::Running;
            inner.current_task = next;
            let cur_cx_ptr  = &mut inner.tasks[cur].task_cx  as *mut  TaskContext;
            let next_cx_ptr = &    inner.tasks[next].task_cx as *const TaskContext;
            drop(inner);                          // ★ 同样要释放
            unsafe { __switch(cur_cx_ptr, next_cx_ptr); }
        } else {
            println!("[kernel] All apps finished!");
            shutdown(false);
        }
    }
}` },
          ],
        },
        {
          title: "Round-Robin 的状态流转",
          blocks: [
            { type: "diagram", content:
`时间 ───────────────────────────────────────────────────────►
任务 A  R R R -  -   -  R R  -    -    -     (yield)
任务 B  -  - R R  -  -    R R  -  -    -     (yield)
任务 C  -  - -  - R R  -   -  R R  -          (timer)

        ↑   ↑    ↑   ↑    ↑   ↑   ↑   ↑   ↑
        │   │    │   │    │   │   │   │   └─ C exit
        │   │    │   │    │   │   │   └─── C preempted
        │   │    │   │    │   │   └─── B yield
        │   │    │   │    │   └─── A yield
        │   │    │   │    └─── B yield
        │   │    │   └─── A yield
        │   │    └─── C preempted
        │   └─── B yield
        └─── A yield  (cooperative)` },
            { type: "paragraph", text: "run_first_task 启动 A；A 的 sys_yield 触发 run_next_task → find_next_task 返回 B → __switch 到 B；依次类推。Lab 3 的时钟中断把同样的 run_next_task 无条件塞进来——任务感觉不到区别。" },
          ],
        },
        {
          title: "最容易犯的错：持锁 __switch",
          blocks: [
            { type: "callout", variant: "warning", text: "绝对不能在 __switch 之前忘记 drop(inner)。想象 A 持着 TaskManagerInner 的 RefMut 切到 B；B 稍后也要 sys_yield→run_next_task→exclusive_access()——它会在 UPSafeCell 上 panic（单核）或死锁（真正的 SpinLock，Phase 3 会遇到）。" },
            { type: "code", language: "rust", code:
`// ✘ 错误示范
let mut inner = self.inner.exclusive_access();
...
unsafe { __switch(cur_cx_ptr, next_cx_ptr); }  // 锁还在！
// B 的 run_next_task() 一进来就 RefCell already borrowed` },
          ],
        },
        {
          title: "常见错误",
          blocks: [
            { type: "list", ordered: true, items: [
              "忘记 drop(inner)：下一个任务 yield 时 borrow 冲突。",
              "current/next 指针方向写反：current 是 *mut（写入现场），next 是 *const（读取）。",
              "run_first_task 不是 -> !：rustc 会强制你在 __switch 后 return 某个值，代码看着别扭，说明签名就错了。",
              "把 Exited 任务错标成 Ready：find_next_task 会永远切回一个已死的任务。sys_exit 里必须 task_status = Exited。",
              "MAX_APP_NUM 硬编码比实际 num_app 小：loader 会悄悄截断——grade.py 会发现你少跑了一个 app。",
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab2-manager", title: "Lab 2 ⭐⭐⭐ TaskManager",
          description: "在 task/mod.rs 实现 run_first_task / find_next_task / run_next_task 以及对外暴露的 suspend_current_and_run_next / exit_current_and_run_next。",
          labFile: "labs/phase_2_proc/src/task/mod.rs",
          hints: [
            "所有 __switch 调用前都要 drop inner",
            "find_next_task 用 (cur+1..cur+num_app+1).map(|i| i%num_app) 可避免模糊的 for",
            "suspend_current_and_run_next：Running → Ready；exit：Running → Exited",
            "run_first_task 的 unused 变量就是调度器本身的伪 TaskContext——切出去之后再也不用切回来",
          ],
          pseudocode:
`pub fn suspend_current_and_run_next() {
    TASK_MANAGER.mark_current_suspended();
    TASK_MANAGER.run_next_task();
}
pub fn exit_current_and_run_next() {
    TASK_MANAGER.mark_current_exited();
    TASK_MANAGER.run_next_task();
}`,
        },
      ],
      acceptanceCriteria: [
        "make qemu 能看到 A/B 交替输出，cooperative yield 跑通",
        "所有 app 退出后内核打印 All apps finished! 并 shutdown",
        "gdb 在 __switch 前看到 inner 已经被 drop（借用计数归零）",
      ],
      references: [
        { title: "OSTEP Ch.7 Scheduling: Introduction", description: "[必读] Round-robin 与 SJF/STCF 的对比", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf" },
        { title: "xv6-riscv book Ch.7 §7.3", description: "[必读] C 版 scheduler() 的结构", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §3.3", description: "[深入阅读] 管理多道程序的 TaskManager", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/3multiprogramming.html" },
      ],
    },

    // ── Lesson 5 ──────────────────────────────────────────
    {
      phaseId: 2, lessonId: 5,
      title: "时钟中断与抢占",
      subtitle: "sbi_set_timer + sie.STIE + sstatus.SIE",
      type: "Practice",
      duration: "2 hours",
      objectives: [
        "理解 RISC-V 的 mtime/mtimecmp 计时模型以及 SBI 的角色",
        "会配置 sie.STIE 与 sstatus.SIE 让 S-mode 真正收到时钟中断",
        "实现 set_next_trigger 与 SupervisorTimer 的 trap 分支",
        "能观察到抢占式调度：不调用 yield 的 app_timer 也被切走",
      ],
      sections: [
        {
          title: "硬件计时三件套",
          blocks: [
            { type: "diagram", content:
`Machine mode (OpenSBI 固件, 我们看不见)
  ┌─────────────────────────────────────────────┐
  │ mtime      — 64 位自由运行计数器（MMIO）     │
  │ mtimecmp   — 每 hart 一个的比较阈值（MMIO）  │
  │ if mtime >= mtimecmp:                        │
  │     触发 M-mode timer interrupt              │
  │     SBI 把它转成 S-mode 的 SupervisorTimer   │
  └─────────────────────────────────────────────┘
                       │
                       │ ecall from S (opcode 0x00, fid 0)
                       ▲
Supervisor mode (我们的内核)
  ┌─────────────────────────────────────────────┐
  │ sbi::set_timer(deadline) ──► 设 mtimecmp     │
  │ trap_handler 的 SupervisorTimer 分支：       │
  │   1) set_next_trigger()  重新武装定时器      │
  │   2) suspend_current_and_run_next()  切任务 │
  └─────────────────────────────────────────────┘` },
            { type: "paragraph", text: "mtime 和 mtimecmp 都是 M-mode 才能直接读写的 MMIO——我们在 S-mode 必须通过 SBI 走一遭。OpenSBI 提供了标准的 sbi_set_timer(stime_value) 调用，底层就是帮我们改 mtimecmp 并清 mip.STIP。" },
          ],
        },
        {
          title: "三个使能位",
          blocks: [
            { type: "table", headers: ["位", "在哪里", "作用", "设置时机"], rows: [
              ["sie.STIE (bit 5)", "sie CSR", "允许 S-mode 时钟中断递送到 CPU", "内核启动 trap::enable_timer_interrupt() 时一次"],
              ["sstatus.SIE (bit 1)", "sstatus CSR", "S-mode 全局中断使能（0 则所有 S 中断都屏蔽）", "返回 U-mode 时通过 SPIE←1 间接打开"],
              ["sstatus.SPIE (bit 5)", "sstatus CSR", "sret 时会被拷回 SIE——构造 TrapContext 时置 1", "app_init_context() 时"],
              ["sie.SEIE / SSIE", "sie CSR", "S-mode 外部 / 软件中断——Phase 2 先不碰", "留待后续 phase"],
            ]},
            { type: "code", language: "rust", code:
`pub fn enable_timer_interrupt() {
    unsafe { sie::set_stimer(); }    // 置 sie.STIE=1
}

// 在 app_init_context 里：
let mut sstatus = sstatus::read();
sstatus.set_spp(SPP::User);
sstatus.set_spie(true);              // ← Phase 2 新增的一行
                                     //   sret 时 SIE 会被拷成 1` },
            { type: "callout", variant: "warning", text: "这三个位的关系经常让人踩坑：stie 是「允不允许这一路中断」，sie 是「S-mode 愿不愿意被打断」。两个都得是 1，中断才真正到达。sepc 里有 pending 但 sie=0 —— 中断会一直悬在 mip 里等到 sret 触发 SPIE←SIE 后才送达。" },
          ],
        },
        {
          title: "timer.rs 的两个函数",
          blocks: [
            { type: "code", language: "rust", code:
`use riscv::register::time;
use crate::sbi::set_timer;
use crate::config::CLOCK_FREQ;

pub const TICKS_PER_SEC: usize = 100;     // 10 ms 一片

pub fn get_time() -> usize { time::read() }

pub fn set_next_trigger() {
    let next = get_time() + CLOCK_FREQ / TICKS_PER_SEC;
    set_timer(next as u64);               // 告诉 SBI 下一次阈值
}` },
            { type: "paragraph", text: "set_timer 传的是绝对 mtime 值（deadline），不是间隔。这是最容易写错的地方——写成 set_timer(CLOCK_FREQ/TICKS_PER_SEC) 只会得到「开机 10 ms 后中断一次」，然后就永远不再触发。" },
          ],
        },
        {
          title: "trap_handler 里新增的分支",
          blocks: [
            { type: "code", language: "rust", code:
`#[no_mangle]
pub fn trap_handler(cx: &mut TrapContext) -> &mut TrapContext {
    let scause = scause::read();
    let stval  = stval::read();
    match scause.cause() {
        Trap::Exception(Exception::UserEnvCall) => {
            cx.sepc += 4;
            cx.x[10] = syscall(cx.x[17], [cx.x[10], cx.x[11], cx.x[12]]) as usize;
        }
        Trap::Interrupt(Interrupt::SupervisorTimer) => {  // ★ 新增
            crate::timer::set_next_trigger();             //   1) 重新武装
            crate::task::suspend_current_and_run_next();  //   2) 切任务
        }
        _ => panic!("unsupported trap {:?}, stval={:#x}", scause.cause(), stval),
    }
    cx
}` },
            { type: "callout", variant: "info", text: "注意 set_next_trigger 必须先调——如果先切任务再重新武装，切过去的任务可能再也不会被 preempt（因为新任务也许永远不再触发 trap，timer 就永远没机会 re-arm）。" },
          ],
        },
        {
          title: "cooperative vs preemptive 对比",
          blocks: [
            { type: "table", headers: ["维度", "Cooperative（Lab 2）", "Preemptive（Lab 3）"], rows: [
              ["触发源", "用户主动 sys_yield / sys_exit", "硬件时钟中断（每 10 ms）"],
              ["app 能不能赖着不走", "能——死循环的 app 会饿死别人", "不能——定时被拖走"],
              ["所需内核改动", "TaskManager + syscall 分发", "+ timer.rs + trap SupervisorTimer 分支 + sie/sstatus 配置"],
              ["现实世界里谁在用", "Windows 3.x / 早期 Mac OS", "所有现代内核（Linux/Windows NT/xv6）"],
              ["公平性", "完全依赖应用自觉", "最差情况也只差一个时间片"],
              ["实时性", "不可控", "上界 = 一个时间片"],
            ]},
          ],
        },
        {
          title: "常见错误",
          blocks: [
            { type: "list", ordered: true, items: [
              "把 set_timer 当成「fire in Δt」：传成了间隔而不是绝对 deadline——只会触发一次。",
              "忘记在 ISR 里重新武装：第一次 preempt 之后 mtime 又爬过 mtimecmp，但我们没更新它——后续任务再也不被打断。",
              "开了 sie.STIE 但 TrapContext 里没置 SPIE=1：sret 回用户态后 SIE 还是 0，中断悬挂但永不到达。",
              "SupervisorTimer 分支里漏掉 set_next_trigger，直接 suspend——同样只有一次 preempt。",
              "把 set_timer 传成 i64 而非 u64：负数 deadline 在 SBI 里可能被当成「过去时间」，导致定时器疯狂触发——CPU 被 ISR 吃满。",
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab3-timer", title: "Lab 3a ⭐ timer.rs",
          description: "实现 get_time / set_next_trigger。注意 CLOCK_FREQ 在 config.rs 里，QEMU virt 机是 10_000_000。",
          labFile: "labs/phase_2_proc/src/timer.rs",
          hints: [
            "riscv::register::time::read() 读 mtime",
            "set_timer 来自 crate::sbi——封装好的 ecall",
            "deadline = 现在 + CLOCK_FREQ / TICKS_PER_SEC",
          ],
          pseudocode:
`pub fn set_next_trigger() {
    let next = get_time() + CLOCK_FREQ / TICKS_PER_SEC;
    set_timer(next as u64);
}`,
        },
        {
          id: "lab3-trap", title: "Lab 3b ⭐⭐ SupervisorTimer 分支",
          description: "在 trap/mod.rs 的 match 里把 todo!() 替换成正确的两句：re-arm + suspend。",
          labFile: "labs/phase_2_proc/src/trap/mod.rs",
          hints: [
            "Trap::Interrupt(Interrupt::SupervisorTimer)",
            "顺序：set_next_trigger 在前、suspend 在后",
            "别忘在 rust_main 里调 trap::enable_timer_interrupt() 和 timer::set_next_trigger()",
          ],
          pseudocode:
`Trap::Interrupt(Interrupt::SupervisorTimer) => {
    crate::timer::set_next_trigger();
    crate::task::suspend_current_and_run_next();
}`,
        },
      ],
      acceptanceCriteria: [
        "make qemu 能看到 app_timer（死循环不 yield 的 app）的输出也被切进切出——preemption 成功",
        "三个 app 都打印 [X done]",
        "scripts/grade.py 满分",
      ],
      references: [
        { title: "RISC-V Privileged Spec Ch.3.1.6 & 3.1.9", description: "[必读] sie / sstatus 的位图与中断递送规则", url: "https://github.com/riscv/riscv-isa-manual/releases" },
        { title: "RISC-V SBI Specification v1.0", description: "[必读] set_timer 的官方语义", url: "https://github.com/riscv-non-isa/riscv-sbi-doc" },
        { title: "OSTEP Ch.8 MLFQ", description: "[深入阅读] round-robin 之后：多级反馈队列", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf" },
        { title: "rCore-Tutorial §3.4", description: "[深入阅读] 抢占式调度——同教学路径的中文参考", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/4time-sharing-system.html" },
      ],
    },
  ],
};

// ─── Phase 2: Process & Scheduling (English) ────────────────

export const phase2En: PhaseContent = {
  phaseId: 2,
  color: "#059669",
  accent: "#34D399",
  lessons: [
    // ── Lesson 1 ──────────────────────────────────────────
    {
      phaseId: 2, lessonId: 1,
      title: "The Process Abstraction & the TCB",
      subtitle: "What a task really is — TCB + kernel stack + user stack",
      type: "Concept",
      duration: "1.5 hours",
      objectives: [
        "Understand which pieces of memory actually constitute a process",
        "Master the TaskControlBlock (TCB) — fields and state machine",
        "See why every task needs its own kernel stack",
        "Draw the UnInit → Ready → Running → Exited transitions",
      ],
      sections: [
        {
          title: "From single-task to multi-task",
          blocks: [
            { type: "paragraph", text: "In Phase 1 the kernel had exactly one straight line of execution: _start → ecall → trap_handler → sret → user code → exit. One set of registers and one kernel stack were enough. Phase 2 wants N user apps sharing the CPU — which means we need the ability to pause A and resume B. But first: what *is* a task, concretely, inside the kernel?" },
            { type: "callout", variant: "info", text: "A task = a TaskControlBlock (TCB) + a kernel stack + a user stack. A process isn't an object floating in the ether — it *is* those three pieces of memory. Phases 3–5 will add address spaces, file tables, parent pointers, but the skeleton is already here." },
          ],
        },
        {
          title: "TCB fields",
          blocks: [
            { type: "code", language: "rust", code:
`#[derive(Copy, Clone)]
pub struct TaskControlBlock {
    pub task_status: TaskStatus,   // UnInit / Ready / Running / Exited
    pub task_cx: TaskContext,      // 14-word register snapshot (next lesson)
}

#[derive(Copy, Clone, PartialEq)]
pub enum TaskStatus { UnInit, Ready, Running, Exited }` },
            { type: "paragraph", text: "TCB is a plain Rust struct, living inside a fixed-size array in the kernel's .data section. Phase 2 does no dynamic allocation: MAX_APP_NUM is fixed at compile time, and loader scans the linked-in user ELFs and populates the slots." },
            { type: "callout", variant: "tip", text: "Phase 5 will move the TCB onto the heap wrapped in Arc<Mutex<TCB>> (fork/exec need dynamic creation). For now a static array — one fewer variable, one clearer mental model." },
          ],
        },
        {
          title: "The three-block memory layout",
          blocks: [
            { type: "diagram", content:
`kernel .bss / .data                                          high
┌─────────────────────────────────────────────────────────┐
│ KERNEL_STACK[MAX_APP_NUM]   8 KiB kernel stack per task │
│   ┌─ KernelStack[0] ─┐                                   │
│   │    8192 bytes    │  ← task 0's sp on ecall           │
│   └──────────────────┘                                   │
│   ┌─ KernelStack[1] ─┐                                   │
│   │    8192 bytes    │                                   │
│   └──────────────────┘                                   │
│        ......                                            │
├─────────────────────────────────────────────────────────┤
│ USER_STACK[MAX_APP_NUM]     8 KiB user stack per task    │
├─────────────────────────────────────────────────────────┤
│ TASK_MANAGER {                                           │
│   num_app: usize,                                        │
│   inner: UPSafeCell<TaskManagerInner> {                  │
│     tasks: [TCB; MAX_APP_NUM],                           │
│     current_task: usize,                                 │
│   }                                                      │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
User .text/.data copied by loader to APP_BASE + N * APP_SIZE_LIMIT` },
            { type: "paragraph", text: "Why does every task need its own kernel stack? Picture task A half-way through trap_handler when a timer fires and we switch to B; B's ecall runs trap_handler too. If they shared one stack, B would overwrite A's frames; when A resumes, its stack is garbage — instant crash. One-per-task keeps it clean." },
          ],
        },
        {
          title: "State machine",
          blocks: [
            { type: "diagram", content:
`            loader::init_app_cx()
   UnInit ───────────────────────► Ready ◀─────────┐
                                     │              │ suspend
                                     ▼              │
                                  Running ──────────┘
                                     │
                                     │ exit (sys_exit)
                                     ▼
                                   Exited` },
            { type: "table", headers: ["State", "Meaning", "Who causes the next transition"], rows: [
              ["UnInit", "Slot unused, or loader hasn't built a TrapContext yet", "loader"],
              ["Ready", "Runnable, waiting for CPU", "scheduler"],
              ["Running", "Executing on some hart", "timer / sys_yield / sys_exit"],
              ["Exited", "Done, kernel stack never resumed", "no one (Phase 5: parent wait reaps it)"],
            ]},
            { type: "callout", variant: "info", text: "Phase 3 adds Sleeping (blocked on a lock); Phase 5 adds Zombie (exited but parent hasn't wait()ed). Four states suffice now — any more is premature complexity." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-tcb", title: "Lab 1a ⭐ TCB & state enum",
          description: "Fill in TaskStatus and TaskControlBlock in task/task.rs. Both are Copy so the TCB array can live by-value inside UPSafeCell.",
          labFile: "labs/phase_2_proc/src/task/task.rs",
          hints: [
            "TaskStatus: derive Copy, Clone, PartialEq, Debug",
            "TaskControlBlock: derive Copy, Clone",
            "task_cx has type TaskContext (defined next lesson)",
          ],
          pseudocode:
`#[derive(Copy, Clone, PartialEq, Debug)]
pub enum TaskStatus { UnInit, Ready, Running, Exited }

#[derive(Copy, Clone)]
pub struct TaskControlBlock {
    pub task_status: TaskStatus,
    pub task_cx: TaskContext,
}`,
        },
      ],
      acceptanceCriteria: [
        "You can explain \"a task is which three pieces of memory\" out loud",
        "You can draw the 4-state transition diagram",
        "sizeof TaskControlBlock is ~120 bytes (1 byte enum + padding + 112-byte TaskContext)",
      ],
      references: [
        { title: "OSTEP Ch.4-6: The Abstraction: The Process", description: "[Required] The classic text on the process abstraction", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf" },
        { title: "xv6-riscv book Ch.7", description: "[Required] Scheduling — read in parallel with our Rust version", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §3.1", description: "[Deep dive] Multiprogramming and time-sharing", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/index.html" },
      ],
    },

    // ── Lesson 2 ──────────────────────────────────────────
    {
      phaseId: 2, lessonId: 2,
      title: "TaskContext vs TrapContext",
      subtitle: "Why one is 14 words and the other is 34",
      type: "Concept",
      duration: "1.5 hours",
      objectives: [
        "Know which boundary each context guards",
        "Understand why saving callee-saved registers alone is sufficient",
        "Know where TaskContext's ra and sp point",
        "Recite the comparison table from memory",
      ],
      sections: [
        {
          title: "Two boundaries, two contexts",
          blocks: [
            { type: "paragraph", text: "Phase 1 already has TrapContext — it guards the privilege boundary U-mode ⇄ S-mode. Phase 2 adds TaskContext — it guards the language-level boundary kernel thread A ⇄ kernel thread B. The register set, the trigger, and the writer are all different." },
            { type: "diagram", content:
`            U-mode user code
                │
                │ ecall / timer
                │                  ┌─ TrapContext 34 words: hardware-driven
                ▼                  │  Any instruction can trap,
          ─────┴──────────         │  so we save every general register
          S-mode trap handler ─────┘
                │
                │ suspend_current_and_run_next()
                │                  ┌─ TaskContext 14 words: Rust-driven
                ▼                  │  __switch is a regular Rust call,
          ─────┴──────────         │  compiler spilled caller-saved already,
          S-mode trap handler      │  we only save callee-saved.
                │                  └─
                │ sret
                ▼
            U-mode user code (perhaps a different app)` },
          ],
        },
        {
          title: "TaskContext: 14 × usize",
          blocks: [
            { type: "code", language: "rust", code:
`#[derive(Copy, Clone)]
#[repr(C)]
pub struct TaskContext {
    ra: usize,       // +0   where __switch will ret to next time
    sp: usize,       // +8   this task's kernel stack pointer
    s: [usize; 12],  // +16 .. +104   s0 .. s11
}
// sizeof = 14 * 8 = 112 bytes` },
            { type: "paragraph", text: "Why just ra, sp, s0..s11? Because __switch is *called* from Rust through the normal calling convention. The RISC-V ABI specifies that caller-saved registers (t0-t6, a0-a7, ft0-ft11) are preserved by the caller. The compiler has already spilled the values it still cares about — __switch need not touch them." },
            { type: "callout", variant: "warning", text: "This is the mirror image of TrapContext's \"save everything\": a trap is asynchronous, no one spills caller-saved for you. __switch is a function you call — the compiler helps. Hence the asymmetry." },
          ],
        },
        {
          title: "Comparison table",
          blocks: [
            { type: "table", headers: ["Aspect", "TrapContext", "TaskContext"], rows: [
              ["Size", "34 × 8 = 272 bytes", "14 × 8 = 112 bytes"],
              ["Boundary", "U-mode ⇄ S-mode (privilege)", "kernel A ⇄ kernel B (language)"],
              ["Trigger", "hardware trap (async, any insn)", "explicit __switch() call"],
              ["Saver", "__alltraps asm (hw-driven)", "__switch asm (call-driven)"],
              ["Register set", "x0-x31 + sstatus + sepc", "ra + sp + s0-s11 (callee-saved)"],
              ["Caller-saved skipped?", "— (must save all)", "Rust caller already spilled"],
              ["Lives where", "on the task's kernel stack", "inside the TCB"],
              ["Built first by", "loader::init_app_cx()", "TaskContext::goto_restore()"],
            ]},
          ],
        },
        {
          title: "goto_restore: point ra at __restore",
          blocks: [
            { type: "paragraph", text: "How do we initialize a never-run task's TaskContext? Trick: make the scheduler's first __switch ret into the assembly routine __restore. __restore then pops the fake TrapContext we pre-built on the kernel stack and sret's to U-mode." },
            { type: "code", language: "rust", code:
`impl TaskContext {
    pub fn goto_restore(kstack_ptr: usize) -> Self {
        extern "C" { fn __restore(); }
        Self {
            ra: __restore as usize,   // first insn after __switch returns
            sp: kstack_ptr,           // kernel stack top: TrapContext lives there
            s:  [0; 12],
        }
    }
}` },
            { type: "callout", variant: "tip", text: "At boot, loader builds a TrapContext at the top of each kernel stack (via push_context) and returns that pointer to goto_restore. The chain is: __switch → ret → __restore → sret → user program. Phase 2's cold start path is exactly this chain." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-context", title: "Lab 1b ⭐⭐ TaskContext + goto_restore",
          description: "Complete task/context.rs: define the 14-word struct and write zero_init() + goto_restore(kstack_ptr).",
          labFile: "labs/phase_2_proc/src/task/context.rs",
          hints: [
            "#[repr(C)] is mandatory — switch.S hard-codes offsets 0/8/16/...",
            "extern \"C\" { fn __restore(); } gets the asm symbol address",
            "zero_init() returns all zeros — used for UnInit slots",
            "goto_restore sets only ra and sp, leaves s[0..12] = 0",
          ],
          pseudocode:
`#[repr(C)]
#[derive(Copy, Clone)]
pub struct TaskContext { ra: usize, sp: usize, s: [usize; 12] }

impl TaskContext {
    pub fn zero_init() -> Self { Self { ra: 0, sp: 0, s: [0; 12] } }
    pub fn goto_restore(kstack_ptr: usize) -> Self {
        extern "C" { fn __restore(); }
        Self { ra: __restore as usize, sp: kstack_ptr, s: [0; 12] }
    }
}`,
        },
      ],
      acceptanceCriteria: [
        "sizeof::<TaskContext>() == 112",
        "You can answer \"why don't we save t0-t6 and a0-a7\"",
        "You can draw the TrapContext vs TaskContext table",
      ],
      references: [
        { title: "RISC-V Calling Convention", description: "[Required] Caller- vs callee-saved registers, authoritative", url: "https://riscv.org/wp-content/uploads/2015/01/riscv-calling.pdf" },
        { title: "rCore-Tutorial §3.2", description: "[Required] Task switching and TaskContext, walked line by line", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/2task-switching.html" },
        { title: "xv6-riscv kernel/proc.h", description: "[Deep dive] Cross-check against the C struct context", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/proc.h" },
      ],
    },

    // ── Lesson 3 ──────────────────────────────────────────
    {
      phaseId: 2, lessonId: 3,
      title: "__switch: 29 instructions of magic",
      subtitle: "sd / ld / ret — the heart of multitasking",
      type: "Practice",
      duration: "2 hours",
      objectives: [
        "Write every instruction of switch.S from memory",
        "Explain why the final ret ends up in a *different* task",
        "Know why this must be asm, not Rust",
        "Use gdb to watch ra/sp flip across the call",
      ],
      sections: [
        {
          title: "__switch's signature",
          blocks: [
            { type: "code", language: "rust", code:
`extern "C" {
    pub fn __switch(
        current_task_cx_ptr: *mut TaskContext,   // a0
        next_task_cx_ptr:    *const TaskContext, // a1
    );
}` },
            { type: "paragraph", text: "a0 = \"save to here\" (current task's TaskContext pointer); a1 = \"load from here\" (next task's TaskContext pointer). Per RISC-V C ABI, the first two pointer arguments land in a0 and a1, so asm reads them directly." },
          ],
        },
        {
          title: "Register snapshot: before / after",
          blocks: [
            { type: "diagram", content:
`Before __switch(&A.cx, &B.cx):

  ┌── CPU ──────────────┐    ┌── mem A.cx ───┐   ┌── mem B.cx ───┐
  │ ra   = return_to_A  │    │ ra   = ???    │   │ ra   = __restore │
  │ sp   = A_kstack_top │    │ sp   = ???    │   │ sp   = B_kstack  │
  │ s0   = A_s0         │    │ s0   = ???    │   │ s0   = B_s0_old  │
  │  ...                │    │  ...          │   │  ...             │
  └─────────────────────┘    └───────────────┘   └──────────────────┘

After 14 sd → A.cx, 14 ld ← B.cx:

  ┌── CPU ──────────────┐    ┌── mem A.cx ───┐   ┌── mem B.cx ───┐
  │ ra   = __restore    │    │ ra = return_to_A │ │ ra   = __restore │
  │ sp   = B_kstack     │    │ sp = A_kstack  │  │ sp   = B_kstack  │
  │ s0   = B_s0_old     │    │ s0 = A_s0      │  │ s0   = B_s0_old  │
  │  ...                │    │  ...           │  │  ...             │
  └─────────────────────┘    └────────────────┘  └──────────────────┘

Final ret = jr ra — jumps into __restore, on B's stack, now running B.` },
          ],
        },
        {
          title: "switch.S in full",
          blocks: [
            { type: "code", language: "asm", code:
`    .section .text
    .globl __switch
__switch:
    # a0 = &mut current_task_cx
    # a1 = &next_task_cx
    sd   ra,  0*8(a0)
    sd   sp,  1*8(a0)
    sd   s0,  2*8(a0)
    sd   s1,  3*8(a0)
    sd   s2,  4*8(a0)
    sd   s3,  5*8(a0)
    sd   s4,  6*8(a0)
    sd   s5,  7*8(a0)
    sd   s6,  8*8(a0)
    sd   s7,  9*8(a0)
    sd   s8, 10*8(a0)
    sd   s9, 11*8(a0)
    sd   s10,12*8(a0)
    sd   s11,13*8(a0)

    ld   ra,  0*8(a1)
    ld   sp,  1*8(a1)
    ld   s0,  2*8(a1)
    ld   s1,  3*8(a1)
    ld   s2,  4*8(a1)
    ld   s3,  5*8(a1)
    ld   s4,  6*8(a1)
    ld   s5,  7*8(a1)
    ld   s6,  8*8(a1)
    ld   s7,  9*8(a1)
    ld   s8, 10*8(a1)
    ld   s9, 11*8(a1)
    ld   s10,12*8(a1)
    ld   s11,13*8(a1)

    ret
` },
            { type: "callout", variant: "info", text: "14 sd + 14 ld + 1 ret = 29 instructions. That final ret = jr ra — but we *just* replaced ra and sp wholesale, so this \"return\" actually jumps into another task's stack and PC. The whole magic of multitasking compresses into that one ret." },
          ],
        },
        {
          title: "Why not Rust?",
          blocks: [
            { type: "paragraph", text: "Surely \"read/write ra/sp in Rust\" should work? It does not. Rust functions have prologues/epilogues: the compiler pushes ra on entry, allocates a frame, and restores both on exit. You cannot precisely control the moment \"ra is still old, sp is still old, store it all now\" — any reorder and the stack is torn in half." },
            { type: "callout", variant: "warning", text: "So __switch must be pure asm with no Rust mixed in. Naked functions (no prologue) are still unstable in Rust; a .S file is the pragmatic choice." },
          ],
        },
        {
          title: "Common mistakes",
          blocks: [
            { type: "list", ordered: true, items: [
              "Wrong offset: ra is field 0, not sp — the first ld crashes the new task.",
              "Swapping a0/a1 on sd/ld: you overwrite the *next* task with current's state.",
              "Forgetting to save ra: next resume has no return address — jumps to null.",
              "Saving caller-saved registers (t0-t6) too: wastes memory and risks missing one — creates intermittent data races, painful to debug.",
              "Forgetting ret: control falls into whatever function follows in the .text section — symptom is \"PC mysteriously lands in some unrelated symbol\".",
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-switch", title: "Lab 1c ⭐⭐ switch.S",
          description: "Write the 29 instructions in task/switch.S. Together with Lab 1b's goto_restore, the first __switch should deliver control to __restore.",
          labFile: "labs/phase_2_proc/src/task/switch.S",
          hints: [
            "Struct offsets: ra=0, sp=8, s0=16, s1=24, ..., s11=104",
            "sd/ld immediates must be multiples of 8",
            "Don't forget .globl __switch",
            "In gdb: b __switch, then stepi to watch each instruction",
          ],
          pseudocode:
`.section .text
.globl __switch
__switch:
    # save current (a0)
    sd ra,  0*8(a0)
    sd sp,  1*8(a0)
    .set n, 0
    .rept 12
        sd s\\n, (2+n)*8(a0)
        .set n, n+1
    .endr
    # load next (a1)
    ld ra,  0*8(a1)
    ld sp,  1*8(a1)
    ...
    ret`,
        },
      ],
      acceptanceCriteria: [
        "In gdb, single-stepping shows ra/sp stored via a0 then loaded from a1",
        "After ret, PC lands in __restore (first time) or the last suspension point",
        "After Lab 1, make qemu runs at least the first app",
      ],
      references: [
        { title: "rCore-Tutorial §3.2.2", description: "[Required] __switch walked line by line", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/2task-switching.html" },
        { title: "xv6-riscv kernel/swtch.S", description: "[Required] The C world's swtch — nearly identical structure", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/swtch.S" },
        { title: "RISC-V Unprivileged ISA", description: "[Deep dive] Formal semantics of sd/ld/jalr/ret", url: "https://riscv.org/technical/specifications/" },
      ],
    },

    // ── Lesson 4 ──────────────────────────────────────────
    {
      phaseId: 2, lessonId: 4,
      title: "The Round-Robin scheduler",
      subtitle: "run_first_task / find_next_task / run_next_task",
      type: "Practice",
      duration: "2 hours",
      objectives: [
        "Implement the three core methods of TaskManager",
        "Understand why calling __switch while holding the lock deadlocks",
        "Master the cooperative control flow (sys_yield / sys_exit)",
        "Observe A/B/C interleaved output in gdb",
      ],
      sections: [
        {
          title: "TaskManager's skeleton",
          blocks: [
            { type: "code", language: "rust", code:
`pub struct TaskManager {
    num_app: usize,
    inner: UPSafeCell<TaskManagerInner>,
}

pub struct TaskManagerInner {
    tasks: [TaskControlBlock; MAX_APP_NUM],
    current_task: usize,
}

lazy_static! {
    pub static ref TASK_MANAGER: TaskManager = {
        let num_app = loader::get_num_app();
        let mut tasks = [TCB { task_cx: TaskContext::zero_init(),
                               task_status: TaskStatus::UnInit };
                         MAX_APP_NUM];
        for i in 0..num_app {
            tasks[i].task_cx = TaskContext::goto_restore(loader::init_app_cx(i));
            tasks[i].task_status = TaskStatus::Ready;
        }
        TaskManager { num_app, inner: UPSafeCell::new(TaskManagerInner {
            tasks, current_task: 0,
        })}
    };
}` },
            { type: "paragraph", text: "UPSafeCell is our single-core \"fake mutex\" from Phase 1 — wraps a RefCell and panics on reentrant borrow rather than blocking. Phase 3 swaps it for a real SpinLock." },
          ],
        },
        {
          title: "The three core methods",
          blocks: [
            { type: "code", language: "rust", code:
`impl TaskManager {
    // never returns — called once by rust_main to open multitasking world
    fn run_first_task(&self) -> ! {
        let mut inner = self.inner.exclusive_access();
        let task0 = &mut inner.tasks[0];
        task0.task_status = TaskStatus::Running;
        let next_cx_ptr = &task0.task_cx as *const TaskContext;
        drop(inner);                              // release BEFORE switch
        let mut unused = TaskContext::zero_init();
        unsafe { __switch(&mut unused, next_cx_ptr); }
        unreachable!("after __switch to first task")
    }

    // Round-robin scan
    fn find_next_task(&self) -> Option<usize> {
        let inner = self.inner.exclusive_access();
        let cur = inner.current_task;
        (cur + 1 .. cur + self.num_app + 1)
            .map(|i| i % self.num_app)
            .find(|&i| inner.tasks[i].task_status == TaskStatus::Ready)
    }

    // suspend / yield / timer all funnel here
    fn run_next_task(&self) {
        if let Some(next) = self.find_next_task() {
            let mut inner = self.inner.exclusive_access();
            let cur = inner.current_task;
            inner.tasks[next].task_status = TaskStatus::Running;
            inner.current_task = next;
            let cur_cx_ptr  = &mut inner.tasks[cur].task_cx  as *mut  TaskContext;
            let next_cx_ptr = &    inner.tasks[next].task_cx as *const TaskContext;
            drop(inner);                          // release BEFORE switch
            unsafe { __switch(cur_cx_ptr, next_cx_ptr); }
        } else {
            println!("[kernel] All apps finished!");
            shutdown(false);
        }
    }
}` },
          ],
        },
        {
          title: "Round-Robin in motion",
          blocks: [
            { type: "diagram", content:
`time ───────────────────────────────────────────────────────►
task A  R R R -  -   -  R R  -    -    -     (yield)
task B  -  - R R  -  -    R R  -  -    -     (yield)
task C  -  - -  - R R  -   -  R R  -          (timer)

        ↑   ↑    ↑   ↑    ↑   ↑   ↑   ↑   ↑
        │   │    │   │    │   │   │   │   └─ C exit
        │   │    │   │    │   │   │   └─── C preempted
        │   │    │   │    │   │   └─── B yield
        │   │    │   │    │   └─── A yield
        │   │    │   │    └─── B yield
        │   │    │   └─── A yield
        │   │    └─── C preempted
        │   └─── B yield
        └─── A yield  (cooperative)` },
            { type: "paragraph", text: "run_first_task kicks off A; A's sys_yield triggers run_next_task → find_next_task returns B → __switch to B; and so on. Lab 3's timer interrupt wedges the same run_next_task in unconditionally — tasks can't tell the difference." },
          ],
        },
        {
          title: "The #1 bug: holding the lock across __switch",
          blocks: [
            { type: "callout", variant: "warning", text: "You absolutely must drop(inner) before __switch. Picture A holding the RefMut crossing into B; moments later B calls sys_yield → run_next_task → exclusive_access() — panic in UPSafeCell (single-core) or deadlock in a real SpinLock (Phase 3). Either way, instant bug." },
            { type: "code", language: "rust", code:
`// ✘ wrong
let mut inner = self.inner.exclusive_access();
...
unsafe { __switch(cur_cx_ptr, next_cx_ptr); }  // lock still held!
// B's run_next_task will see \"RefCell already borrowed\"` },
          ],
        },
        {
          title: "Common mistakes",
          blocks: [
            { type: "list", ordered: true, items: [
              "Forgetting drop(inner): next task's yield sees a borrow conflict.",
              "Swapping current/next direction: current is *mut (we save into it); next is *const (we load from it).",
              "run_first_task isn't -> !: rustc forces a return value after __switch, which looks awkward and signals the signature is wrong.",
              "Marking an Exited task as Ready by mistake: find_next_task will forever pick a dead task.",
              "Hard-coding MAX_APP_NUM smaller than the real app count: loader silently truncates — grade.py will notice you skipped one.",
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab2-manager", title: "Lab 2 ⭐⭐⭐ TaskManager",
          description: "In task/mod.rs implement run_first_task / find_next_task / run_next_task plus the public wrappers suspend_current_and_run_next / exit_current_and_run_next.",
          labFile: "labs/phase_2_proc/src/task/mod.rs",
          hints: [
            "Every call to __switch must be preceded by drop(inner)",
            "(cur+1..cur+num_app+1).map(|i| i%num_app) avoids a fiddly for loop",
            "suspend: Running → Ready; exit: Running → Exited",
            "The unused variable in run_first_task is a throwaway TaskContext — we switch out and never back",
          ],
          pseudocode:
`pub fn suspend_current_and_run_next() {
    TASK_MANAGER.mark_current_suspended();
    TASK_MANAGER.run_next_task();
}
pub fn exit_current_and_run_next() {
    TASK_MANAGER.mark_current_exited();
    TASK_MANAGER.run_next_task();
}`,
        },
      ],
      acceptanceCriteria: [
        "make qemu shows A/B interleaved output — cooperative yield works",
        "After all apps finish, the kernel prints 'All apps finished!' and shuts down",
        "In gdb, the lock is observably released (borrow count zero) before __switch",
      ],
      references: [
        { title: "OSTEP Ch.7 Scheduling: Introduction", description: "[Required] Round-robin vs SJF/STCF", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf" },
        { title: "xv6-riscv book Ch.7 §7.3", description: "[Required] Structure of scheduler() in C", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial §3.3", description: "[Deep dive] Managing multiple programs with TaskManager", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/3multiprogramming.html" },
      ],
    },

    // ── Lesson 5 ──────────────────────────────────────────
    {
      phaseId: 2, lessonId: 5,
      title: "Timer interrupts & preemption",
      subtitle: "sbi_set_timer + sie.STIE + sstatus.SIE",
      type: "Practice",
      duration: "2 hours",
      objectives: [
        "Understand the mtime/mtimecmp model and SBI's role",
        "Configure sie.STIE + sstatus.SIE to actually receive S-timer interrupts",
        "Implement set_next_trigger and the SupervisorTimer trap arm",
        "Watch app_timer (which never yields) being preempted — proof of preemption",
      ],
      sections: [
        {
          title: "The timing trio",
          blocks: [
            { type: "diagram", content:
`Machine mode (OpenSBI firmware, invisible to us)
  ┌─────────────────────────────────────────────┐
  │ mtime      — 64-bit free-running counter    │
  │ mtimecmp   — per-hart comparator (MMIO)     │
  │ if mtime >= mtimecmp:                       │
  │     raise M-mode timer interrupt            │
  │     SBI promotes it to S-mode SupervisorTimer│
  └─────────────────────────────────────────────┘
                       │
                       │ ecall from S (opcode 0x00, fid 0)
                       ▲
Supervisor mode (our kernel)
  ┌─────────────────────────────────────────────┐
  │ sbi::set_timer(deadline) ──► program mtimecmp│
  │ trap_handler SupervisorTimer arm:            │
  │   1) set_next_trigger()  re-arm              │
  │   2) suspend_current_and_run_next()  switch  │
  └─────────────────────────────────────────────┘` },
            { type: "paragraph", text: "mtime and mtimecmp are M-mode-only MMIO — in S-mode we must trip through SBI. OpenSBI provides the standard sbi_set_timer(stime_value) call, which underneath updates mtimecmp and clears mip.STIP." },
          ],
        },
        {
          title: "The three enable bits",
          blocks: [
            { type: "table", headers: ["Bit", "Where", "Role", "When to set"], rows: [
              ["sie.STIE (bit 5)", "sie CSR", "Allow S-mode timer IRQs to reach CPU", "Once at boot, trap::enable_timer_interrupt()"],
              ["sstatus.SIE (bit 1)", "sstatus CSR", "Global S-mode interrupt enable (0 masks everything)", "Indirectly on return to U-mode via SPIE←1"],
              ["sstatus.SPIE (bit 5)", "sstatus CSR", "Becomes SIE after sret — set in TrapContext", "In app_init_context()"],
              ["sie.SEIE / SSIE", "sie CSR", "S-mode external / software IRQs — ignore in Phase 2", "Later phases"],
            ]},
            { type: "code", language: "rust", code:
`pub fn enable_timer_interrupt() {
    unsafe { sie::set_stimer(); }    // sie.STIE = 1
}

// Inside app_init_context:
let mut sstatus = sstatus::read();
sstatus.set_spp(SPP::User);
sstatus.set_spie(true);              // ← Phase 2 new line
                                     //   sret will copy SPIE → SIE` },
            { type: "callout", variant: "warning", text: "The relationship is the classic pitfall: stie gates \"this one interrupt line\"; sie is the S-mode global \"am I interruptible\" flag. Both must be 1 for the interrupt to actually fire. Pending in sepc but sie=0 — the IRQ sits in mip until sret's SPIE→SIE lets it through." },
          ],
        },
        {
          title: "Two functions in timer.rs",
          blocks: [
            { type: "code", language: "rust", code:
`use riscv::register::time;
use crate::sbi::set_timer;
use crate::config::CLOCK_FREQ;

pub const TICKS_PER_SEC: usize = 100;     // 10 ms slice

pub fn get_time() -> usize { time::read() }

pub fn set_next_trigger() {
    let next = get_time() + CLOCK_FREQ / TICKS_PER_SEC;
    set_timer(next as u64);               // tell SBI the next deadline
}` },
            { type: "paragraph", text: "set_timer takes an absolute mtime value (a deadline), NOT an interval. This is the single most common bug — writing set_timer(CLOCK_FREQ/TICKS_PER_SEC) fires exactly once 10 ms after boot and then never again." },
          ],
        },
        {
          title: "The new trap arm",
          blocks: [
            { type: "code", language: "rust", code:
`#[no_mangle]
pub fn trap_handler(cx: &mut TrapContext) -> &mut TrapContext {
    let scause = scause::read();
    let stval  = stval::read();
    match scause.cause() {
        Trap::Exception(Exception::UserEnvCall) => {
            cx.sepc += 4;
            cx.x[10] = syscall(cx.x[17], [cx.x[10], cx.x[11], cx.x[12]]) as usize;
        }
        Trap::Interrupt(Interrupt::SupervisorTimer) => {  // ★ new arm
            crate::timer::set_next_trigger();             //   1) re-arm
            crate::task::suspend_current_and_run_next();  //   2) switch
        }
        _ => panic!("unsupported trap {:?}, stval={:#x}", scause.cause(), stval),
    }
    cx
}` },
            { type: "callout", variant: "info", text: "set_next_trigger must come first — if you switch tasks first then re-arm, the switched-to task may never touch this code path again (it could be a user loop that never traps), and preemption stops." },
          ],
        },
        {
          title: "cooperative vs preemptive",
          blocks: [
            { type: "table", headers: ["Aspect", "Cooperative (Lab 2)", "Preemptive (Lab 3)"], rows: [
              ["Trigger", "app calls sys_yield / sys_exit", "HW timer IRQ (every 10 ms)"],
              ["Can an app hog CPU?", "yes — infinite loop starves others", "no — yanked on next tick"],
              ["Kernel work required", "TaskManager + syscall dispatch", "+ timer.rs + SupervisorTimer arm + sie/sstatus config"],
              ["Who uses it in the wild", "Windows 3.x / early Mac OS", "every modern kernel (Linux/NT/xv6)"],
              ["Fairness", "relies on app courtesy", "worst case 1 slice behind"],
              ["Realtime bounds", "unbounded", "bounded by slice length"],
            ]},
          ],
        },
        {
          title: "Common mistakes",
          blocks: [
            { type: "list", ordered: true, items: [
              "Passing an interval to set_timer: it's mtimecmp (absolute), not \"fire in Δt\" — one shot and done.",
              "Forgetting to re-arm inside the ISR: mtime eventually passes mtimecmp but we never updated mtimecmp — no more preemption.",
              "Setting sie.STIE but leaving SPIE=0 in TrapContext: sret returns to user with SIE=0 — IRQ stays pending, never delivered.",
              "SupervisorTimer arm calls suspend without set_next_trigger: same symptom — exactly one preemption.",
              "Passing set_timer an i64 that went negative: SBI sees a deadline in the past — IRQ storms, CPU pinned in the ISR.",
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab3-timer", title: "Lab 3a ⭐ timer.rs",
          description: "Implement get_time and set_next_trigger. CLOCK_FREQ lives in config.rs; QEMU virt reports 10_000_000.",
          labFile: "labs/phase_2_proc/src/timer.rs",
          hints: [
            "riscv::register::time::read() reads mtime",
            "set_timer comes from crate::sbi — an ecall wrapper",
            "deadline = now + CLOCK_FREQ / TICKS_PER_SEC",
          ],
          pseudocode:
`pub fn set_next_trigger() {
    let next = get_time() + CLOCK_FREQ / TICKS_PER_SEC;
    set_timer(next as u64);
}`,
        },
        {
          id: "lab3-trap", title: "Lab 3b ⭐⭐ SupervisorTimer arm",
          description: "In trap/mod.rs, replace the todo!() in the match with re-arm + suspend.",
          labFile: "labs/phase_2_proc/src/trap/mod.rs",
          hints: [
            "Trap::Interrupt(Interrupt::SupervisorTimer)",
            "Order matters: set_next_trigger first, then suspend",
            "In rust_main don't forget trap::enable_timer_interrupt() and timer::set_next_trigger()",
          ],
          pseudocode:
`Trap::Interrupt(Interrupt::SupervisorTimer) => {
    crate::timer::set_next_trigger();
    crate::task::suspend_current_and_run_next();
}`,
        },
      ],
      acceptanceCriteria: [
        "make qemu shows app_timer (the never-yielding app) being switched in and out — preemption confirmed",
        "All three apps print [X done]",
        "scripts/grade.py reports full marks",
      ],
      references: [
        { title: "RISC-V Privileged Spec §3.1.6 & §3.1.9", description: "[Required] sie / sstatus bit layouts and IRQ delivery rules", url: "https://github.com/riscv/riscv-isa-manual/releases" },
        { title: "RISC-V SBI Specification v1.0", description: "[Required] Authoritative semantics of set_timer", url: "https://github.com/riscv-non-isa/riscv-sbi-doc" },
        { title: "OSTEP Ch.8 MLFQ", description: "[Deep dive] Beyond round-robin: multi-level feedback queue", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf" },
        { title: "rCore-Tutorial §3.4", description: "[Deep dive] Preemptive scheduling — Chinese companion text", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/4time-sharing-system.html" },
      ],
    },
  ],
};
