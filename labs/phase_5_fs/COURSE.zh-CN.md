# Phase 5 — 文件系统 (easy-fs)

> **目标愿景**：本阶段结束后，在 TinyOS 里敲 `ls`、`cat hello.txt`、
> `echo hi > f`，数据会真正写入 VirtIO 磁盘；重启后仍然能读到。

---

## 5.0 导读 — 从内存到磁盘

前四个 Phase 的所有数据结构（页表、任务上下文、堆）都活在 RAM 里，一断电
就消失。Phase 5 引入**持久化存储**，OS 突然要回答一堆新问题：

- 文件 `f` 具体放在磁盘哪几个块上？
- 怎么 O(1) 找到空闲空间？
- 一次 `read` 会不会触发 100 次磁盘 I/O？
- 写入一半时宕机怎么办？

文件系统通常是业余 OS 中最大的子系统 —— xv6 用了 45 页讲它。我们大幅简化：
不做日志、不做权限、不做软链。最终得到 **easy-fs**，≈500 行代码，可以
整体塞进脑袋。

```
╭───────────── 最终效果 ─────────────╮
│  用户 > echo hello > greeting      │
│  用户 > cat greeting               │
│  hello                             │
│  用户 > reboot && cat greeting     │
│  hello   ← 数据持久化到 virtio-blk │
╰────────────────────────────────────╯
```

---

## 5.1 块设备抽象

块设备（block device）以固定大小（这里 512 B）为单位读写。`BlockDevice` trait
只有两个方法：

```rust
fn read_block(&self, block_id: usize, buf: &mut [u8]);  // buf 必须 512 字节
fn write_block(&self, block_id: usize, buf: &[u8]);
```

上层的 bitmap、inode、目录，全都是**对块号的解释规则**。

### VirtIO MMIO 一页速览

QEMU 的 `-device virtio-blk-device,bus=virtio-mmio-bus.0` 会把设备映射到物理
地址 **0x1000_1000**。legacy 寄存器图：

```
偏移   名字          用途
0x000  MagicValue   (= 0x74726976, "virt")
0x004  Version      (1 = legacy)
0x008  DeviceID     (2 = block)
0x030  QueueSel
0x038  QueueNum
0x040  QueuePFN     ← 描述符环物理地址
0x050  QueueNotify  ← 告诉设备"我提交了一个请求"
0x070  Status
```

每次请求由三个描述符串起来：

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ BlkReqHeader │ → │ data (512 B) │ → │ status (1 B) │
│ type|sector  │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
      ↑ 只读            ↑ 读/写       ↑ 设备回填
```

我们不手写队列管理，而是用 `virtio-drivers` crate，只需实现 `Hal` trait
（DMA 分配 + 地址翻译）。

### 常见坑

- **DMA coherency**：真硬件要 `fence`，QEMU 下不需要，但真板子会静默出错。
- **Request 格式**：把 status 放进 data 描述符（违反规范）。
- **轮询死循环**：一定要加超时。

---

## Lab 1 ⭐⭐ — 实现 VirtIOBlock

**文件**：`src/drivers/virtio_blk.rs`

让 `VirtIOBlock` 满足 `BlockDevice`：

```rust
impl BlockDevice for VirtIOBlock {
    fn read_block(&self, id: usize, buf: &mut [u8]) {
        self.0.lock().read_blocks(id, buf).expect("virtio read failed");
    }
    fn write_block(&self, id: usize, buf: &[u8]) {
        self.0.lock().write_blocks(id, buf).expect("virtio write failed");
    }
}
```

crate 帮你隐藏了队列细节，但你要明白底下发生了什么——也就是上面讲的内容。

---

## 5.2 easy-fs 磁盘布局

连续 5 个区域：

```
block #  0        1..                                              total-1
        ┌─────────┬──────────┬──────────┬──────────┬──────────────────────┐
        │ Super   │ Inode    │ Data     │ Inodes   │ Data Blocks          │
        │ Block   │ Bitmap   │ Bitmap   │ (4/block)│                      │
        └─────────┴──────────┴──────────┴──────────┴──────────────────────┘
```

### 4 MiB 磁盘算一下

```
total_blocks        = 4 MiB / 512 B = 8192
inode_bitmap_blocks = 1
inode_area_blocks   = 4096 inode / 4 per block = 1024
data_bitmap_blocks  ≈ 2
data_area_blocks    = 8192 - 1 - 1 - 1024 - 2 = 7164
```

可放 ≈3.5 MiB 文件数据，够用。

---

## 5.3 Bitmap 分配器

一个 bitmap 块 = 512 × 8 = **4096 位**。我们当成 `[u64; 64]` 用位运算：

```
alloc():
  遍历每个 bitmap 块:
    遍历每个 u64:
      若 u64 != !0u64:                # 存在 0 位
        i = u64.trailing_ones()        # 第一个 0 位
        置位并返回位置
```

`trailing_ones` 单条指令。**不要**逐位循环 —— 这是热路径。

---

## 5.4 DiskInode —— 指针树

一个 inode 128 字节（一个块塞 4 个）。块映射：

```
          ┌─ direct[0..28] ──────►  28 × 512 B  = 14 KiB
DiskInode │
          ├─ indirect1 ─► [128 ptrs] ─► 128 × 512 B = 64 KiB
          │
          └─ indirect2 ─► [128 ptrs] ──┬─► [128] → 64 KiB
                                       ├─► [128] → 64 KiB
                                       │   ...
                                       └─►             = 8 MiB

最大文件 ≈ 8.08 MiB
```

### 把 inner 块号 `n` 翻译为物理块号

```
if n < 28                → direct[n]
elif n < 28 + 128        → indirect1[n-28]
else                     → indirect2[(n-156)/128][(n-156)%128]
```

这是 `DiskInode::get_block_id`。`read_at` / `write_at` 本质上就是在循环调用它。

---

## 5.5 DirEntry —— 目录也是文件

目录的"内容"就是一连串 32 字节 DirEntry：

```
byte  0                          27 28        31
     ┌──────────────────────────────┬────────────┐
     │ name (NUL 填充, ≤27 字符)    │ inode (u32)│
     └──────────────────────────────┴────────────┘
```

`ls` = 读出全部 DirEntry；`find(name)` = 线性扫。

---

## Lab 2 ⭐⭐⭐ — easy-fs 核心

**文件**：

```
easy-fs/src/block_cache.rs   LRU 缓存
easy-fs/src/bitmap.rs        alloc/dealloc
easy-fs/src/layout.rs        DiskInode 指针树 / read_at / write_at
easy-fs/src/vfs.rs           Inode::find / create / ls / write_at
```

### 推荐实现顺序

1. `BlockCacheManager::get_block_cache`（其他全依赖它）
2. `Bitmap::alloc` / `dealloc`
3. `DiskInode::get_block_id`
4. `DiskInode::read_at` / `write_at`（注意首尾不对齐的块）
5. `DiskInode::increase_size` / `clear_size`
6. `Inode::find` / `create` / `ls` / `write_at`

### `read_at` 伪码

```
let start = offset, end = min(offset + buf.len(), self.size);
while cur < end:
    block = get_block_id(cur / 512)
    in_block = cur % 512
    n = min(512 - in_block, end - cur)
    get_block_cache(block).lock().read(0, |d: &DataBlock| {
        buf[out..out+n].copy_from_slice(&d[in_block..in_block+n]);
    });
    cur += n; out += n
```

---

## 5.6 BlockCache —— 幕后英雄

没有缓存的话，打开 `/etc/passwd` 要 ~10 次磁盘 I/O（超级块、bitmap、inode 块、
目录块……）。加上 16 项 LRU 后，只有 ~2 次真正下到磁盘。

```
MRU → [b17][b02][b11][b99]...[b08] ← LRU (满了淘汰它)
```

**淘汰规则**：只淘汰 `Arc::strong_count == 1` 的条目（当前没人借用）。
如果全被借用，**panic** —— 说明缓存容量不足。16 项对本课作业完全够用。

**写回策略**：write-back。`sync()` 在 drop 时回写脏页；kernel 在关机前调用
`block_cache_sync_all()`。

---

## Lab 3 ⭐⭐ — 内核 VFS

**文件**：`src/fs/inode.rs`、`src/syscall/fs.rs`。

`File` trait 统一了 stdin/stdout 和磁盘文件：

```rust
trait File: Send + Sync {
    fn readable(&self) -> bool;
    fn writable(&self) -> bool;
    fn read(&self, buf: &mut [u8]) -> usize;
    fn write(&self, buf: &[u8]) -> usize;
}
```

`OSInode` = easy-fs `Inode` + `Mutex<(cursor, inode)>` + flags。

### 完整调用链

```
user: read(fd, buf, n)
  ↓  ecall
sys_read
  ↓  FD_TABLE[fd].read(buf)
OSInode::read
  ↓  inode.read_at(offset, buf)
easy_fs::Inode::read_at
  ↓  DiskInode::read_at
     get_block_id → get_block_cache → copy_from_slice
                         ↓ (miss)
                    BlockDevice::read_block
                         ↓
                    VirtIOBlock.read_blocks → MMIO → QEMU → fs.img
```

---

## 5.7 集成演示

```
$ make fs-img
fs image written to target/fs.img with 2 apps
$ make run
[kernel] phase 5 booting
[kernel] virtio-blk ready
/**** APPS ****
  test_fs
  bench
**************/
test_fs OK
```

重启再运行，`hello.txt` 依然在。

---

## 5.8 回顾 & Phase 6 预告

| 概念 | 你实现了 | 关键文件 |
|------|---------|----------|
| 块抽象 | `BlockDevice` + VirtIO 实现 | `drivers/virtio_blk.rs` |
| 空间管理 | `Bitmap` alloc/dealloc | `easy-fs/bitmap.rs` |
| 指针树 | `DiskInode` 直/间/二级间接 | `easy-fs/layout.rs` |
| 命名空间 | `DirEntry` + `Inode::find/ls` | `easy-fs/vfs.rs` |
| 缓存 | 16 路 LRU | `easy-fs/block_cache.rs` |
| OS 集成 | `File` trait + `OSInode` + 系统调用 | `fs/`, `syscall/fs.rs` |

### Phase 6 预告 —— Shell + 管道

有了文件系统，终于可以跑用户态 shell。新增的唯一内核原语是**管道**：
一个实现 `File` trait 的内存环形缓冲区，于是 `ls | grep hello` 成立。

### 参考资料

#### 必读

- xv6 book, Ch. 8 *File system*
  — https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf
- OSTEP Ch. 39–40 *File System Implementation / FSCK & Journaling*
  — https://pages.cs.wisc.edu/~remzi/OSTEP/
- rCore tutorial 第 6 章 *文件系统*
  — https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/

#### 深入阅读

- VirtIO 1.1 规范（virtio-blk 设备寄存器、virtqueue、描述符链的权威来源）
  — https://docs.oasis-open.org/virtio/virtio/v1.1/virtio-v1.1.pdf
- FFS 原论文 *A Fast File System for UNIX* (McKusick, 1984) —— 柱面组、
  块分配策略的起点，easy-fs 是它的极简子集。
  — https://dsf.berkeley.edu/cs262/FFS.pdf
- Linux `fs/ext2/` 源码 —— 工业级 inode/dir_entry/块位图实现，
  对照你写的 `layout.rs` / `vfs.rs`。
  — https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/ext2

#### 扩展思考

- 为什么 `DiskInode` 要用"直接/一级间接/二级间接"这种指针树，而不
  是一棵平衡树？（提示：小文件 O(1) 命中，大文件代价分摊；B-tree
  元数据开销对 4KB 小文件过大，ext4/XFS 只在大文件上切到 extent。）
- 如果 `block_cache` 的 LRU 替换发生在 `sync` 之前，磁盘数据会不会
  损坏？（提示：不会——驱逐时会先 flush 脏块；但掉电时序不保证，
  所以真正的 FS 用 journaling / COW 来保证 crash consistency。）
- easy-fs 没有目录项哈希，`find` 是 O(n)。如果目录有 10 万个文件
  会怎样？（提示：每次查找走一遍全部块；ext4 的 htree 和 btrfs 的
  B-tree 就是为此。）
