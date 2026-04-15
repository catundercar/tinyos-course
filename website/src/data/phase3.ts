import type { PhaseContent } from "./types";

// ─── Phase 3: Concurrency & Locks (zh-CN) ──────────────────

export const phase3ZhCN: PhaseContent = {
  phaseId: 3,
  color: "#7C3AED",
  accent: "#A78BFA",
  lessons: [
    // ── Lesson 1 ──────────────────────────────────────────
    {
      phaseId: 3, lessonId: 1,
      title: "Phase 3 导读：race condition 与原子指令",
      subtitle: "从丢失更新到 RISC-V A 扩展",
      type: "Concept",
      duration: "1.5 hours",
      objectives: [
        "用一个 counter += 1 的例子还原 lost update 是怎么发生的",
        "理解原子性、临界区、race condition 三个概念的精确含义",
        "掌握 RISC-V A 扩展的三条核心指令：amoswap.w / lr.w / sc.w",
        "知道 Rust 内存序 Acquire / Release / SeqCst 何时用哪个",
      ],
      sections: [
        {
          title: "会忘记的计数器",
          blocks: [
            { type: "paragraph", text: "Phase 2 里你实现了抢占式调度——时钟中断可以在任何一条指令之间切走当前任务。现在把两个任务都去做 counter += 1，每人 10000 次。期望最终 counter == 20000。真实结果：10002 到 19998 之间浮动，永远凑不齐。" },
            { type: "code", language: "asm", code:
`# counter += 1 在 RISC-V 上并不是一条指令：
lw   t0, (a0)      # 1. 读 counter
addi t0, t0, 1     # 2. 寄存器里 +1
sw   t0, (a0)      # 3. 写回` },
            { type: "diagram", content:
`counter 初值 = 5，T1 和 T2 都做 +1，一种"丢更新"的交织：

T1: lw  t0 <- 5       ───┐
                         │  (时钟中断，切到 T2)
T2: lw  t0 <- 5          │
T2: addi t0 = 6          │
T2: sw  6 -> counter     │  ← counter = 6
                         │  (切回 T1)
T1: addi t0 = 6       ───┘
T1: sw  6 -> counter      ← counter = 6 (而不是 7)

两次 +1 只生效一次——T2 的写被"丢"了。` },
            { type: "callout", variant: "warning", text: "这种 bug 是测试极难发现的——1000 次里错一次。生产环境下跑几天才出问题，日志里却看不出任何异常。唯一靠谱的解法是让这类操作在语义上不可打断，也就是原子。" },
          ],
        },
        {
          title: "三个必须分清的概念",
          blocks: [
            { type: "table", headers: ["概念", "定义", "在 counter += 1 例子里"], rows: [
              ["Race condition", "正确性依赖操作的相对时序", "两个任务同时 +1，结果取决于交织顺序"],
              ["原子性 (Atomic)", "其它 CPU/任务无法观察到中间态", "单条 lw/sw 对齐字是原子的；lw+addi+sw 三条不是"],
              ["临界区", "访问共享状态的代码区域", "包含 counter += 1 这三条指令的整段代码"],
            ]},
            { type: "callout", variant: "info", text: "经验法则：一个变量如果被多个任务同时读写，要么整个放进锁里，要么每次访问都是单条原子指令。两者必居其一——中间地带都是 bug。" },
          ],
        },
        {
          title: "RISC-V A 扩展：硬件给的原子指令",
          blocks: [
            { type: "paragraph", text: "A (Atomic) 扩展给每条 read-modify-write 都加了一个单指令版本，硬件保证对其它 hart 而言这条指令是一瞬间完成的。Rust 的 AtomicBool::compare_exchange / AtomicUsize::fetch_add 底层都会降到下面这几条。" },
            { type: "table", headers: ["指令", "语义", "典型用途"], rows: [
              ["amoswap.w.aq rd,rs2,(rs1)", "rd = *rs1;  *rs1 = rs2  (带 acquire)", "SpinLock 的 lock——把 1 换进去，看换出的是不是 0"],
              ["amoadd.w.aqrl rd,rs2,(rs1)", "rd = *rs1;  *rs1 += rs2", "原子计数器，fetch_add"],
              ["lr.w rd, (rs1)", "加载并在这个地址上放保留位", "CAS 循环的第一步"],
              ["sc.w rd, rs2, (rs1)", "如果保留位还在则写入并返回 0；否则返回 1", "CAS 循环的第二步；配合 lr.w 实现无锁算法"],
              ["amocas.w (Zacas)", "单指令 compare-and-swap", "较新硬件，xv6-riscv 不依赖"],
            ]},
            { type: "code", language: "asm", code:
`# 典型的 lr/sc CAS 循环：把 *a0 从 old 改成 new
retry:
    lr.w   t0, (a0)        # 读并保留
    bne    t0, a1, fail    # 期望值不对
    sc.w   t1, a2, (a0)    # 尝试写
    bnez   t1, retry       # 如果保留被打破，重来
fail:` },
            { type: "callout", variant: "tip", text: "amoswap 一定写；lr/sc 可能不写。写少锁竞争场景下 lr/sc 比 amoswap 省一次缓存行 ping-pong——但 RISC-V 规范规定 sc 之间最多 16 条指令，超过就会永远失败。所以循环体要短。" },
          ],
        },
        {
          title: "内存序：Acquire / Release / SeqCst",
          blocks: [
            { type: "paragraph", text: "原子性只保证“这条指令不会被撕开”，但编译器和乱序 CPU 还会搬动它前后的普通访存。Rust 里每个 atomic 操作都要指定 Ordering，告诉优化器哪些搬动是允许的。" },
            { type: "table", headers: ["Ordering", "效果", "何时用"], rows: [
              ["Relaxed", "只保证这条指令本身原子；前后可随意重排", "纯计数器、统计值"],
              ["Acquire", "这条之后的读写不能重排到它之前", "lock() 成功那一刻——之后读共享数据才安全"],
              ["Release", "这条之前的读写不能重排到它之后", "unlock()——临界区写必须在释放前对其他核可见"],
              ["AcqRel", "Acquire + Release（只对 RMW 有意义）", "compare_exchange 的 success 序"],
              ["SeqCst", "所有 SeqCst 操作有全局唯一总序", "不想想清楚时的安全兜底，性能最差"],
            ]},
            { type: "callout", variant: "warning", text: "Lab 1 里最常见的 bug 是 lock() CAS 用 Relaxed——编译器会把受保护的 counter 读 hoist 到 CAS 之前，结果你拿到锁之前就已经读了脏数据。记忆口诀：取锁用 Acquire，放锁用 Release。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab-race-demo", title: "实验：复现 lost update",
          description: "在 phase_2 的抢占式调度上跑两个 task 各做 counter += 1 十万次，打印最终值。多跑几次观察抖动，再把 counter 换成 AtomicUsize::fetch_add 看结果稳定为 200000。",
          labFile: "labs/phase_3_sync/src/sync/spin.rs",
          hints: [
            "先不加锁、不用 Atomic——直接看 race",
            "再用 core::sync::atomic::AtomicUsize 改 fetch_add，Ordering::Relaxed 就够了",
            "反汇编 counter += 1 的版本，看 lw/addi/sw 三条指令——亲眼看到才记得住",
          ],
          pseudocode:
`// race 版本
static mut COUNTER: usize = 0;
for _ in 0..100_000 { unsafe { COUNTER += 1; } }

// atomic 版本
static COUNTER: AtomicUsize = AtomicUsize::new(0);
for _ in 0..100_000 { COUNTER.fetch_add(1, Ordering::Relaxed); }`,
        },
      ],
      acceptanceCriteria: [
        "能用 counter += 1 的例子向别人画出丢更新的时序图",
        "能说出 amoswap 和 lr/sc 的区别以及各自适用场景",
        "能解释为什么 lock 用 Acquire、unlock 用 Release",
      ],
      references: [
        { title: "xv6-riscv book Ch. 6", description: "[必读] Locking——从 race 到 spinlock 的最经典讲解", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "OSTEP Ch. 28", description: "[必读] Locks——概念层面的权威教材", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf" },
        { title: "RISC-V A Extension Spec", description: "[深入阅读] amoswap / lr.w / sc.w 的权威定义", url: "https://github.com/riscv/riscv-isa-manual/releases" },
      ],
    },

    // ── Lesson 2 ──────────────────────────────────────────
    {
      phaseId: 3, lessonId: 2,
      title: "SpinLock：原子 flag + 关中断",
      subtitle: "最简单但最基础的锁",
      type: "Lab",
      duration: "2 hours",
      objectives: [
        "用 AtomicBool + compare_exchange 实现一个正确的 SpinLock<T>",
        "理解为什么单处理器也要关中断——否则 irq 里拿同一把锁就会自锁",
        "用 RAII guard 让 unlock 在 drop 时自动执行，避免忘记释放",
        "写出正确的 drop 顺序：先放锁、再开中断",
      ],
      sections: [
        {
          title: "数据结构与状态机",
          blocks: [
            { type: "paragraph", text: "SpinLock 就是一个字节——locked: AtomicBool——加上被保护的数据。lock() 自旋到把 false CAS 成 true；unlock() 存 false 回去。" },
            { type: "diagram", content:
`  ┌──────────────┐   lock() CAS(false -> true) 成功   ┌──────────────┐
  │    FREE      │ ─────────────────────────────────▶ │    HELD      │
  │ locked=false │                                    │ locked=true  │
  │ irq 未变     │                                    │ irq 已关     │
  └──────────────┘ ◀───── unlock() store(false) ───── └──────────────┘
        ▲                                                     │
        │                                                     │
        └──────── 别的核/任务 CAS 失败，原地自旋 ◀────────────┘` },
            { type: "code", language: "rust", code:
`pub struct SpinLock<T> {
    locked: AtomicBool,
    data:   UnsafeCell<T>,
}
pub struct SpinLockGuard<'a, T> {
    lock:      &'a SpinLock<T>,
    irq_saved: bool,      // 进入前 sstatus.SIE 的值
}
unsafe impl<T: Send> Sync for SpinLock<T> {}` },
          ],
        },
        {
          title: "为什么单核也必须关中断",
          blocks: [
            { type: "paragraph", text: "多核下关中断是为了防止中断处理程序重入同一把锁——这点好理解。但单核呢？直觉上“反正只有一个 CPU，同一时刻只有一个任务在跑”，为什么还要关？" },
            { type: "diagram", content:
`hart 0:
  L.lock()           ← locked 变 true
  ... 临界区 ...
                     ← 时钟中断！
  trap_handler:
    scheduler 把任务 T2 调度上来
    T2 里某处也调用 L.lock()
                     ← 自旋等 locked 变 false
                     ← 但原先持锁的任务 T1 永远没机会继续跑
                     ← hart 0 对自己死锁了` },
            { type: "callout", variant: "warning", text: "这叫“自锁”(self-deadlock)——和多核死锁不同，单核单任务就能复现。xv6 用一对函数 push_off/pop_off 计数式地关/开中断，允许嵌套。我们的 Rust 版用 RAII guard 的 irq_saved 字段记录上下文。" },
            { type: "code", language: "rust", code:
`impl<T> SpinLock<T> {
    pub fn lock(&self) -> SpinLockGuard<'_, T> {
        let saved = disable_and_save_intr();           // ① 先关中断
        while self.locked
            .compare_exchange(false, true,
                              Ordering::Acquire,       // ② 关键
                              Ordering::Relaxed)
            .is_err()
        {
            core::hint::spin_loop();                   // ③ pause 提示
        }
        SpinLockGuard { lock: self, irq_saved: saved }
    }
}
impl<T> Drop for SpinLockGuard<'_, T> {
    fn drop(&mut self) {
        self.lock.locked.store(false, Ordering::Release);  // ④ 先放锁
        restore_intr(self.irq_saved);                      // ⑤ 再恢复中断
    }
}` },
          ],
        },
        {
          title: "三个最致命的 bug",
          blocks: [
            { type: "table", headers: ["错误", "症状", "根因"], rows: [
              ["drop 里先 restore_intr 后 store", "极低概率死锁或数据错乱", "临界区写还没对外可见时就开了中断，irq 处理程序看到旧数据"],
              ["CAS 用 Relaxed 的 success 序", "压力测试下偶发脏读", "受保护数据读被 hoist 到 CAS 之前"],
              ["忘了 core::hint::spin_loop()", "功能正确但热度拉满、别的核饿死", "现代 CPU 需要 pause 提示才能让出流水线给同核兄弟 hart"],
            ]},
            { type: "callout", variant: "tip", text: "Rust 的 Drop + 借用检查器让你“不可能忘记解锁”——只要你不 mem::forget(guard)。对比 C 里 xv6 手写的 acquire/release，能否配对全靠审计，少了一次 release 就是永久死锁。" },
          ],
        },
        {
          title: "RAII guard 的一点哲学",
          blocks: [
            { type: "code", language: "rust", code:
`// 好的用法：guard 的生命周期 = 临界区
{
    let mut g = lock.lock();
    *g += 1;
}   // ← guard drop，自动解锁
// lock 已释放，继续下面的代码

// 坏的用法：临界区比预期长
let mut g = lock.lock();
*g += 1;
some_slow_io();                 // ★ 锁还持有着
*g -= 1;` },
            { type: "paragraph", text: "RAII 把“锁的有效期 = 变量的生命周期”这一不变式交给编译器保证。代价是你必须主动让变量 drop——用 { } 划定作用域或显式 drop(g)。SpinLock 要求临界区极短（几微秒），所以这种控制粒度很重要。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab-spinlock", title: "Lab 1 ⭐ 实现 SpinLock<T>",
          description: "在 src/sync/spin.rs 里实现 SpinLock::lock / try_lock / raw_unlock 和 SpinLockGuard::drop。文件里已有骨架和 HINT 注释。",
          labFile: "labs/phase_3_sync/src/sync/spin.rs",
          hints: [
            "lock() 先关中断再 CAS——顺序反了会在开中断那一瞬间被抢占",
            "drop() 先 store(false, Release) 再 restore_intr",
            "用 compare_exchange_weak 做循环，允许 spurious fail，性能更好",
            "try_lock 不自旋——一次 CAS 失败就返回 None",
          ],
          pseudocode:
`fn lock(&self) -> Guard<'_, T> {
    let saved = disable_intr();
    loop {
        match self.locked.compare_exchange_weak(
            false, true, Acquire, Relaxed)
        {
            Ok(_) => return Guard { lock: self, irq_saved: saved },
            Err(_) => hint::spin_loop(),
        }
    }
}
fn drop(&mut self) {
    self.lock.locked.store(false, Release);
    restore_intr(self.irq_saved);
}`,
        },
      ],
      acceptanceCriteria: [
        "cargo test sync::spin 全部通过（多线程 stress test 含 100k 次 fetch_add）",
        "能回答：单核为什么要关中断？drop 顺序为什么不能反？",
        "会用 compare_exchange_weak 配循环，知道它和 _strong 的区别",
      ],
      references: [
        { title: "xv6-riscv book §6.3", description: "[必读] Code: Locks——push_off/pop_off 的经典实现", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "OSTEP Ch. 28 §28.10", description: "[必读] Spin Locks with Test-and-Set / CAS", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf" },
        { title: "Rust std::sync::atomic", description: "[深入阅读] Ordering 各变体的官方解释，含 examples", url: "https://doc.rust-lang.org/std/sync/atomic/" },
      ],
    },

    // ── Lesson 3 ──────────────────────────────────────────
    {
      phaseId: 3, lessonId: 3,
      title: "SleepLock 与等待队列",
      subtitle: "什么时候该睡、不该自旋",
      type: "Lab",
      duration: "2 hours",
      objectives: [
        "判断一段临界区该用 SpinLock 还是 SleepLock",
        "用 SpinLock + 等待队列 + 调度器 yield 实现阻塞式互斥锁",
        "理解“锁直接交接”如何消除 lost-wakeup 与偷锁",
        "避开惊群问题（thundering herd）",
      ],
      sections: [
        {
          title: "自旋还是睡？一张表说清",
          blocks: [
            { type: "table", headers: ["维度", "SpinLock", "SleepLock"], rows: [
              ["临界区长度", "< 几微秒，几十条指令", "可以几毫秒到几秒"],
              ["持锁时能否睡？", "绝对不能——会死锁调度器", "可以——本身就是阻塞原语"],
              ["中断上下文可用？", "可以（但要关本地中断）", "不可以——中断里不能 yield"],
              ["抢占？", "持锁期间关中断阻止抢占", "持锁期间可被抢占"],
              ["CPU 开销", "等待时 100% CPU 自旋", "等待时让出 CPU，0 开销"],
              ["典型用途", "保护链表头、bump 计数器", "磁盘 I/O、网络、可能扩容的堆分配"],
            ]},
            { type: "callout", variant: "info", text: "经验法则：如果临界区包含任何可能让出 CPU 的调用（I/O、可能触发 panic 的分配、嵌套加锁），就必须用 SleepLock。SpinLock 里调度 = 必死。" },
          ],
        },
        {
          title: "数据结构",
          blocks: [
            { type: "code", language: "rust", code:
`pub struct SleepLock<T> {
    inner: SpinLock<SleepLockInner<T>>,   // ← 内层 SpinLock 保护元数据
}
struct SleepLockInner<T> {
    locked:     bool,
    wait_queue: VecDeque<TaskHandle>,     // 等待任务的句柄
    data:       T,                        // 被保护的数据
}` },
            { type: "callout", variant: "warning", text: "注意嵌套：SleepLock 内部的 wait_queue 本身也是共享状态，需要一把锁——但这把“内锁”不能再是 SleepLock（无限递归），必须是 SpinLock。持内层 SpinLock 的时间极短，只够操作队列。" },
          ],
        },
        {
          title: "lock 与 unlock 的时序",
          blocks: [
            { type: "diagram", content:
`lock() ──┬──── inner.lock()
         │      if !locked:                    ← 幸运路径
         │          locked = true
         │          drop inner guard
         │          return
         │
         └──── else:
                  把 self push 进 wait_queue
                  drop inner guard
                  sched::block_current()       ← 让出 CPU
                  (唤醒时返回，已持锁)

unlock() ────inner.lock()
              if wait_queue 非空:
                  waiter = pop_front()
                  // locked 保持为 true！
                  drop inner guard
                  sched::wake(waiter)          ← 直接交接
              else:
                  locked = false
                  drop inner guard` },
            { type: "callout", variant: "tip", text: "关键设计：unlock 发现有等待者时 **不清 locked 位**，而是把锁“直接交接”给被唤醒的任务。如果先清 locked 再唤醒，第三个任务可能插队 CAS 成功偷走锁，被唤醒的 waiter 醒来发现锁被偷了——还得再睡一次。" },
          ],
        },
        {
          title: "producer-consumer：SleepLock 的典型客户",
          blocks: [
            { type: "code", language: "rust", code:
`// 有界环形缓冲区
static BUF:   SleepLock<RingBuf<u8>>   = ...;
static EMPTY: Semaphore = Semaphore::new(N as isize);   // 空槽数
static FULL:  Semaphore = Semaphore::new(0);            // 满槽数

fn producer(item: u8) {
    EMPTY.down();                  // 等空槽
    BUF.lock().push(item);         // 短临界区写入
    FULL.up();                     // 通知消费者
}
fn consumer() -> u8 {
    FULL.down();                   // 等满槽
    let x = BUF.lock().pop();
    EMPTY.up();
    x
}` },
            { type: "paragraph", text: "BUF 的临界区（push/pop）足够短，用 SpinLock 其实也行——但 EMPTY/FULL 是天然的阻塞：生产得过快时需要睡，不能自旋 10 秒。这就是 Semaphore 存在的理由，下一课详述。" },
          ],
        },
        {
          title: "惊群 (thundering herd)",
          blocks: [
            { type: "paragraph", text: "想象 100 个任务都在等同一把锁。持锁者 unlock 的瞬间如果 **全部唤醒**，它们同时冲向 CAS，只有一个成功，其它 99 个又要睡回去——99 次无用的上下文切换。" },
            { type: "callout", variant: "info", text: "SleepLock 每次只唤醒一个（pop_front + 直接交接），天然无惊群。Condvar 的 notify_all 是显式让你接受惊群——某些场景（例如“所有读者都该醒”）是必要的。notify_one 则只叫一个。" },
          ],
        },
      ],
      exercises: [
        {
          id: "lab-sleeplock", title: "Lab 2 ⭐⭐ 实现 SleepLock<T>",
          description: "在 src/sync/sleep.rs 里实现 SleepLock::lock / unlock，内部 wait_queue 用 VecDeque<TaskHandle>，外层 inner 用你在 Lab 1 写的 SpinLock。",
          labFile: "labs/phase_3_sync/src/sync/sleep.rs",
          hints: [
            "block_current() 要在 drop(inner_guard) 之后调用——否则调度器切走时还持着 SpinLock",
            "unlock 时如果 wait_queue 非空：**不要** 把 locked 改成 false",
            "唤醒用 sched::wake(task_handle)——把任务状态从 Blocked 改回 Ready",
            "测试用例：两个 task 抢同一把 SleepLock，断言序列化而非并发",
          ],
          pseudocode:
`fn lock(&self) {
    let mut g = self.inner.lock();
    if !g.locked {
        g.locked = true;
        return;
    }
    g.wait_queue.push_back(current_task());
    drop(g);                      // ★ 先放内锁
    sched::block_current();       // ★ 再睡
}
fn unlock(&self) {
    let mut g = self.inner.lock();
    if let Some(w) = g.wait_queue.pop_front() {
        // locked 保持 true——直接交接
        drop(g);
        sched::wake(w);
    } else {
        g.locked = false;
    }
}`,
        },
      ],
      acceptanceCriteria: [
        "cargo test sync::sleep 通过",
        "能画出“unlock 清 locked + 唤醒”会产生偷锁的时序图",
        "能说出 SleepLock 的内层锁为什么不能又是 SleepLock",
      ],
      references: [
        { title: "xv6-riscv book §6.5", description: "[必读] Sleep locks——C 版的最小实现，对照 Rust 版", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "OSTEP Ch. 30", description: "[必读] Condition Variables——producer-consumer 的权威讲解", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-cv.pdf" },
        { title: "Linux Kernel Development Ch. 10", description: "[深入阅读] Love 第 10 章——工业级 spin/rw/seqlock/mutex 对比", url: "https://www.oreilly.com/library/view/linux-kernel-development/9780672329463/" },
      ],
    },

    // ── Lesson 4 ──────────────────────────────────────────
    {
      phaseId: 3, lessonId: 4,
      title: "Semaphore / Condvar + 死锁四条件",
      subtitle: "从计数信号量到哲学家就餐",
      type: "Lab + Concept",
      duration: "2.5 hours",
      objectives: [
        "实现计数信号量 Semaphore::{up, down}，理解计数值的物理含义",
        "用 Mutex + Condvar 写出不会丢唤醒的等待循环",
        "背下 Coffman 死锁四条件，能逐一说出破坏方法",
        "用锁排序破解哲学家就餐问题",
      ],
      sections: [
        {
          title: "计数信号量：isize + 等待队列",
          blocks: [
            { type: "paragraph", text: "Semaphore 是 Dijkstra 在 1965 年发明的——原本叫 P (proberen, 尝试) 和 V (verhogen, 增加)。本质是一个 isize 计数器，配一个等待队列。初值是几，就允许几个并发持有者。初值为 1 时退化为互斥锁。" },
            { type: "table", headers: ["计数值", "物理含义"], rows: [
              ["3", "还有 3 个资源可用；尚无等待者"],
              ["0", "资源用完；下次 down 会睡"],
              ["-2", "资源用完 + 等待队列里有 2 个任务"],
            ]},
            { type: "code", language: "rust", code:
`pub struct Semaphore {
    inner: SpinLock<SemInner>,
}
struct SemInner {
    count:      isize,
    wait_queue: VecDeque<TaskHandle>,
}
impl Semaphore {
    pub fn down(&self) {
        let mut g = self.inner.lock();
        g.count -= 1;
        if g.count < 0 {
            g.wait_queue.push_back(current_task());
            drop(g);
            sched::block_current();
        }
    }
    pub fn up(&self) {
        let mut g = self.inner.lock();
        g.count += 1;
        if g.count <= 0 {
            let w = g.wait_queue.pop_front().unwrap();
            drop(g);
            sched::wake(w);
        }
    }
}` },
            { type: "callout", variant: "tip", text: "注意 down 总是先 -1、再判断——这样“剩余资源”与“等待者数量”可以从同一个 count 读出：count ≥ 0 是剩余，count < 0 是 -|等待者|。这种自编码比用两个字段更难写错。" },
          ],
        },
        {
          title: "Condvar：等一个谓词变真",
          blocks: [
            { type: "paragraph", text: "Semaphore 适合资源计数；但当等待条件不能简单映射为“资源数”时（例如“队列里有偶数个元素”），就要用 Condition Variable。Condvar 总是和一个 Mutex 搭配——Mutex 保护谓词涉及的共享状态，Condvar 提供“睡等通知”能力。" },
            { type: "code", language: "rust", code:
`// 标准等待循环——必须用 while 不能用 if
let mut g = mutex.lock();
while !predicate(&*g) {
    g = condvar.wait(g);     // ← 原子地：释放锁 + 入队 + 睡；唤醒后重新加锁
}
// 此时谓词为真且持锁
process(&mut *g);
drop(g);` },
            { type: "callout", variant: "warning", text: "为什么必须用 while？(1) 唤醒可能是“伪唤醒”（某些实现允许）；(2) notify_all 时只有一个赢得锁，其他醒来时谓词又变假；(3) 唤醒和谓词真不是原子的——醒来时别的任务可能已经先改了状态。写 if 在 99% 情况下也对——这就是它危险的地方。" },
          ],
        },
        {
          title: "丢唤醒 (lost wakeup) 与 Condvar::wait 的原子性",
          blocks: [
            { type: "diagram", content:
`错误实现（wait 不原子）：
  Waiter A                         Signaler B
  ----------                       -----------
  mutex.lock()
  check pred → false
  mutex.unlock()
                                   mutex.lock()
                                   set pred = true
                                   condvar.signal()   ← 没人在队列上！
                                   mutex.unlock()
  condvar.wait()                   ← 永远睡下去

正确实现：wait 必须"先入队再放锁"——这两步对外必须原子。
一种做法：wait 内部持有 Condvar 自己的 inner SpinLock 跨越这两步。` },
            { type: "code", language: "rust", code:
`pub fn wait<'a, T>(&self, guard: MutexGuard<'a, T>)
    -> MutexGuard<'a, T>
{
    let mutex = guard.mutex();
    let mut cv_inner = self.inner.lock();     // ① 持住 Condvar 内锁
    cv_inner.wait_queue.push_back(current());  // ② 先入队
    drop(guard);                              // ③ 再放用户 Mutex
    drop(cv_inner);                           // ④ 放 Condvar 内锁
    sched::block_current();                   // ⑤ 睡
    mutex.lock()                              // ⑥ 醒来重拿用户锁
}` },
          ],
        },
        {
          title: "Coffman 死锁四条件",
          blocks: [
            { type: "paragraph", text: "1971 年 Coffman 证明：死锁发生当且仅当以下四条件同时成立。破坏任何一条，死锁不可能发生。" },
            { type: "table", headers: ["条件", "含义", "破坏方法"], rows: [
              ["① Mutual exclusion", "资源不可共享", "改用读写锁 / RCU / 无锁结构——不总是可行"],
              ["② Hold and wait", "持有资源的同时请求另一个", "一次性申请所有锁（two-phase locking）"],
              ["③ No preemption", "内核不能剥夺已分配的锁", "超时回滚（try_lock + 失败重来）"],
              ["④ Circular wait", "等待图中存在环", "全局锁排序——总是按固定顺序获取"],
            ]},
            { type: "callout", variant: "info", text: "工程上最常用的是破坏 ④：给所有锁一个全局序（例如按地址排序），永远升序获取。这样等待图每条边都是“升序”，不可能成环。" },
          ],
        },
        {
          title: "哲学家就餐：一个必经的死锁练习",
          blocks: [
            { type: "diagram", content:
`5 位哲学家，5 根筷子，每人左右各一根。每人反复：思考 → 拿左 → 拿右 → 吃 → 放左 → 放右。

所有人同时拿起"左"筷子后的死锁：
       P0 ──持有──▶ F0 ──等待──▶ P1
        ▲                          │
        │                          持有
       等待                         │
        │                          ▼
        F4 ◀──持有── P4 ◀──等待── F1
                     ▲             │
                     │            持有
                    等待           │
                     │             ▼
                     F3 ◀──持有── P2 ──等待──▶ F2

五条边首尾相连——完美的循环等待。` },
            { type: "paragraph", text: "经典解法（破坏条件 ④）：给筷子编号 0..4，每人拿 min(左号, 右号) 再拿另一根。这样 P4 会先拿 F0 再拿 F4（因为 0 < 4），不再形成环。另一种（破坏 ②）：拿之前做 try_lock，失败就把已拿的也放回去。" },
            { type: "code", language: "rust", code:
`// labs/phase_3_sync/user/src/bin/philosopher_dinner.rs 大意
fn philosopher(id: usize, forks: &[Mutex<()>; 5]) {
    let (a, b) = {
        let l = id;
        let r = (id + 1) % 5;
        if l < r { (l, r) } else { (r, l) }   // ★ 小编号先
    };
    loop {
        think();
        let _ga = forks[a].lock();
        let _gb = forks[b].lock();
        eat();
    }
}` },
          ],
        },
      ],
      exercises: [
        {
          id: "lab-sem-cv", title: "Lab 3a ⭐⭐ Semaphore + Condvar",
          description: "在 src/sync/semaphore.rs 和 src/sync/condvar.rs 里实现 Semaphore::{up,down}、Condvar::{wait,notify_one,notify_all}。",
          labFile: "labs/phase_3_sync/src/sync/semaphore.rs",
          hints: [
            "Semaphore 内部 SpinLock 保护 (count, wait_queue) 整体",
            "Condvar::wait 必须做到“入队 + 放 mutex”对外原子——要想清顺序",
            "notify_all 可以一次性 pop 整个队列，逐个 wake",
            "每个原语都要写 stress test：2 个 producer + 2 个 consumer 跑 10000 次",
          ],
          pseudocode:
`// Semaphore
fn down(&self) {
    let mut g = self.inner.lock();
    g.count -= 1;
    if g.count < 0 {
        g.wait_queue.push_back(current());
        drop(g);
        sched::block_current();
    }
}
fn up(&self) {
    let mut g = self.inner.lock();
    g.count += 1;
    if g.count <= 0 {
        let w = g.wait_queue.pop_front().unwrap();
        drop(g);
        sched::wake(w);
    }
}`,
        },
        {
          id: "lab-philosopher", title: "Lab 3b ⭐ 哲学家就餐——不死锁版",
          description: "在 user/src/bin/philosopher_dinner.rs 里用 5 把 Mutex 模拟 5 根筷子。用锁排序保证 60 秒内所有哲学家心跳都在推进。",
          labFile: "labs/phase_3_sync/src/sync/mutex.rs",
          hints: [
            "让 P0..P4 都按 min(left, right) 先拿——只有 P4 行为和其他人不同",
            "加 HEARTBEAT: [AtomicUsize; 5]，每次 eat() +1",
            "main 监控 60 秒：所有心跳严格单调递增 = 通过",
          ],
        },
      ],
      acceptanceCriteria: [
        "cargo test sync::{semaphore,condvar,mutex} 全部通过",
        "philosopher_dinner 运行 60 秒不死锁，5 个心跳都在增长",
        "能背出 Coffman 四条件并对每条说出至少一种破坏方法",
        "能解释 Condvar::wait 为什么需要“入队 + 放锁”的原子性",
      ],
      references: [
        { title: "OSTEP Ch. 31", description: "[必读] Semaphores——从 down/up 到生产者消费者、读者写者、哲学家", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf" },
        { title: "OSTEP Ch. 32", description: "[必读] Common Concurrency Problems——死锁与非死锁 bug 的分类学", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf" },
        { title: "rCore-Tutorial Ch. 5", description: "[深入阅读] 姊妹教程的进程与同步章节，Rust 实现", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter5/" },
      ],
    },
  ],
};

// ─── Phase 3: Concurrency & Locks (en) ──────────────────

export const phase3En: PhaseContent = {
  phaseId: 3,
  color: "#7C3AED",
  accent: "#A78BFA",
  lessons: [
    // ── Lesson 1 ──────────────────────────────────────────
    {
      phaseId: 3, lessonId: 1,
      title: "Phase 3 Overview: Race Conditions and Atomic Instructions",
      subtitle: "From lost updates to the RISC-V A extension",
      type: "Concept",
      duration: "1.5 hours",
      objectives: [
        "Reconstruct a lost update using a plain counter += 1 example",
        "Distinguish atomicity, critical section, and race condition precisely",
        "Know the three core RISC-V A-extension instructions: amoswap.w / lr.w / sc.w",
        "Pick the right Rust memory ordering: Acquire / Release / SeqCst",
      ],
      sections: [
        {
          title: "The counter that forgets",
          blocks: [
            { type: "paragraph", text: "Phase 2 gave you preemptive scheduling — a timer IRQ can fire between any two instructions. Now let two tasks each run counter += 1 ten thousand times. Expected final value: 20000. Observed: anywhere from 10002 to 19998, never exact." },
            { type: "code", language: "asm", code:
`# counter += 1 is NOT one instruction on RISC-V:
lw   t0, (a0)      # 1. load counter
addi t0, t0, 1     # 2. add in register
sw   t0, (a0)      # 3. store back` },
            { type: "diagram", content:
`counter starts at 5. Both T1 and T2 do +1. One "lost update" interleaving:

T1: lw  t0 <- 5       ───┐
                         │  (timer IRQ, switch to T2)
T2: lw  t0 <- 5          │
T2: addi t0 = 6          │
T2: sw  6 -> counter     │  ← counter = 6
                         │  (switch back)
T1: addi t0 = 6       ───┘
T1: sw  6 -> counter      ← counter = 6 (should be 7)

Two increments, one effect. T2's write was lost.` },
            { type: "callout", variant: "warning", text: "This bug is brutal: fails 1-in-1000, only appears in production after days. The only reliable fix is to make the whole operation semantically indivisible — atomic." },
          ],
        },
        {
          title: "Three concepts you must keep apart",
          blocks: [
            { type: "table", headers: ["Concept", "Definition", "In the counter example"], rows: [
              ["Race condition", "Correctness depends on relative timing", "Two tasks both +1; result depends on interleaving"],
              ["Atomicity", "No other CPU/task can observe a half-done state", "Single aligned lw/sw is atomic; lw+addi+sw is not"],
              ["Critical section", "Code region that touches shared state", "The three-instruction block that forms counter += 1"],
            ]},
            { type: "callout", variant: "info", text: "Rule of thumb: if a variable is read and written by more than one task, either wrap it in a lock or make every access a single atomic instruction. Middle grounds are bugs." },
          ],
        },
        {
          title: "RISC-V A extension: atomic instructions from hardware",
          blocks: [
            { type: "paragraph", text: "The A (Atomic) extension adds single-instruction read-modify-write operations. The hardware guarantees each one appears instantaneous to other harts. Rust's AtomicBool::compare_exchange / AtomicUsize::fetch_add all lower to these." },
            { type: "table", headers: ["Instruction", "Semantics", "Typical use"], rows: [
              ["amoswap.w.aq rd,rs2,(rs1)", "rd = *rs1;  *rs1 = rs2  (with acquire)", "SpinLock lock — swap 1 in, see if old was 0"],
              ["amoadd.w.aqrl rd,rs2,(rs1)", "rd = *rs1;  *rs1 += rs2", "Atomic counters, fetch_add"],
              ["lr.w rd, (rs1)", "Load and set a reservation on the address", "First half of a CAS loop"],
              ["sc.w rd, rs2, (rs1)", "If reservation still held: write and return 0; else return 1", "Second half; pair with lr.w for lock-free algos"],
              ["amocas.w (Zacas)", "Single-instruction compare-and-swap", "Newer hardware; xv6-riscv doesn't require it"],
            ]},
            { type: "code", language: "asm", code:
`# Typical lr/sc CAS loop: change *a0 from old (a1) to new (a2)
retry:
    lr.w   t0, (a0)        # load-reserved
    bne    t0, a1, fail    # expected value mismatch
    sc.w   t1, a2, (a0)    # store-conditional
    bnez   t1, retry       # reservation broken — retry
fail:` },
            { type: "callout", variant: "tip", text: "amoswap always writes. lr/sc may not. Under low contention, lr/sc avoids a cache-line ping-pong — but the RISC-V spec limits the lr/sc window to 16 instructions or fewer, or sc will always fail. Keep the loop body tiny." },
          ],
        },
        {
          title: "Memory ordering: Acquire / Release / SeqCst",
          blocks: [
            { type: "paragraph", text: "Atomicity only says \"this instruction is not torn.\" Compilers and out-of-order CPUs still reorder ordinary loads/stores around it. Every Rust atomic op takes an Ordering that tells optimizers which reorderings are allowed." },
            { type: "table", headers: ["Ordering", "Effect", "When to use"], rows: [
              ["Relaxed", "Only this op is atomic; neighbours may reorder freely", "Plain counters, statistics"],
              ["Acquire", "Loads/stores after this cannot be hoisted before it", "The moment lock() succeeds — subsequent reads must see fresh data"],
              ["Release", "Loads/stores before this cannot be sunk after it", "unlock() — writes inside CS must be visible to the next acquirer"],
              ["AcqRel", "Acquire + Release (only meaningful on RMW)", "compare_exchange success ordering"],
              ["SeqCst", "All SeqCst ops share one global total order", "Safe default when unsure; costs the most"],
            ]},
            { type: "callout", variant: "warning", text: "Lab 1's most common bug: lock() CAS uses Relaxed. The compiler hoists reads of the protected data above the CAS — you see stale data before the lock was even taken. Mnemonic: lock with Acquire, unlock with Release." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab-race-demo", title: "Exercise: reproduce the lost update",
          description: "On top of Phase 2's preemptive scheduler, run two tasks each doing counter += 1 one hundred thousand times and print the total. Run it a few times to see the jitter. Then swap counter for AtomicUsize::fetch_add and confirm it's always 200000.",
          labFile: "labs/phase_3_sync/src/sync/spin.rs",
          hints: [
            "First version: no lock, no Atomic — watch the race with your own eyes",
            "Second version: core::sync::atomic::AtomicUsize with Ordering::Relaxed is enough",
            "Disassemble the racy version to see lw/addi/sw — visual proof cements the lesson",
          ],
          pseudocode:
`// racy version
static mut COUNTER: usize = 0;
for _ in 0..100_000 { unsafe { COUNTER += 1; } }

// atomic version
static COUNTER: AtomicUsize = AtomicUsize::new(0);
for _ in 0..100_000 { COUNTER.fetch_add(1, Ordering::Relaxed); }`,
        },
      ],
      acceptanceCriteria: [
        "Can draw the lost-update timeline with counter += 1 for someone else",
        "Can explain when to pick amoswap vs lr/sc",
        "Can explain why lock uses Acquire and unlock uses Release",
      ],
      references: [
        { title: "xv6-riscv book Ch. 6", description: "[Required] Locking — the canonical race-to-spinlock walkthrough", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "OSTEP Ch. 28", description: "[Required] Locks — the authoritative conceptual chapter", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf" },
        { title: "RISC-V A Extension Spec", description: "[Deep dive] Authoritative amoswap / lr.w / sc.w semantics", url: "https://github.com/riscv/riscv-isa-manual/releases" },
      ],
    },

    // ── Lesson 2 ──────────────────────────────────────────
    {
      phaseId: 3, lessonId: 2,
      title: "SpinLock: atomic flag + disabled interrupts",
      subtitle: "The simplest lock that actually works",
      type: "Lab",
      duration: "2 hours",
      objectives: [
        "Build a correct SpinLock<T> from AtomicBool + compare_exchange",
        "Explain why even a uniprocessor must disable IRQs — otherwise an IRQ taking the same lock deadlocks with itself",
        "Use an RAII guard so unlock runs in Drop and can't be forgotten",
        "Get the drop order right: release the flag first, then restore IRQs",
      ],
      sections: [
        {
          title: "Data structure and state machine",
          blocks: [
            { type: "paragraph", text: "A SpinLock is one byte — locked: AtomicBool — plus the protected data. lock() spins until it CASes false into true; unlock() stores false back." },
            { type: "diagram", content:
`  ┌──────────────┐   lock() CAS(false -> true) success  ┌──────────────┐
  │    FREE      │ ─────────────────────────────────────▶│    HELD      │
  │ locked=false │                                       │ locked=true  │
  │ irq untouched│                                       │ irq disabled │
  └──────────────┘ ◀──── unlock() store(false) ────────  └──────────────┘
        ▲                                                       │
        │                                                       │
        └──── other hart/task: CAS fails, spin in place ◀──────┘` },
            { type: "code", language: "rust", code:
`pub struct SpinLock<T> {
    locked: AtomicBool,
    data:   UnsafeCell<T>,
}
pub struct SpinLockGuard<'a, T> {
    lock:      &'a SpinLock<T>,
    irq_saved: bool,      // sstatus.SIE value before lock()
}
unsafe impl<T: Send> Sync for SpinLock<T> {}` },
          ],
        },
        {
          title: "Why disable interrupts even on a single core",
          blocks: [
            { type: "paragraph", text: "On multicore, disabling IRQs protects against an interrupt handler re-entering the same lock — easy to see. But on a single core, intuition says \"only one task runs at a time, why bother?\"" },
            { type: "diagram", content:
`hart 0:
  L.lock()           ← locked becomes true
  ... critical section ...
                     ← timer IRQ!
  trap_handler:
    scheduler picks task T2
    T2 somewhere calls L.lock()
                     ← spins waiting for locked = false
                     ← but T1 (the holder) never resumes
                     ← hart 0 deadlocks with itself` },
            { type: "callout", variant: "warning", text: "This is self-deadlock — unlike multicore deadlock, a single hart with a single task can reproduce it. xv6 uses push_off/pop_off to count nested disable/enable. Our Rust version puts the saved state in the RAII guard's irq_saved field." },
            { type: "code", language: "rust", code:
`impl<T> SpinLock<T> {
    pub fn lock(&self) -> SpinLockGuard<'_, T> {
        let saved = disable_and_save_intr();           // ① disable IRQs first
        while self.locked
            .compare_exchange(false, true,
                              Ordering::Acquire,       // ② matters
                              Ordering::Relaxed)
            .is_err()
        {
            core::hint::spin_loop();                   // ③ pause hint
        }
        SpinLockGuard { lock: self, irq_saved: saved }
    }
}
impl<T> Drop for SpinLockGuard<'_, T> {
    fn drop(&mut self) {
        self.lock.locked.store(false, Ordering::Release);  // ④ release lock first
        restore_intr(self.irq_saved);                      // ⑤ then restore IRQs
    }
}` },
          ],
        },
        {
          title: "Three deadly bugs",
          blocks: [
            { type: "table", headers: ["Mistake", "Symptom", "Root cause"], rows: [
              ["drop: restore_intr before store", "Very rare deadlock / corruption", "CS writes not yet visible when IRQ sees old state"],
              ["CAS success ordering = Relaxed", "Stale reads under stress tests", "Protected reads hoisted above the CAS"],
              ["Forgot core::hint::spin_loop()", "Correct but starves sibling harts", "Modern CPUs need pause to yield pipeline to SMT peer"],
            ]},
            { type: "callout", variant: "tip", text: "Rust's Drop + borrow checker make it \"impossible to forget unlock\" — as long as you don't mem::forget the guard. Compare xv6's hand-written acquire/release in C: pairing them is an audit obligation; miss one release = permanent deadlock." },
          ],
        },
        {
          title: "A little RAII philosophy",
          blocks: [
            { type: "code", language: "rust", code:
`// Good: guard lifetime == critical section
{
    let mut g = lock.lock();
    *g += 1;
}   // ← guard drops, lock auto-released
// continue without holding the lock

// Bad: CS accidentally long
let mut g = lock.lock();
*g += 1;
some_slow_io();                 // ★ still holding the lock
*g -= 1;` },
            { type: "paragraph", text: "RAII hands the compiler the invariant \"lock lifetime = variable lifetime.\" The price: you must actively let the guard drop — use a { } scope, or call drop(g) explicitly. Since SpinLock assumes microsecond CS, this fine control matters." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab-spinlock", title: "Lab 1 ⭐ Implement SpinLock<T>",
          description: "In src/sync/spin.rs, implement SpinLock::lock / try_lock / raw_unlock and SpinLockGuard::drop. A scaffold and HINT comments are already in the file.",
          labFile: "labs/phase_3_sync/src/sync/spin.rs",
          hints: [
            "lock(): disable IRQs first, then CAS — reverse order gets you preempted the instant IRQs come back on",
            "drop(): store(false, Release) first, restore_intr second",
            "Use compare_exchange_weak in a loop — spurious failures are cheaper",
            "try_lock: one CAS attempt, return None on failure (no spin)",
          ],
          pseudocode:
`fn lock(&self) -> Guard<'_, T> {
    let saved = disable_intr();
    loop {
        match self.locked.compare_exchange_weak(
            false, true, Acquire, Relaxed)
        {
            Ok(_)  => return Guard { lock: self, irq_saved: saved },
            Err(_) => hint::spin_loop(),
        }
    }
}
fn drop(&mut self) {
    self.lock.locked.store(false, Release);
    restore_intr(self.irq_saved);
}`,
        },
      ],
      acceptanceCriteria: [
        "cargo test sync::spin all green (including 100k-iteration fetch_add stress test)",
        "Can explain: why disable IRQs on one core? why can't drop order be reversed?",
        "Knows compare_exchange_weak vs _strong and when each is preferable",
      ],
      references: [
        { title: "xv6-riscv book §6.3", description: "[Required] Code: Locks — the canonical push_off/pop_off implementation", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "OSTEP Ch. 28 §28.10", description: "[Required] Spin Locks with Test-and-Set / CAS", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf" },
        { title: "Rust std::sync::atomic", description: "[Deep dive] Official Ordering explainer with examples", url: "https://doc.rust-lang.org/std/sync/atomic/" },
      ],
    },

    // ── Lesson 3 ──────────────────────────────────────────
    {
      phaseId: 3, lessonId: 3,
      title: "SleepLock and wait queues",
      subtitle: "When to sleep, when to spin",
      type: "Lab",
      duration: "2 hours",
      objectives: [
        "Pick SpinLock vs SleepLock for a given critical section",
        "Build a blocking mutex from SpinLock + wait queue + scheduler yield",
        "Explain how \"direct handoff\" on unlock avoids lost wakeups and lock stealing",
        "Avoid the thundering herd",
      ],
      sections: [
        {
          title: "Spin or sleep? One table decides",
          blocks: [
            { type: "table", headers: ["Dimension", "SpinLock", "SleepLock"], rows: [
              ["CS length", "< a few µs, dozens of instructions", "ms to seconds is fine"],
              ["Can you sleep while holding?", "Never — scheduler deadlock", "Yes — it's itself a blocking primitive"],
              ["Usable in IRQ context?", "Yes (with local IRQs off)", "No — cannot yield in an IRQ handler"],
              ["Preemption?", "IRQs off while held ⇒ no preempt", "Preemptable while held"],
              ["CPU cost while waiting", "100% busy-wait", "Zero — scheduler runs something else"],
              ["Typical use", "List heads, bump counters", "Disk I/O, network, heap-growing alloc"],
            ]},
            { type: "callout", variant: "info", text: "Rule of thumb: if the CS contains any call that can yield (I/O, fallible alloc, nested locking), you MUST use SleepLock. Yielding inside a SpinLock means certain death." },
          ],
        },
        {
          title: "Data structure",
          blocks: [
            { type: "code", language: "rust", code:
`pub struct SleepLock<T> {
    inner: SpinLock<SleepLockInner<T>>,   // ← inner SpinLock guards metadata
}
struct SleepLockInner<T> {
    locked:     bool,
    wait_queue: VecDeque<TaskHandle>,     // blocked task handles
    data:       T,                        // protected data
}` },
            { type: "callout", variant: "warning", text: "Nesting caveat: the wait_queue itself is shared state and needs its own lock — but that inner lock can't be another SleepLock (infinite recursion). It must be a SpinLock. Hold it only long enough to manipulate the queue." },
          ],
        },
        {
          title: "lock and unlock timelines",
          blocks: [
            { type: "diagram", content:
`lock() ──┬──── inner.lock()
         │      if !locked:                    ← happy path
         │          locked = true
         │          drop inner guard
         │          return
         │
         └──── else:
                  push self onto wait_queue
                  drop inner guard
                  sched::block_current()       ← yield CPU
                  (on wake: return, holding lock)

unlock() ────inner.lock()
              if wait_queue non-empty:
                  waiter = pop_front()
                  // keep locked = true!
                  drop inner guard
                  sched::wake(waiter)          ← direct handoff
              else:
                  locked = false
                  drop inner guard` },
            { type: "callout", variant: "tip", text: "Key design: on unlock with waiters, do NOT clear locked. Hand the lock over directly to the woken task. If you cleared locked and then woke, a third task could CAS true before the waiter gets scheduled — lock stolen, waiter has to sleep again." },
          ],
        },
        {
          title: "Producer-consumer: SleepLock's canonical customer",
          blocks: [
            { type: "code", language: "rust", code:
`// Bounded ring buffer
static BUF:   SleepLock<RingBuf<u8>>   = ...;
static EMPTY: Semaphore = Semaphore::new(N as isize);   // empty slots
static FULL:  Semaphore = Semaphore::new(0);            // filled slots

fn producer(item: u8) {
    EMPTY.down();                  // wait for empty slot
    BUF.lock().push(item);         // short CS
    FULL.up();                     // signal consumers
}
fn consumer() -> u8 {
    FULL.down();                   // wait for filled slot
    let x = BUF.lock().pop();
    EMPTY.up();
    x
}` },
            { type: "paragraph", text: "BUF's CS (push/pop) is short enough that SpinLock would also work. But EMPTY/FULL are inherently blocking — producer may need to sleep for seconds, not spin. That is the whole raison d'être of semaphores; next lesson." },
          ],
        },
        {
          title: "Thundering herd",
          blocks: [
            { type: "paragraph", text: "Imagine 100 tasks all waiting on one lock. If unlock wakes them ALL, they race to CAS — one wins, 99 lose and sleep again. 99 wasted context switches." },
            { type: "callout", variant: "info", text: "SleepLock wakes exactly one (pop_front + direct handoff) — no herd. Condvar::notify_all explicitly opts in to a herd; sometimes correct (\"all readers should wake\"). Use notify_one when you only need one woken." },
          ],
        },
      ],
      exercises: [
        {
          id: "lab-sleeplock", title: "Lab 2 ⭐⭐ Implement SleepLock<T>",
          description: "In src/sync/sleep.rs, implement SleepLock::lock / unlock. The wait_queue is VecDeque<TaskHandle>; the inner lock is your Lab 1 SpinLock.",
          labFile: "labs/phase_3_sync/src/sync/sleep.rs",
          hints: [
            "Call block_current() AFTER drop(inner_guard) — otherwise you yield while still holding the SpinLock",
            "On unlock with non-empty queue, do NOT set locked = false — keep it true for the direct handoff",
            "Waking uses sched::wake(handle) to move the task from Blocked to Ready",
            "Test: two tasks contend on one SleepLock — assert serialization (not interleaving)",
          ],
          pseudocode:
`fn lock(&self) {
    let mut g = self.inner.lock();
    if !g.locked {
        g.locked = true;
        return;
    }
    g.wait_queue.push_back(current_task());
    drop(g);                      // ★ release inner lock first
    sched::block_current();       // ★ then sleep
}
fn unlock(&self) {
    let mut g = self.inner.lock();
    if let Some(w) = g.wait_queue.pop_front() {
        // keep locked = true — direct handoff
        drop(g);
        sched::wake(w);
    } else {
        g.locked = false;
    }
}`,
        },
      ],
      acceptanceCriteria: [
        "cargo test sync::sleep passes",
        "Can draw the timeline where \"clear locked + wake\" causes a stolen lock",
        "Can explain why the inner lock of a SleepLock cannot itself be a SleepLock",
      ],
      references: [
        { title: "xv6-riscv book §6.5", description: "[Required] Sleep locks — the minimal C version to compare against Rust", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "OSTEP Ch. 30", description: "[Required] Condition Variables — producer-consumer from first principles", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-cv.pdf" },
        { title: "Linux Kernel Development Ch. 10", description: "[Deep dive] Love Ch. 10 — industrial spin/rw/seqlock/mutex comparison", url: "https://www.oreilly.com/library/view/linux-kernel-development/9780672329463/" },
      ],
    },

    // ── Lesson 4 ──────────────────────────────────────────
    {
      phaseId: 3, lessonId: 4,
      title: "Semaphore / Condvar + the four conditions for deadlock",
      subtitle: "From counting semaphores to the dining philosophers",
      type: "Lab + Concept",
      duration: "2.5 hours",
      objectives: [
        "Implement Semaphore::{up, down}; read the physical meaning of the counter",
        "Write a wait loop with Mutex + Condvar that cannot lose wakeups",
        "Memorize Coffman's four conditions and one way to break each",
        "Break the dining philosophers deadlock with lock ordering",
      ],
      sections: [
        {
          title: "Counting semaphore: isize + wait queue",
          blocks: [
            { type: "paragraph", text: "Semaphores were invented by Dijkstra in 1965 — originally P (proberen, \"to try\") and V (verhogen, \"to raise\"). An isize counter plus a wait queue. Initial value N allows N concurrent holders. Initial value 1 degenerates into a mutex." },
            { type: "table", headers: ["count value", "physical meaning"], rows: [
              ["3", "3 resources available; no waiters"],
              ["0", "Resources exhausted; next down blocks"],
              ["-2", "Resources exhausted + 2 tasks in the wait queue"],
            ]},
            { type: "code", language: "rust", code:
`pub struct Semaphore {
    inner: SpinLock<SemInner>,
}
struct SemInner {
    count:      isize,
    wait_queue: VecDeque<TaskHandle>,
}
impl Semaphore {
    pub fn down(&self) {
        let mut g = self.inner.lock();
        g.count -= 1;
        if g.count < 0 {
            g.wait_queue.push_back(current_task());
            drop(g);
            sched::block_current();
        }
    }
    pub fn up(&self) {
        let mut g = self.inner.lock();
        g.count += 1;
        if g.count <= 0 {
            let w = g.wait_queue.pop_front().unwrap();
            drop(g);
            sched::wake(w);
        }
    }
}` },
            { type: "callout", variant: "tip", text: "Note: down decrements first then checks — so one count value encodes both \"remaining resources\" (≥ 0) and \"negated waiter count\" (< 0). This self-encoding is harder to desync than two separate fields." },
          ],
        },
        {
          title: "Condvar: sleep until a predicate becomes true",
          blocks: [
            { type: "paragraph", text: "Semaphores suit resource counting. When the waiting condition doesn't map cleanly to \"a count\" (e.g. \"queue has an even number of elements\"), use a Condition Variable. A Condvar always pairs with a Mutex — Mutex protects the state the predicate reads, Condvar provides sleep-and-notify." },
            { type: "code", language: "rust", code:
`// Canonical wait loop — use while, NOT if
let mut g = mutex.lock();
while !predicate(&*g) {
    g = condvar.wait(g);     // ← atomically: release lock + enqueue + sleep;
                             //   reacquire on wake
}
// predicate now true AND lock held
process(&mut *g);
drop(g);` },
            { type: "callout", variant: "warning", text: "Why while, not if? (1) Some implementations allow spurious wakeups; (2) notify_all wakes many but only one gets the mutex — others re-find a false predicate; (3) wake + predicate-true is not atomic. if works 99% of the time — which is exactly what makes it dangerous." },
          ],
        },
        {
          title: "Lost wakeups and the atomicity of Condvar::wait",
          blocks: [
            { type: "diagram", content:
`Broken implementation (wait not atomic):
  Waiter A                         Signaler B
  ----------                       -----------
  mutex.lock()
  check pred → false
  mutex.unlock()
                                   mutex.lock()
                                   set pred = true
                                   condvar.signal()   ← nobody in queue!
                                   mutex.unlock()
  condvar.wait()                   ← sleeps forever

Correct: wait() must "enqueue THEN release mutex" atomically from the
outside. One technique: hold the Condvar's own inner SpinLock across
both steps.` },
            { type: "code", language: "rust", code:
`pub fn wait<'a, T>(&self, guard: MutexGuard<'a, T>)
    -> MutexGuard<'a, T>
{
    let mutex = guard.mutex();
    let mut cv_inner = self.inner.lock();      // ① take Condvar's inner lock
    cv_inner.wait_queue.push_back(current());   // ② enqueue first
    drop(guard);                               // ③ then release user mutex
    drop(cv_inner);                            // ④ release Condvar inner
    sched::block_current();                    // ⑤ sleep
    mutex.lock()                               // ⑥ reacquire on wake
}` },
          ],
        },
        {
          title: "Coffman's four conditions",
          blocks: [
            { type: "paragraph", text: "Coffman (1971) proved: deadlock occurs iff all four conditions hold simultaneously. Break any one — deadlock becomes impossible." },
            { type: "table", headers: ["Condition", "Meaning", "How to break"], rows: [
              ["① Mutual exclusion", "Resources are non-shareable", "Switch to rwlock / RCU / lock-free — not always possible"],
              ["② Hold and wait", "Hold a resource while asking for another", "Acquire all locks at once (two-phase locking)"],
              ["③ No preemption", "Kernel can't yank a lock away", "Timeouts with rollback (try_lock + retry)"],
              ["④ Circular wait", "A cycle in the wait-for graph", "Global lock ordering — always acquire in fixed order"],
            ]},
            { type: "callout", variant: "info", text: "In practice ④ is broken most often: give every lock a global order (e.g. by address), always acquire ascending. Every edge in the wait-for graph points \"up,\" so no cycle is possible." },
          ],
        },
        {
          title: "Dining philosophers: a mandatory deadlock drill",
          blocks: [
            { type: "diagram", content:
`5 philosophers, 5 forks, each has one on left and right. Each repeats:
think -> pick up left -> pick up right -> eat -> put left -> put right.

If all pick up "left" at once, here is the deadlock:
       P0 ──holds──▶ F0 ──wanted by──▶ P1
        ▲                                │
        │                               holds
       wants                             │
        │                                ▼
        F4 ◀──holds── P4 ◀──wants── F1
                      ▲              │
                      │             holds
                     wants           │
                      │              ▼
                      F3 ◀──holds── P2 ──wants──▶ F2

Five edges head-to-tail — a perfect cycle.` },
            { type: "paragraph", text: "Classic fix (break ④): number the forks 0..4, each philosopher grabs min(left, right) first. Now P4 picks up F0 before F4 (since 0 < 4), and the cycle cannot form. Another fix (break ②): use try_lock, and if the second grab fails, release the first and retry." },
            { type: "code", language: "rust", code:
`// Gist of labs/phase_3_sync/user/src/bin/philosopher_dinner.rs
fn philosopher(id: usize, forks: &[Mutex<()>; 5]) {
    let (a, b) = {
        let l = id;
        let r = (id + 1) % 5;
        if l < r { (l, r) } else { (r, l) }   // ★ smaller index first
    };
    loop {
        think();
        let _ga = forks[a].lock();
        let _gb = forks[b].lock();
        eat();
    }
}` },
          ],
        },
      ],
      exercises: [
        {
          id: "lab-sem-cv", title: "Lab 3a ⭐⭐ Semaphore + Condvar",
          description: "In src/sync/semaphore.rs and src/sync/condvar.rs, implement Semaphore::{up,down} and Condvar::{wait,notify_one,notify_all}.",
          labFile: "labs/phase_3_sync/src/sync/semaphore.rs",
          hints: [
            "Semaphore's inner SpinLock must guard (count, wait_queue) together",
            "Condvar::wait must enqueue BEFORE releasing the user mutex — think the ordering through",
            "notify_all can drain the queue in one pop loop, calling wake on each",
            "Stress test each: 2 producers + 2 consumers × 10000 iterations",
          ],
          pseudocode:
`// Semaphore
fn down(&self) {
    let mut g = self.inner.lock();
    g.count -= 1;
    if g.count < 0 {
        g.wait_queue.push_back(current());
        drop(g);
        sched::block_current();
    }
}
fn up(&self) {
    let mut g = self.inner.lock();
    g.count += 1;
    if g.count <= 0 {
        let w = g.wait_queue.pop_front().unwrap();
        drop(g);
        sched::wake(w);
    }
}`,
        },
        {
          id: "lab-philosopher", title: "Lab 3b ⭐ Dining philosophers — deadlock-free",
          description: "In user/src/bin/philosopher_dinner.rs, use 5 Mutexes as forks. Apply lock ordering so that over 60 seconds every philosopher's heartbeat keeps advancing.",
          labFile: "labs/phase_3_sync/src/sync/mutex.rs",
          hints: [
            "Everyone picks min(left, right) first — only P4 behaves differently from the others",
            "Add HEARTBEAT: [AtomicUsize; 5]; +1 per eat()",
            "main watches for 60s: strictly monotonic increase on all five = pass",
          ],
        },
      ],
      acceptanceCriteria: [
        "cargo test sync::{semaphore,condvar,mutex} all green",
        "philosopher_dinner runs 60s without deadlock; all five heartbeats climb",
        "Can recite Coffman's four conditions and one way to break each",
        "Can explain why Condvar::wait needs \"enqueue + release\" atomicity",
      ],
      references: [
        { title: "OSTEP Ch. 31", description: "[Required] Semaphores — down/up through producer-consumer, readers-writers, philosophers", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf" },
        { title: "OSTEP Ch. 32", description: "[Required] Common Concurrency Problems — taxonomy of deadlock and non-deadlock bugs", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf" },
        { title: "rCore-Tutorial Ch. 5", description: "[Deep dive] Sister tutorial's process + synchronization chapter in Rust", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter5/" },
      ],
    },
  ],
};
