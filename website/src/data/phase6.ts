import type { PhaseContent } from "./types";

// ─── Phase 6: Shell, Pipes & User Programs (zh-CN) ──────────────────

export const phase6ZhCN: PhaseContent = {
  phaseId: 6,
  color: "#DB2777",
  accent: "#F472B6",
  lessons: [
    // ── Lesson 1 ─────────────────────────────────────────────
    {
      phaseId: 6, lessonId: 1,
      title: "fork / exec / waitpid：进程三件套",
      subtitle: "用户态进程的诞生、蜕变与回收",
      type: "Concept",
      duration: "2 hours",
      objectives: [
        "理解 fork 如何克隆 TCB 并让一次系统调用返回两个值",
        "搞清 exec 如何在保留 PCB 身份的前提下替换整个地址空间",
        "掌握 waitpid 的三态返回与僵尸进程回收时机",
        "能解释为什么 Unix 选择 fork+exec 而不是单一的 spawn",
      ],
      sections: [
        {
          title: "一次 syscall，两个返回值",
          blocks: [
            { type: "paragraph", text: "fork 是 Unix 最有灵性的设计：同一条 ecall，父进程拿到子进程的 pid（正数），子进程拿到 0。这种双返回值不是语言特性——它是我们手动把子进程 TrapContext 中的 x[10]（即 a0）写成 0 的结果。当调度器将来 __restore 子进程时，sret 把 0 装进用户寄存器 a0，于是 C 代码里的 if (pid == 0) 分支就自然分流了。" },
            { type: "diagram", content:
`  fork 之前                       fork 之后
  ┌────────────┐                 ┌────────────┐   ┌────────────┐
  │ parent PCB │                 │ parent PCB │   │  child PCB │
  │ pid = 7    │     ══════▶    │ pid = 7    │   │  pid = 8   │
  │ a0 = ?     │                 │ a0 = 8     │   │  a0 = 0    │  ← 手动改
  │ memory A   │                 │ memory A   │   │  memory A' │  ← 全量拷贝
  │ fd[0..3]   │                 │ fd[0..3]   │   │  fd[0..3]  │  ← Arc::clone
  └────────────┘                 └────────────┘   └────────────┘
                                              ↑
                                   两者共享同一个 File trait object
                                   的引用计数——这是管道能工作的根基` },
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/task/fork.rs
pub fn sys_fork() -> isize {
    let parent = current_task().unwrap();
    let child  = parent.fork();                    // 深拷贝 memory_set，Arc::clone fd_table
    let trap_cx = child.inner_exclusive_access().get_trap_cx();
    trap_cx.x[10] = 0;                              // ★ 子进程 a0 = 0
    let new_pid = child.pid.0 as isize;
    add_task(child);                                // 入就绪队列
    new_pid                                         // 父进程 a0 = 子 pid
}` },
            { type: "callout", variant: "info", text: "这就是著名的 Unix \"一次系统调用返回两次\" 的魔法。硬件根本不知道有这回事——秘密全藏在调度器 __restore 之前那一次 trap_cx.x[10] = 0 的赋值。" },
          ],
        },
        {
          title: "Copy-on-write：本项目不做，但必须懂",
          blocks: [
            { type: "paragraph", text: "本教学内核在 fork 时做完整的物理帧复制（MemorySet::from_existed_user）。如果父进程紧接着 exec，那些复制出来的帧立刻被丢弃——纯粹的浪费。真实的 Linux 用 COW：子进程继承父进程的页表，所有可写页临时改成只读；任一方写入触发缺页异常，内核才懒惰地分配新帧并拷贝。" },
            { type: "table", headers: ["方案", "fork 时开销", "exec 后开销", "实现复杂度"], rows: [
              ["完整拷贝（本项目）", "O(memory_size)", "丢弃并重建", "最简单"],
              ["Copy-on-write", "O(page_count)（只标只读）", "几乎无浪费", "需要写时缺页路径 + 引用计数帧"],
              ["vfork / posix_spawn", "不拷贝，父阻塞", "子必须立刻 exec", "API 约束很强"],
            ]},
            { type: "callout", variant: "tip", text: "Phase 4 你已经有了 MapArea 和 PageTable——想给项目升级 COW 是很好的扩展练习，但会跟 Phase 3 的锁交互变复杂。建议做完 Phase 6 再回头加。" },
          ],
        },
        {
          title: "exec：身份保留，灵魂替换",
          blocks: [
            { type: "diagram", content:
`  before exec("sh")           after exec("sh")
  ┌────────────┐              ┌────────────┐
  │ memory_set │  ── drop ──▶ │ memory_set │   ← 新 ELF 的 segments
  │ (old prog) │              │ (sh prog)  │
  ├────────────┤              ├────────────┤
  │ fd_table   │  ── keep ──▶ │ fd_table   │   ← 保留！这是重定向能跨
  ├────────────┤              ├────────────┤       过 exec 的关键
  │ pid, ppid  │  ── keep ──▶ │ pid, ppid  │
  │ children[] │  ── keep ──▶ │ children[] │
  └────────────┘              └────────────┘` },
            { type: "paragraph", text: "exec 解析 ELF，用 MemorySet::from_elf 构造新地址空间，直接赋值给 inner.memory_set——Rust RAII 会把老的一整套帧释放。然后用 TrapContext::app_init_context 在新用户栈顶写一个干净的 TrapContext，让 __restore 把用户寄存器全清零，从 ELF entry 开始执行。" },
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/task/exec.rs
pub fn exec(&self, elf_data: &[u8], args: Vec<String>) {
    let (memory_set, mut user_sp, entry) = MemorySet::from_elf(elf_data);
    let trap_cx_ppn = memory_set.translate(TRAP_CONTEXT.into())
        .unwrap().ppn();
    // 把 argv 拷到用户栈顶（按 RISC-V ABI）
    user_sp = push_args_to_stack(&mut user_sp, &args, &memory_set);
    let mut inner = self.inner_exclusive_access();
    inner.memory_set = memory_set;             // 老 MemorySet 在此 drop
    inner.trap_cx_ppn = trap_cx_ppn;
    *inner.get_trap_cx() = TrapContext::app_init_context(
        entry, user_sp,
        KERNEL_SPACE.exclusive_access().token(),
        self.kernel_stack.get_top(),
        trap_handler as usize,
    );
    // fd_table 完全不动——这是 redirection 的灵魂
}` },
          ],
        },
        {
          title: "waitpid：僵尸回收的三态协议",
          blocks: [
            { type: "paragraph", text: "exit(code) 不能立刻释放 TCB——父进程可能想读取退出码。我们把子进程标记为 Zombie，保留一个只含 exit_code 的轻量 PCB。waitpid 来找它、拿走 exit_code、从父的 children 列表里摘掉，此时引用计数归零，TCB 才真正消失。" },
            { type: "table", headers: ["情况", "返回值", "含义"], rows: [
              ["无任何匹配子进程", "-1", "参数错或子进程早就不存在"],
              ["有匹配子进程但都还在跑", "-2", "用户态自己 sys_yield 后重试"],
              ["找到一个僵尸", "pid", "exit_code 写入 *status，子 PCB 被回收"],
            ]},
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/task/waitpid.rs
pub fn sys_waitpid(pid: isize, exit_code_ptr: *mut i32) -> isize {
    let task = current_task().unwrap();
    let mut inner = task.inner_exclusive_access();
    if !inner.children.iter().any(|c| pid == -1 || c.pid.0 as isize == pid) {
        return -1;                              // 没这个孩子
    }
    let pos = inner.children.iter().position(|c| {
        c.inner_exclusive_access().is_zombie()
            && (pid == -1 || c.pid.0 as isize == pid)
    });
    if let Some(idx) = pos {
        let child = inner.children.remove(idx);
        let child_pid = child.pid.0 as isize;
        let exit_code = child.inner_exclusive_access().exit_code;
        // 把 exit_code 拷到用户空间
        *translated_refmut(inner.memory_set.token(), exit_code_ptr) = exit_code;
        child_pid                                // ← 返回 pid
    } else {
        -2                                       // ← 有孩子但还没退出
    }
}` },
            { type: "callout", variant: "warning", text: "init 进程（pid=0）必须在死循环里 waitpid(-1) 来收割所有孤儿——任何用户进程的父进程先死了，它的孩子会被重新挂到 init 名下。忘了这一步，系统跑一会就全是僵尸 PCB 占着物理页。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-fork", title: "Lab 1a ⭐⭐ 实现 sys_fork",
          description: "在 task/fork.rs 里实现 fork()：深拷贝 memory_set，Arc::clone fd_table，把子进程的 a0 改为 0，返回子 pid。",
          labFile: "labs/phase_6_shell/src/task/fork.rs",
          hints: [
            "MemorySet::from_existed_user(&parent.memory_set) 会帮你逐 MapArea 复制",
            "fd_table 是 Vec<Option<Arc<dyn File>>>——对每一项 .as_ref().map(Arc::clone) 即可",
            "★ 最容易漏的：child.trap_cx.x[10] = 0",
            "add_task(child) 必须在 trap_cx 修改之后",
          ],
          pseudocode:
`fn fork(parent) -> Arc<TaskControlBlock>:
    memory_set  = MemorySet::from_existed_user(&parent.memory_set)
    fd_table    = parent.fd_table.iter().map(clone_arc)
    pid         = pid_alloc()
    kernel_stack= KernelStack::new(pid)
    child       = TCB { pid, parent: Weak(parent), memory_set, fd_table, ... }
    # 关键一步
    child.get_trap_cx().x[10] = 0
    parent.children.push(Arc::clone(&child))
    return child`,
        },
        {
          id: "lab1-exec", title: "Lab 1b ⭐⭐ 实现 sys_exec",
          description: "读取路径，从 easy-fs 里找到 ELF，调 MemorySet::from_elf，替换 inner.memory_set。argv 按 RISC-V ABI 压到用户栈顶。",
          labFile: "labs/phase_6_shell/src/task/exec.rs",
          hints: [
            "先 translated_str 把用户态路径拷到内核缓冲区",
            "OSInode 的 read_all() 返回完整 ELF bytes",
            "argv 要先存指针数组，再在栈下方存字符串本身——entry 约定 a0=argc, a1=argv",
            "fd_table **不要** 重置",
          ],
          pseudocode:
`fn exec(path, argv) -> isize:
    elf = open(path)?.read_all()
    (memory_set, user_sp, entry) = MemorySet::from_elf(elf)
    user_sp = push_args(user_sp, argv)
    self.memory_set  = memory_set        # 老的自动 drop
    self.trap_cx_ppn = memory_set.translate(TRAP_CONTEXT).ppn()
    *self.get_trap_cx() = TrapContext::app_init_context(entry, user_sp, ...)
    # fd_table 保留
    return argv.len() as isize`,
        },
        {
          id: "lab1-waitpid", title: "Lab 1c ⭐⭐ 实现 sys_waitpid",
          description: "实现三态返回。记得清空子进程的 fd_table——否则 File Arc 永远不释放。",
          labFile: "labs/phase_6_shell/src/task/waitpid.rs",
          hints: [
            "children.iter().position(|c| c.is_zombie()) 找第一个僵尸",
            "translated_refmut 把 exit_code 写回用户空间",
            "★ 子进程 remove 之前先 fd_table.clear()，否则 inode / pipe 永不关闭",
          ],
        },
      ],
      acceptanceCriteria: [
        "fork()+waitpid() 循环 1000 次，内核内存不增长",
        "exec(\"nonexistent\") 正确返回 -1 而不是 panic",
        "子进程 exit 后，父进程立即 waitpid 拿到正确 exit_code",
        "init 进程能回收所有孤儿僵尸",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.zh-CN.md §6.1-6.3", description: "[必读] fork/exec/waitpid 三节完整讲解", url: "./labs/phase_6_shell/COURSE.zh-CN.md" },
        { title: "xv6-riscv book Ch. 1", description: "[必读] Unix 接口的经典讲解，fork+exec 的设计哲学", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "APUE Ch. 8 Process Control", description: "[深入阅读] POSIX 权威——waitpid 的 WNOHANG/WUNTRACED 完整语义", url: "https://www.apuebook.com/" },
        { title: "rCore-Tutorial §7.2 进程管理", description: "[深入阅读] 同样 Rust+RISC-V 的实现参照", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter7/" },
      ],
    },

    // ── Lesson 2 ─────────────────────────────────────────────
    {
      phaseId: 6, lessonId: 2,
      title: "文件描述符表 + dup + 重定向",
      subtitle: "一个 Vec<Option<Arc<dyn File>>> 撑起整个 IO 世界",
      type: "Concept + Practice",
      duration: "1.5 hours",
      objectives: [
        "理解每进程 fd 数组、全局 File trait object 两层映射的关系",
        "掌握 sys_dup / sys_dup2 的分配语义",
        "学会用 dup2+close 三步实现 shell 的 >、<、>>",
        "理解为什么 fd_table 必须能跨 exec 存活",
      ],
      sections: [
        {
          title: "三层映射：fd → File → inode/pipe",
          blocks: [
            { type: "diagram", content:
`  process A                 kernel                  device
  ┌────────────┐             ┌──────────────┐        ┌─────────┐
  │ fd_table   │             │ File trait   │        │ inode   │
  │ [0] Stdin  │────────────▶│  object      │──────▶ │ of /a.t │
  │ [1] ──────┐│             │  (OSInode)   │        └─────────┘
  │ [2] Stdout││             └──────────────┘
  │ [3] ──┐   ││             ┌──────────────┐        ┌─────────┐
  └───────│───││             │ Pipe read    │──┐     │ ring    │
          │   │└────────────▶│  end         │  │────▶│ buffer  │
          │   │              └──────────────┘  │     └─────────┘
          │   │              ┌──────────────┐  │
          │   └─────────────▶│ Pipe write   │──┘
          │                  │  end         │
          │                  └──────────────┘
  process B (fork of A)          ↑
  ┌────────────┐                 │ Arc::clone
  │ [0] Stdin  │─────────────────┘` },
            { type: "paragraph", text: "fd 本身只是个 usize 数组下标——它不是内核资源。真正的内核资源是 Arc<dyn File>：OSInode、Pipe、Stdin、Stdout 都实现 File trait，都通过 Arc 引用计数共享。fork 时每个 Arc::clone 一次，close 时 drop 一次——当引用计数归零，底层资源（缓冲区、inode 句柄）自动释放。" },
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/fs/fd_table.rs
pub trait File: Send + Sync {
    fn readable(&self) -> bool;
    fn writable(&self) -> bool;
    fn read (&self, buf: UserBuffer) -> usize;
    fn write(&self, buf: UserBuffer) -> usize;
}

pub struct FdTable {
    table: Vec<Option<Arc<dyn File>>>,    // None = 关闭的槽
}

impl FdTable {
    pub fn alloc(&mut self, file: Arc<dyn File>) -> usize {
        // 找最小的空槽；没有就扩展
        if let Some(i) = self.table.iter().position(|x| x.is_none()) {
            self.table[i] = Some(file);  i
        } else {
            self.table.push(Some(file));  self.table.len() - 1
        }
    }
}` },
            { type: "callout", variant: "info", text: "\"最小可用 fd\" 的分配规则不是随便定的——shell 依赖它。close(1) 之后下一个 dup 必然返回 1，这是重定向算法的基石。" },
          ],
        },
        {
          title: "sys_dup vs sys_dup2",
          blocks: [
            { type: "table", headers: ["syscall", "语义", "常见用途"], rows: [
              ["dup(fd)", "复制到最小空 fd，返回新 fd", "保存备份、占位"],
              ["dup2(src, dst)", "把 src 复制到 **指定** dst；如 dst 已开则先 close", "精确重定向"],
              ["close(fd)", "drop 该槽的 Arc", "释放资源"],
            ]},
            { type: "paragraph", text: "dup2 是 shell 的主力。语义读作 \"让 dst 指向 src 所指的 File\"——执行后 src 和 dst 是同一个 File 的两个别名，close 其中一个不影响另一个。" },
            { type: "code", language: "rust", code:
`pub fn sys_dup2(src: usize, dst: usize) -> isize {
    let task = current_task().unwrap();
    let mut inner = task.inner_exclusive_access();
    let Some(Some(file)) = inner.fd_table.get(src) else { return -1 };
    let file = Arc::clone(file);
    // 扩展到至少 dst+1 个槽
    while inner.fd_table.len() <= dst { inner.fd_table.push(None); }
    inner.fd_table[dst] = Some(file);        // 旧的自动 drop
    dst as isize
}` },
          ],
        },
        {
          title: "重定向三步走：`>`, `<`, `>>`",
          blocks: [
            { type: "paragraph", text: "shell 看到 cmd > out 时，在 fork 完、exec 前做三件事：打开文件拿到 fd_f、用 dup2(fd_f, 1) 让 1 号 fd 指向文件、close(fd_f) 去掉临时别名。exec 后保留的 fd_table 让新程序的 stdout 写入就直达文件。" },
            { type: "code", language: "rust", code:
`// 用户态 shell 代码片段
fn run_with_redir(cmd: &Command) {
    if sys_fork() == 0 {                              // 子进程
        if let Some(ref path) = cmd.stdout {
            let fd = sys_open(path, O_CREATE | O_WRONLY);
            sys_dup2(fd, 1);                          // 让 stdout 指向文件
            sys_close(fd);                            // 去掉多余别名
        }
        if let Some(ref path) = cmd.stdin {
            let fd = sys_open(path, O_RDONLY);
            sys_dup2(fd, 0);
            sys_close(fd);
        }
        sys_exec(&cmd.path, &cmd.args);              // fd_table 穿越 exec
        sys_exit(-1);                                 // exec 失败才到这
    }
}` },
            { type: "diagram", content:
`  执行 \`echo hi > out\` 的 fd_table 变化：

  fork 后：     [0]Stdin  [1]Stdout  [2]Stdout
  open "out": [0]Stdin  [1]Stdout  [2]Stdout  [3]File("out")
  dup2(3,1):  [0]Stdin  [1]File   [2]Stdout  [3]File("out")  ← 1 和 3 别名
  close(3):   [0]Stdin  [1]File   [2]Stdout  [3]None
  exec echo:  [0]Stdin  [1]File   [2]Stdout              ← echo 的 write(1,...)
                                                            直接落到 out` },
          ],
        },
      ],
      exercises: [
        {
          id: "lab2-fd", title: "Lab 2a ⭐ FdTable 基础",
          description: "实现 FdTable::alloc / close / get，保证最小可用槽语义。",
          labFile: "labs/phase_6_shell/src/fs/fd_table.rs",
          hints: [
            "new() 初始化 [Stdin, Stdout, Stdout] 三个默认项",
            "alloc 用 position(|x| x.is_none())",
            "close 就是 table[fd] = None",
          ],
        },
        {
          id: "lab2-dup", title: "Lab 2b ⭐⭐ sys_dup / sys_dup2",
          description: "实现两个 syscall。注意 dup2 需要能扩展 Vec 到指定大小。",
          labFile: "labs/phase_6_shell/src/task/mod.rs",
          hints: [
            "dup 直接转发给 fd_table.alloc(Arc::clone(file))",
            "dup2 的 src == dst 是合法的空操作，返回 dst",
            "dst 超出当前长度时 push None 填充",
          ],
          pseudocode:
`fn sys_dup2(src, dst):
    file = fd_table[src]?
    if src == dst: return dst
    while fd_table.len() <= dst: fd_table.push(None)
    fd_table[dst] = Some(Arc::clone(&file))     # 旧 Arc drop
    return dst`,
        },
      ],
      acceptanceCriteria: [
        "echo hello > /tmp/a 后 cat /tmp/a 得到 hello",
        "cmd < input.txt 能让 cmd 从文件读 stdin",
        "echo a >> log; echo b >> log 追加写两行",
        "1000 次 open+close 后 inode 引用计数不泄漏",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.zh-CN.md §6.4", description: "[必读] 文件描述符表本章完整讲解", url: "./labs/phase_6_shell/COURSE.zh-CN.md" },
        { title: "xv6-riscv book §1.3 & §8.1", description: "[必读] Unix fd 抽象与 dup 的设计", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "APUE Ch. 3 File I/O", description: "[深入阅读] dup/dup2/fcntl 的完整 POSIX 语义", url: "https://www.apuebook.com/" },
        { title: "man 2 dup2", description: "[速查] Linux 手册页", url: "https://man7.org/linux/man-pages/man2/dup.2.html" },
      ],
    },

    // ── Lesson 3 ─────────────────────────────────────────────
    {
      phaseId: 6, lessonId: 3,
      title: "Pipe：环形缓冲 + 引用计数",
      subtitle: "两个 Arc<Pipe> + 一个 Weak<> 换来完美的 EOF 语义",
      type: "Concept + Practice",
      duration: "2 hours",
      objectives: [
        "设计并实现固定大小的环形缓冲（head/tail + status 消歧）",
        "用 Arc<Mutex<PipeRingBuffer>> 在两端共享同一块环",
        "理解 Weak<> 如何实现 \"所有写端关闭时读端见 EOF\" 语义",
        "能在纸上逐步画出 read/write 交替的光标移动",
      ],
      sections: [
        {
          title: "两个 Arc，一块环",
          blocks: [
            { type: "paragraph", text: "pipe() 一次返回两个 fd：[0] 读端，[1] 写端。内核层面它们是两个不同的 Arc<Pipe>，但都持有指向同一个 PipeRingBuffer 的 Arc——读写操作都落到那块共享内存上。" },
            { type: "diagram", content:
`  read_end : Arc<Pipe> ──┐
                         ├─▶ Arc<Mutex<PipeRingBuffer>>
  write_end: Arc<Pipe> ──┘         │
                                   ▼
        ┌─────────────────────────────────┐
        │ buf: [u8; RING=2048]            │
        │ head: usize    (下一个读位置)   │
        │ tail: usize    (下一个写位置)   │
        │ status: Empty | Normal | Full   │
        │ write_end: Weak<Pipe>  ★        │
        └─────────────────────────────────┘` },
            { type: "callout", variant: "info", text: "Weak 是关键。ring 持有的是写端的 Weak——不增加引用计数。当最后一个写端 Arc drop 后，weak.upgrade() 返回 None，读端由此判断 EOF。如果用 Arc 会循环引用，没人会被释放。" },
          ],
        },
        {
          title: "环形缓冲：head == tail 的二义性",
          blocks: [
            { type: "paragraph", text: "环的经典难题：head 和 tail 相遇时，到底是空还是满？解决方案是加个 status 三态字段。每次读把 status 朝 Empty 推，每次写朝 Full 推。" },
            { type: "table", headers: ["status", "可读字节数", "可写字节数"], rows: [
              ["Empty", "0", "RING_SIZE"],
              ["Normal", "(tail - head + RING) % RING", "RING - 可读"],
              ["Full", "RING_SIZE", "0"],
            ]},
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/fs/pipe.rs
const RING_SIZE: usize = 2048;

pub struct PipeRingBuffer {
    buf: [u8; RING_SIZE],
    head: usize, tail: usize,
    status: RingStatus,
    write_end: Option<Weak<Pipe>>,         // ★ 不是 Arc
}

impl PipeRingBuffer {
    fn available_read(&self) -> usize {
        match self.status {
            RingStatus::Empty  => 0,
            RingStatus::Full   => RING_SIZE,
            RingStatus::Normal => (self.tail + RING_SIZE - self.head) % RING_SIZE,
        }
    }
    fn all_write_ends_closed(&self) -> bool {
        self.write_end.as_ref().unwrap().upgrade().is_none()
    }
}` },
            { type: "diagram", content:
`  RING=4 的演进（.=空，X=数据，H=head，T=tail）：

  初始        [. . . .]  H=0 T=0  Empty
  write 3B    [X X X .]  H=0 T=3  Normal   avail_read=3
  read  2B    [. . X .]  H=2 T=3  Normal   avail_read=1
  write 3B    [X X X X]  H=2 T=2  Full     avail_read=4 ← 绕回了
  read  4B    [. . . .]  H=2 T=2  Empty    avail_read=0` },
          ],
        },
        {
          title: "读写协程：忙轮询 or 睡眠",
          blocks: [
            { type: "paragraph", text: "本内核简化实现：没有条件变量，Pipe::read 在环为空但写端没关时主动 sys_yield()；Pipe::write 在环满时 yield。高性能实现要等 Phase 7/8 加了 WaitQueue 之后才换成睡眠。" },
            { type: "code", language: "rust", code:
`impl File for Pipe {
    fn read(&self, mut buf: UserBuffer) -> usize {
        assert!(self.readable);
        let mut read_size = 0usize;
        let want = buf.len();
        loop {
            let mut ring = self.buffer.lock();
            let n = ring.available_read();
            if n == 0 {
                if ring.all_write_ends_closed() { return read_size; }  // EOF
                drop(ring);                                             // ★ 先 drop 锁
                suspend_current_and_run_next();                         // yield
                continue;
            }
            // 拷贝 min(n, want-read_size) 字节
            for i in 0..n.min(want - read_size) {
                buf.write_byte(read_size, ring.read_byte());
                read_size += 1;
            }
            if read_size == want { return read_size; }
        }
    }
}` },
            { type: "callout", variant: "warning", text: "drop(ring) 在 suspend 之前是硬性要求——MutexGuard 横跨 schedule() 会让调度器永远拿不到锁，整个系统 hang 死。Phase 3 Lab 2c 已经踩过一次了。" },
          ],
        },
        {
          title: "EOF 的显微镜",
          blocks: [
            { type: "paragraph", text: "ls | wc -l：ls 写完、exit；此时环里还有数据，wc 可以继续读。关键是 wc 最后一次 read 读完所有数据后再进入 loop——此时 avail_read==0、all_write_ends_closed()==true，于是返回 read_size（可能为 0）。上层 read 见到 0 就认为文件结束。" },
            { type: "diagram", content:
`  t0:  ls 执行中                 pipe.write_end.strong_count = 2
                                 (shell 父 + ls 子)
  t1:  ls 写 "foo.txt\\nbar\\n"    ring 里 9 字节
  t2:  shell 父 drop(write_end)  strong_count = 1
  t3:  ls exit                   ls 的 fd_table 释放 → drop
                                 strong_count = 0
  t4:  wc read                   avail_read=9 → 拷出 9 字节
  t5:  wc read 又调              avail_read=0
                                 upgrade() = None → 返回 0 → EOF` },
          ],
        },
      ],
      exercises: [
        {
          id: "lab3-ring", title: "Lab 3a ⭐⭐ 环形缓冲",
          description: "实现 PipeRingBuffer 的 read_byte / write_byte / available_read / available_write。跑 test_ring_wrap 验证绕回正确。",
          labFile: "labs/phase_6_shell/src/fs/pipe.rs",
          hints: [
            "每次 read_byte：head = (head+1) % RING; 更新 status",
            "写满后 status=Full，再写要先 yield",
            "在纸上画 RING=4 跑完 Section 3 的示例，再对照代码",
          ],
          pseudocode:
`fn read_byte(&mut self) -> u8:
    assert!(self.status != Empty)
    byte = self.buf[self.head]
    self.head = (self.head + 1) % RING_SIZE
    self.status = if self.head == self.tail: Empty else Normal
    return byte

fn write_byte(&mut self, b: u8):
    assert!(self.status != Full)
    self.buf[self.tail] = b
    self.tail = (self.tail + 1) % RING_SIZE
    self.status = if self.tail == self.head: Full else Normal`,
        },
        {
          id: "lab3-pipe", title: "Lab 3b ⭐⭐⭐ Pipe::read/write + sys_pipe",
          description: "用 Arc<Mutex<PipeRingBuffer>> 串起读写两端；实现 sys_pipe 返回一对 fd。",
          labFile: "labs/phase_6_shell/src/fs/pipe.rs",
          hints: [
            "make_pipe() 返回 (Arc<Pipe>, Arc<Pipe>)，两者共享 ring",
            "先创建 write_end Arc，再把 Arc::downgrade 存入 ring.write_end",
            "★★ read 循环里 yield 前必须 drop(ring_guard)",
            "EOF 条件：avail_read==0 && all_write_ends_closed()",
          ],
        },
      ],
      acceptanceCriteria: [
        "writer 写满 2048 B 后 reader 每次读 100 B，最终两边都不阻塞死",
        "writer 写完 drop fd，reader 能读到所有数据后见到 read()==0（EOF）",
        "10 轮 ls | wc -l 后不泄漏任何物理页",
        "test_ring_wrap 边界用例全部通过",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.zh-CN.md §6.5", description: "[必读] Pipe 章节", url: "./labs/phase_6_shell/COURSE.zh-CN.md" },
        { title: "xv6-riscv book Ch. 9 Pipes", description: "[必读] 教科书级管道实现", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "Linux fs/pipe.c", description: "[深入阅读] 工业级环形缓冲 + 唤醒策略", url: "https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/pipe.c" },
        { title: "man 7 pipe", description: "[速查] POSIX pipe 原子写语义 (PIPE_BUF)", url: "https://man7.org/linux/man-pages/man7/pipe.7.html" },
      ],
    },

    // ── Lesson 4 ─────────────────────────────────────────────
    {
      phaseId: 6, lessonId: 4,
      title: "Shell 行解析：从字节流到管道计划",
      subtitle: "词法分析、管道分段、重定向抽取、后台符号",
      type: "Concept + Practice",
      duration: "1.5 hours",
      objectives: [
        "实现带引号支持的 tokenizer",
        "按 | 切分 token 列表为 Command 数组",
        "把 < > >> 从 argv 里抽出来，留下干净的参数",
        "识别末尾 & 标记为后台任务",
      ],
      sections: [
        {
          title: "四阶段管线",
          blocks: [
            { type: "diagram", content:
`  原始行:   cat f | grep foo > out &
             │
             ▼  tokenize（尊重引号）
  tokens:   [cat] [f] [|] [grep] [foo] [>] [out] [&]
             │
             ▼  split_by_pipe
  groups:   [[cat][f]]   [[grep][foo][>][out][&]]
             │
             ▼  extract_redirs + detect_background
  pipeline: Pipeline {
              commands: [
                Command{argv:[cat,f]},
                Command{argv:[grep,foo], stdout:Some("out")}
              ],
              background: true
            }
             │
             ▼  execute
  fork chain + dup2 + exec` },
          ],
        },
        {
          title: "Tokenizer：带引号状态机",
          blocks: [
            { type: "paragraph", text: "最朴素的 split_whitespace 遇到 echo \"hello world\" 就断了——\"hello 和 world\" 变成两个 token，还各自带着引号。正确做法是一个三状态机：Normal、InDoubleQuote、InSingleQuote。" },
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/user_shell.rs
fn tokenize(line: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut in_dq = false;
    let mut in_sq = false;
    for c in line.chars() {
        match c {
            '"'  if !in_sq => in_dq = !in_dq,
            '\'' if !in_dq => in_sq = !in_sq,
            c if c.is_whitespace() && !in_dq && !in_sq => {
                if !cur.is_empty() { out.push(core::mem::take(&mut cur)); }
            }
            '|' | '<' | '>' | '&' if !in_dq && !in_sq => {
                if !cur.is_empty() { out.push(core::mem::take(&mut cur)); }
                // 处理 >> 两字符 token
                if let Some(last) = out.last_mut() {
                    if last == ">" && c == '>' { last.push('>'); continue; }
                }
                out.push(c.to_string());
            }
            _ => cur.push(c),
        }
    }
    if !cur.is_empty() { out.push(cur); }
    out
}` },
          ],
        },
        {
          title: "管道切分 + 重定向抽取",
          blocks: [
            { type: "code", language: "rust", code:
`pub struct Command {
    pub path: String,
    pub args: Vec<String>,
    pub stdin:   Option<String>,
    pub stdout:  Option<String>,
    pub append:  bool,
}
pub struct Pipeline { pub commands: Vec<Command>, pub background: bool }

fn parse(tokens: Vec<String>) -> Pipeline {
    let mut bg = false;
    let mut toks = tokens;
    if toks.last().map(|s| s.as_str()) == Some("&") { bg = true; toks.pop(); }

    let mut commands = Vec::new();
    for group in toks.split(|t| t == "|") {
        let mut cmd = Command::default();
        let mut i = 0;
        while i < group.len() {
            match group[i].as_str() {
                "<"  => { cmd.stdin  = Some(group[i+1].clone()); i += 2; }
                ">"  => { cmd.stdout = Some(group[i+1].clone()); cmd.append = false; i += 2; }
                ">>" => { cmd.stdout = Some(group[i+1].clone()); cmd.append = true;  i += 2; }
                _    => { cmd.args.push(group[i].clone()); i += 1; }
            }
        }
        cmd.path = cmd.args[0].clone();
        commands.push(cmd);
    }
    Pipeline { commands, background: bg }
}` },
            { type: "callout", variant: "tip", text: "先切管道、再抽重定向、再处理后台——这个顺序有讲究。如果先抽重定向，pipeline 中间那些 | 会被当成普通参数。" },
          ],
        },
        {
          title: "执行：n-1 个管道，n 次 fork",
          blocks: [
            { type: "code", language: "rust", code:
`fn execute(p: &Pipeline) {
    let n = p.commands.len();
    // 先一次性开所有管道
    let mut pipes: Vec<(usize,usize)> = Vec::new();
    for _ in 0..n-1 {
        let mut fd = [0usize; 2];
        sys_pipe(&mut fd);
        pipes.push((fd[0], fd[1]));
    }

    let mut children = Vec::new();
    for i in 0..n {
        let pid = sys_fork();
        if pid == 0 {
            // 子进程：先连好管道和重定向
            if i > 0       { sys_dup2(pipes[i-1].0, 0); }   // 上一段的读端 → stdin
            if i < n-1     { sys_dup2(pipes[i].1,   1); }   // 当前段的写端 → stdout
            // ★ 父子都要把所有 pipe fd 清理，否则 EOF 永不到来
            for (r, w) in &pipes { sys_close(*r); sys_close(*w); }
            // 显式重定向覆盖管道
            apply_redirections(&p.commands[i]);
            sys_exec(&p.commands[i].path, &p.commands[i].args);
            sys_exit(-1);
        } else { children.push(pid); }
    }
    // ★★ 关键：父进程必须立刻关掉所有 pipe fd，否则 reader 永远见不到 EOF
    for (r, w) in pipes { sys_close(r); sys_close(w); }

    if !p.background {
        for pid in children { let mut code = 0; sys_waitpid(pid, &mut code); }
    }
}` },
            { type: "callout", variant: "warning", text: "整个 phase 6 最经典的 bug：父进程忘了关自己手里的 pipe fd。只要还有一个 write_end Arc 活着，读端就永远 EOF 不了，wc -l 会挂住。写完 execute 先跑 ls | wc -l，挂住了 100% 是 close 漏了。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab4-tokenize", title: "Lab 4a ⭐⭐ tokenize + parse",
          description: "实现带引号的 tokenize、管道切分、重定向抽取、后台识别。表驱动测试 20 个用例。",
          labFile: "labs/phase_6_shell/src/user_shell.rs",
          hints: [
            "建议先 tokenize 再 parse，两步分离",
            "\"hello world\" 保留空格、保留 | < >",
            ">> 要作为单个 token；简单做法是在 tokenize 里合并相邻 >",
            "测试用例：echo \"a|b\" 应该产生一个 token a|b",
          ],
        },
        {
          id: "lab4-execute", title: "Lab 4b ⭐⭐⭐ 执行管道",
          description: "fork 出 n 个子进程，用 dup2 串联，重点关注父子两端的 close。",
          labFile: "labs/phase_6_shell/src/user_shell.rs",
          hints: [
            "先开完所有 pipe 再开 fork 循环",
            "子进程：dup2 绑好后，遍历 pipes 数组把所有 fd close 掉",
            "★ 父进程 fork 循环结束后，立刻 close 所有 pipe fd",
            "后台任务：不 waitpid，让 init 去收割",
          ],
          pseudocode:
`fn execute(pipeline):
    pipes = for _ in 0..n-1: sys_pipe()
    for i in 0..n:
        pid = fork()
        if pid == 0:                  # child
            if i > 0:   dup2(pipes[i-1].read, 0)
            if i < n-1: dup2(pipes[i].write,  1)
            for (r, w) in pipes: close(r); close(w)
            apply_redirections(commands[i])
            exec(commands[i])
    for (r, w) in pipes: close(r); close(w)     # ★ parent 清理
    if !background: waitpid all children`,
        },
      ],
      acceptanceCriteria: [
        "echo \"a|b|c\" 打印 a|b|c（不切管道）",
        "ls | grep rs | wc -l 返回正确行数，不挂起",
        "cat file > out 2> err 分离 stdout/stderr（可选扩展）",
        "sleep 5 & 立刻返回提示符",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.zh-CN.md §6.6", description: "[必读] Shell 解析章节", url: "./labs/phase_6_shell/COURSE.zh-CN.md" },
        { title: "Bash source execute_cmd.c", description: "[深入阅读] 真实 shell 的 execute_pipeline 实现", url: "https://git.savannah.gnu.org/cgit/bash.git/tree/execute_cmd.c" },
        { title: "The Unix Programming Environment, Ch. 3", description: "[深入阅读] Kernighan & Pike 讲解 shell 语义", url: "https://archive.org/details/UnixProgrammingEnvironment" },
        { title: "xv6 sh.c", description: "[速查] 300 行实现的极简 shell，阅读参考", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/user/sh.c" },
      ],
    },

    // ── Lesson 5 ─────────────────────────────────────────────
    {
      phaseId: 6, lessonId: 5,
      title: "coreutils + init 自举：8000 行的 Unix 梦",
      subtitle: "/bin/init → /bin/sh → ls | wc -l",
      type: "Integration",
      duration: "2-3 hours",
      objectives: [
        "实现 init 进程：fork /bin/sh、死循环回收孤儿",
        "编写 ls / cat / echo / mkdir / rm / ps / kill 八个 coreutil",
        "理解用户态程序如何通过 syscall 访问 fs/pipe/task 子系统",
        "体会 \"OS 是一条从 _start 到 shell 提示符的路径\"",
      ],
      sections: [
        {
          title: "init 的死循环",
          blocks: [
            { type: "paragraph", text: "kernel main 跑到最后做一件事：add_initproc()——把 /bin/init 作为 pid 0 塞进就绪队列。init 的源码只有 20 行，却是整个系统的守护神。" },
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/user/src/bin/init.rs
#![no_std] #![no_main]

#[no_mangle]
fn main() -> i32 {
    if fork() == 0 {
        exec("/bin/sh\\0", &["sh\\0"]);          // 子进程：做 shell
    } else {
        loop {
            let mut exit_code = 0;
            let pid = waitpid(-1, &mut exit_code);   // 父进程：收割
            if pid == -1 { yield_(); continue; }     // 暂时没僵尸
            // 打印收尸记录（可选）
            println!("[init] pid {} exited with {}", pid, exit_code);
        }
    }
    0
}` },
            { type: "callout", variant: "info", text: "这 20 行是整个 OS 所有用户进程生命周期的闭环：所有孤儿最终都挂到 init 名下，所有僵尸最终都被这个 waitpid(-1) 收走。没有它，系统迟早内存耗尽。" },
          ],
        },
        {
          title: "进程树的诞生",
          blocks: [
            { type: "diagram", content:
`  启动序列：

  t0  kernel: add_initproc()
  t1  scheduler: 选中 init，__restore
  t2  init: fork()
  t3  scheduler: 父继续、子被加入队列
  t4  init(parent): 进入 waitpid 循环
  t5  init(child):  exec("/bin/sh")
  t6  sh: 打印 "$ "、read_line
  t7  user types: ls | wc -l
  t8  sh: parse + execute
        ├─ fork cat (pid 3)
        ├─ fork grep (pid 4)
        └─ fork wc   (pid 5)
  t9  pipeline 结束，waitpid 回收 3/4/5
  t10 sh: 下一个提示符

  最终进程树：

      init (0)
       └── sh (1)
            ├── ls  (2, 瞬时)
            ├── cat (3, 瞬时)
            └── ...` },
          ],
        },
        {
          title: "八个 coreutil",
          blocks: [
            { type: "table", headers: ["程序", "功能", "主要 syscall", "行数估算"], rows: [
              ["ls [path]", "列目录", "open + readdir + close", "~60"],
              ["cat FILE...", "拼接输出", "open + read + write", "~40"],
              ["echo ARGS", "打印参数", "write", "~15"],
              ["mkdir DIR", "建目录", "sys_mkdir", "~20"],
              ["rm FILE", "删除", "sys_unlink", "~20"],
              ["ps", "进程列表", "sys_ps（新 syscall）", "~30"],
              ["kill PID SIG", "发信号", "sys_kill", "~25"],
              ["wc [-l]", "计行/字", "read（到 EOF）", "~50"],
            ]},
            { type: "code", language: "rust", code:
`// user/src/bin/cat.rs — 最短的 coreutil，但已经能走完整条路径
#![no_std] #![no_main]
use user_lib::{open, read, write, OpenFlags};

#[no_mangle]
fn main(argc: usize, argv: &[&str]) -> i32 {
    for path in &argv[1..] {
        let fd = open(path, OpenFlags::RDONLY);
        if fd < 0 { println!("cat: {}: No such file", path); continue; }
        let mut buf = [0u8; 512];
        loop {
            let n = read(fd as usize, &mut buf);
            if n <= 0 { break; }                 // ★ EOF from pipe or file
            write(1, &buf[..n as usize]);
        }
        close(fd as usize);
    }
    0
}` },
            { type: "callout", variant: "tip", text: "cat 不区分 \"文件\" 和 \"管道\"——它只看到 read(fd, buf) 返回 0 就退出。这就是 Unix 的 \"everything is a file\" 抽象力的终极体现：cat file 和 cat | grep foo 走的是同一段代码。" },
          ],
        },
        {
          title: "make qemu 的交付物",
          blocks: [
            { type: "code", language: "text", code:
`$ make qemu
[kernel] boot, paging enabled, heap initialized
[kernel] init process pid=0 loaded
[init] forking /bin/sh
$ ls
README.md   COURSE.md   src
$ cat README.md | wc -l
42
$ ps
PID  PPID  STATE  NAME
0    -     R      init
1    0     R      sh
$ echo "built an OS from scratch" > out.txt
$ cat out.txt
built an OS from scratch
$ kill 1 9
[init] pid 1 exited with -9
[init] forking /bin/sh     # init 应该重启 sh；练习题
$ ` },
            { type: "callout", variant: "quote", text: "You have built an operating system. 6 个 phase，约 8000 行 Rust——每一行都是你亲手写的。下次 make qemu 之后，记得在日记里写一句：2026/04/15，my OS said hi。" },
          ],
        },
        {
          title: "常见错误合集",
          blocks: [
            { type: "table", headers: ["症状", "根因", "修复"], rows: [
              ["ls | wc -l 挂住", "父进程忘了关 pipe fd", "execute 末尾 close 所有 pipes"],
              ["echo \"a b\" 打印 \"a\" \"b\"", "tokenizer 不懂引号", "加三状态机"],
              ["僵尸堆积", "init 没循环 waitpid", "init 用 while 收割"],
              ["exec 后 fd 全丢", "exec 误清了 fd_table", "exec 只换 memory_set"],
              ["fork bomb", "忘了改子 a0 = 0", "trap_cx.x[10] = 0"],
              ["sys_open 连续失败", "waitpid 没 clear fd_table", "reap 时显式清空"],
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab5-init", title: "Lab 5a ⭐⭐ /bin/init",
          description: "写 init.rs：fork sh，父进程死循环 waitpid(-1)。放进 user/src/bin。",
          labFile: "labs/phase_6_shell/user/src/bin/init.rs",
          hints: [
            "exec 路径要以 \\0 结尾（C 字符串约定）",
            "waitpid 返回 -1 表示暂时没僵尸，sys_yield 后重试",
            "扩展练习：sh 退出时自动重启（进程号永远是 1）",
          ],
        },
        {
          id: "lab5-coreutils", title: "Lab 5b ⭐⭐⭐ 八个 coreutil",
          description: "在 user/src/bin 下各写一个文件：ls、cat、echo、mkdir、rm、ps、kill、wc。每个不超过 80 行。",
          labFile: "labs/phase_6_shell/user/src/bin/",
          hints: [
            "argv 通过 main(argc, argv) 传入——user_lib 已经处理好 ABI",
            "ls 要实现 sys_readdir 或从 stat 拼接",
            "ps 需要内核新增 sys_ps(buf, len) 或 sys_listpid",
            "wc 读到 read==0 就是 EOF，不要检测具体字节",
          ],
        },
        {
          id: "lab5-integration", title: "Lab 5c ⭐⭐⭐⭐ 完整集成",
          description: "make qemu 后，跑 cat COURSE.md | grep Lab | wc -l 看到正确行数。跑 grade.py 拿满分。",
          labFile: "labs/phase_6_shell/",
          hints: [
            "卡住时：COURSE.zh-CN.md \"Common Mistakes\" 那一节按症状索引",
            "QEMU 内 Ctrl-A X 退出",
            "跑 1000 次 ls | wc -l 不泄漏——加个压测脚本检查",
          ],
        },
      ],
      acceptanceCriteria: [
        "make qemu 启动后，sh 正常出提示符",
        "ls、cat、echo、mkdir、rm、ps、kill、wc 全部可用",
        "cat X | grep Y | wc -l 链式管道正确退出",
        "scripts/grade.py 评分为满分",
        "连续运行 1 小时的随机命令流无内存泄漏",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.zh-CN.md §6.7-6.8", description: "[必读] 集成章 + 展望 + 完整常见错误表", url: "./labs/phase_6_shell/COURSE.zh-CN.md" },
        { title: "xv6-riscv user/init.c + user/sh.c", description: "[必读] 参考 C 实现，200 行看懂整个自举", url: "https://github.com/mit-pdos/xv6-riscv/tree/riscv/user" },
        { title: "GNU coreutils 源码", description: "[深入阅读] 工业级实现——注意 ls 的 20 种选项可以不做", url: "https://www.gnu.org/software/coreutils/" },
        { title: "Lions' Commentary on UNIX 6th Edition", description: "[深入阅读] 一本书读完 Unix V6 全部内核源码", url: "https://warsus.github.io/lions-/" },
      ],
    },
  ],
};

// ─── Phase 6: Shell, Pipes & User Programs (en) ────────────────────

export const phase6En: PhaseContent = {
  phaseId: 6,
  color: "#DB2777",
  accent: "#F472B6",
  lessons: [
    // ── Lesson 1 ─────────────────────────────────────────────
    {
      phaseId: 6, lessonId: 1,
      title: "fork / exec / waitpid: the process trinity",
      subtitle: "Birth, metamorphosis, and reaping of user processes",
      type: "Concept",
      duration: "2 hours",
      objectives: [
        "Understand how fork clones a TCB and makes one syscall return two values",
        "See how exec replaces the entire address space while keeping PCB identity",
        "Master waitpid's three-state return and zombie reaping",
        "Explain why Unix chose fork+exec over a single spawn primitive",
      ],
      sections: [
        {
          title: "One syscall, two return values",
          blocks: [
            { type: "paragraph", text: "fork is Unix at its most elegant: a single ecall, but the parent gets the child's pid (positive) while the child gets 0. That dual return isn't a language feature — it comes from manually overwriting the child TrapContext's x[10] (a0) with 0. When the scheduler later __restores the child, sret loads 0 into user a0, and the C-level if (pid == 0) branch splits naturally." },
            { type: "diagram", content:
`  before fork                     after fork
  ┌────────────┐                 ┌────────────┐   ┌────────────┐
  │ parent PCB │                 │ parent PCB │   │  child PCB │
  │ pid = 7    │     ══════▶    │ pid = 7    │   │  pid = 8   │
  │ a0 = ?     │                 │ a0 = 8     │   │  a0 = 0    │  ← manual
  │ memory A   │                 │ memory A   │   │  memory A' │  ← full copy
  │ fd[0..3]   │                 │ fd[0..3]   │   │  fd[0..3]  │  ← Arc::clone
  └────────────┘                 └────────────┘   └────────────┘
                                              ↑
                                   Both hold the same File trait
                                   object's refcount — this is the
                                   foundation pipes rest on.` },
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/task/fork.rs
pub fn sys_fork() -> isize {
    let parent = current_task().unwrap();
    let child  = parent.fork();                    // deep-copy memory_set, Arc::clone fd_table
    let trap_cx = child.inner_exclusive_access().get_trap_cx();
    trap_cx.x[10] = 0;                              // ★ child's a0 = 0
    let new_pid = child.pid.0 as isize;
    add_task(child);                                // enqueue
    new_pid                                         // parent's a0 = child pid
}` },
            { type: "callout", variant: "info", text: "This is the famous Unix \"one syscall returns twice\" trick. The hardware has no idea — the secret is the single trap_cx.x[10] = 0 assignment before __restore." },
          ],
        },
        {
          title: "Copy-on-write: not implemented here, but know it",
          blocks: [
            { type: "paragraph", text: "This teaching kernel does a full physical-frame copy at fork (MemorySet::from_existed_user). If the parent immediately execs, all those copies are discarded — pure waste. Real Linux uses COW: the child inherits the parent's page table with all writable pages marked read-only; writes from either side trigger a page fault, and only then does the kernel lazily allocate and copy." },
            { type: "table", headers: ["Scheme", "fork cost", "post-exec cost", "Complexity"], rows: [
              ["Full copy (this project)", "O(memory_size)", "Discard & rebuild", "Simplest"],
              ["Copy-on-write", "O(page_count) (mark RO)", "Almost free", "Write-fault path + refcounted frames"],
              ["vfork / posix_spawn", "No copy; parent blocks", "Child must exec immediately", "Strong API constraint"],
            ]},
            { type: "callout", variant: "tip", text: "Phase 4 gave you MapArea and PageTable — upgrading to COW is a great extension, but it complicates Phase 3 locking. Recommend finishing Phase 6 first, then looping back." },
          ],
        },
        {
          title: "exec: keep the identity, swap the soul",
          blocks: [
            { type: "diagram", content:
`  before exec("sh")           after exec("sh")
  ┌────────────┐              ┌────────────┐
  │ memory_set │  ── drop ──▶ │ memory_set │   ← new ELF segments
  │ (old prog) │              │ (sh prog)  │
  ├────────────┤              ├────────────┤
  │ fd_table   │  ── keep ──▶ │ fd_table   │   ← preserved! This is why
  ├────────────┤              ├────────────┤       redirection survives exec
  │ pid, ppid  │  ── keep ──▶ │ pid, ppid  │
  │ children[] │  ── keep ──▶ │ children[] │
  └────────────┘              └────────────┘` },
            { type: "paragraph", text: "exec parses the ELF, builds a new MemorySet via from_elf, and assigns it straight into inner.memory_set — Rust's RAII frees the old frames. Then it writes a fresh TrapContext at the new user-stack top so __restore clears all user registers and enters the ELF entry point." },
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/task/exec.rs
pub fn exec(&self, elf_data: &[u8], args: Vec<String>) {
    let (memory_set, mut user_sp, entry) = MemorySet::from_elf(elf_data);
    let trap_cx_ppn = memory_set.translate(TRAP_CONTEXT.into())
        .unwrap().ppn();
    // copy argv onto the user stack per RISC-V ABI
    user_sp = push_args_to_stack(&mut user_sp, &args, &memory_set);
    let mut inner = self.inner_exclusive_access();
    inner.memory_set = memory_set;             // old MemorySet drops here
    inner.trap_cx_ppn = trap_cx_ppn;
    *inner.get_trap_cx() = TrapContext::app_init_context(
        entry, user_sp,
        KERNEL_SPACE.exclusive_access().token(),
        self.kernel_stack.get_top(),
        trap_handler as usize,
    );
    // fd_table untouched — this is the soul of redirection
}` },
          ],
        },
        {
          title: "waitpid: the three-state reaping protocol",
          blocks: [
            { type: "paragraph", text: "exit(code) can't free the TCB immediately — the parent may want the exit code. We mark the child as Zombie and keep a lightweight PCB holding just the exit_code. waitpid finds it, pulls exit_code, removes it from children; when the last Arc drops the TCB is gone." },
            { type: "table", headers: ["Case", "Return", "Meaning"], rows: [
              ["No matching child", "-1", "Bad arg or child never existed"],
              ["Matching child still running", "-2", "User-space yields and retries"],
              ["Found a zombie", "pid", "exit_code written back, PCB reaped"],
            ]},
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/task/waitpid.rs
pub fn sys_waitpid(pid: isize, exit_code_ptr: *mut i32) -> isize {
    let task = current_task().unwrap();
    let mut inner = task.inner_exclusive_access();
    if !inner.children.iter().any(|c| pid == -1 || c.pid.0 as isize == pid) {
        return -1;                              // no such child
    }
    let pos = inner.children.iter().position(|c| {
        c.inner_exclusive_access().is_zombie()
            && (pid == -1 || c.pid.0 as isize == pid)
    });
    if let Some(idx) = pos {
        let child = inner.children.remove(idx);
        let child_pid = child.pid.0 as isize;
        let exit_code = child.inner_exclusive_access().exit_code;
        *translated_refmut(inner.memory_set.token(), exit_code_ptr) = exit_code;
        child_pid
    } else {
        -2                                       // child exists, not exited
    }
}` },
            { type: "callout", variant: "warning", text: "init (pid 0) must loop on waitpid(-1) forever to reap orphans — any user process whose parent dies first gets reparented to init. Forget this and your system fills up with zombie PCBs pinning physical pages." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab1-fork", title: "Lab 1a ⭐⭐ implement sys_fork",
          description: "In task/fork.rs implement fork(): deep-copy memory_set, Arc::clone the fd_table, set the child's a0 to 0, return the child pid.",
          labFile: "labs/phase_6_shell/src/task/fork.rs",
          hints: [
            "MemorySet::from_existed_user(&parent.memory_set) handles per-MapArea copy",
            "fd_table is Vec<Option<Arc<dyn File>>> — .as_ref().map(Arc::clone) each slot",
            "★ Easy to miss: child.trap_cx.x[10] = 0",
            "add_task(child) must happen after the trap_cx tweak",
          ],
          pseudocode:
`fn fork(parent) -> Arc<TaskControlBlock>:
    memory_set  = MemorySet::from_existed_user(&parent.memory_set)
    fd_table    = parent.fd_table.iter().map(clone_arc)
    pid         = pid_alloc()
    kernel_stack= KernelStack::new(pid)
    child       = TCB { pid, parent: Weak(parent), memory_set, fd_table, ... }
    # critical
    child.get_trap_cx().x[10] = 0
    parent.children.push(Arc::clone(&child))
    return child`,
        },
        {
          id: "lab1-exec", title: "Lab 1b ⭐⭐ implement sys_exec",
          description: "Read the path, find the ELF in easy-fs, call MemorySet::from_elf, replace inner.memory_set. Push argv on the user stack per RISC-V ABI.",
          labFile: "labs/phase_6_shell/src/task/exec.rs",
          hints: [
            "translated_str copies the user-space path into a kernel buffer first",
            "OSInode::read_all() returns the full ELF bytes",
            "argv: pointer array above, strings below — entry expects a0=argc, a1=argv",
            "**Do not** reset fd_table",
          ],
          pseudocode:
`fn exec(path, argv) -> isize:
    elf = open(path)?.read_all()
    (memory_set, user_sp, entry) = MemorySet::from_elf(elf)
    user_sp = push_args(user_sp, argv)
    self.memory_set  = memory_set        # old one drops
    self.trap_cx_ppn = memory_set.translate(TRAP_CONTEXT).ppn()
    *self.get_trap_cx() = TrapContext::app_init_context(entry, user_sp, ...)
    # keep fd_table
    return argv.len() as isize`,
        },
        {
          id: "lab1-waitpid", title: "Lab 1c ⭐⭐ implement sys_waitpid",
          description: "Implement the three-state return. Remember to clear the child's fd_table — otherwise File Arcs never release.",
          labFile: "labs/phase_6_shell/src/task/waitpid.rs",
          hints: [
            "children.iter().position(|c| c.is_zombie()) finds the first zombie",
            "translated_refmut writes exit_code back to user space",
            "★ Before removing the child, fd_table.clear() — else inodes/pipes never close",
          ],
        },
      ],
      acceptanceCriteria: [
        "Loop fork()+waitpid() 1000 times with no kernel memory growth",
        "exec(\"nonexistent\") returns -1 cleanly, no panic",
        "After child exits, parent's waitpid returns correct exit_code",
        "init reaps all orphan zombies",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.en.md §6.1-6.3", description: "[Required] Full walkthrough of fork/exec/waitpid", url: "./labs/phase_6_shell/COURSE.en.md" },
        { title: "xv6-riscv book Ch. 1", description: "[Required] Canonical Unix interface chapter, fork+exec design", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "APUE Ch. 8 Process Control", description: "[Deep dive] POSIX authority — full waitpid WNOHANG/WUNTRACED semantics", url: "https://www.apuebook.com/" },
        { title: "rCore-Tutorial §7.2 Process Management", description: "[Deep dive] Sister Rust+RISC-V reference", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter7/" },
      ],
    },

    // ── Lesson 2 ─────────────────────────────────────────────
    {
      phaseId: 6, lessonId: 2,
      title: "File descriptor table + dup + redirection",
      subtitle: "A Vec<Option<Arc<dyn File>>> holds up the whole IO world",
      type: "Concept + Practice",
      duration: "1.5 hours",
      objectives: [
        "Understand the two-level mapping: per-process fd array → global File trait object",
        "Master the allocation semantics of sys_dup / sys_dup2",
        "Implement shell >, <, >> in three steps: dup2+close",
        "See why fd_table must survive exec",
      ],
      sections: [
        {
          title: "Three-level mapping: fd → File → inode/pipe",
          blocks: [
            { type: "diagram", content:
`  process A                 kernel                  device
  ┌────────────┐             ┌──────────────┐        ┌─────────┐
  │ fd_table   │             │ File trait   │        │ inode   │
  │ [0] Stdin  │────────────▶│  object      │──────▶ │ of /a.t │
  │ [1] ──────┐│             │  (OSInode)   │        └─────────┘
  │ [2] Stdout││             └──────────────┘
  │ [3] ──┐   ││             ┌──────────────┐        ┌─────────┐
  └───────│───││             │ Pipe read    │──┐     │ ring    │
          │   │└────────────▶│  end         │  │────▶│ buffer  │
          │   │              └──────────────┘  │     └─────────┘
          │   │              ┌──────────────┐  │
          │   └─────────────▶│ Pipe write   │──┘
          │                  │  end         │
          │                  └──────────────┘
  process B (fork of A)          ↑
  ┌────────────┐                 │ Arc::clone
  │ [0] Stdin  │─────────────────┘` },
            { type: "paragraph", text: "An fd is just an array index — it's not a kernel resource by itself. The real resource is Arc<dyn File>: OSInode, Pipe, Stdin, Stdout all implement the File trait, all shared via Arc refcounting. fork Arc::clones each slot; close drops one. When the count hits zero the underlying buffer / inode handle is released automatically." },
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/fs/fd_table.rs
pub trait File: Send + Sync {
    fn readable(&self) -> bool;
    fn writable(&self) -> bool;
    fn read (&self, buf: UserBuffer) -> usize;
    fn write(&self, buf: UserBuffer) -> usize;
}

pub struct FdTable {
    table: Vec<Option<Arc<dyn File>>>,    // None = closed slot
}

impl FdTable {
    pub fn alloc(&mut self, file: Arc<dyn File>) -> usize {
        if let Some(i) = self.table.iter().position(|x| x.is_none()) {
            self.table[i] = Some(file);  i
        } else {
            self.table.push(Some(file));  self.table.len() - 1
        }
    }
}` },
            { type: "callout", variant: "info", text: "The \"lowest unused fd\" rule isn't arbitrary — the shell relies on it. After close(1), the next dup is guaranteed to return 1, which is the keystone of the redirection algorithm." },
          ],
        },
        {
          title: "sys_dup vs sys_dup2",
          blocks: [
            { type: "table", headers: ["syscall", "Semantics", "Typical use"], rows: [
              ["dup(fd)", "Copy into lowest free slot; return new fd", "Backup, placeholder"],
              ["dup2(src, dst)", "Copy into **specified** dst; close dst if open", "Precise redirect"],
              ["close(fd)", "Drop the slot's Arc", "Release resources"],
            ]},
            { type: "paragraph", text: "dup2 is the shell's workhorse. Read it as \"make dst refer to the same File as src\" — afterwards src and dst are two aliases for the same File; closing one doesn't affect the other." },
            { type: "code", language: "rust", code:
`pub fn sys_dup2(src: usize, dst: usize) -> isize {
    let task = current_task().unwrap();
    let mut inner = task.inner_exclusive_access();
    let Some(Some(file)) = inner.fd_table.get(src) else { return -1 };
    let file = Arc::clone(file);
    while inner.fd_table.len() <= dst { inner.fd_table.push(None); }
    inner.fd_table[dst] = Some(file);        // old entry drops
    dst as isize
}` },
          ],
        },
        {
          title: "Redirection in three steps: `>`, `<`, `>>`",
          blocks: [
            { type: "paragraph", text: "When the shell sees cmd > out, after fork() but before exec() it does three things: open the file → fd_f, dup2(fd_f, 1) so fd 1 points to the file, close(fd_f) to remove the spare alias. Because fd_table survives exec, the new program's writes to stdout go straight to the file." },
            { type: "code", language: "rust", code:
`// user-space shell snippet
fn run_with_redir(cmd: &Command) {
    if sys_fork() == 0 {                              // child
        if let Some(ref path) = cmd.stdout {
            let fd = sys_open(path, O_CREATE | O_WRONLY);
            sys_dup2(fd, 1);                          // stdout → file
            sys_close(fd);                            // drop the spare alias
        }
        if let Some(ref path) = cmd.stdin {
            let fd = sys_open(path, O_RDONLY);
            sys_dup2(fd, 0);
            sys_close(fd);
        }
        sys_exec(&cmd.path, &cmd.args);              // fd_table crosses exec
        sys_exit(-1);
    }
}` },
            { type: "diagram", content:
`  fd_table evolution for \`echo hi > out\`:

  after fork:  [0]Stdin  [1]Stdout  [2]Stdout
  open "out": [0]Stdin  [1]Stdout  [2]Stdout  [3]File("out")
  dup2(3,1):  [0]Stdin  [1]File   [2]Stdout  [3]File("out")  ← 1 & 3 alias
  close(3):   [0]Stdin  [1]File   [2]Stdout  [3]None
  exec echo:  [0]Stdin  [1]File   [2]Stdout              ← echo's write(1,...)
                                                            lands in out` },
          ],
        },
      ],
      exercises: [
        {
          id: "lab2-fd", title: "Lab 2a ⭐ FdTable basics",
          description: "Implement FdTable::alloc / close / get with lowest-free-slot semantics.",
          labFile: "labs/phase_6_shell/src/fs/fd_table.rs",
          hints: [
            "new() seeds with [Stdin, Stdout, Stdout]",
            "alloc uses position(|x| x.is_none())",
            "close is just table[fd] = None",
          ],
        },
        {
          id: "lab2-dup", title: "Lab 2b ⭐⭐ sys_dup / sys_dup2",
          description: "Implement both syscalls. dup2 must be able to grow the Vec to the specified size.",
          labFile: "labs/phase_6_shell/src/task/mod.rs",
          hints: [
            "dup forwards to fd_table.alloc(Arc::clone(file))",
            "dup2 where src == dst is a legal no-op returning dst",
            "Grow with pushed None when dst exceeds current length",
          ],
          pseudocode:
`fn sys_dup2(src, dst):
    file = fd_table[src]?
    if src == dst: return dst
    while fd_table.len() <= dst: fd_table.push(None)
    fd_table[dst] = Some(Arc::clone(&file))     # old Arc drops
    return dst`,
        },
      ],
      acceptanceCriteria: [
        "echo hello > /tmp/a then cat /tmp/a prints hello",
        "cmd < input.txt feeds stdin from a file",
        "echo a >> log; echo b >> log appends two lines",
        "1000 open+close cycles do not leak inode refs",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.en.md §6.4", description: "[Required] Full fd-table chapter", url: "./labs/phase_6_shell/COURSE.en.md" },
        { title: "xv6-riscv book §1.3 & §8.1", description: "[Required] Unix fd abstraction and dup design", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "APUE Ch. 3 File I/O", description: "[Deep dive] Full POSIX dup/dup2/fcntl semantics", url: "https://www.apuebook.com/" },
        { title: "man 2 dup2", description: "[Reference] Linux manual", url: "https://man7.org/linux/man-pages/man2/dup.2.html" },
      ],
    },

    // ── Lesson 3 ─────────────────────────────────────────────
    {
      phaseId: 6, lessonId: 3,
      title: "Pipe: ring buffer + refcounting",
      subtitle: "Two Arc<Pipe> + one Weak<> give you clean EOF semantics",
      type: "Concept + Practice",
      duration: "2 hours",
      objectives: [
        "Design and implement a fixed-size ring buffer (head/tail + status to disambiguate)",
        "Share one ring between both ends via Arc<Mutex<PipeRingBuffer>>",
        "Grasp how Weak<> gives the \"reader sees EOF when all writers closed\" property",
        "Step through interleaved reads/writes on paper",
      ],
      sections: [
        {
          title: "Two Arcs, one ring",
          blocks: [
            { type: "paragraph", text: "pipe() returns two fds: [0] read end, [1] write end. In the kernel they are two different Arc<Pipe> but both hold an Arc pointing to the same PipeRingBuffer — reads and writes all land in that shared memory." },
            { type: "diagram", content:
`  read_end : Arc<Pipe> ──┐
                         ├─▶ Arc<Mutex<PipeRingBuffer>>
  write_end: Arc<Pipe> ──┘         │
                                   ▼
        ┌─────────────────────────────────┐
        │ buf: [u8; RING=2048]            │
        │ head: usize    (next read idx)  │
        │ tail: usize    (next write idx) │
        │ status: Empty | Normal | Full   │
        │ write_end: Weak<Pipe>  ★        │
        └─────────────────────────────────┘` },
            { type: "callout", variant: "info", text: "Weak is the key. The ring holds a Weak to the write end — no refcount bump. When the last write-end Arc drops, weak.upgrade() returns None and the reader sees EOF. Arc would cycle and nothing would ever free." },
          ],
        },
        {
          title: "Ring buffer: disambiguating head == tail",
          blocks: [
            { type: "paragraph", text: "The classic ring question: when head and tail meet, is it empty or full? Solution: a three-state status field. Every read pushes status toward Empty; every write pushes it toward Full." },
            { type: "table", headers: ["status", "Readable bytes", "Writable bytes"], rows: [
              ["Empty", "0", "RING_SIZE"],
              ["Normal", "(tail - head + RING) % RING", "RING - readable"],
              ["Full", "RING_SIZE", "0"],
            ]},
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/fs/pipe.rs
const RING_SIZE: usize = 2048;

pub struct PipeRingBuffer {
    buf: [u8; RING_SIZE],
    head: usize, tail: usize,
    status: RingStatus,
    write_end: Option<Weak<Pipe>>,         // ★ not Arc
}

impl PipeRingBuffer {
    fn available_read(&self) -> usize {
        match self.status {
            RingStatus::Empty  => 0,
            RingStatus::Full   => RING_SIZE,
            RingStatus::Normal => (self.tail + RING_SIZE - self.head) % RING_SIZE,
        }
    }
    fn all_write_ends_closed(&self) -> bool {
        self.write_end.as_ref().unwrap().upgrade().is_none()
    }
}` },
            { type: "diagram", content:
`  RING=4 evolution (.=empty, X=data, H=head, T=tail):

  initial      [. . . .]  H=0 T=0  Empty
  write 3B     [X X X .]  H=0 T=3  Normal   avail_read=3
  read  2B     [. . X .]  H=2 T=3  Normal   avail_read=1
  write 3B     [X X X X]  H=2 T=2  Full     avail_read=4 ← wrapped
  read  4B     [. . . .]  H=2 T=2  Empty    avail_read=0` },
          ],
        },
        {
          title: "Read/write coroutines: busy-wait vs sleep",
          blocks: [
            { type: "paragraph", text: "This kernel is minimalist: no condition variables. Pipe::read yields (sys_yield) when the ring is empty but writers still exist; Pipe::write yields when full. A high-perf implementation would use WaitQueues once you have those in later phases." },
            { type: "code", language: "rust", code:
`impl File for Pipe {
    fn read(&self, mut buf: UserBuffer) -> usize {
        assert!(self.readable);
        let mut read_size = 0usize;
        let want = buf.len();
        loop {
            let mut ring = self.buffer.lock();
            let n = ring.available_read();
            if n == 0 {
                if ring.all_write_ends_closed() { return read_size; }  // EOF
                drop(ring);                                             // ★ drop lock first
                suspend_current_and_run_next();                         // yield
                continue;
            }
            for i in 0..n.min(want - read_size) {
                buf.write_byte(read_size, ring.read_byte());
                read_size += 1;
            }
            if read_size == want { return read_size; }
        }
    }
}` },
            { type: "callout", variant: "warning", text: "drop(ring) before suspend is mandatory — a MutexGuard held across schedule() means the scheduler can never retake the lock, hanging the whole system. Phase 3 Lab 2c already bit you once." },
          ],
        },
        {
          title: "EOF under the microscope",
          blocks: [
            { type: "paragraph", text: "ls | wc -l: ls finishes writing, exits; data is still in the ring, so wc keeps reading. The key step is wc's final read: after draining, it loops once more — this time avail_read==0 and all_write_ends_closed()==true, so read() returns read_size (possibly 0). The caller treats 0 as EOF." },
            { type: "diagram", content:
`  t0:  ls running                pipe.write_end.strong_count = 2
                                  (shell parent + ls child)
  t1:  ls writes "foo.txt\\nbar\\n" 9 bytes in ring
  t2:  shell parent drop(write)   strong_count = 1
  t3:  ls exit                    its fd_table drops → drop
                                  strong_count = 0
  t4:  wc read                    avail_read=9 → copy 9 bytes
  t5:  wc read again              avail_read=0
                                  upgrade() = None → return 0 → EOF` },
          ],
        },
      ],
      exercises: [
        {
          id: "lab3-ring", title: "Lab 3a ⭐⭐ ring buffer",
          description: "Implement PipeRingBuffer's read_byte / write_byte / available_read / available_write. Verify wrapping with test_ring_wrap.",
          labFile: "labs/phase_6_shell/src/fs/pipe.rs",
          hints: [
            "Each read_byte: head = (head+1) % RING; update status",
            "When full, status=Full; next write must yield",
            "Work through Section 3's example on paper with RING=4, then diff against code",
          ],
          pseudocode:
`fn read_byte(&mut self) -> u8:
    assert!(self.status != Empty)
    byte = self.buf[self.head]
    self.head = (self.head + 1) % RING_SIZE
    self.status = if self.head == self.tail: Empty else Normal
    return byte

fn write_byte(&mut self, b: u8):
    assert!(self.status != Full)
    self.buf[self.tail] = b
    self.tail = (self.tail + 1) % RING_SIZE
    self.status = if self.tail == self.head: Full else Normal`,
        },
        {
          id: "lab3-pipe", title: "Lab 3b ⭐⭐⭐ Pipe::read/write + sys_pipe",
          description: "Wire the two ends with Arc<Mutex<PipeRingBuffer>>; implement sys_pipe returning a pair of fds.",
          labFile: "labs/phase_6_shell/src/fs/pipe.rs",
          hints: [
            "make_pipe() returns (Arc<Pipe>, Arc<Pipe>) sharing the ring",
            "Create the write-end Arc first, then store Arc::downgrade in ring.write_end",
            "★★ In the read loop, drop(ring_guard) before yield",
            "EOF condition: avail_read==0 && all_write_ends_closed()",
          ],
        },
      ],
      acceptanceCriteria: [
        "Writer fills 2048 B, reader takes 100 B at a time — both progress without deadlock",
        "Writer drops fd after done; reader drains and sees read()==0 (EOF)",
        "10 cycles of ls | wc -l leak no frames",
        "test_ring_wrap covers wrap-around correctly",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.en.md §6.5", description: "[Required] Pipe chapter", url: "./labs/phase_6_shell/COURSE.en.md" },
        { title: "xv6-riscv book Ch. 9 Pipes", description: "[Required] Textbook-level pipe implementation", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "Linux fs/pipe.c", description: "[Deep dive] Industrial ring buffer + wake policy", url: "https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/pipe.c" },
        { title: "man 7 pipe", description: "[Reference] POSIX pipe atomic-write semantics (PIPE_BUF)", url: "https://man7.org/linux/man-pages/man7/pipe.7.html" },
      ],
    },

    // ── Lesson 4 ─────────────────────────────────────────────
    {
      phaseId: 6, lessonId: 4,
      title: "Shell line parsing: bytes to a pipeline plan",
      subtitle: "Tokenization, pipe splitting, redir extraction, background &",
      type: "Concept + Practice",
      duration: "1.5 hours",
      objectives: [
        "Implement a quote-aware tokenizer",
        "Split the token list into Command groups on |",
        "Extract < > >> out of argv, leaving clean arguments",
        "Detect trailing & as background marker",
      ],
      sections: [
        {
          title: "Four-stage pipeline",
          blocks: [
            { type: "diagram", content:
`  raw line:  cat f | grep foo > out &
              │
              ▼  tokenize (quote-aware)
  tokens:    [cat] [f] [|] [grep] [foo] [>] [out] [&]
              │
              ▼  split_by_pipe
  groups:    [[cat][f]]   [[grep][foo][>][out][&]]
              │
              ▼  extract_redirs + detect_background
  pipeline:  Pipeline {
               commands: [
                 Command{argv:[cat,f]},
                 Command{argv:[grep,foo], stdout:Some("out")}
               ],
               background: true
             }
              │
              ▼  execute
  fork chain + dup2 + exec` },
          ],
        },
        {
          title: "Tokenizer: quote-aware state machine",
          blocks: [
            { type: "paragraph", text: "A naive split_whitespace chokes on echo \"hello world\" — it yields \"hello and world\" with quotes still attached. The fix is a three-state machine: Normal, InDoubleQuote, InSingleQuote." },
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/src/user_shell.rs
fn tokenize(line: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut in_dq = false;
    let mut in_sq = false;
    for c in line.chars() {
        match c {
            '"'  if !in_sq => in_dq = !in_dq,
            '\'' if !in_dq => in_sq = !in_sq,
            c if c.is_whitespace() && !in_dq && !in_sq => {
                if !cur.is_empty() { out.push(core::mem::take(&mut cur)); }
            }
            '|' | '<' | '>' | '&' if !in_dq && !in_sq => {
                if !cur.is_empty() { out.push(core::mem::take(&mut cur)); }
                // handle >> as a two-char token
                if let Some(last) = out.last_mut() {
                    if last == ">" && c == '>' { last.push('>'); continue; }
                }
                out.push(c.to_string());
            }
            _ => cur.push(c),
        }
    }
    if !cur.is_empty() { out.push(cur); }
    out
}` },
          ],
        },
        {
          title: "Pipe split + redir extraction",
          blocks: [
            { type: "code", language: "rust", code:
`pub struct Command {
    pub path: String,
    pub args: Vec<String>,
    pub stdin:   Option<String>,
    pub stdout:  Option<String>,
    pub append:  bool,
}
pub struct Pipeline { pub commands: Vec<Command>, pub background: bool }

fn parse(tokens: Vec<String>) -> Pipeline {
    let mut bg = false;
    let mut toks = tokens;
    if toks.last().map(|s| s.as_str()) == Some("&") { bg = true; toks.pop(); }

    let mut commands = Vec::new();
    for group in toks.split(|t| t == "|") {
        let mut cmd = Command::default();
        let mut i = 0;
        while i < group.len() {
            match group[i].as_str() {
                "<"  => { cmd.stdin  = Some(group[i+1].clone()); i += 2; }
                ">"  => { cmd.stdout = Some(group[i+1].clone()); cmd.append = false; i += 2; }
                ">>" => { cmd.stdout = Some(group[i+1].clone()); cmd.append = true;  i += 2; }
                _    => { cmd.args.push(group[i].clone()); i += 1; }
            }
        }
        cmd.path = cmd.args[0].clone();
        commands.push(cmd);
    }
    Pipeline { commands, background: bg }
}` },
            { type: "callout", variant: "tip", text: "Split pipes first, extract redirs second, detect background third. The order matters: extracting redirs before splitting would swallow the | tokens between pipeline stages as regular args." },
          ],
        },
        {
          title: "Execute: n-1 pipes, n forks",
          blocks: [
            { type: "code", language: "rust", code:
`fn execute(p: &Pipeline) {
    let n = p.commands.len();
    let mut pipes: Vec<(usize,usize)> = Vec::new();
    for _ in 0..n-1 {
        let mut fd = [0usize; 2];
        sys_pipe(&mut fd);
        pipes.push((fd[0], fd[1]));
    }

    let mut children = Vec::new();
    for i in 0..n {
        let pid = sys_fork();
        if pid == 0 {
            // child: wire up pipes and redirections first
            if i > 0       { sys_dup2(pipes[i-1].0, 0); }
            if i < n-1     { sys_dup2(pipes[i].1,   1); }
            // ★ both parent & child must close every pipe fd not in use
            for (r, w) in &pipes { sys_close(*r); sys_close(*w); }
            apply_redirections(&p.commands[i]);
            sys_exec(&p.commands[i].path, &p.commands[i].args);
            sys_exit(-1);
        } else { children.push(pid); }
    }
    // ★★ critical: parent must close all pipe fds NOW
    for (r, w) in pipes { sys_close(r); sys_close(w); }

    if !p.background {
        for pid in children { let mut code = 0; sys_waitpid(pid, &mut code); }
    }
}` },
            { type: "callout", variant: "warning", text: "The all-time classic Phase 6 bug: the parent forgets to close its pipe fds. One dangling write-end Arc keeps EOF from ever arriving, and wc -l hangs forever. After writing execute, run ls | wc -l first; if it hangs, it's 100% a missing close." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab4-tokenize", title: "Lab 4a ⭐⭐ tokenize + parse",
          description: "Implement quote-aware tokenize, pipe splitting, redirection extraction, background detection. Table-drive 20 test cases.",
          labFile: "labs/phase_6_shell/src/user_shell.rs",
          hints: [
            "Keep tokenize and parse as two separate passes",
            "\"hello world\" preserves the space and keeps | < > literal",
            ">> must be a single token; easiest approach is merging adjacent > in tokenize",
            "Test: echo \"a|b\" should yield one token a|b",
          ],
        },
        {
          id: "lab4-execute", title: "Lab 4b ⭐⭐⭐ execute pipelines",
          description: "Fork n children, chain them with dup2, focus on closing pipe fds in both parent and children.",
          labFile: "labs/phase_6_shell/src/user_shell.rs",
          hints: [
            "Open all pipes before the fork loop",
            "Children: after dup2, iterate pipes[] and close every fd",
            "★ Parent: immediately after the fork loop, close all pipe fds",
            "Background task: skip waitpid and let init reap",
          ],
          pseudocode:
`fn execute(pipeline):
    pipes = for _ in 0..n-1: sys_pipe()
    for i in 0..n:
        pid = fork()
        if pid == 0:                  # child
            if i > 0:   dup2(pipes[i-1].read, 0)
            if i < n-1: dup2(pipes[i].write,  1)
            for (r, w) in pipes: close(r); close(w)
            apply_redirections(commands[i])
            exec(commands[i])
    for (r, w) in pipes: close(r); close(w)     # ★ parent cleanup
    if !background: waitpid all children`,
        },
      ],
      acceptanceCriteria: [
        "echo \"a|b|c\" prints a|b|c (no pipe split)",
        "ls | grep rs | wc -l returns the right line count, never hangs",
        "cat file > out 2> err splits stdout/stderr (optional extension)",
        "sleep 5 & returns the prompt immediately",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.en.md §6.6", description: "[Required] Shell-parsing chapter", url: "./labs/phase_6_shell/COURSE.en.md" },
        { title: "Bash source execute_cmd.c", description: "[Deep dive] The real shell's execute_pipeline", url: "https://git.savannah.gnu.org/cgit/bash.git/tree/execute_cmd.c" },
        { title: "The Unix Programming Environment Ch. 3", description: "[Deep dive] Kernighan & Pike on shell semantics", url: "https://archive.org/details/UnixProgrammingEnvironment" },
        { title: "xv6 sh.c", description: "[Reference] 300-line minimal shell, great read", url: "https://github.com/mit-pdos/xv6-riscv/blob/riscv/user/sh.c" },
      ],
    },

    // ── Lesson 5 ─────────────────────────────────────────────
    {
      phaseId: 6, lessonId: 5,
      title: "coreutils + init bootstrap: the 8000-line Unix dream",
      subtitle: "/bin/init → /bin/sh → ls | wc -l",
      type: "Integration",
      duration: "2-3 hours",
      objectives: [
        "Write init: fork /bin/sh and loop reaping orphans forever",
        "Build ls / cat / echo / mkdir / rm / ps / kill — eight coreutils",
        "Understand how user programs reach fs/pipe/task subsystems via syscall",
        "Feel \"an OS is the path from _start to the shell prompt\"",
      ],
      sections: [
        {
          title: "init's eternal loop",
          blocks: [
            { type: "paragraph", text: "kernel main ends with one thing: add_initproc() — put /bin/init as pid 0 into the ready queue. init's source is 20 lines, but it's the guardian of the whole system." },
            { type: "code", language: "rust", code:
`// labs/phase_6_shell/user/src/bin/init.rs
#![no_std] #![no_main]

#[no_mangle]
fn main() -> i32 {
    if fork() == 0 {
        exec("/bin/sh\\0", &["sh\\0"]);          // child: become shell
    } else {
        loop {
            let mut exit_code = 0;
            let pid = waitpid(-1, &mut exit_code);
            if pid == -1 { yield_(); continue; } // no zombies yet
            println!("[init] pid {} exited with {}", pid, exit_code);
        }
    }
    0
}` },
            { type: "callout", variant: "info", text: "These 20 lines close the entire process-lifecycle loop of the OS: every orphan eventually reparents here, every zombie eventually gets harvested by this waitpid(-1). Without it, memory is exhausted eventually." },
          ],
        },
        {
          title: "Birth of the process tree",
          blocks: [
            { type: "diagram", content:
`  Boot sequence:

  t0  kernel: add_initproc()
  t1  scheduler: picks init, __restore
  t2  init: fork()
  t3  scheduler: parent continues, child queued
  t4  init(parent): enter waitpid loop
  t5  init(child):  exec("/bin/sh")
  t6  sh: prints "$ ", read_line
  t7  user types: ls | wc -l
  t8  sh: parse + execute
        ├─ fork cat (pid 3)
        ├─ fork grep (pid 4)
        └─ fork wc   (pid 5)
  t9  pipeline done, waitpid reaps 3/4/5
  t10 sh: next prompt

  Final tree:

      init (0)
       └── sh (1)
            ├── ls  (2, transient)
            ├── cat (3, transient)
            └── ...` },
          ],
        },
        {
          title: "Eight coreutils",
          blocks: [
            { type: "table", headers: ["Program", "Function", "Key syscalls", "Approx LOC"], rows: [
              ["ls [path]", "list dir", "open + readdir + close", "~60"],
              ["cat FILE...", "concat + print", "open + read + write", "~40"],
              ["echo ARGS", "print args", "write", "~15"],
              ["mkdir DIR", "create dir", "sys_mkdir", "~20"],
              ["rm FILE", "remove", "sys_unlink", "~20"],
              ["ps", "process list", "sys_ps (new syscall)", "~30"],
              ["kill PID SIG", "send signal", "sys_kill", "~25"],
              ["wc [-l]", "count lines/words", "read (to EOF)", "~50"],
            ]},
            { type: "code", language: "rust", code:
`// user/src/bin/cat.rs — the shortest coreutil, already walks the whole stack
#![no_std] #![no_main]
use user_lib::{open, read, write, OpenFlags};

#[no_mangle]
fn main(argc: usize, argv: &[&str]) -> i32 {
    for path in &argv[1..] {
        let fd = open(path, OpenFlags::RDONLY);
        if fd < 0 { println!("cat: {}: No such file", path); continue; }
        let mut buf = [0u8; 512];
        loop {
            let n = read(fd as usize, &mut buf);
            if n <= 0 { break; }                 // ★ EOF (file or pipe)
            write(1, &buf[..n as usize]);
        }
        close(fd as usize);
    }
    0
}` },
            { type: "callout", variant: "tip", text: "cat doesn't distinguish \"file\" from \"pipe\" — it just sees read(fd, buf) return 0 and exits. This is Unix's \"everything is a file\" abstraction at its finest: cat file and cat | grep foo share the exact same code path." },
          ],
        },
        {
          title: "The make qemu deliverable",
          blocks: [
            { type: "code", language: "text", code:
`$ make qemu
[kernel] boot, paging enabled, heap initialized
[kernel] init process pid=0 loaded
[init] forking /bin/sh
$ ls
README.md   COURSE.md   src
$ cat README.md | wc -l
42
$ ps
PID  PPID  STATE  NAME
0    -     R      init
1    0     R      sh
$ echo "built an OS from scratch" > out.txt
$ cat out.txt
built an OS from scratch
$ kill 1 9
[init] pid 1 exited with -9
[init] forking /bin/sh     # init should restart sh; exercise
$ ` },
            { type: "callout", variant: "quote", text: "You have built an operating system. Six phases, about 8000 lines of Rust — every line written by you. After your next make qemu, write it down: 2026/04/15, my OS said hi." },
          ],
        },
        {
          title: "Common mistakes, consolidated",
          blocks: [
            { type: "table", headers: ["Symptom", "Root cause", "Fix"], rows: [
              ["ls | wc -l hangs", "Parent forgot to close pipe fds", "close all pipes at end of execute()"],
              ["echo \"a b\" prints \"a\" \"b\"", "Tokenizer doesn't know quotes", "add three-state machine"],
              ["Zombies pile up", "init not looping on waitpid", "while-loop reaper in init"],
              ["fd's lost after exec", "exec reset the fd_table", "exec swaps memory_set only"],
              ["fork bomb", "Forgot child's a0 = 0", "trap_cx.x[10] = 0"],
              ["sys_open fails repeatedly", "waitpid didn't clear fd_table", "Explicitly clear on reap"],
            ]},
          ],
        },
      ],
      exercises: [
        {
          id: "lab5-init", title: "Lab 5a ⭐⭐ /bin/init",
          description: "Write init.rs: fork sh, parent loops on waitpid(-1). Drop it in user/src/bin.",
          labFile: "labs/phase_6_shell/user/src/bin/init.rs",
          hints: [
            "exec paths must be NUL-terminated (C-string convention)",
            "waitpid returning -1 means no zombie right now — sys_yield and retry",
            "Stretch: automatically restart sh when it exits (pid always 1)",
          ],
        },
        {
          id: "lab5-coreutils", title: "Lab 5b ⭐⭐⭐ eight coreutils",
          description: "Under user/src/bin, one file each: ls, cat, echo, mkdir, rm, ps, kill, wc. Each under 80 lines.",
          labFile: "labs/phase_6_shell/user/src/bin/",
          hints: [
            "argv arrives via main(argc, argv) — user_lib handles the ABI",
            "ls needs sys_readdir or stat-based construction",
            "ps needs a new kernel syscall sys_ps(buf, len) or sys_listpid",
            "wc treats read()==0 as EOF — don't inspect bytes",
          ],
        },
        {
          id: "lab5-integration", title: "Lab 5c ⭐⭐⭐⭐ full integration",
          description: "After make qemu, run cat COURSE.md | grep Lab | wc -l and see a correct number. Run grade.py for a full score.",
          labFile: "labs/phase_6_shell/",
          hints: [
            "Stuck? COURSE.en.md \"Common Mistakes\" is indexed by symptom",
            "Exit QEMU with Ctrl-A X",
            "Run 1000 ls | wc -l cycles as a leak test",
          ],
        },
      ],
      acceptanceCriteria: [
        "make qemu boots and sh shows the prompt",
        "ls, cat, echo, mkdir, rm, ps, kill, wc all usable",
        "cat X | grep Y | wc -l chains correctly and exits cleanly",
        "scripts/grade.py reports a full score",
        "One hour of random command streams shows no memory leak",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.en.md §6.7-6.8", description: "[Required] Integration chapter + outlook + full common-mistakes table", url: "./labs/phase_6_shell/COURSE.en.md" },
        { title: "xv6-riscv user/init.c + user/sh.c", description: "[Required] Reference C implementation, 200 lines cover the entire bootstrap", url: "https://github.com/mit-pdos/xv6-riscv/tree/riscv/user" },
        { title: "GNU coreutils source", description: "[Deep dive] Industrial-grade — note you can skip ls's 20 options", url: "https://www.gnu.org/software/coreutils/" },
        { title: "Lions' Commentary on UNIX 6th Edition", description: "[Deep dive] One book covering the entire Unix V6 kernel source", url: "https://warsus.github.io/lions-/" },
      ],
    },
  ],
};
