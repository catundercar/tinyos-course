# Phase 1 · 陷阱与系统调用

> *"Trap 是硬件强加给你的一次函数调用。"*

---

## 1.0 导读 · 为什么要学 Trap

Phase 0 你写了一个能 `println!` 的内核。它跑在 **S-mode**，想做什么做什么。
没有用户程序，也不需要防御谁。对引导器来说这足够了，但对操作系统来说远远不够。

**操作系统的核心职责，是安全地运行别人的代码。** 为此硬件必须在内核（特权）
和用户程序（非特权）之间立一道墙。RISC-V 用三个特权级 + 一个跨级机制实现
它——这个机制就是 **trap（陷阱）**。

下列情形会触发 trap：
- 用户代码执行 `ecall` —— 向内核请求服务；
- 用户代码干了坏事 —— 访问非法地址、除零、执行特权指令；
- 外设中断 —— 时钟到点、磁盘就绪。

无论哪种，硬件都会**冻结**用户、切到 S-mode、跳到 `stvec` 指向的入口，
把控制权交给内核。等内核处理完，一条 `sret` 把 CPU 送回 U-mode，就像
什么也没发生过。

本 Phase 的心智模型就一张图：

```
       U-mode                       S-mode                      U-mode
   ┌──────────┐  ecall   ┌──────────────────────┐   sret   ┌──────────┐
   │ 用户代码 ├─────────▶│  __alltraps          │          │ 用户代码 │
   │  pc=N    │          │     └─► trap_handler │          │  pc=N+4  │
   │          │          │           └─► syscall│          │          │
   └──────────┘          │  __restore           ├─────────▶└──────────┘
                         └──────────────────────┘
```

做完本 Phase，图里每个方框都是你亲手写的。

---

## 1.1 概念 · S-mode 的 Trap CSR

RISC-V 的监督态 trap 子系统是六个 CSR。请牢记。

| CSR        | 读写 | 作用                                                      |
| ---------- | ---- | --------------------------------------------------------- |
| `stvec`    | R/W  | 任何 S-mode trap 发生时 CPU 跳转的地址。                  |
| `sepc`     | R/W  | 发生 trap 时的 PC（ecall 指令本身的地址等）。             |
| `scause`   | R/W  | 原因；最高位=1 表示中断，=0 表示异常。                     |
| `stval`    | R/W  | 附加信息（比如缺页地址）。                                 |
| `sscratch` | R/W  | 内核自由使用的寄存器；我们用它保存 kernel_sp。             |
| `sstatus`  | R/W  | 模式和中断标志位，**重点见下方**。                        |

### `sstatus` 里你必须动的位

```
 63                                                                 0
  ────────────────────────────────────────────────────────────────
  │ ... │ SUM │ ... │ SPP │ ... │ SPIE │ ... │ SIE │ ... │
  ────────────────────────────────────────────────────────────────
             bit 18   bit 8         bit 5         bit 1
```

- `SPP`（Supervisor Previous Privilege）：trap 来自 U-mode 时为 0，来自
  S-mode 时为 1。执行 `sret` 时 CPU 返回到 SPP 指示的模式。第一次跑用户
  程序时你必须**手动清零 SPP**——这正是 `app_init_context` 做的事。
- `SPIE`：保存的 IE 位；`sret` 会把它恢复到 `SIE`。
- `SIE`：全局中断使能。Phase 1 让 U-mode 下它关着，时钟中断留到 Phase 2。

---

## 1.2 概念 · TrapContext（为什么是 34 个寄存器）

Trap 发生时硬件只帮你保存了 `sepc`。全部 32 个通用寄存器仍然是活的，只要
内核里执行一句 `mv`、`ld` 或 `addi`，它们就没了。所以进入内核的第一件事
必须是把 **全部 32 个 GPR**（x0..x31）压到内存里。再加上 `sstatus` 和
`sepc`（CPU 已经帮我们存到 CSR 里，但我们要写回内存以便修改），一共
**34 × 8 = 272 字节**。

```
TrapContext 内存布局（从低地址到高地址）

  偏移    字段         备注
  ─────── ───────────  ──────────────────────────────────────
   +  0   x0           恒为 0，保留槽位只为对齐
   +  8   x1  (ra)     返回地址
   + 16   x2  (sp)     用户栈指针（来自 sscratch）
   + 24   x3  (gp)
   + 32   x4  (tp)
   + 40   x5  (t0)     ← __alltraps 内部会临时用它做 scratch
   ...
   + 80   x10 (a0)     syscall 返回值 / 第一个参数
   ...
   +136   x17 (a7)     syscall 号
   ...
   +248   x31
   +256   sstatus      (32 * 8)
   +264   sepc         (33 * 8)
  ─────── ───────────
   合计 272 字节
```

把这张图刻在脑子里。`trap.S` 的每一行要么是把寄存器写进这些槽位，要么是
把它们读回来。

---

## Lab 1 · TrapContext · ⭐⭐

**文件**：`src/trap/context.rs`

### 伪码

```rust
pub fn app_init_context(entry: usize, user_sp: usize) -> Self {
    let mut sstatus: usize;
    unsafe { asm!("csrr {}, sstatus", out(reg) sstatus); }
    sstatus &= !SSTATUS_SPP;         // 返回 U-mode
    let mut ctx = TrapContext { x: [0; 32], sstatus, sepc: entry };
    ctx.x[2] = user_sp;               // sp
    ctx
}
```

### 常见错误

- **忘了清 SPP**。`sret` 会把你送回 S-mode，用户代码就能执行特权指令。
  Phase 1 不会立刻爆，但 Phase 2 开分页后瞬间炸。
- **把 entry 写到了 `x[0]`** 而不是 `sepc`。x0 写入被硬件丢弃。
- **忘设 `x[2]`**。用户程序的第一条指令通常是 `addi sp, sp, -N`，sp=0
  就会立刻缺页。
- **34 这个数字写成 33**，调了三小时才发现少 8 字节偏移。

### 验证

```bash
cargo test --target $(rustc -vV | sed -n 's|host: ||p') --test test_lab1_context
```

---

## 1.3 概念 · `__alltraps` 的舞蹈

`trap.S` 要执行的编排，用散文讲清楚：

```
trap 之前：                    10 行 __alltraps 之后：
  sp       = user_sp             sp       = kernel_sp - 272
  sscratch = kernel_sp           sscratch = user_sp
                                 *(kernel_sp - 272 + i*8) = x[i]
                                 *(kernel_sp - 272 + 32*8) = sstatus
                                 *(kernel_sp - 272 + 33*8) = sepc
```

唯一的"魔术"是这一条：

```asm
csrrw sp, sscratch, sp     # 原子：tmp = sp; sp = sscratch; sscratch = tmp
```

**为什么必须原子？** 因为刚 trap 时没有任何空闲寄存器可用—— GPR 全是活的。
`csrrw` 用 CSR 本身当中转，零消耗一个 GPR。交换后 `sp` 就是内核栈，
`sscratch` 里装着用户 sp。接下来开辟 272 字节 TrapContext，用普通的
`sd` 一个个填进去。

### `__alltraps` 执行完的栈状态

```
  高地址
  ┌───────────────────┐  ← kernel_sp（旧栈顶）
  │                   │
  │   TrapContext     │   272 字节
  │   (x0..x31,       │
  │    sstatus, sepc) │
  │                   │
  ├───────────────────┤  ← kernel_sp - 272  == 新 sp == trap_handler 的 a0
  │   handler 栈帧... │
  └───────────────────┘
  低地址
```

---

## Lab 2 · `__alltraps` / `__restore` + 分发 · ⭐⭐⭐

**文件**：`src/trap/trap.S` 与 `src/trap/mod.rs`

### `__alltraps` 逐行伪码

```
__alltraps:
    csrrw sp, sscratch, sp          ; 交换：sp ← kernel_sp, sscratch ← user_sp
    addi  sp, sp, -34*8             ; 分配 TrapContext
    sd x1, 1*8(sp)                  ; 保存 ra
    sd x3, 3*8(sp)                  ; 保存 gp（跳过 x0 x2 x4）
    .set n, 5
    .rept 27
        SAVE_GP %n
        .set n, n+1
    .endr
    csrr t0, sstatus ; sd t0, 32*8(sp)
    csrr t1, sepc    ; sd t1, 33*8(sp)
    csrr t2, sscratch ; sd t2, 2*8(sp)   ; 把*用户*sp 存进 x[2]
    mv a0, sp                       ; &TrapContext
    call trap_handler
    # 继续执行到 __restore
```

### `__restore` 把上面的电影反着放一遍

```
__restore:
    mv sp, a0
    ld t0, 32*8(sp) ; csrw sstatus, t0
    ld t1, 33*8(sp) ; csrw sepc,    t1
    ld t2, 2*8(sp)  ; csrw sscratch, t2
    ld x1, 1*8(sp)
    ld x3, 3*8(sp)
    .set n, 5 ; .rept 27 ; LOAD_GP %n ; .set n, n+1 ; .endr
    addi sp, sp, 34*8
    csrrw sp, sscratch, sp          ; sp ← user_sp, sscratch ← kernel_sp
    sret
```

### Rust 侧分发器

```rust
#[no_mangle]
pub extern "C" fn trap_handler(cx: &mut TrapContext) -> &mut TrapContext {
    let scause: usize; let stval: usize;
    unsafe {
        asm!("csrr {}, scause", out(reg) scause);
        asm!("csrr {}, stval",  out(reg) stval);
    }
    let is_int = (scause as isize) < 0;
    let code   = scause & !(1 << 63);
    match (is_int, code) {
        (false, EXC_U_ECALL) => {
            cx.sepc += 4;
            cx.x[10] = syscall(cx.x[17], [cx.x[10], cx.x[11], cx.x[12]]) as usize;
        }
        (false, EXC_ILLEGAL_INST) => {
            println!("[kernel] illegal instruction @ {:#x}", cx.sepc);
            exit_current(-3);
        }
        (false, EXC_LOAD_FAULT | EXC_STORE_FAULT
              | EXC_LOAD_PAGE_FAULT | EXC_STORE_PAGE_FAULT) => {
            println!("[kernel] mem fault: scause={} stval={:#x}", code, stval);
            exit_current(-2);
        }
        _ => panic!("unsupported trap scause={} is_int={}", code, is_int),
    }
    cx
}
```

### 值得抄在笔记本上的坑

1. **别救 x0**。硬连线为 0，救也是白救，读回来写 x0 还是 0。
2. **`csrrw sp, sscratch, sp` 必须第一条**。想用别的方式拿 kernel_sp 都
   会先毁掉一个 GPR。
3. **sepc += 4 只对 ecall 做**。不加就死循环。
4. **stvec 用 MODE=0（direct）**。低两位是模式位，MODE=1 是向量表。

---

## 1.4 概念 · Syscall ABI

Phase 1 沿用 rCore / Linux-RISCV 约定：

| 寄存器   | 角色           |
| -------- | -------------- |
| `a7`     | syscall 号     |
| `a0..a5` | 参数           |
| `a0`     | 返回值         |

```
user:
    li a7, 64       ; SYSCALL_WRITE
    li a0, 1        ; fd
    la a1, msg
    li a2, msg_len
    ecall           ; → trap_handler → syscall → sys_write → len
```

**为什么 `sepc += 4`？** `sepc` 指向 ecall 本身。不加 4 回到 U-mode 就
又执行一遍 ecall，死循环。

---

## Lab 3 · Syscalls · ⭐⭐

**文件**：`src/syscall/mod.rs`、`fs.rs`、`process.rs`

三个函数都比它们的注释还短：

```rust
pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    match id {
        SYSCALL_WRITE  => sys_write(args[0], args[1] as *const u8, args[2]),
        SYSCALL_EXIT   => sys_exit(args[0] as i32),
        SYSCALL_GETPID => sys_getpid(),
        _ => panic!("unknown syscall {}", id),
    }
}
```

短归短，但此刻你拥有了一台能执行用户代码的内核。

---

## 1.5 集成验证

```bash
make qemu
```

期望输出：

```
[kernel] TinyOS Phase 1 · Traps & Syscalls
[kernel] loaded app @ 0x80400000, jumping to U-mode
[user] hello from U-mode!
[user] goodbye
[kernel] app exited with code 0
```

看到 `[user] hello` 就说明最上面那张图里的每个方框都跑通了。

### 调试流程

```bash
make gdb
(gdb) b trap_handler
(gdb) b *__alltraps
(gdb) c
(gdb) x/34xg $sp       # dump 栈上的 TrapContext
(gdb) print/x $sstatus
```

---

## 1.6 复盘 & 下一阶段

| 话题                   | 你现在能…                                         |
| ---------------------- | ------------------------------------------------- |
| 特权级                 | 解释为什么 U-mode 不能碰 `sstatus`                |
| TrapContext            | 凭记忆画出 272 字节布局                           |
| `__alltraps/__restore` | 实现并讲清每一次 `csrrw` 的作用                   |
| Syscall ABI            | 把 a7 → 分发表 → 返回值 串通                      |
| 异常分类               | 区分可恢复故障与致命错误                          |

**Phase 2 预告**：进程与调度。TrapContext 会从"挂在内核栈上的单例"升级为
每任务一个；它会和一个新的 `TaskContext`（callee-saved 寄存器 + ra + sp）
组合，由新写的 `__switch` 来切。时钟中断替代 `sret` 成为用户代码主动
回到内核的主要方式。

---

## 参考资料

### 必读

- **xv6-riscv book** Ch. 4 *Traps and system calls*
  <https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf>
- **rCore-Tutorial** §3 trap 子系统
  <https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/>
- **RISC-V Privileged Spec v1.12** Ch. 10 *Supervisor-Level ISA*
  <https://github.com/riscv/riscv-isa-manual/releases>

### 深入阅读

- **RISC-V ISA Vol I**：`ecall` / `sret` / CSR 操作的权威定义
  <https://riscv.org/technical/specifications/>
- Linux `arch/riscv/kernel/entry.S`：产业级的同一套 `__alltraps` 套路
  <https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/riscv/kernel/entry.S>
- Yosef Pertzovsky, "Context Switches on RISC-V" —— sp/sscratch 交换的
  可视化讲解

### 扩展思考

- 如果 `__alltraps` 在保存 `x1` 之前就被中断（比如一条虚假的 NMI），
  会发生什么？（提示：RISC-V 通过 `sstatus.SIE` 在进入 trap 时自动
  屏蔽 S-mode 中断；但 NMI/调试异常是另一回事，需要专门的影子寄存器。）
- 为什么 `TrapContext` 要保存 34 个寄存器而不是 32 个？
  （提示：除了 `x1..x31`，还要保存 `sstatus` 和 `sepc`，否则嵌套 trap 会
  覆盖它们。）
- 如果用户程序的 `ecall` 传入一个指向内核地址的指针，内核直接
  解引用会怎样？（提示：Phase 1 还没开页表隔离，物理地址能访问就
  访问；Phase 4 开启 SV39 后，U-mode 指针需要通过页表翻译，这是
  `copy_from_user` 的由来。）
