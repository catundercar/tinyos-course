# Phase 0 · 启动：从上电到内核 main

> 目标：在 QEMU 的 RISC-V `virt` 机器上，让一个你自己写的 Rust 内核
> 从 OpenSBI 手中接过控制权，打印 `Hello, TinyOS!`，再优雅关机。

---

## 0.0 Phase 导读

### 你在构建什么

在 Phase 0 结束时，你会亲眼看着一台虚拟 RISC-V 机器从零启动——
CPU 复位、OpenSBI 固件跑完、跳进你写的汇编 `_start`、设置栈指针、
跃入 Rust 世界、从 `sbi_ecall` 把一个字节推向 UART——屏幕上浮现一
行绿色的字：

```
Hello, TinyOS!
```

那一刻你会意识到：**操作系统没那么神秘**。它只是一段被放在正确地址
上的机器码，加上一个你自己定义的约定（SBI）去和更低层的软件对话。

具体而言，你会亲手实现：

1. 一份 **链接脚本** `linker.ld`，把 `.text` 钉在 `0x80200000`。
2. 一段 **汇编跳板** `entry.asm`，设置 `sp`、跳进 `rust_main`。
3. 一组 **SBI 绑定** `sbi.rs`，用 `ecall` 调用 `console_putchar`
   和 `system_reset`。
4. 一个 **格式化输出层** `console.rs`，`print!` / `println!` 宏。
5. 一个 **panic 处理器** `lang_items.rs`，失败时打印位置并关机。

### 启动流程总览

```
  上电
    │
    ▼
  ┌─────────────────────────┐
  │  M-mode 复位向量         │  CPU 硬件固定跳到这里
  │  (在 QEMU 里是 MROM)     │
  └─────────┬───────────────┘
            │ jump
            ▼
  ┌─────────────────────────┐
  │  OpenSBI @ 0x80000000   │  M-mode 固件
  │  - 初始化串口 / CLINT   │
  │  - 准备 S-mode 环境     │
  │  - mret 到 0x80200000   │
  └─────────┬───────────────┘
            │ mret (进入 S-mode)
            ▼
  ┌─────────────────────────┐
  │  _start @ 0x80200000    │  ← 你的 entry.asm
  │  la sp, boot_stack_top  │
  │  call rust_main         │
  └─────────┬───────────────┘
            │ jal
            ▼
  ┌─────────────────────────┐
  │  rust_main (Rust)        │  ← 你的 main.rs
  │  clear_bss()             │
  │  println!("Hello, ...")  │──┐
  │  sbi::shutdown()         │  │
  └──────────────────────────┘  │ ecall
                                ▼
                       ┌────────────────────┐
                       │ OpenSBI putchar()  │
                       │ → UART MMIO 写     │
                       └────────────────────┘
```

### 心智模型

> **裸机 Rust ≈ Rust − std**。

`std` 依赖 OS 给它的 heap、线程、文件、系统调用。我们现在**就是**
OS，没法依赖自己，所以要切到 `#![no_std]`。这带来三个必须自己解决
的问题——正好对应三个 Lab：

```rust
#![no_std]    // 不用 std
#![no_main]   // 不用 main() 符号

// 问题 1：没有 main 了，CPU 落地到哪？        → Lab 1 entry.asm
// 问题 2：没有 println! 了，怎么打字？         → Lab 2 sbi + console
// 问题 3：没有 panic_unwind 了，崩了怎么办？   → Lab 3 panic_handler
```

把这三件事搞定，Rust 的其它能力（`&str`、`Option`、`for`、
format_args!、trait）都还在。你仍在写现代 Rust，只是下面没有 OS
兜底而已。

**三条 takeaway：**
1. **控制权始于你的 `_start`**——地址必须是 `0x80200000`，否则
   OpenSBI 会跳到空气里。对应 Lab 1。
2. **所有 I/O 走 SBI**——S-mode 不能直接踹 UART，必须 `ecall` 求
   M-mode 帮忙。对应 Lab 2。
3. **panic 是你的责任**——内核没上层，自己处理；不处理就编译不过。
   对应 Lab 3。

---

## 0.1 概念课：RISC-V 特权级与启动流程

### 三级特权模型

RISC-V 标准定义了三种运行模式（mode），权限从低到高：

| 模式 | 缩写 | 权限 | 谁运行 | Phase 0 里的用法 |
|------|------|------|--------|------------------|
| User | U | 最低，不能访问特权寄存器 | 用户程序 | Phase 2 才用 |
| Supervisor | S | 可以管页表、读写 s-csrs | **内核** | 我们的代码 |
| Machine | M | 最高，直接访问 MMIO、物理地址 | 固件 (OpenSBI / BootROM) | 被我们通过 ecall 调用 |

### 为什么不直接用 M-mode？

理论上你可以在 M-mode 写操作系统——但没人这么做，因为：

- **M-mode 是平台相关的**：不同厂商的 UART 地址、时钟控制器都
  不一样，你得为每块板子写一份 MMIO 驱动。
- **SBI 把平台差异抽掉了**：OpenSBI 已经为每块板子写好了 M-mode
  驱动，你只需要把 ecall 编号记住就行。
- **两层特权隔离**：固件 bug 不会直接毁掉内核的地址空间假设。

现代 RISC-V 栈是这样的：

```
  ┌─────────────┐  U-mode
  │  user app   │
  └──────┬──────┘
         │ ecall (syscall)
  ┌──────▼──────┐  S-mode
  │  your OS    │  ← Phase 0 起点
  └──────┬──────┘
         │ ecall (SBI)
  ┌──────▼──────┐  M-mode
  │  OpenSBI    │
  └──────┬──────┘
         │ MMIO
  ┌──────▼──────┐
  │  hardware   │
  └─────────────┘
```

### 特权级切换

- 低→高：通过 `ecall`（或中断/异常）触发 trap，硬件把 pc、mode
  存进 CSR，跳到 trap handler。
- 高→低：通过 `mret` / `sret`，硬件从 CSR 恢复 pc 和 mode。

我们在 Phase 0 只走 **S → M**（ecall 进 OpenSBI），**M → S**
（mret 回来）这一条路。U-mode 要等 Phase 1。

---

## 0.2 概念课：链接脚本与内存布局

### 每个段是什么

编译后一个 ELF 里有好几个 **段 (section)**，常见四个：

| 段 | 含义 | 可写？ | 会被链接脚本放到哪 |
|----|------|:------:|----------------------|
| `.text` | 可执行机器码（函数体） | ❌ | 最前面，紧贴 BASE_ADDRESS |
| `.rodata` | 只读数据（字符串字面量、const） | ❌ | `.text` 之后 |
| `.data` | 有初值的全局变量 | ✅ | `.rodata` 之后 |
| `.bss` | **初值为零**的全局变量 + 栈 | ✅ | 最后，启动时要清零 |

### 为什么地址是 `0x80200000`

RISC-V `virt` 机器的物理内存从 `0x80000000` 开始。QEMU 的默认
`-bios default` 是 OpenSBI，它把自己装在 `0x80000000` 起的前 2 MiB，
然后配置 `fw_jump` 目标地址为 `0x80200000`——也就是说它 **固定**
会在 `mret` 之后把 pc 设成这个值，我们的 `_start` 必须在那里等它。

### 内存布局图

```
物理地址
 0x80000000 ┌──────────────────────┐
            │  OpenSBI (M-mode)    │   约 2 MiB
 0x80200000 ├──────────────────────┤  ← BASE_ADDRESS
            │  .text.entry (_start)│
            │  .text (rust fns)    │
            │  ─────────── etext   │
            │  .rodata             │
            │  ─────────── erodata │
            │  .data               │
            │  ─────────── edata   │
            │  .bss.stack (boot)   │   ← sp 初值在这里的顶端
            │  .bss (globals)      │
            │  ─────────── ebss    │
            │  (未使用物理内存...)  │
 0x88000000 └──────────────────────┘   128 MiB 上限 (qemu -m 128M)
```

### 链接脚本讲解

```ld
OUTPUT_ARCH(riscv)
ENTRY(_start)                      ; ELF 的入口符号 (gdb 会用)
BASE_ADDRESS = 0x80200000;         ; 常量

SECTIONS
{
    . = BASE_ADDRESS;              ; 定位计数器，后面的段从这里开始
    stext = .;                     ; 打个标记（Rust 可以 extern "C" 取它的地址）
    .text : {
        *(.text.entry)             ; _start 所在段，必须最先
        *(.text .text.*)           ; 其它函数
    }
    . = ALIGN(4K);                 ; 对齐到 4 KiB 页
    etext = .;
    ...
}
```

几个容易踩的坑：

| 症状 | 原因 |
|------|------|
| `_start` 不在 `0x80200000` | 忘了 `*(.text.entry)` 放第一行 |
| 启动后 println 里的字符串乱码 | `.rodata` 没进 ELF（可能被 `/DISCARD/` 误伤） |
| 静态变量初值不对 | 没清零 `.bss`（clear_bss 没被调用） |
| 栈写飞了、卡在莫名地方 | boot stack 太小，或 `sp` 指向了栈底而不是栈顶 |

---

## Lab 1 · `entry.asm` + `linker.ld` ⭐

**学习目标：**
- 理解一段裸机汇编的最小骨架。
- 知道为什么 bootstrap 的三件事是 (设栈, 清 bss, 跳 Rust)。
- 会看 `la` / `call` 伪指令展开。

**前置知识：**
- RISC-V 寄存器：`sp` 是 x2，`ra` 是 x1，参数用 `a0`..`a7`。
- 汇编语法：`#` 注释、`.section` 指令、`.globl` 导出符号、
  `.space N` 保留 N 字节。

**核心概念：bootstrap 的三件事**

当 CPU 跳到 `_start` 的瞬间：
1. **栈是脏的**——寄存器 `sp` 的值是 OpenSBI 留下的，不属于我们。
   Rust 代码编译出来全是 `addi sp, sp, -16; sd ra, 8(sp)` 这样的
   序言；如果 `sp` 不指向我们自己的内存，第一次写栈就炸。
2. **bss 是脏的**——ELF 头里只记录 `.bss` 的大小，不存实际内容，
   指望谁来清零？我们自己。clear_bss 已经在 `main.rs` 提供了。
3. **没人会回来**——`rust_main` 的签名是 `-> !`（Never 类型），
   我们 `call` 进去就不出来。`call` 之后放 `wfi; j .` 做兜底。

**实战指引**

Step 1 · 填第一条 TODO：设栈。
```asm
la   sp, boot_stack_top
```
`la` = load address。`boot_stack_top` 这个符号在本文件结尾的
`.bss.stack` 段里，它是整块栈内存的 **高地址端**。

Step 2 · 填第二条 TODO：跳 Rust。
```asm
call rust_main
```
`call` 是 `auipc ra, ...; jalr ra, ra, ...` 的糖。它会把返回
地址写入 `ra`，不过我们永远不会用到——`rust_main` 不返回。

Step 3 · 删掉 `unimp`。它是一条故意制造 illegal instruction 的
占位符，用来提醒你还没完成 TODO。

**常见错误**

| 你写的 | 会发生 |
|--------|--------|
| `la sp, boot_stack_lower_bound` | `sp` 在栈底，第一次 push 就越界到 `.data` |
| `j rust_main` | 没问题（和 `call` 等价），但不优雅 |
| 忘了 `.section .text.entry` | `_start` 可能不在 0x80200000，CPU 一脸懵 |
| 忘了删 `unimp` | QEMU 立刻 illegal instruction exception |

**测试**

```bash
make build                      # 应该成功编译
make grade                      # Lab 1 四项全绿
make qemu                       # 现在会 hang（Lab 2 才有输出）
```

---

## 0.3 概念课：SBI 与 ecall 通路

### SBI 是什么

**SBI = Supervisor Binary Interface**，RISC-V 基金会定义的一份
规范（[github.com/riscv-non-isa/riscv-sbi-doc](https://github.com/riscv-non-isa/riscv-sbi-doc)）。
它规定了 S-mode 内核可以向 M-mode 固件请求哪些服务：

- console 收发字节
- 关机、重启
- 计时器设置
- 跨核 IPI、TLB shootdown
- ...

OpenSBI、RustSBI 等项目都实现了这份规范。你可以把 SBI 想成
"操作系统之下的 syscall"。

### ecall 指令语义

`ecall` 是 RISC-V 的环境调用指令，**和特权级强相关**：

| 发起模式 | 进入的 trap | Phase 0 场景 |
|----------|-------------|---------------|
| U-mode | S-mode trap (`scause=8`) | 用户 syscall，Phase 1 才处理 |
| S-mode | M-mode trap (`mcause=9`) | **本 Phase** 用来调 SBI |
| M-mode | 同 M-mode 内 trap | 固件内部用 |

硬件在 `ecall` 时做的事：
1. 把当前 pc 存进 `sepc` 或 `mepc`（看目标模式）。
2. 把原因存进 `scause` / `mcause`（值 = 8 + 源模式）。
3. 跳到目标模式的 `stvec` / `mtvec`（trap 入口）。

### SBI 调用约定

```
输入:
  a7 = 扩展 ID (eid)
  a6 = 函数 ID (fid, 仅 v1.0 扩展)
  a0..a5 = 参数
输出:
  a0 = error    (0 = SBI_SUCCESS)
  a1 = value    (按扩展约定，通常可忽略)
```

我们在 Lab 2 只用两个最老实的 **legacy** 扩展：

| eid | 名字 | 含义 |
|-----|------|------|
| 1 | CONSOLE_PUTCHAR | 把 a0 低 8 位当字节塞进串口 |
| 8 | SHUTDOWN | 关机（不返回） |

### 调用流程图

```
kernel (S-mode)                   OpenSBI (M-mode)                  UART
    │                                   │                             │
    │  ecall  (a7=1, a0='H')            │                             │
    ├──────────────────────────────────▶│                             │
    │                                   │  mmio_write(UART_TX, 'H')   │
    │                                   ├────────────────────────────▶│
    │                                   │                             │
    │  mret (sepc 自动 += 4)             │                             │
    │◀──────────────────────────────────┤                             │
    │                                   │                             │
  pc = pc_after_ecall                   │                             │
```

---

## Lab 2 · `sbi.rs` + `console.rs` ⭐⭐

**学习目标：**
- 会写 `core::arch::asm!` 内联汇编。
- 理解 `inlateout` / clobber / options 的含义。
- 实现 `core::fmt::Write` trait，串起 `format_args!` 机器。

**核心实现：`sbi_call`**

```rust
#[inline(always)]
fn sbi_call(eid: usize, arg0: usize, arg1: usize, arg2: usize) -> usize {
    let mut ret: usize;
    unsafe {
        core::arch::asm!(
            "ecall",
            inlateout("a0") arg0 => ret,
            in("a1") arg1,
            in("a2") arg2,
            in("a7") eid,
            options(nostack, preserves_flags),
        );
    }
    ret
}
```

要点：
- `inlateout("a0") arg0 => ret`：`a0` 先载入 `arg0`，ecall 后把
  值读回 `ret`。这是 SBI 约定的两用寄存器。
- `options(nostack)`：告诉 Rust 我们不动 sp，让它可以内联。
- `options(preserves_flags)`：RISC-V 没 flags，写上无害，是好习惯。

**Lab 2 第二件事：`Stdout` 实现 `fmt::Write`**

```rust
impl core::fmt::Write for Stdout {
    fn write_str(&mut self, s: &str) -> core::fmt::Result {
        for &b in s.as_bytes() {
            console_putchar(b as usize);
        }
        Ok(())
    }
}
```

一旦 `Write` 实现好，`println!` 宏展开后就能调 `write_fmt`，
`core::fmt` 会帮我们把 `"hart {}", 0` 这种东西切成 `"hart "` + `"0"`
两段调 `write_str`。零运行时开销，零 heap。

**常见错误**

| 你写的 | 会发生 |
|--------|--------|
| 忘了 `unsafe` 包 `asm!` | 编译器报 "use of unsafe" |
| 参数顺序搞错 (arg0 放 a1) | OpenSBI 收到垃圾，putchar 打印乱码 |
| 宏里用 `print!` 调 `print!` | 宏递归，栈爆 |
| `Stdout` 不实现 Write 直接调 putchar | 丢了 `format_args!` 能力，不能用 `{}` |

**测试**

```bash
make qemu
# 应该看到:
#   Hello, TinyOS!
#   [kernel] booted at 0x...
#   [kernel] .text   [0x80200000, 0x...)
#   ...
# 然后 QEMU 自己退出（shutdown 成功）
```

---

## Lab 3 · `panic_handler` ⭐⭐

**为什么 no_std 必须 `#[panic_handler]`**

完整 Rust 的 panic 路径是：`panic!` → `core::panic_handler` 符号
→ std 的默认实现（unwind 栈帧、打印、abort）。去掉 std 之后，
**符号消失**，链接器会报：

```
error: `#[panic_handler]` function required, but not found
```

所以我们自己在 `no_std` crate 里定义一份——它就是内核的终极
异常处理器。整个 binary 里 **有且只能有一份**。

**PanicInfo 结构**

```rust
pub struct PanicInfo<'a> {
    fn location(&self) -> Option<&Location<'a>>;    // file + line + col
    fn message(&self)  -> Option<&fmt::Arguments>;  // 需要 feature flag
    fn payload(&self)  -> &(dyn Any + Send);        // 不用
    fn can_unwind(&self) -> bool;                   // no_std 里永远 false
}
```

`info.message()` 在稳定 Rust 里还不能直接用，所以 `main.rs` 头部
打了 `#![feature(panic_info_message)]`。

**参考实现**

```rust
#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    if let Some(loc) = info.location() {
        println!(
            "[kernel] PANIC at {}:{}: {}",
            loc.file(),
            loc.line(),
            info.message().unwrap()
        );
    } else {
        println!("[kernel] PANIC: {}", info.message().unwrap());
    }
    shutdown()
}
```

**常见错误**

| 错误 | 后果 |
|------|------|
| 写成 `fn panic(info: &PanicInfo)` 不加 `-> !` | 编译不过，签名不匹配 |
| 忘了 `#[panic_handler]` 属性 | 链接器报缺失 |
| handler 里又 panic | 无限递归（但最终栈爆然后 illegal insn） |
| handler 里借用 `info.message()` 不 unwrap | 它是 `Option`，需要处理 |

---

## 0.4 整合：启动你的内核

三个 Lab 都写完后：

```bash
make qemu
```

期望输出：

```
Hello, TinyOS!
[kernel] booted at 0x802000XX
[kernel] .text   [0x80200000, 0x80203000)
[kernel] .rodata [0x80203000, 0x80204000)
[kernel] .data   [0x80204000, 0x80205000)
[kernel] .bss    [0x80205000, 0x80215000)
```

然后 QEMU 自己退出（你应该会看到 shell prompt 回来）。

### 5 件可以试的事

1. **故意 panic**：在 `rust_main` 里加一行
   ```rust
   panic!("just testing, line {}", line!());
   ```
   观察 Lab 3 的输出格式。

2. **故意越界写**：
   ```rust
   unsafe { (0x0 as *mut u8).write_volatile(42); }
   ```
   看会发生什么。（提示：Load/Store Access Fault，但我们没写 trap
   handler，下一个 Phase 才会抓到。）

3. **改栈大小**：把 `.space 4096 * 16` 改成 `.space 16`，再跑。
   观察递归函数何时爆。

4. **gdb 单步**：
   ```bash
   make gdb          # 终端 1
   make gdb-client   # 终端 2
   (gdb) b rust_main
   (gdb) c
   (gdb) layout asm
   ```

5. **换一种 shutdown**：把 `SBI_SHUTDOWN`（legacy）换成 SRST 扩展，
   观察 QEMU 的退出码。

### grade.py 示例输出

```
═════════════════════════════════════════════════
  Phase 0 · Grading Report
═════════════════════════════════════════════════

  entry.asm + linker.ld
  ████████████████████ 100%  (4/4 tests)
    ✓ kernel builds with `cargo build --release`
    ✓ _start is at 0x80200000
    ✓ linker symbols stext/etext/sbss/ebss/boot_stack_top exist
    ✓ _start loads stack pointer before calling rust_main

  sbi.rs + console.rs
  ████████████████████ 100%  (3/3 tests)
    ✓ prints 'Hello, TinyOS!'
    ✓ prints kernel memory layout (.text / .bss)
    ✓ qemu exits cleanly (sbi::shutdown works)

  panic_handler
  ████████████████████ 100%  (4/4 tests)
    ✓ panic handler prints the word PANIC
    ✓ panic handler prints file:line location
    ✓ panic handler prints the panic message
    ✓ panic handler shuts down (no hang)

─────────────────────────────────────────────────
  Overall: 11/11 tests passed (100%)
```

---

## 0.5 回顾

| 概念 | 你学到了什么 | 为什么重要 |
|------|-------------|------------|
| 特权级 | M / S / U 三层，权限和用途 | Phase 1 trap、Phase 2 用户态全靠它 |
| 链接脚本 | section 布局、BASE_ADDRESS、symbol | 每个后续 Phase 都会动它（栈、堆、内核/用户分离） |
| `no_std` | 拿掉 std 后剩什么、要补什么 | 所有 embedded/系统编程的起点 |
| SBI | ecall 约定、legacy vs v1.0 | Phase 1 syscall 的模板 |
| panic_handler | PanicInfo、必须存在、必须 `-> !` | 内核稳定性的最后一道墙 |

### 你造了什么

```
┌──────────────────────────────────────────┐
│             你的 TinyOS Phase 0           │
│                                          │
│    ┌─────────────────────────────────┐    │
│    │      println!("Hello...")        │    │
│    └──────────────┬──────────────────┘    │
│                   ▼                      │
│    ┌─────────────────────────────────┐    │
│    │   Stdout : fmt::Write            │    │
│    └──────────────┬──────────────────┘    │
│                   ▼                      │
│    ┌─────────────────────────────────┐    │
│    │   sbi::console_putchar           │    │
│    └──────────────┬──────────────────┘    │
│                   ▼                      │
│    ┌─────────────────────────────────┐    │
│    │   sbi_call → ecall               │    │
│    └─────────────────────────────────┘    │
└──────────────────────────────────────────┘
         ▲
         │ 起点
  ┌──────┴──────┐
  │  _start.asm │
  │  la sp, ... │
  │  call rust_ │
  └─────────────┘
```

### Phase 1 预告

下一 Phase 我们会把 **反向** 通道也打通——不仅是内核 → 固件，
还要让 **用户程序 → 内核**。你将：

- 设置 `stvec` 指向汇编入口 `__alltraps`。
- 保存 34 个寄存器到 `TrapContext`，分发 `scause`。
- 实现第一个真·syscall：`sys_write`、`sys_exit`。
- 让一个运行在 U-mode 的用户程序通过 `ecall` 跟你的内核说话。

---

## 参考资料

### 必读

1. [xv6-riscv book, Ch. 1-2](https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf)
   —— MIT 6.S081 的官方课本，第 1-2 章讲 boot 和 trap 框架，是 C 版本
   的，但概念一模一样。
2. [rCore-Tutorial §1 · 应用程序与基本执行环境](https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter1/index.html)
   —— 清华大学的 Rust OS 教程，中文、详尽，Phase 0 和它的第一章高度同构。
3. [RISC-V ELF psABI Specification](https://github.com/riscv-non-isa/riscv-elf-psabi-doc)
   —— 链接脚本、调用约定、寄存器用途。

### 深入阅读

4. [RISC-V Privileged Spec v1.12](https://github.com/riscv/riscv-isa-manual/releases)
   —— 特权级、CSR、trap 的权威定义。
5. [OpenSBI Documentation](https://github.com/riscv-software-src/opensbi/tree/master/docs)
   —— SBI 规范、平台支持、启动流程细节。
6. [The Embedonomicon](https://docs.rust-embedded.org/embedonomicon/)
   —— Rust 嵌入式组的官方文档，从 `#![no_std]` 到最小化 `start` 一步步写。
7. [Writing an OS in Rust (Philipp Oppermann)](https://os.phil-opp.com/)
   —— 虽然用 x86_64，但 no_std / panic_handler / 链接脚本的讲解非常清楚。

### 扩展思考题

- 如果我们要直接从 M-mode 启动（不用 OpenSBI），需要额外做什么？
  （Hint: 自己写 `mret` 过渡到 S-mode、自己配 `mtvec`、自己初始化
  CLINT 的计时器、自己写 UART MMIO 驱动。）
- 为什么 bss 需要手动清零？ELF loader 不是应该做这件事吗？
  （Hint: 有 loader 的环境下确实会做，例如 Linux 的 `load_elf_binary`。
  我们没有 loader——OpenSBI 只是把字节搬到物理地址，不解析 ELF
  header 里的 PT_LOAD `p_memsz > p_filesz`。）
- 如果把 `.bss.stack` 放到 `.data` 段后面、不写 `*(.bss.stack)` 显式
  声明在 `.bss` 首部，会有什么区别？（Hint: ELF 文件体积会变大，
  OpenSBI 加载时间变长——因为 `.data` 里的 0 是要占硬盘空间的，
  `.bss` 不占。）
- `ecall` 有没有可能从 M-mode 发起？目标是哪里？
  （Hint: 可以，落到 M-mode trap handler 自己——一般用于固件内部
  自调试。）
