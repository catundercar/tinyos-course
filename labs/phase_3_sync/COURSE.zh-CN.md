# 第 3 阶段 · 并发与同步原语

> *"你有两头牛。你把一头送给朋友。结果两头牛同时变成了四头，因为你们俩都在
> 对 `herd_count += 1`。"* — 改编自并发程序员的古老笑话

---

## 3.0 导读：健忘的计数器

最简单的共享状态：一个 `usize` 计数器，两个任务，各自循环 `counter += 1`
共 10 000 次。期望结果是 20 000。在 Phase 2 的抢占式调度上实测，结果往往
落在 **10 002 到 19 998** 之间，从不为 20 000。

这是因为 `counter += 1` 在 RISC-V 上编译出 3 条指令：

```asm
lw   t0, (a0)      # 1. 读
addi t0, t0, 1     # 2. 算
sw   t0, (a0)      # 3. 写
```

两个任务交错（初始 counter = 5）：

```
T1: lw  t0 <- 5        ───┐
                          │   (时钟中断，上下文切换)
T2: lw  t0 <- 5           │
T2: addi t0 = 6           │
T2: sw  6 -> counter      │
                          │   (切回 T1)
T1: addi t0 = 6        ───┘
T1: sw  6 -> counter
```

两次递增，只有一次生效。T2 的写被 T1 覆盖，**更新丢失**。

本阶段给你避免这种交错的工具。

---

## 3.1 概念 · 竞态、原子性、临界区

- **竞态 (race condition)** — 程序正确性依赖操作的相对时序。测试跑 999
  次都对，线上跑第 1000 次翻车。
- **原子性 (atomicity)** — 一个操作不能被其他 hart/任务观察到"做了一半"。
  RISC-V 上对齐的 `lw`/`sw` 是原子的，`counter += 1`（三条指令）不是。
- **临界区 (critical section)** — 访问共享状态的代码。为了安全，同一个临界
  区内同一时间最多只能有一个任务。保证"最多一个"的机制叫 **锁**。

> **经验法则**：任何被多个任务读写的变量，要么加锁，要么每次访问都是
> 单条原子指令。

---

## 3.2 概念 · SpinLock = 原子标志 + 忙等

自旋锁是能用的最简单的锁：内存里一字节 `locked: bool`，`lock()` 自旋到
能把它从 `false` 原子地翻到 `true`，`unlock()` 再写回 `false`。

### 关键的 RISC-V 原子指令

RISC-V "A" 扩展引入了一组**读-改-写**原子指令：

| 指令 | 语义 |
|------|------|
| `amoswap.w.aq rd, rs2, (rs1)` | `rd = *rs1; *rs1 = rs2;` 带 acquire 语义 |
| `amocas.w rd, rs2, (rs1)` | compare-and-swap（Zacas 扩展） |
| `lr.w` + `sc.w` | load-reserved / store-conditional 对 |

Rust 的 `AtomicBool::compare_exchange` 会降级为以上之一；你不用手写汇编。

### 为什么持锁期间必须关中断

想象 hart 0 拿着自旋锁 L。时钟中断触发，中断处理切到另一个任务，这个
任务调用 `L.lock()`。hart 0 开始自旋在一个只有自己能解锁的 flag 上。
**单 hart 自锁**。

解决：`lock()` 在 CAS 之前关本地中断，`unlock()` 释放后恢复。RAII 的
guard 自动做这件事，学生想忘都忘不掉。

### SpinLock 状态机

```
  ┌──────────────┐  lock() CAS(false,true)  ┌────────────┐
  │   FREE       │ ────────────────────────▶│   HELD     │
  │ locked=false │                          │ locked=true│
  │              │◀──────────────────────── │ 中断已关   │
  └──────────────┘     unlock() store(false)└────────────┘
```

### Lab 1 实现指南

在 `src/sync/spin.rs` 中实现 `SpinLock::lock / try_lock / raw_unlock`
以及 `SpinLockGuard::drop`。文件里已经写好了伪代码注释。三个高频坑：

1. **drop 顺序颠倒**：要**先**释放原子标志，**再**恢复中断。否则先恢复
   中断后，一个时钟 IRQ 可能在 `locked` 还是 true 时抢走 CPU。
2. **只用 `Ordering::Relaxed`**：编译器/乱序 CPU 会把受保护数据的读
   提到 CAS 之前。成功路径用 `Acquire`，store 用 `Release`。
3. **用 `swap` 代替 `compare_exchange` 自旋**：`swap` 无条件写入，会导致
   cache line 乒乓。`compare_exchange` 失败路径可以 Relaxed，更便宜。

---

## 3.3 概念 · 睡眠锁（阻塞型 Mutex）

自旋锁适合微秒级的临界区（链表头更新、计数器自增）。如果临界区可能很长
——磁盘 I/O、分配器扩堆、网络往返——持锁者让 CPU 空转就太浪费了。

方案：锁被占时，**阻塞**调用者。调度器挑别人上。锁最终释放时，释放者
从等待队列摘一个唤醒它。

```
  lock()  ─┬──── 未持有 ────▶  locked=true, 返回
           │
           └──── 已持有 ────▶  自己入 wait_queue
                              yield 给调度器
                              （醒来：锁已是我的，返回）
```

等价于 async Rust 的 `tokio::sync::Mutex` 或标准库的 `std::sync::Mutex`。

### unlock 时的"所有权直接移交"

`unlock()` 发现等待队列非空时，**不要清除 `locked`**。弹出一个等待者，
保持 `locked = true`，唤醒它。锁直接交接。如果你清了 `locked` 又唤醒
等待者，另一个刚好进入 `lock()` 的任务就可能把锁抢走——经典的"丢失唤醒"
变体。

---

## 3.4 概念 · Semaphore 与 Condvar

### 计数信号量

`isize` 计数器 + 两个操作：

- `P` / `down` / `wait`：先自减。结果 `< 0` 就阻塞。
- `V` / `up` / `signal`：先自增。结果 `≤ 0` 就唤醒一个等待者。

初值为 1 → 等价于 mutex。初值为 N → 控制同时访问一个资源的 N 个用户（比
如最多 3 个并发 HTTP 连接）。

### 条件变量

Condvar 让任务睡到 **谓词为真**。谓词本身在 mutex 保护下计算，Condvar
只负责"等通知"的另一半。

教科书写法：

```rust
mutex.lock();
while !predicate() {
    condvar.wait(&mutex);
}
// 此时谓词为真，且 mutex 在手
mutex.unlock();
```

为什么用 `while` 而不是 `if`？虚假唤醒、唤醒被别的线程抢先消费等竞态。
**永远重新检查谓词**。

### 丢失唤醒（lost wakeup）

`wait` 必须和 `mutex.unlock()` **原子**，否则：

```
线程 A（等待者）         线程 B（通知者）
----------------         ----------------
mutex.lock()
检查谓词 → false
mutex.unlock()
                          mutex.lock()
                          谓词 = true
                          condvar.signal()    # 没人在等！
                          mutex.unlock()
condvar.wait()            # 永远睡下去
```

`Condvar::wait` 里的修复：**先**把自己挂到 wait_queue，**再**调
`mutex.unlock()`。这样与之竞态的 signal 能看到我们在队列里。

### Lab 2 实现指南

实现 `MutexBlocking` / `Semaphore` / `Condvar` 以及九个 `sys_*` 系统调用。
单元测试在 `tests/test_lab2_sync_primitives.rs`，端到端示例在
`user/src/bin/`。

---

## 3.5 概念 · 死锁

Coffman 四条件，**全部满足才会死锁**：

1. **互斥 (mutual exclusion)** — 资源不可共享。
2. **持有并等待 (hold & wait)** — 任务持有一个资源的同时等另一个。
3. **不可抢占 (no preemption)** — 内核不能强拿走锁。
4. **循环等待 (circular wait)** — 等待图里有环。

```
      P0 ──持有──▶ fork_0 ──等待──▶ P1
       ▲                              │
       │                              持有
       │                              │
       └──── 等待 ────── fork_4 ◀─────┘
```

经典破法：**锁排序**。全局给所有锁排个序，获取时必须按升序。这直接
消灭条件 (4)：所有等待边都"向上"，构不成环。`philosopher_dinner.rs`
就是这套——每个哲学家先拿 `min(left, right)`。

---

## 3.6 集成：三个 demo

| 程序 | 用到的原语 | 通过标准 |
|------|-----------|---------|
| `race_counter` | `MutexBlocking` | 最终 = 100 000 精确 |
| `producer_consumer` | `Semaphore` × 2 + `Mutex` | 2000 项全部传完 |
| `philosopher_dinner` | 5 × `Mutex` | 60s 内 heartbeat 一直在跳 |

用 `make qemu USER=race_counter` 等运行。

---

## 3.7 复盘 + Phase 4 预告

自测题 —— 做完本阶段你应该能回答：

- 单 hart 的 spinlock 为什么还要关中断？
- 什么叫 lost wakeup？`Condvar::wait` 里最小修复是什么？
- 锁排序消灭 Coffman 四条件里的哪一条？
- 一个信号量计数为 `-3`，等待队列里有几个任务？

**Phase 4 预告 —— 虚拟内存**。你会启用 SV39 分页，给每个进程独立的地址
空间，处理缺页。本阶段的同步原语会原样沿用——`SpinLock` 不在乎它保护的
指针指向内核页表还是用户页表。

---

## 参考资料

### 必读

- xv6-riscv book, Ch. 6 *Locking*：
  <https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf>
- OSTEP 第 28–31 章：
  <https://pages.cs.wisc.edu/~remzi/OSTEP/>
- rCore-Tutorial v3 · 第 5 章 *进程与同步*
  <https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter5/>

### 深入阅读

- 《Linux 内核设计与实现》第 10 章 *内核同步方法* —— spinlock、
  rwlock、seqlock、RCU 的工业实现对照。
- RISC-V Unprivileged ISA — "A" 扩展（`lr.w` / `sc.w` / `amoswap` 的
  权威定义）：
  <https://github.com/riscv/riscv-isa-manual/releases>
- Rust 原子与内存序参考（`Ordering::{Relaxed, Acquire, Release, SeqCst}`）：
  <https://doc.rust-lang.org/std/sync/atomic/>

### 扩展思考

- 为什么 `SpinLock` 持有时必须关中断？不关会死锁吗？（提示：会——
  中断处理程序若也想拿同一把锁，CPU 就和自己死锁；xv6 的 `push_off` /
  `pop_off` 就是为此。）
- `SleepLock` 的 `wait_queue` 本身需要一把锁保护。这把"元锁"能是
  `SleepLock` 吗？（提示：不能——会无限递归。所以 `SleepLock` 内部必
  用 `SpinLock` 实现临界区。）
- 如果把 `Ordering::Relaxed` 用在 `unlock()` 的 store 上，你的互斥
  会出什么问题？（提示：临界区内的写可能被编译器/CPU 重排到
  unlock 之后，下一个抢到锁的人会读到旧值；必须用 `Release`。）
