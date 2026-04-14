# Phase 6 — Shell、管道与 Coreutils

## 6.0 导读 ——「从零启动的 OS 终于长出了 shell」

Phase 0 你从 `_start` 的一片寄存器空白开始；之后依次加上了中断（1）、进程
（2）、锁（3）、分页（4）、文件系统（5）。本阶段把最后一块拱顶石放上去：
**一个用管道把程序拼起来的用户态 shell**。

集成目标是一行：

```
make run → /bin/init → /bin/sh → $ ls | wc -l
```

能敲完这行并看到数字回来，你就造出了一个 OS。

```
  ┌──────────────┐
  │ init (pid 0) │
  └──────┬───────┘
         │ fork+exec
         ▼
  ┌──────────────┐
  │  sh (pid 1)  │
  └──┬───────┬───┘
     │       │ fork+pipe+exec
     ▼       ▼
  ┌────┐  ┌────┐
  │ ls │→ │ wc │
  └────┘  └────┘
```

---

## 6.1 概念 —— `fork`

`fork()` 克隆当前进程，子进程几乎与父进程一致：

- 用户内存一模一样（code/data/stack 全复制），但落在**新的物理帧**上，互不影响
- fd_table 的每个槽是父进程的 `Arc::clone`，共享管道/文件引用计数
- pid、内核栈、parent 指针都是新的

### `a0 = 0` 小魔术

系统调用经 `x[10]`（a0）返回。在把子进程加进就绪队列前，改写它的 trap context：

```
child.trap_cx.x[10] = 0;
```

调度器切到子进程后，`__restore` 把 a0=0 写回用户寄存器，子进程里 `fork()`
看起来就返回了 **0**。父进程那边 trap context 未动，返回的是子进程 pid。
一次系统调用，两个返回值。

---

## 6.2 概念 —— `exec`

`exec(path)` 丢掉当前 memory_set，把新 ELF 装进同一个 PCB。pid、父子关系、
fd_table 全部保留——这正是 `fork+exec` 成为 Unix 万能"开新程序"惯用法的原因。

```
  exec 前                     exec 后
  ┌────────────┐              ┌────────────┐
  │ memory_set │  ── drop ──▶ │ memory_set │
  │ (旧程序)   │              │ (新程序)   │
  ├────────────┤              ├────────────┤
  │ fd_table   │  ── 保留 ──▶ │ fd_table   │
  ├────────────┤              ├────────────┤
  │ pid, ppid  │  ── 保留 ──▶ │ pid, ppid  │
  └────────────┘              └────────────┘
```

---

## 6.3 概念 —— `waitpid` 与僵尸进程

进程调用 `exit(code)` 后进入 `Zombie` 状态：PCB 残留只剩退出码，等父进程
`waitpid` 回收。若父进程先死，内核把孤儿**重新过继**给 `initproc`，后者在
无限 `wait()` 循环里兜底。

`sys_waitpid` 的返回值：

| 场景                       | 返回   |
|----------------------------|--------|
| 没有匹配的子进程           | `-1`   |
| 有匹配子进程但还活着       | `-2`   |
| 僵尸回收成功               | `pid`  |

用户态见到 `-2` 就 yield 重试，内核侧不必维护等待队列，简单为先。

---

### Lab 1 ⭐⭐ —— 实现 `sys_fork` / `sys_exec` / `sys_waitpid`

常见错误：

- **忘了 `x[10] = 0`**：父子都看到返回子 pid → 无限分叉
- **exec 里重复释放**：`memory_set` 会随赋值自动 drop，千万别手动 dealloc
- **跨 `schedule()` 持锁**：切换前务必 drop 所有 MutexGuard，否则对端进程立刻死锁

---

## 6.4 概念 —— 文件描述符表

每个 PCB 拥有一份 `Vec<Option<Arc<dyn File>>>`。0/1/2 预填 `Stdin`/`Stdout`/
`Stdout`。shell 做重定向的套路：

1. `pipe(&mut fds)` → 拿到两个 fd
2. `close(1)` → 腾出 1 号槽
3. `dup(fds[1])` → 返回 1（最小空闲），stdout 就流入管道
4. `close(fds[1])` → 冗余 fd 清掉

---

## 6.5 概念 —— 管道

```
   ┌──────────────┐       环形缓冲（2048 B）
   │   写端       │─────▶ ┌──┬──┬──┬──┬──┬──┐
   │  Arc<Pipe>   │       │▓▓│▓▓│  │  │  │  │
   └──────────────┘       └──┴──┴──┴──┴──┴──┘
                           ▲         ▲
                           │ Weak──┐ │
   ┌──────────────┐              │ │
   │   读端       │──────────────┘ │
   │  Arc<Pipe>   │◀───────────────┘
   └──────────────┘
```

环形缓冲里存的是写端的 `Weak<Pipe>`。当最后一个写端 Arc 被 drop（所有写者
都 close 了 fd），`weak.upgrade()` 返回 `None`，读端就能看到 **EOF**。没有
`Weak`，两端永远感知不到彼此关闭——这是设计关键。

---

### Lab 2 ⭐⭐ —— 实现管道

`available_read()` / `available_write()` 里藏 off-by-one：`head == tail` 有
歧义（空？满？），靠 `status` 字段消歧。建议 `RING=4` 画图手推 4 写 2 读 3 写，
画出来和代码对上就能过。

---

## 6.6 概念 —— shell 解析

```
原始行：    cat f | grep foo > out &
            │
            ▼  分词
tokens：    [cat] [f] [|] [grep] [foo] [>] [out] [&]
            │
            ▼  按 | 分段，挂 redirs，识别 &
pipeline：  [ Command{argv:[cat,f]} ,
              Command{argv:[grep,foo], stdout:"out"} ]
            background = true
```

调度：

1. 先创建 `n-1` 个管道
2. 每一段 `fork`；子进程把 `pipe[i-1].read → 0`、`pipe[i].write → 1`，
   **关掉其他所有管道 fd**，然后 `exec`
3. 父进程把所有管道 fd 关干净（关键！）再按序 `waitpid`

---

### Lab 3 ⭐⭐⭐ —— shell 与 8 个 coreutils

头号 bug 源：**父进程漏关管道 fd**。只要还有一个 fd 挂着写端，读端就永远见不到
EOF，`wc` 永远卡住。pipeline 卡死时先查 `close()` 调用。

---

## 6.7 集成

```
$ cat README.md | grep Lab | wc -l
3
$ ps
PID  PPID  STATE  NAME
0    -     R      init
1    0     R      sh
2    1     R      cat
3    1     R      grep
4    1     R      wc
```

---

## 常见错误 / Common Mistakes

下面是学生在做 fork / exec / pipe / shell 时真实踩过的坑。每条给出**症状**、**原因**、**修复**。这些错误要么导致 shell 完全跑不起来，要么在你测完基本用例后藏得很深——在继续前先扫一遍。

### 1. `fork` 后忘了把子进程的 `a0` 置零
**症状**：`fork` 返回后父子进程打印的 pid 一样（都是父进程刚拿到的值），`if pid == 0` 分支永远进不去，子进程行为完全错乱。
**原因**：子进程是从父的 `TrapContext` 克隆来的，寄存器一模一样。系统调用返回值走 `a0`，如果不改子进程的 `TrapContext.x[10]`，父子都会读到"新建的子进程 pid"。
**修复**：复制完 trap context 后显式把子进程的 `a0` 清零：
```rust
let new_task = parent.fork();
let trap_cx = new_task.inner_exclusive_access().get_trap_cx();
trap_cx.x[10] = 0;          // child: fork() returns 0
// parent path returns the child's pid as usual
```

### 2. 管道 reader 永远读不到 EOF（写端 Arc 没 drop）
**症状**：`cat file | grep foo` 跑完 grep 一直卡住不退出；或 shell 里 `ls | wc -l` 打印完行数后挂住。
**原因**：管道 EOF 靠"所有写端 Arc 都被 drop"判定。父进程 fork 后如果自己还持有写端 fd，就算子进程退出了，写端引用计数 > 0，`read` 端永远不会返回 0。
**修复**：父进程在 fork 完子进程后，立刻关掉自己不用的那一端：
```rust
let (read_end, write_end) = make_pipe();
let child = current.fork();
child.fd_table[1] = Some(write_end.clone());
drop(write_end);            // 父不再持有写端
current.fd_table[0] = Some(read_end);
```
子进程 exec 前也要对称地 drop 自己不用的那端。

### 3. `dup2` 顺序搞反，exec 前就把 stdout 弄丢了
**症状**：重定向到文件/管道时什么都没写进去；或子进程输出跑到父的终端而不是管道。
**原因**：`dup2(new_fd, 1)` 会先关掉 fd 1 再复制。如果你先 `close(1)` 再 `dup2(pipe_write, 1)`，中间那一瞬间 fd 1 是空的——但更常见的错是**顺序颠倒**写成 `dup2(1, pipe_write)`，把管道端关掉复制成 stdout。
**修复**：牢记参数顺序 `dup2(src, dst)`——把 `src` 复制到 `dst`：
```rust
// redirect stdout to the pipe write end
sys_dup2(write_end_fd, 1);  // src=write_end, dst=1
sys_close(write_end_fd);    // 现在 fd 1 和 write_end 指同一个，可以关原 fd
sys_exec(path, args);
```
所有 `dup2` / `close` 必须在 `exec` **之前**做完；exec 替换的是内存镜像，保留 fd_table。

### 4. `exec` 没拆掉旧的 memory_set，内存泄露
**症状**：反复 `exec` 后物理内存持续增长，`frame_alloc` 最终返回 `None`；或者新程序跑起来但能从旧程序的栈里读到脏数据。
**原因**：`exec` 语义是"替换当前进程镜像"。如果只是把新程序的 MapArea push 进去，旧的 user stack / heap / code 还留在 MemorySet 里，PTE 还指着旧帧。
**修复**：在 `exec` 里重建 MemorySet，老的整体 drop 掉：
```rust
pub fn exec(&self, elf_data: &[u8]) {
    let (memory_set, user_sp, entry) = MemorySet::from_elf(elf_data);
    let mut inner = self.inner_exclusive_access();
    inner.memory_set = memory_set;   // 旧 MemorySet 在这里 Drop，帧回收
    inner.trap_cx_ppn = ...;
    *inner.get_trap_cx() = TrapContext::app_init_context(entry, user_sp, ...);
}
```
注意 fd_table 不能跟着重建——它是 exec 语义要保留的。

### 5. `waitpid` 回收了僵尸但没关 fd_table
**症状**：跑几十轮 shell 命令后 `sys_open` 开始返回 `-EMFILE`；或者打开的文件数越来越多，`lsof` 式调试显示有大量已死进程的 fd 还在。
**原因**：僵尸进程的 TaskControlBlock 通常由父进程 `waitpid` 回收。如果回收逻辑只把 TCB 从 children 列表删掉，却不 drop 其 `fd_table`，文件描述符指向的 `File` Arc 引用计数一直 > 0，底层 inode / pipe 永远不关。
**修复**：`waitpid` 找到退出的子进程后，显式清掉 fd_table 再释放：
```rust
let child = inner.children.remove(idx);
let exit_code = child.inner_exclusive_access().exit_code;
child.inner_exclusive_access().fd_table.clear();  // 关闭所有 fd
// child Arc 计数归 0 时整个 TCB 释放
```
或者保证 TCB 的 Drop 会级联清 fd_table，这样只要最后一个 Arc 走掉就干净。

### 6. shell 解析器在引号内部也按空格切分
**症状**：`echo "hello world"` 打印出 `hello world`（带引号）；或 `grep "foo bar" file` 报"参数太多"。
**原因**：最简单的 `split_whitespace()` 不理解引号语法，会把 `"hello` 和 `world"` 切成两段，结果既带引号又被切开。
**修复**：写一个小型状态机，跟踪是否处于引号内：
```rust
fn tokenize(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut in_q = false;
    for c in s.chars() {
        match c {
            '"' => in_q = !in_q,
            c if c.is_whitespace() && !in_q => {
                if !cur.is_empty() { out.push(core::mem::take(&mut cur)); }
            }
            _ => cur.push(c),
        }
    }
    if !cur.is_empty() { out.push(cur); }
    out
}
```
再考虑 `'...'`、转义 `\"`，以及管道/重定向符号同样不能在引号内触发。

### 7. init 没循环 `waitpid`，孤儿进程无人回收
**症状**：跑一会儿后 `ps`（或你的任务列表）里充满 "Z"（zombie）状态进程；调度器空转时 CPU 占用不高但内存被僵尸 TCB 占着。
**原因**：用户进程的父进程退出后，孤儿会被过继给 init（pid 1）。如果 init 只 `waitpid` 一次就进入死循环 `yield`，以后的孤儿死掉时没人调 wait，一直停在 zombie 状态。
**修复**：init 的主循环里**非阻塞**地 reap 所有可回收的子进程：
```rust
loop {
    loop {
        let pid = sys_waitpid(-1, &mut exit_code, WNOHANG);
        if pid <= 0 { break; }        // 没有可回收的了
    }
    sys_yield();
}
```
用 `-1` 匹配任意子 pid，`WNOHANG` 保证没 zombie 时立刻返回而不是阻塞。

---

## 6.8 回顾与去向

你现在手里有一个能启动、带分页、抢占、文件系统、管道、shell 的完整 OS。后面几个方向：

- **SMP**：多核启动、per-cpu 调度、真正的 RCU
- **网络**：virtio-net + 用户态 TCP/IP 栈
- **真文件系统**：用 ext2 或 journaling FS 替掉 easy-fs
- **Fuzzing**：syzkaller 风格的系统调用序列模糊测试

## 参考资料

### 必读

- xv6 book, Ch. 1 *Operating system interfaces*（`fork`/`exec`/`pipe`
  的教科书实现）
  — https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf
- rCore 实验指导书 §7 *进程*
  — https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter7/
- OSTEP Ch. 5 *Process API* —— `fork`/`exec`/`wait` 的动机与陷阱
  — https://pages.cs.wisc.edu/~remzi/OSTEP/

### 深入阅读

- APUE (Stevens), Ch. 15 *Interprocess Communication* —— 管道、FIFO、
  重定向的 POSIX 语义权威。
- Linux `fs/pipe.c` —— 工业级管道环形缓冲 + 唤醒策略，对照你的
  `Pipe::read/write`。
  — https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/pipe.c
- Bash 源码 `execute_cmd.c` 中 `execute_pipeline` —— 真正的 shell
  如何 fork + dup2 + close 每一端。
  — https://git.savannah.gnu.org/cgit/bash.git/tree/execute_cmd.c

### 扩展思考

- 如果 `fork` 后父进程立即 `exec`，页表上百次的 COW 复制是浪费吗？
  （提示：是——所以 POSIX 引入 `posix_spawn` / `vfork`，避免拷贝 PCB
  和页表；Linux 也有 `CLONE_VM`。）
- `ls | grep hello` 时，`grep` 看到 EOF 的条件是什么？（提示：所有
  写端 fd 都关闭后，`Pipe::read` 返回 0；这要求 `ls` 退出 **且** shell
  已 close 它那一端，少关一个就永远挂起。）
- 如果 shell 不收 `SIGCHLD` 也不 `waitpid`，子进程会变成什么？
  （提示：僵尸进程——PCB 还在但资源已释放；累积到 PID 耗尽，Linux
  `init` 会主动回收孤儿进程。）
