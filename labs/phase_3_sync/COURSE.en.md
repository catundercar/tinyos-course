# Phase 3 · Synchronization Primitives

> *"You have two cows. You give one to your friend. They promptly
> become four cows because you both incremented `herd_count` at the same
> time."* — Adapted from concurrency folklore

---

## 3.0 Motivation: the counter that forgets

Consider the simplest possible shared state: one `usize` counter, two
tasks, each calls `counter += 1`. Run both 10 000 times and print the
total. Expected: 20 000. Observed in Phase 2's preemptive scheduler:
anywhere from **10 002 to 19 998**.

What happened? `counter += 1` in RISC-V compiles to three instructions:

```asm
lw   t0, (a0)      # 1. load counter
addi t0, t0, 1     # 2. increment in register
sw   t0, (a0)      # 3. store back
```

Here is one interleaving that loses an update (T1 and T2 are two tasks,
counter starts at 5):

```
T1: lw  t0 <- 5        ───┐
                          │   (timer interrupt, context switch)
T2: lw  t0 <- 5           │
T2: addi t0 = 6           │
T2: sw  6 -> counter      │
                          │   (switch back)
T1: addi t0 = 6        ───┘
T1: sw  6 -> counter
```

Two increments, one update. The write from T2 was **lost**.

This phase gives you the tools to prevent that interleaving.

---

## 3.1 Concepts · race condition, atomicity, critical section

- **Race condition** — correctness depends on the relative timing of
  operations. Tests pass 999 times out of 1000 and fail in production.
- **Atomicity** — an operation is atomic if no other CPU/task can
  observe it half-done. On RISC-V, single `lw`/`sw` of aligned word-sized
  data is atomic. `counter += 1` is **not**; it's three instructions.
- **Critical section** — a code region that accesses shared state. To be
  safe, at most one task may be inside a given critical section at a
  time. The machinery that enforces "at most one" is a **lock**.

> **Rule of thumb.** If a variable is read and written by more than one
> task, either wrap it in a lock or make every access a single atomic
> instruction.

---

## 3.2 Concepts · SpinLock = atomic flag + busy wait

A spinlock is the simplest lock that works. A single byte — `locked: bool`
— in memory. `lock()` spins until it atomically flips `false → true`.
`unlock()` stores `false` back.

### RISC-V atomic instructions we need

The `A` (atomic) extension adds *read-modify-write* instructions that
complete indivisibly relative to other harts:

| Mnemonic | Effect |
|----------|--------|
| `amoswap.w.aq rd, rs2, (rs1)` | `rd = *rs1;  *rs1 = rs2;` atomically with acquire semantics |
| `amocas.w rd, rs2, (rs1)` | compare-and-swap (Zacas ext.) |
| `lr.w` + `sc.w` | load-reserved / store-conditional pair |

Rust's `AtomicBool::compare_exchange` lowers to one of these — you do
not write them by hand.

### Why we must disable interrupts while holding a spinlock

Imagine hart 0 holds spinlock `L`. A timer interrupt fires. The handler
schedules another task on hart 0, and that task calls `L.lock()`. Now
hart 0 is spinning on a flag that only hart 0 can clear. **Deadlock on
one hart.**

The fix: `lock()` disables local interrupts before CAS, and `unlock()`
re-enables them after releasing. The RAII guard does this automatically
so students cannot forget.

### SpinLock state machine

```
  ┌──────────────┐  lock() CAS(false,true)  ┌────────────┐
  │   FREE       │ ────────────────────────▶│   HELD     │
  │ locked=false │                          │ locked=true│
  │              │◀──────────────────────── │ irq disabl.│
  └──────────────┘     unlock() store(false)└────────────┘
```

### Lab 1 guide

Implement `SpinLock::lock`, `try_lock`, `raw_unlock`, and `SpinLockGuard::drop`
in `src/sync/spin.rs`. Pseudocode is already in the file as comments. Top
three bugs you will hit:

1. **Forgetting the drop ordering.** Release the atomic flag FIRST, then
   restore interrupts. If you restore first, a timer IRQ can preempt you
   while `locked` is still `true`.
2. **Using `Ordering::Relaxed` on acquire.** Compilers and out-of-order
   CPUs will hoist reads of your protected data above the CAS. Use
   `Acquire` on success and `Release` on store.
3. **Using `swap` instead of `compare_exchange`** and then spinning —
   `swap` always writes, which is a cache-line ping-pong. `compare_
   exchange` with the relaxed-failure branch is cheaper.

---

## 3.3 Concepts · Sleep locks (blocking mutex)

Spinlocks are great for microsecond-scale critical sections (updating
a list head, bumping a counter). For anything that might take longer —
disk I/O, an allocation that could grow the heap, a network round-trip
— burning CPU while the lock is held by another task is wasteful.

Solution: if the lock is taken, **block** the caller. The scheduler
picks someone else to run. When the lock is eventually released, the
releaser drags one waiter off the queue and marks it ready.

```
  lock()  ─┬──────── not held ──────▶  set locked=true, return
           │
           └──────── already held ──▶  push self on wait_queue
                                       yield_to_scheduler
                                       (woken: return, holding lock)
```

This is the analogue of `tokio::sync::Mutex` in async Rust or
`std::sync::Mutex` in std.

### Ownership hand-off on unlock

When `unlock()` finds a non-empty wait queue, **do not clear
`locked`**. Pop a waiter, leave `locked = true`, and wake the waiter.
The lock is directly handed over. If you instead cleared `locked` and
woke a waiter, a third task that calls `lock()` before the waiter gets
scheduled could steal the lock — a "lost-wakeup" pattern.

---

## 3.4 Concepts · Semaphore & Condvar

### Counting semaphore

A semaphore is an `isize` counter with two operations:

- `P` / `down` / `wait`: decrement. If result `< 0`, block.
- `V` / `up` / `signal`: increment. If result `≤ 0`, wake one waiter.

With initial value 1, it's a mutex. With initial value *N*, it gates
*N* concurrent users of a resource (e.g. 3 outgoing HTTP connections).

### Condition variable

A Condvar lets a task sleep until a **predicate** of shared state
becomes true. The predicate is evaluated under a mutex; the Condvar is
the "wait for notification" half.

Canonical loop:

```rust
mutex.lock();
while !predicate() {
    condvar.wait(&mutex);
}
// predicate() is now true AND mutex is held
mutex.unlock();
```

Why `while`, not `if`? Spurious wakeups and signal-sent-to-wrong-waiter
races. Always re-check.

### The lost-wakeup race

The wait operation has to be **atomic with respect to the mutex
release**, or this ordering is possible:

```
Thread A (waiter)       Thread B (signaler)
-----------------       -------------------
mutex.lock()
check predicate → false
mutex.unlock()
                         mutex.lock()
                         predicate = true
                         condvar.signal()    # nobody waiting!
                         mutex.unlock()
condvar.wait()           # sleeps forever
```

The fix implemented in `Condvar::wait`: enqueue on the wait queue
BEFORE calling `mutex.unlock()`. Then a signal that races in can find
us.

### Lab 2 guide

Implement `MutexBlocking`, `Semaphore`, `Condvar`, and the nine
`sys_*` syscalls. Tests live in `tests/test_lab2_sync_primitives.rs`;
end-to-end demos live in `user/src/bin/`.

---

## 3.5 Concepts · Deadlock

Coffman's four conditions — all must hold for deadlock:

1. **Mutual exclusion** — resources are non-shareable.
2. **Hold & wait** — a task holds one resource while waiting for another.
3. **No preemption** — the kernel can't yank a lock away.
4. **Circular wait** — a cycle in the wait-for graph.

```
      P0 ──holds──▶ fork_0 ──wanted by──▶ P1
       ▲                                   │
       │                                  holds
       │                                   │
       └────────── wanted by ───── fork_4 ◀┘
```

The classic breaker is **resource ordering**: globally sort your locks
and always acquire in ascending order. That destroys condition (4)
because you can't form a cycle if every edge points "up" in the order.
`philosopher_dinner.rs` uses this trick — each philosopher picks up
`min(left, right)` first.

---

## 3.6 Integration

Three demos exercise the whole stack:

| Program | Primitives | Pass criterion |
|---------|-----------|----------------|
| `race_counter` | `MutexBlocking` | final = 100 000 exactly |
| `producer_consumer` | `Semaphore` × 2 + `Mutex` | all 2000 items transferred |
| `philosopher_dinner` | 5 × `Mutex` | heartbeats advance for 60 s |

Run them with `make qemu USER=race_counter`, etc.

---

## 3.7 Review + what's next

Checkpoint — you should now be able to answer:

- Why does a spinlock on a uniprocessor need to disable interrupts?
- What is the lost-wakeup bug, and what's the minimal fix in `Condvar::wait`?
- Which of Coffman's conditions does "lock ordering" break?
- Given a semaphore at value `-3`, how many waiters are enqueued?

**Phase 4 preview — Virtual Memory.** You'll enable SV39 paging, give
every process its own address space, and handle page faults. Your sync
primitives will carry straight over — a SpinLock doesn't care whether
the pointer it protects lives in a kernel or user page table.

---

## References

### Required

- xv6-riscv book, Ch. 6 *Locking*:
  <https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf>
- OSTEP Ch. 28–31 *Concurrency*:
  <https://pages.cs.wisc.edu/~remzi/OSTEP/>
- rCore-Tutorial v3, Ch. 5 *Process & Synchronization*:
  <https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter5/>

### Deep dive

- Linux Kernel Development (Love), Ch. 10 *Kernel Synchronization
  Methods* — industrial-grade spinlock, rwlock, seqlock, RCU.
- RISC-V Unprivileged ISA — "A" Extension (authoritative `lr.w` /
  `sc.w` / `amoswap` semantics):
  <https://github.com/riscv/riscv-isa-manual/releases>
- Rust reference on atomics and memory orderings
  (`Ordering::{Relaxed, Acquire, Release, SeqCst}`):
  <https://doc.rust-lang.org/std/sync/atomic/>

### Stretch questions

- Why must interrupts be disabled while a `SpinLock` is held? What
  deadlock appears if you forget? (Hint: if the interrupt handler tries
  to take the same lock, the CPU deadlocks with itself. xv6's
  `push_off` / `pop_off` exists exactly for this.)
- A `SleepLock`'s `wait_queue` needs its own lock. Can that inner lock
  be another `SleepLock`? (Hint: no — infinite recursion. The inner
  critical section must use a `SpinLock`.)
- What breaks if `unlock()` uses `Ordering::Relaxed` for its store?
  (Hint: writes inside the critical section can be reordered past the
  unlock; the next acquirer sees stale data. You need `Release`.)
