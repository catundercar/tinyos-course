# Phase 2 — Process & Scheduling

> **Goal.** Turn the single-tasked kernel from Phase 1 into a multi-tasking
> kernel. By the end you will have written a 14-line assembly routine that is
> the literal heart of every modern OS scheduler, and you will have three user
> apps being preempted every 10 ms by a timer interrupt you configured.

---

## 2.0 Prologue: What *is* a process, really?

In Phase 1 we ran exactly one user app. Execution was a single straight line:
`_start → ecall → trap_handler → sret → user code → exit`. Everything the CPU
needed was in the registers and on one kernel stack.

Now we want *N* apps. They must share one CPU, which means we need the
ability to **pause** one and **resume** another. But what is "a task",
concretely, inside the kernel?

A task = **(a Task Control Block) + (a kernel stack) + (a user stack)**.

- **TCB** is a plain Rust struct in the kernel's data section. It stores the
  task's status (Ready/Running/Exited), a pointer to its stack, and — crucially
  — a `TaskContext`: the tiny register snapshot we need to bring this task
  back to life.
- **Kernel stack** is where the kernel runs when this task ecall's in. Each
  task gets its own so that when we pause task A in the middle of
  `trap_handler`, task B can do the same without smashing A's frames.
- **User stack** is the task's own memory, untouched by the kernel.

There is no "process" object floating in the ether. A process *is* those three
pieces of memory. Phases 3–5 will add more (address space, file table, parent
pointer, …) but the skeleton is already here.

---

## 2.1 Two contexts: `TrapContext` vs `TaskContext`

We now have **two** distinct "save/restore" flows, and they exist for different
reasons. It is essential to keep them straight.

### TrapContext (34 words, Phase 1, already written)

Saved at the boundary **U-mode ⇄ S-mode**. Because the trap can happen at any
instruction, we must save *every* general register plus `sstatus` and `sepc`.

```
kernel stack grows down
                      ┌──────────────┐  high
                      │   x1 = ra    │
                      │   x2 = sp    │     ← user sp snapshot
                      │      ...     │
                      │   x31        │
                      │   sstatus    │
                      │   sepc       │     ← return PC to user
                      └──────────────┘  low
                            34 * 8 = 272 bytes
```

### TaskContext (14 words, Phase 2, Lab 1)

Saved at the boundary **kernel thread A ⇄ kernel thread B**. Because the
switch only happens *inside* our `__switch` function (which is regular Rust
calling convention — callee-saved), the compiler has already spilled caller-
saved registers (t0-t6, a0-a7) before we are called.

We only need:

- `ra`         — where to resume after `__switch` returns
- `sp`         — the task's kernel stack pointer
- `s0 … s11`   — 12 callee-saved registers

```
                    ┌──────────────┐
                    │  ra          │  +0
                    │  sp          │  +8
                    │  s0 .. s11   │  +16 .. +104
                    └──────────────┘  total 14*8 = 112 bytes
```

Why not save everything, just to be safe? Because `__switch` is *called* from
Rust — the compiler guarantees the caller doesn't care about scratch regs.
Saving them would just waste cycles.

---

## 2.2 The essence of `__switch`

The whole scheduler reduces to one assembly routine: swap `(ra, sp, s0..s11)`
between two memory locations. That's it. That's the secret of multitasking.

Two tasks, A and B, both parked mid-function. Their state lives in their TCBs:

```
Before __switch(&A, &B):                 After __switch(&A, &B):

A.task_cx: ra=old_A_ra sp=A_kstack       A.task_cx: ra=here    sp=A_now
B.task_cx: ra=here'    sp=B_now          B.task_cx: ra=old_B_ra sp=B_kstack
                                         CPU is now running on B's stack,
                                         about to `ret` to old_B_ra
```

In RISC-V asm:

```
__switch:
    # a0 = &mut current   a1 = &next
    sd ra,  0*8(a0)       # save
    sd sp,  1*8(a0)
    sd s0,  2*8(a0)
    ...
    sd s11, 13*8(a0)
    ld ra,  0*8(a1)       # load
    ld sp,  1*8(a1)
    ld s0,  2*8(a1)
    ...
    ld s11, 13*8(a1)
    ret                   # returns on the *new* stack, to the *new* ra
```

14 stores + 14 loads + 1 ret = 29 instructions. That final `ret` is where the
magic happens: `ret` is `jr ra`, but we just overwrote `ra` and `sp`, so we
jump into a completely different task.

### Lab 1 ⭐⭐ — Write it

1. In `task/context.rs`, finish `TaskContext::goto_restore`. It must return a
   `TaskContext` whose `ra` is the address of `__restore` (from `trap.S`) and
   whose `sp` is the kernel stack slot where we just built the initial
   `TrapContext` for this app.
2. In `task/switch.S`, write the 29-instruction body described above.

**Common mistakes**

- Forgetting `ra`. Without it, the new task has no idea where to resume.
- Swapping the store/load order (writing to `a1` instead of `a0`).
- Including caller-saved registers — wastes memory and, worse, makes it easy
  to miss one.
- Wrong offsets. The struct layout is `#[repr(C)]` with `usize` fields, so
  offsets are 0, 8, 16, 24, …, 104.

---

## 2.3 Cooperative vs preemptive scheduling

Once `__switch` works, we need a **policy** for when to switch.

**Cooperative.** Tasks voluntarily call `sys_yield()`. Cheap, simple, but a
buggy or malicious app can hog the CPU forever.

**Preemptive.** The kernel forces a switch on a timer tick. The app cannot
opt out — its next instruction may happen on a different task. This is what
every real OS does.

Phase 2 does both: Labs 2 adds cooperative yield/exit; Lab 3 adds preemption.

### Round-Robin

Given N tasks in a circular array and a pointer `current`, the next Ready
task is simply:

```
for off in 1..=N {
    let i = (current + off) % N;
    if tasks[i].status == Ready { return Some(i); }
}
None   // everyone exited, shut down
```

### State machine

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

There are exactly four states. Phase 3 will add `Sleeping` (blocked on a lock);
Phase 5 will add `Zombie` (exited, but parent hasn't called `wait`).

### Lab 2 ⭐⭐⭐ — Scheduler

Implement in `task/mod.rs`:

- `TaskManager::run_first_task()` — pick task 0, mark Running, `__switch` from
  a throwaway `unused` context into task 0's context. Never returns.
- `TaskManager::find_next_task()` — round-robin scan.
- `TaskManager::run_next_task()` — the workhorse: pick next, update status,
  call `__switch(&mut cur.cx, &next.cx)`.

**Common mistakes**

- Holding the `Mutex<TaskManagerInner>` across the `__switch` call. The
  *next* task will re-enter this path on its own yield and deadlock. Drop the
  guard first.
- Confusing `*mut` vs `*const` for the two context pointers: `current` is
  where we *save*, so `*mut`; `next` is where we *load*, so `*const`.
- Forgetting that `run_first_task` must never return. Use `-> !` and
  `unreachable!()` after `__switch`.

---

## 2.4 RISC-V timer interrupts, briefly

RISC-V has a memory-mapped 64-bit counter called `mtime`, plus a per-hart
comparator `mtimecmp`. When `mtime >= mtimecmp`, a machine-mode timer
interrupt is raised. Our kernel runs in S-mode, so we delegate this through
OpenSBI: we ask it to program `mtimecmp` via `sbi_set_timer(value)`, and the
firmware promotes the interrupt into an S-mode one for us (scause = 0x8000…05).

Three knobs we must touch:

- `sie.STIE` — enable S-mode timer interrupts. One-time, at boot.
- `sstatus.SIE` — the global S-mode interrupt enable. Set when returning to
  user (we already do this in `TrapContext::app_init_context` via SPIE).
- `sbi_set_timer(next)` — re-arm for the next tick, once per ISR.

10 ms slice at a 10 MHz clock → `CLOCK_FREQ / TICKS_PER_SEC = 10_000_000/100 = 100_000`.

### Lab 3 ⭐⭐ — Preemption

1. In `timer.rs`, implement `set_next_trigger()`:
   ```
   let next = get_time() + CLOCK_FREQ / TICKS_PER_SEC;
   set_timer(next as u64);
   ```
2. In `trap/mod.rs`, the `SupervisorTimer` arm of the match is a `todo!()`.
   Replace it with:
   ```
   crate::timer::set_next_trigger();
   crate::task::suspend_current_and_run_next();
   ```

**Common mistakes**

- Passing an *interval* to `set_timer` instead of an absolute deadline. It's
  `mtimecmp`, not "fire in 10 ms".
- Forgetting to re-arm each tick — you'll get exactly one preemption and no
  more.
- Enabling `stie` but forgetting to set `sstatus.SIE` in the user's
  TrapContext — the interrupt will be pending forever in the CSR but masked.

---

## 2.5 Integration: what a good run looks like

After all three labs are done, `make qemu` prints something like:

```
[kernel] TinyOS Phase 2 booting
A0 B0 C A1 B1 C C A2 B2 C C A3 B3 C A4 B4 [A done]
[B done]
C C C C [C done]
```

- Alternating `A`/`B` before preemption: cooperative yield works.
- `C` tokens sprinkled in despite `app_timer` never calling `yield_()`:
  preemption works.
- The `[X done]` markers prove `sys_exit` tears the task down cleanly and
  scheduling continues.

The grading script (`scripts/grade.py`) checks exactly these properties.

---

## 2.6 Review & Phase 3 preview

By now you should be able to explain, without notes:

- Why `TaskContext` is 14 words and `TrapContext` is 34. Who's calling whom,
  and what the ABI promises.
- What the `ret` at the end of `__switch` actually does, and how it ends up
  executing on a different task.
- Why the scheduler must drop its lock before `__switch`.
- The exact three things a timer ISR must do: re-arm, yield, return.

**Phase 3 preview.** Preemption introduces a new problem: if two tasks both
update a shared counter, the switch may land mid-`lw`/`sw` and corrupt it.
Phase 3 builds the fix — SpinLock, SleepLock, semaphores — and makes you
defend against deadlock.

---

## References

### Required

- OSTEP — [Chapters 5–10 Processes & Scheduling](https://pages.cs.wisc.edu/~remzi/OSTEP/)
- xv6-riscv book — [Chapter 7 Scheduling](https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf)
- rCore-Tutorial — [§3 Task Switching](https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/index.html)

### Deep dive

- RISC-V Privileged Spec — [Chapter 4 Supervisor-Level ISA](https://github.com/riscv/riscv-isa-manual/releases)
- SBI spec — [RISC-V SBI Specification v1.0](https://github.com/riscv-non-isa/riscv-sbi-doc)
  (authoritative for `set_timer` and IPIs — the basis of timeslice scheduling)
- Linux Kernel Development (Love), Ch. 4 *Process Scheduling* — compare
  CFS against the round-robin scheduler you just wrote.

### Stretch questions

- Why must `__switch` be written in assembly? Where would a Rust version
  break? (Hint: Rust's calling convention inserts prologue/epilogue
  register save-restore, so you cannot precisely control when `ra` and
  `sp` flip — the stack gets torn mid-swap.)
- If a task in kernel mode loops forever without yielding, can the timer
  interrupt save you? (Hint: yes — as long as `sstatus.SIE=1` and
  `sie.STIE=1`, the S-timer preempts S-mode itself. This is the essence
  of preemptive scheduling.)
- Is round-robin fair to I/O-bound tasks? (Hint: no — a blocked I/O task
  waits a full round after waking. OSTEP Ch. 8's MLFQ was invented for
  exactly this.)
