# Phase 4 · 虚拟内存与 SV39 分页

> **第 8–9 周 · 3 个实验**
> 前置：Phase 3（内核/用户分离、trap、简单调度）
> 后续：Phase 5（文件系统）会依赖本章的 `translated_byte_buffer`。

---

## 4.0 导读 —— "两个程序用同一个指针地址，却互不干扰" 的魔法

在 PC 上同时跑下面两个程序：

```c
// 程序 A                             // 程序 B
int *p = (int*)0x10000000;           int *p = (int*)0x10000000;
*p = 111;                            *p = 222;
printf("%d\n", *p);                  printf("%d\n", *p);
```

A 打印 `111`，B 打印 `222`，互不影响。虚拟地址完全相同，为什么没互相覆盖？

因为每个进程访问内存时，CPU 的 MMU 都会通过**各自私有的映射表**把虚拟地址
翻译成物理地址。A 运行时，`0x10000000` 经 A 的页表落到某个物理帧 `PA_a`；
B 运行时，**同一个** VA 经 B 的页表落到完全不同的 `PA_b`。物理内存并不知道
进程的存在，只看到两个不同的物理地址。

Phase 4 要构建的三层结构：

```
          ┌───────────────────┐   ┌───────────────────┐
   进程 A │   MemorySet A     │   │   MemorySet B     │ 进程 B
          │ ┌──────────────┐  │   │ ┌──────────────┐  │
          │ │  PageTable A │  │   │ │  PageTable B │  │
          │ │  (own frames)│  │   │ │  (own frames)│  │
          │ └──────┬───────┘  │   │ └──────┬───────┘  │
          └────────┼──────────┘   └────────┼──────────┘
                   │                       │
                   ▼                       ▼
          ┌──────────────────────────────────────────┐
          │         FrameAllocator（全局唯一）       │
          │        按 4 KiB 发放空闲物理帧           │
          └──────────────────────────────────────────┘
```

全局只有 **一个** 帧分配器。每个进程 **独立的** 页表。切换进程时向 CSR
`satp` 写入新的根 PPN 即可。

---

## 4.1 概念 —— 为什么需要虚拟内存

| 动机        | 没有 VM 会怎样                                         |
|-------------|--------------------------------------------------------|
| **隔离**    | 任何用户 bug 都可能改写内核或邻居进程的数据            |
| **重定位**  | 每次开机都得重新编译二进制以适配真实地址               |
| **超售**    | 进程总内存需求一旦超出物理 RAM 就无法运行              |

SV39 把 MMU 插进每条 load/store 指令与物理总线之间，一次性解决以上三点。

---

## 4.2 概念 —— SV39 布局

RISC-V SV39：**虚拟地址 39 位**，**物理地址 56 位**。VA 按 `9/9/9/12` 拆
成三级页表索引：

```
 63           39 38       30 29       21 20       12 11         0
 ┌──────────────┬───────────┬───────────┬───────────┬────────────┐
 │   符号扩展   │  VPN[2]   │  VPN[1]   │  VPN[0]   │   offset   │
 └──────────────┴───────────┴───────────┴───────────┴────────────┘
     25 位         9 位       9 位        9 位        12 位
```

### 三级走表

```
         satp.PPN ──► ┌─────────┐
                      │  L2 表  │   512 个 PTE
                      └────┬────┘
       VA[38:30]=VPN[2]  ──►│
                            ▼
                       PTE2.PPN ──► ┌─────────┐
                                    │  L1 表  │
                                    └────┬────┘
                 VA[29:21]=VPN[1]   ──►│
                                       ▼
                                  PTE1.PPN ──► ┌─────────┐
                                               │  L0 表  │
                                               └────┬────┘
                       VA[20:12]=VPN[0]         ──►│
                                                    ▼
                                               PTE0.PPN + VA[11:0] = PA
```

最坏情况 3 次访存。硬件通过 **TLB** 缓存最终映射，绝大多数翻译仅需 1 周期。

---

## 4.3 概念 —— PTE 位图

每个 4 KiB 帧可存 512 个 64 位 PTE：

```
 63        54 53                         10 9   8 7 6 5 4 3 2 1 0
 ┌────────────┬──────────────────────────────┬─────┬─┬─┬─┬─┬─┬─┬─┬─┐
 │  reserved  │              PPN             │ RSW │D│A│G│U│X│W│R│V│
 └────────────┴──────────────────────────────┴─────┴─┴─┴─┴─┴─┴─┴─┴─┘
      10              44 位                    2   1 1 1 1 1 1 1 1
```

| 位 | 名字 | 含义 |
|----|------|------|
| 0  | V    | 有效位，未使用的 slot 必须清零 |
| 1  | R    | 叶节点可读 |
| 2  | W    | 叶节点可写 |
| 3  | X    | 叶节点可执行 |
| 4  | U    | 用户态可访问（S 态访问须 `SUM=1`）|
| 5  | G    | Global（所有 ASID 共享）|
| 6  | A    | Accessed |
| 7  | D    | Dirty |
| 8–9| RSW  | 留给 OS 自由使用 |

常见组合：

| 组合       | 含义                              |
|------------|-----------------------------------|
| `V`        | 中间层 PTE（指向下一级页表）      |
| `V R X`    | 内核 .text / trampoline           |
| `V R`      | 内核 .rodata                       |
| `V R W`    | 内核 .data / .bss / 物理内存       |
| `V R W U`  | 用户栈 / 用户堆 / 匿名 mmap        |
| `V R X U`  | 用户 .text                         |

`R=W=X=0 且 V=1` 的 PTE 表示**中间指针**，其它组合都是**叶节点**。

---

## Lab 1 指南 ⭐⭐ —— `frame_allocator.rs`

栈式分配器 + FrameTracker RAII：

```
  StackFrameAllocator
  ┌───────────────────────────────────────────────────┐
  │  current  ───► end                                │
  │     │                                             │
  │     ▼                                             │
  │  [ 从未分配过的物理帧区间 ]                       │
  │                                                   │
  │  recycled: Vec<PPN>   ◄─── dealloc 时 push        │
  └───────────────────────────────────────────────────┘
```

### 易踩的坑

* **忘记清零**。`FrameTracker::new` 必须把整 4 KiB 归零，否则复用为页表
  帧时残留字节会被误解为合法 PTE。
* **丢失 tracker**。在 tracker 之外保存裸 `PhysPageNum` 就意味着该帧永远
  无法回收。
* **双重释放**。`dealloc` 里加一行 `assert` 能在调试阶段立刻暴露。

---

## Lab 2 指南 ⭐⭐⭐ —— `page_table.rs`

核心两件事：

* `find_pte_create(vpn)` —— L2→L1→L0 走表，遇到无效中间 PTE 就申请新帧。
* `find_pte(vpn)` —— 同样的走法，但 **绝不** 分配；中间任何一层缺失就
  返回 `None`。

`map` / `unmap` / `translate` 在此之上各自只需要三四行。`translate` 正
是 PROVIDED 的 `translated_byte_buffer` 的底座——内核借助它在 `satp` 已
切走的情况下仍能读到用户缓冲区。

### 为什么中间 PTE 只设 V

硬件依据 `R | W | X ≠ 0` 判断叶节点。中间 PTE 必须只有 `V=1`，否则 MMU
会把它当叶节点、把指向下一级页表的 PPN 当成最终物理帧。

---

## 4.4 概念 —— `satp` CSR

```
 63   60 59       44 43                                 0
 ┌──────┬───────────┬───────────────────────────────────┐
 │ MODE │   ASID    │              root PPN             │
 └──────┴───────────┴───────────────────────────────────┘
    4       16                    44
```

`MODE = 8` 开启 SV39。写 `satp` **不会** 自动刷新 TLB，必须紧跟 `sfence.vma`：

```asm
    csrw  satp, t0
    sfence.vma      # 清空整个 TLB
```

忘了 fence，CPU 会继续使用上一个地址空间缓存的翻译——非常隐蔽的 bug。

---

## 4.5 概念 —— MemorySet / MapArea 与 trampoline 小把戏

```
 用户地址空间                             内核地址空间
 ┌────────────────────────┐ 2^39-1        ┌────────────────────────┐
 │   Trampoline (R X)     │═══════════════│   Trampoline (R X)     │  同一个 PA！
 ├────────────────────────┤ TRAMPOLINE-1  ├────────────────────────┤
 │   TrapContext (R W)    │               │  （恒等映射的物理内存、│
 ├────────────────────────┤               │    内核 .text/.rodata/ │
 │                        │               │    .data/.bss 等）     │
 │   用户栈 (R W U)        │               │                        │
 │   ...                  │               │                        │
 │   .bss  (R W U)         │               │                        │
 │   .data (R W U)         │               │                        │
 │   .text (R X U)         │               │                        │
 └────────────────────────┘ 0             └────────────────────────┘ 0
```

**Trampoline** 是一页汇编代码，在 *每个* 地址空间（内核+所有用户进程）
都映射到 **同一个** VA `0xFFFFFFFFFFFFF000` 并指向 **同一块** 物理帧。
原因：在 `csrw satp` 后紧接着取下一条指令时——不管新旧映射谁生效——PC
都必须落在合法、已映射的页面上。Trampoline 是唯一满足该约束的位置。

---

## Lab 3 指南 ⭐⭐⭐ —— `memory_set.rs`

### `new_kernel()`

遍历内核每个段（`stext..etext`、`srodata..erodata`、`sdata..edata`、
`sbss..ebss`）以及 `ekernel..MEMORY_END` 的剩余物理内存，各自 push 一个
**恒等映射** 的 MapArea。不要加 `U`。别忘了 `map_trampoline()`。

### `from_elf(elf)`

1. `xmas_elf::ElfFile::new(data)` 解析。
2. 对每个 `PT_LOAD`：
   - start = `ph.virtual_addr()`，end = start + `ph.mem_size()`；
   - 权限来自 `ph.flags()`，再或上 `U`；
   - data = `elf_data[ph.offset() .. ph.offset()+ph.file_size()]`；
   - push 一个 Framed MapArea，附带初始数据。
3. 在 `max_end_vpn` 上方留一页 guard page，再 push 大小为
   `USER_STACK_SIZE` 的 Framed 用户栈（R W U）。
4. Push `[TRAP_CONTEXT, TRAMPOLINE)` 那页 Framed（R W，不加 U）。
5. 返回 `(memory_set, user_sp, entry_point)`。

---

## 4.6 整合 —— 启动

`task::TaskControlBlock` 持有 `MemorySet` 和 `trap_cx_ppn`。切换任务的
最后几条指令：

```asm
    csrw  satp, t0          # 新进程的根 PPN
    sfence.vma
    sret
```

验证：

1. 同时启动两份 `isolation_demo`，各自向 `0x10000000` 写
   `0xAAAA_AAAA` 与 `0xBBBB_BBBB`，读回必须是自己写的值。
2. 启动 `page_fault_demo`，内核应打印 `StorePageFault @ 0x0 ... killed`
   并继续调度下一个任务，而非崩溃。

---

## 常见错误 / Common Mistakes

下面是学生真实踩过的坑。每一条都包含**症状**（你实际看到的现象）、**原因**（为什么会这样）和**修复**（怎么改对）。在出问题时先对照这里，能省掉几小时盲调。

### 1. 写 `satp` 后忘了 `sfence.vma`
**症状**：切换到用户页表后立刻 `InstructionPageFault`，或者内核跳进用户态后第一条指令就取指失败；有时在 QEMU 上偶尔能跑，换硬件或更严格的模拟器就挂。
**原因**：`satp` 只是告诉 MMU "新页表在这里"，但 TLB 里还缓存着旧的 VA→PA 映射。CPU 会继续用旧条目翻译，直到 TLB 被显式刷新。
**修复**：每次修改 `satp` 后立刻执行 `sfence.vma`（不带参数即刷全表）：
```asm
csrw satp, t0
sfence.vma zero, zero
```
修改某个叶子 PTE 后也要刷对应 VA 的 TLB，否则后续访问看不到更新。

### 2. PTE flag 组合错误（`R=0 W=1` 是保留编码）
**症状**：加载页表后立刻 `LoadPageFault` 或 `StorePageFault`，连第一条 `ld`/`sd` 都走不过；`mcause` 对应异常号看似合理，但权限位明明"够用"。
**原因**：SV39 规定 `R=0, W=1` 是 reserved encoding，硬件按非法处理；`R=0, W=1, X=1` 同样非法。此外如果忘了设 `V=1`，整条 PTE 视为无效。
**修复**：设置 PTE 时使用枚举封装，绝不直接操作 bit：
```rust
bitflags! {
    pub struct PTEFlags: u8 {
        const V = 1 << 0;
        const R = 1 << 1;
        const W = 1 << 2;
        const X = 1 << 3;
        const U = 1 << 4;
    }
}
```
对用户数据页用 `V | R | W | U`，对代码段用 `V | R | X | U`，永远不要出现"只 W 不 R"。

### 3. `FrameTracker` 没真正被持有，帧被提前释放
**症状**：跑几秒后随机出现 `LoadPageFault`，或用户程序读到诡异的全 0/脏数据；`frame_alloc` 返回同一个物理页给不同进程。
**原因**：`new_frame()` 返回 `FrameTracker`，它的 `Drop` 会把帧还回 allocator。如果只取 `.ppn` 存进页表却不保留 `FrameTracker`（比如写成 `let ppn = frame_alloc().unwrap().ppn;`），整个临时变量在语句结束就析构了，帧被回收但 PTE 还指着它。
**修复**：把 `FrameTracker` 放进 `MapArea.data_frames: BTreeMap<VirtPageNum, FrameTracker>` 或 `PageTable.frames: Vec<FrameTracker>`，生命周期和拥有它的结构一致。

### 4. 混淆 VPN 和 PPN 的下标
**症状**：页表走表跳到一个不可能的地址，QEMU 立刻 `InstructionPageFault @ 0xdeadbeef...`；调试时发现自己把用户 VA 当物理地址去访问了。
**原因**：VPN 用来**索引**当前页表，PPN 则指向**下一级页表或叶子帧**。初学者常写 `pt[vpn.2]` 去拿下一级表，结果把 VPN 当成 PPN 用。
**修复**：牢记公式 `next_pt = PPN(pte) << 12`，三级走表写成：
```rust
let idxs = vpn.indexes();   // [vpn2, vpn1, vpn0]
let mut ppn = self.root_ppn;
for i in 0..3 {
    let pte = &ppn.get_pte_array()[idxs[i]];
    if i == 2 { return Some(*pte); }
    ppn = pte.ppn();        // 下一级是 PPN，不是 VPN
}
```

### 5. 没在内核空间和用户空间同时 identity-map trampoline
**症状**：`__alltraps` 进入内核后切换 `satp`，下一条指令就 `InstructionPageFault`；用户态触发 trap 可以跳到 `TRAMPOLINE`，但回到用户态前死掉。
**原因**：trampoline 的 `sret`/`trap` 指令横跨 satp 切换边界——切换瞬间，PC 必须在新旧两张表里都映射到同一个物理页。只要少一边，切换那条指令的下一条就没地址翻译。
**修复**：两个 MemorySet 都要把 trampoline 映射到最高页 `TRAMPOLINE = 0xffff_ffff_ffff_f000`，并指向同一块物理代码：
```rust
memory_set.page_table.map(
    VirtAddr::from(TRAMPOLINE).into(),
    PhysAddr::from(strampoline as usize).into(),
    PTEFlags::R | PTEFlags::X,
);
```
用户空间也一样，不带 `U` 位。

### 6. 用户栈两侧没留 guard page，或者上下两页被双重映射
**症状**：用户程序跑着跑着莫名其妙踩到相邻栈/堆的数据；或者刚 `exec` 就 `StorePageFault`，地址落在本该有效的栈区。
**原因**：栈溢出时如果下方紧邻另一个有效页，会静默覆盖别人的内存；或者把 stack top 算错，导致 stack 区和 trap context 区重叠、同一 VPN 出现两个 PTE。
**修复**：在 stack 下方留一个**未映射**的 guard page，触发栈溢出直接 `StorePageFault` 而不是静默损坏：
```
[user stack top] ← sp 从这里向下
...
[user stack bottom]
[GUARD PAGE unmapped]   ← 溢出即 fault
[next area]
```
同时用 `assert!` 检查每块 MapArea 的 VPN 范围不相交。

### 7. 切进程时 `satp` 没换，用旧 satp 访问新进程内核态
**症状**：调度到第二个用户进程后，内核读 `TrapContext` 读到上一个进程的值；或者系统调用参数完全不对。
**原因**：`__switch` 只换了内核栈和寄存器，但 satp 要在进入新进程的内核态前（或用户态前）显式切。stale satp 导致内核用旧页表翻译新进程的 trap context 虚址。
**修复**：在 `trap_return` 里根据 `current_task().user_satp()` 写入 satp 并 `sfence.vma`，确保从内核态跨回用户态用的是新表：
```asm
csrw satp, a0
sfence.vma zero, zero
jr     t0              # 跳到 TRAMPOLINE 里的 sret
```
永远不要假设"上一个进程留下的 satp 刚好对"。

---

## 4.7 复盘 & 下一阶段

| 你现在应该能……                                  | 对应文件              |
|-------------------------------------------------|-----------------------|
| 默写 SV39 三级走表图                            | §4.2                  |
| 读一个 PTE 并说出它授予哪些访问权限             | §4.3                  |
| 30 秒内讲清 trampoline trick                    | §4.5                  |
| 无泄漏地分配/回收物理帧                         | Lab 1                 |
| 安装并翻译映射                                  | Lab 2                 |
| 从 ELF 构建每进程地址空间                       | Lab 3                 |

**Phase 5 预告。** 有了地址空间后，加载程序就意味着从磁盘读取 ELF。下一
阶段我们将搭建一个迷你 FAT 文件系统，用真正的 `sys_exec("/bin/hello")`
替换 Phase 4 中写死的 ELF 数组。

---

## 参考资料

### 必读

* xv6-riscv book · Ch. 3 *Page tables*
  <https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf>
* rCore-Tutorial v3 · 第 4 章 *地址空间*
  <https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/index.html>
* RISC-V Privileged Spec · Ch. 10 *Supervisor-Level Memory Management*
  <https://github.com/riscv/riscv-isa-manual/releases>

### 深入阅读

* OSTEP · Ch. 18–23 *Virtualization of Memory* —— 分页、TLB、多级
  页表的系统性导论。
  <https://pages.cs.wisc.edu/~remzi/OSTEP/>
* Writing an OS in Rust (Phil-Opp) · *Paging Introduction* / *Paging
  Implementation* —— x86_64 视角，但 `Mapper` / `FrameAllocator`
  的抽象与你的 `MemorySet` 高度同构。
  <https://os.phil-opp.com/>
* Linux `arch/riscv/mm/init.c` —— 产业级 SV39/SV48 切换与
  `setup_vm_final` 的真实代码。
  <https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/riscv/mm/init.c>

### 扩展思考

* 为什么切换 `satp` 后必须 `sfence.vma`？不刷 TLB 会看到什么诡异
  现象？（提示：TLB 里缓存的是旧 ASID 的翻译，下一条指令可能按
  旧页表取指；QEMU 不严格，真机会直接飞。）
* 跳板页 (trampoline) 为什么要在内核地址空间和每个用户地址空间
  的**同一虚拟地址**映射？（提示：`__alltraps` 切换 `satp` 的那
  一条指令，切换前后必须落在同一 VA 上，否则下一条 PC 落到空洞。）
* 如果把内核也放到低地址（身份映射 + 页表隔离），有什么好处和代价？
  （提示：好处是 U/S 共用 ASID 时 TLB 条目多；代价是内核必须
  relocation-aware，xv6 选择高地址正是为了避免这一点。）
