# Phase 2 — 进程：任务抽象与调度

> **目标。** 把 Phase 1 的单任务内核升级为多任务内核。到本阶段末，你会写出一段
> 14 行、却是一切现代 OS 调度器之魂的汇编；并让三个用户程序在你亲手配置的
> 10 ms 时钟中断下被抢占式调度。

---

## 2.0 导读：进程到底是什么？

Phase 1 里我们只跑一个用户程序。执行是一条笔直的线：
`_start → ecall → trap_handler → sret → user code → exit`。
寄存器和一个内核栈就够了。

现在要跑 *N* 个程序。它们共享一个 CPU，这意味着我们必须能 **暂停**
一个任务、**恢复** 另一个任务。那么，内核里 "一个任务" 具体是什么？

任务 = **(一个 Task Control Block) + (一个内核栈) + (一个用户栈)**。

- **TCB** 是内核数据段里一个朴素的 Rust 结构体。它存着任务状态
  (Ready/Running/Exited)、栈指针，以及——最关键的——一个 `TaskContext`：
  让这个任务起死回生所需的最小寄存器快照。
- **内核栈** 是该任务 ecall 进入内核后运行所用。每个任务一个，这样在
  `trap_handler` 中途暂停 A 时，B 也能进入 `trap_handler` 而不踩脏 A 的栈帧。
- **用户栈** 是任务自己的内存，内核不碰。

没有一个漂浮在天上的 "进程对象"。进程 **就是** 这三块内存。
后面 Phase 3–5 会再加东西（地址空间、文件表、父指针……），但骨架已经在这里。

---

## 2.1 两个上下文：`TrapContext` vs `TaskContext`

现在内核里有 **两条** 独立的 "保存/恢复" 流水线，原因不同，绝对不能混。

### TrapContext（34 个字，Phase 1 已写）

在 **U-态 ⇄ S-态** 之间保存。因为 trap 可能发生在用户程序的任何一条指令上，
所以必须保存 *所有* 通用寄存器 + `sstatus` + `sepc`。

```
内核栈从高地址向低地址生长
                      ┌──────────────┐  高
                      │   x1 = ra    │
                      │   x2 = sp    │   ← 用户 sp 的快照
                      │     ...      │
                      │   x31        │
                      │   sstatus    │
                      │   sepc       │   ← 回到用户态的 PC
                      └──────────────┘  低
                       34 * 8 = 272 字节
```

### TaskContext（14 个字，Phase 2 Lab 1）

在 **内核线程 A ⇄ 内核线程 B** 之间保存。因为切换只发生在我们自己的
`__switch` 函数内——遵循 Rust 正常调用约定——编译器在调用 `__switch`
*之前* 就已经把 caller-saved 寄存器（t0-t6, a0-a7）溢出到栈上了。

所以我们只需保存：

- `ra`         —— `__switch` 返回后从哪里继续
- `sp`         —— 该任务的内核栈指针
- `s0 … s11`   —— 12 个 callee-saved 寄存器

```
                    ┌──────────────┐
                    │  ra          │  +0
                    │  sp          │  +8
                    │  s0 .. s11   │  +16 .. +104
                    └──────────────┘  共 14*8 = 112 字节
```

为什么不"保险起见全保存"？因为 `__switch` 是被 Rust *调用* 的——
ABI 保证调用者不关心 scratch 寄存器。多保存只是浪费周期。

---

## 2.2 `__switch` 的精髓

整个调度器归结为一段汇编：把 `(ra, sp, s0..s11)` 在两块内存之间交换。
就这样。多任务的秘密就在这里。

两个任务 A、B 都停在各自函数中。状态都在 TCB 里：

```
__switch(&A, &B) 之前：                  __switch(&A, &B) 之后：

A.task_cx: ra=old_A_ra sp=A_kstack       A.task_cx: ra=here    sp=A_now
B.task_cx: ra=here'    sp=B_now          B.task_cx: ra=old_B_ra sp=B_kstack
                                         CPU 现在跑在 B 的栈上，
                                         下一条指令是 `ret` 到 old_B_ra
```

RISC-V 汇编：

```
__switch:
    # a0 = &mut current   a1 = &next
    sd ra,  0*8(a0)       # 保存
    sd sp,  1*8(a0)
    sd s0,  2*8(a0)
    ...
    sd s11, 13*8(a0)
    ld ra,  0*8(a1)       # 装载
    ld sp,  1*8(a1)
    ld s0,  2*8(a1)
    ...
    ld s11, 13*8(a1)
    ret                   # 用 *新的* sp 和 *新的* ra 返回
```

14 条 sd + 14 条 ld + 1 条 ret = 29 条指令。最后那条 `ret` 就是魔法：
`ret` 实际是 `jr ra`，可我们刚刚把 `ra`、`sp` 都换掉了——于是跳进了另一个任务。

### Lab 1 ⭐⭐ — 亲手写

1. 在 `task/context.rs` 完成 `TaskContext::goto_restore`。返回的 `TaskContext`
   `ra` 必须指向 `__restore`（来自 `trap.S`），`sp` 是该任务内核栈里刚刚
   布置好的 TrapContext 所在位置。
2. 在 `task/switch.S` 写出上面描述的 29 条汇编。

**常见错误**

- 忘了 `ra`。新任务根本不知道在哪继续。
- 保存/装载顺序搞反（写到 `a1` 而不是 `a0`）。
- 把 caller-saved 也放进来——浪费内存，而且更容易漏一个。
- 偏移量算错。结构体是 `#[repr(C)]`，字段是 `usize`，所以偏移是
  0, 8, 16, 24, …, 104。

---

## 2.3 协作式 vs 抢占式调度

`__switch` 写好之后，还需要一个 **策略**：什么时候切？

**协作式。** 任务主动 `sys_yield()`。简单、便宜，但一个 bug 或恶意程序可以
永远霸占 CPU。

**抢占式。** 内核在时钟 tick 上强行切换。程序无权选择——下一条指令
可能已经属于另一个任务。所有真实 OS 都是这样做的。

Phase 2 两者都做：Lab 2 加协作式 yield/exit；Lab 3 加抢占。

### Round-Robin

N 个任务排成环，指针 `current`，下一个 Ready 任务就是：

```
for off in 1..=N {
    let i = (current + off) % N;
    if tasks[i].status == Ready { return Some(i); }
}
None   // 所有人都退出了，关机
```

### 状态机

```
           load_apps()
    UnInit ─────────────► Ready ◀──────┐
                            │           │ suspend
                            ▼           │
                         Running ───────┘
                            │
                            │ exit
                            ▼
                          Exited
```

恰好四种状态。Phase 3 会加 `Sleeping`（阻塞在锁上）；
Phase 5 会加 `Zombie`（已退出，父进程未 `wait`）。

### Lab 2 ⭐⭐⭐ — 调度器

在 `task/mod.rs` 实现：

- `TaskManager::run_first_task()` —— 选 task 0，标记 Running，从一个
  临时的 `unused` context `__switch` 到 task 0。永不返回。
- `TaskManager::find_next_task()` —— 环形扫描。
- `TaskManager::run_next_task()` —— 调度主干：选下一个、更新状态、
  调用 `__switch(&mut cur.cx, &next.cx)`。

**常见错误**

- 抱着 `Mutex<TaskManagerInner>` 的锁调 `__switch`。*下一个* 任务再次
  yield 时必然死锁。先 `drop(inner)` 再切。
- `*mut` 与 `*const` 搞混：`current` 是要 *保存* 的目标，用 `*mut`；
  `next` 是要 *装载* 的来源，用 `*const`。
- 忘了 `run_first_task` 永不返回——用 `-> !`，`__switch` 后加 `unreachable!()`。

---

## 2.4 RISC-V 时钟中断速览

RISC-V 有一个内存映射的 64 位计数器 `mtime`，以及每个 hart 一个比较器
`mtimecmp`。当 `mtime >= mtimecmp` 时，机器模式触发一个 timer 中断。
我们的内核跑在 S-态，所以通过 OpenSBI 间接设置：调用
`sbi_set_timer(value)`，固件会把中断 "代理" 成一个 S-态中断
（scause = 0x8000…05）。

三个开关必须打开：

- `sie.STIE` —— 使能 S-态 timer 中断。启动时一次即可。
- `sstatus.SIE` —— S-态全局中断使能。返回用户态时通过 SPIE 打开
  （`TrapContext::app_init_context` 已经处理）。
- `sbi_set_timer(next)` —— 每次中断重新设下一次，ISR 内调用一次。

10 ms 时间片 @ 10 MHz → `CLOCK_FREQ / TICKS_PER_SEC = 10_000_000/100 = 100_000`。

### Lab 3 ⭐⭐ — 抢占

1. 在 `timer.rs` 实现 `set_next_trigger()`：
   ```
   let next = get_time() + CLOCK_FREQ / TICKS_PER_SEC;
   set_timer(next as u64);
   ```
2. `trap/mod.rs` 里 `SupervisorTimer` 分支是 `TODO!()`，替换为：
   ```
   crate::timer::set_next_trigger();
   crate::task::suspend_current_and_run_next();
   ```

**常见错误**

- 给 `set_timer` 传 *时间差* 而不是 *绝对截止点*。它是 `mtimecmp`，
  不是 "10 ms 之后"。
- 忘了每次 tick 都要重新 arm——否则只会抢一次就不抢了。
- `stie` 开了但用户态 TrapContext 的 `sstatus.SIE` 没开——CSR 里
  中断永远 pending，永远被屏蔽。

---

## 2.5 集成：成功的跑起来应该是什么样

三个 Lab 都写完之后，`make qemu` 大致输出：

```
[kernel] TinyOS Phase 2 booting
A0 B0 C A1 B1 C C A2 B2 C C A3 B3 C A4 B4 [A done]
[B done]
C C C C [C done]
```

- 抢占出现之前 A/B 交替：协作式 yield 工作。
- `app_timer` 从不 `yield_()`，却照样有 `C` 穿插：抢占工作。
- `[X done]` 标记证明 `sys_exit` 把任务干净撕掉、调度继续。

`scripts/grade.py` 检查的正是这几条。

---

## 2.6 回顾 & Phase 3 预览

到这里你应当能不看笔记回答：

- 为什么 `TaskContext` 14 个字、`TrapContext` 34 个字。谁在调用谁，
  ABI 保证了什么。
- `__switch` 最后那条 `ret` 到底做了什么，为什么会落到另一个任务。
- 为什么调度器必须 `drop(lock)` 再 `__switch`。
- 时钟 ISR 必做的三件事：重置定时器、yield、返回。

**Phase 3 预览。** 抢占引入一个新问题：两个任务同时改一个共享计数器时，
切换可能落在 `lw`/`sw` 中间导致数据损坏。Phase 3 会造出解药——
SpinLock、SleepLock、Semaphore——并让你直面死锁。

---

## 参考资料

### 必读

- OSTEP — [第 5–10 章 进程与调度](https://pages.cs.wisc.edu/~remzi/OSTEP/)
- xv6-riscv book — [第 7 章 Scheduling](https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf)
- rCore-Tutorial — [§3 任务切换](https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/index.html)

### 深入阅读

- RISC-V Privileged Spec — [第 4 章 Supervisor-Level ISA](https://github.com/riscv/riscv-isa-manual/releases)
- SBI spec — [RISC-V SBI Specification v1.0](https://github.com/riscv-non-isa/riscv-sbi-doc)
  （`set_timer` 和 IPI 的权威文档，时间片调度的基石）
- 《Linux 内核设计与实现》第 4 章 *进程调度* —— 把 CFS 与你现在的
  round-robin 做对照。

### 扩展思考

- 为什么 `__switch` 必须用汇编写？用 Rust 写会在哪里崩？（提示：
  Rust 的调用约定会在函数入口/出口插入寄存器保存/恢复，`ra` 和 `sp`
  的切换时机无法精确控制，切到一半栈就乱了。）
- 如果一个任务在内核态死循环不主动让出 CPU，时钟中断能救你吗？
  （提示：能——只要 `sstatus.SIE=1` 且 `sie.STIE=1`，S-mode 内核也会
  被 S-timer 中断抢占，这就是抢占式调度的本质。）
- round-robin 调度对 I/O 密集型任务公平吗？（提示：不公平——I/O 阻塞
  任务醒来后要等一整轮，OSTEP Ch.8 的 MLFQ 正是为此而生。）
