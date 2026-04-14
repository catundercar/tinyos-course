# Phase 6 — Shell, Pipes, and Coreutils

## 6.0 Prelude — The OS Grows a Shell

You started at `_start` in Phase 0 with nothing but RISC-V registers. You added
traps (Phase 1), processes (Phase 2), locks (Phase 3), paging (Phase 4), and a
filesystem (Phase 5). In this phase we put the final stone on the arch:
**a user-land shell that composes programs with pipes**.

The integration target is one line:

```
make run → /bin/init → /bin/sh → $ ls | wc -l
```

If you can type that and see a number come back, you have built an OS.

```
  ┌─────────────────┐
  │  init  (pid 0)  │
  └────────┬────────┘
           │ fork+exec
           ▼
  ┌─────────────────┐
  │   sh  (pid 1)   │
  └────┬─────┬──────┘
       │     │  fork+pipe+exec
       ▼     ▼
  ┌──────┐ ┌──────┐
  │  ls  │→│  wc  │
  └──────┘ └──────┘
```

---

## 6.1 Concept — `fork`

`fork()` duplicates the calling process. The child is an almost-identical copy:

- Same user memory (same code, same data, same stack) — but in **fresh physical
  frames**. Writes do not leak across.
- Same fd table — each slot is an `Arc::clone` of the parent's, so both share
  the same pipe/file refcounts.
- Different pid, different kernel stack, different parent pointer.

### The `a0 = 0` trick

A syscall returns through `x[10]` (a0 in RISC-V). Right before adding the
child to the ready queue, we overwrite its trap context:

```
child.trap_cx.x[10] = 0;
```

Now when the scheduler dispatches the child, `__restore` pops a0 = 0 into the
user register, and `fork()` appears to return **0** in the child. The parent's
trap context was never touched; it returns the child pid. One syscall, two
return values.

---

## 6.2 Concept — `exec`

`exec(path)` throws away the current memory_set and loads a new ELF into the
same PCB. The pid, parent links, and fd table all survive — that's why
`fork()` followed by `exec()` works as the universal "run a program" idiom.

```
  before exec                 after exec
  ┌────────────┐              ┌────────────┐
  │ memory_set │  ── drop ──▶ │ memory_set │
  │ (old prog) │              │ (new prog) │
  ├────────────┤              ├────────────┤
  │ fd_table   │  ── keep ──▶ │ fd_table   │
  ├────────────┤              ├────────────┤
  │ pid, ppid  │  ── keep ──▶ │ pid, ppid  │
  └────────────┘              └────────────┘
```

---

## 6.3 Concept — `waitpid` & zombies

When a process calls `exit(code)` it enters `Zombie` state: its PCB lingers,
holding only the exit code, until the parent reaps it via `waitpid`. If the
parent dies first, the kernel **re-parents** the orphan to `initproc`, which
sits in an infinite `wait()` loop to reap everyone.

Return values of our `sys_waitpid`:

| condition                                 | return |
|-------------------------------------------|--------|
| No matching child                         | `-1`   |
| Matching child exists but still running   | `-2`   |
| Zombie reaped                             | `pid`  |

User-space retries on `-2` by yielding. This keeps the kernel path simple —
no wait queues yet.

---

### Lab 1 ⭐⭐ — implement `sys_fork` / `sys_exec` / `sys_waitpid`

Common mistakes:

- **Forgetting `x[10] = 0`** in the child. `fork` appears to return the child
  pid in both processes → infinite forks.
- **Double-freeing in `exec`**. Remember that `memory_set` is dropped via
  Rust's RAII when you overwrite it. Do not manually deallocate frames.
- **Holding a lock across `schedule()`**. Every `MutexGuard` must be dropped
  before the context switch, otherwise the next thread deadlocks immediately.

---

## 6.4 Concept — the file descriptor table

Every PCB owns a `Vec<Option<Arc<dyn File>>>`. fds 0/1/2 are pre-populated
with `Stdin` / `Stdout` / `Stdout`. To redirect, the shell:

1. `pipe(&mut fds)` — adds two fds
2. `close(1)` — frees slot 1
3. `dup(fds[1])` — returns 1 (lowest free), so stdout now goes into the pipe
4. `close(fds[1])` — we still have it at fd 1

---

## 6.5 Concept — the Pipe

```
   ┌──────────────┐       ring buffer (2048 B)
   │  write end   │─────▶ ┌──┬──┬──┬──┬──┬──┐
   │  Arc<Pipe>   │       │▓▓│▓▓│  │  │  │  │
   └──────────────┘       └──┴──┴──┴──┴──┴──┘
                           ▲         ▲
                           │ Weak──┐ │
   ┌──────────────┐              │ │
   │  read  end   │──────────────┘ │
   │  Arc<Pipe>   │◀───────────────┘
   └──────────────┘
```

The ring holds a `Weak<Pipe>` to the write-end. When the last write-end `Arc`
drops (because every writer closed the fd), `weak.upgrade()` returns `None`
and the reader sees **EOF**. Without the `Weak`, neither side could ever
observe the other being closed — that's the key design constraint.

---

### Lab 2 ⭐⭐ — implement the pipe

Off-by-one bugs lurk in `available_read()` / `available_write()` because
`head == tail` is ambiguous (empty or full?). The `status` field disambiguates.
Draw the ring on paper for `RING=4`, step through 4 writes + 2 reads + 3
writes. If your diagram matches the code, you're done.

---

## 6.6 Concept — shell parsing

```
raw line:   cat f | grep foo > out &
            │
            ▼  tokenize
tokens:     [cat] [f] [|] [grep] [foo] [>] [out] [&]
            │
            ▼  group on |, attach redirs, detect &
pipeline:   [ Command{argv:[cat,f]} ,
              Command{argv:[grep,foo], stdout:"out"} ]
            background = true
```

Orchestration:

1. Allocate `n-1` pipes upfront.
2. For each stage, `fork`; in the child wire `pipe[i-1].read → 0`,
   `pipe[i].write → 1`, close everything else, then `exec`.
3. Parent closes every pipe fd (critical!) and `waitpid`s in order.

---

### Lab 3 ⭐⭐⭐ — the shell and 8 coreutils

The single biggest source of bugs: **the parent forgetting to close pipe fds**.
Even one straggling fd keeps the write-end alive → reader never sees EOF →
`wc` hangs forever. If a pipeline hangs, audit `close()` calls first.

---

## 6.7 Integration

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

## Common Mistakes

A running list of the bugs students actually hit while wiring up fork / exec / pipes / shell, with the exact symptom, the root cause, and the fix. Some of these are obvious the moment they bite; others hide until the happy path works and then surface under load.

### 1. Forgetting to set the child's `a0 = 0` after `fork`
**Symptom**: After `fork` both parent and child print the same pid (the one the parent just got back). `if pid == 0` never fires in the child, so the child takes the parent branch and everything diverges.
**Cause**: The child is cloned from the parent's `TrapContext`, so its registers are identical. Syscall return values live in `a0`; if you don't overwrite the child's `TrapContext.x[10]`, both see "the new child's pid".
**Fix**: Right after cloning the trap context, clear the child's `a0`:
```rust
let new_task = parent.fork();
let trap_cx = new_task.inner_exclusive_access().get_trap_cx();
trap_cx.x[10] = 0;          // child: fork() returns 0
// parent keeps returning the child's pid as usual
```

### 2. Pipe reader never sees EOF because the write-end Arc wasn't dropped
**Symptom**: `cat file | grep foo` hangs after grep finishes; `ls | wc -l` prints a number and then sits there forever.
**Cause**: Pipe EOF means "every write-end Arc has been dropped." If the parent forks a child, hands the child the write end, but keeps holding its own Arc, the refcount stays > 0 even after the child exits. The reader blocks forever.
**Fix**: Right after fork, the parent must drop the fd it doesn't use:
```rust
let (read_end, write_end) = make_pipe();
let child = current.fork();
child.fd_table[1] = Some(write_end.clone());
drop(write_end);            // parent no longer holds the write end
current.fd_table[0] = Some(read_end);
```
The child, before `exec`, must symmetrically drop the end it doesn't need.

### 3. `dup2` order wrong — stdout clobbered before exec
**Symptom**: A redirect to a file or a pipe produces no output; child output shows up on the parent's terminal instead of inside the pipe.
**Cause**: `dup2(new_fd, 1)` closes fd 1 and then duplicates. The common mistake is flipping arguments — writing `dup2(1, pipe_write)` — which closes the pipe end and clones stdout on top of it.
**Fix**: Remember the order `dup2(src, dst)` — "copy `src` into `dst`":
```rust
// redirect stdout into the pipe's write end
sys_dup2(write_end_fd, 1);  // src=write_end, dst=1
sys_close(write_end_fd);    // fd 1 and write_end now alias; safe to close src
sys_exec(path, args);
```
All `dup2` / `close` calls must happen **before** `exec`. `exec` replaces the memory image but preserves the fd_table.

### 4. `exec` doesn't tear down the old memory_set — frames leak
**Symptom**: After repeated `exec`s, physical memory keeps shrinking and `frame_alloc` eventually returns `None`. Or the new program boots but can read stale data from the previous program's stack.
**Cause**: `exec` is "replace the current image." If you just push the new MapAreas onto the existing MemorySet, the old user stack / heap / code are still there, with PTEs still pointing at the old frames.
**Fix**: Rebuild the MemorySet inside `exec`; drop the old one wholesale:
```rust
pub fn exec(&self, elf_data: &[u8]) {
    let (memory_set, user_sp, entry) = MemorySet::from_elf(elf_data);
    let mut inner = self.inner_exclusive_access();
    inner.memory_set = memory_set;   // old MemorySet drops here, frames freed
    inner.trap_cx_ppn = ...;
    *inner.get_trap_cx() = TrapContext::app_init_context(entry, user_sp, ...);
}
```
The fd_table is intentionally preserved across `exec` — don't reset that.

### 5. `waitpid` reaps the zombie but leaves fd_table dangling
**Symptom**: After a few dozen shell commands `sys_open` starts failing with `-EMFILE`. The open-file count climbs; a debug print of active Files shows entries belonging to long-dead processes.
**Cause**: The zombie TCB is usually reaped by the parent's `waitpid`. If your reaper only removes the child from the `children` list without clearing its `fd_table`, every `File` Arc in that table stays alive, so the underlying inode or pipe never closes.
**Fix**: When `waitpid` finds an exited child, explicitly clear its fd_table before letting the TCB drop:
```rust
let child = inner.children.remove(idx);
let exit_code = child.inner_exclusive_access().exit_code;
child.inner_exclusive_access().fd_table.clear();  // close all fds
// when child Arc's refcount hits 0, the TCB is freed
```
Alternatively, give the TCB a `Drop` impl that clears the fd_table transitively — then cleanup happens as soon as the last Arc goes.

### 6. Shell parser splits whitespace inside quoted strings
**Symptom**: `echo "hello world"` prints `"hello world"` (literal quotes in output); `grep "foo bar" file` errors with "too many arguments."
**Cause**: A naive `split_whitespace()` doesn't understand quoting. `"hello` and `world"` become two tokens, each still carrying a quote character.
**Fix**: Write a tiny state machine that tracks whether you're inside quotes:
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
Extend it to single quotes, `\"` escapes, and treat `|` / `<` / `>` as literals when inside quotes.

### 7. Init doesn't loop over `waitpid` — orphans never reaped
**Symptom**: Over time, your task list fills up with "Z" (zombie) entries. The scheduler idles, CPU looks fine, but memory is pinned down by dead TCBs.
**Cause**: When a user process's parent exits, its orphan children are reparented to init (pid 1). If init calls `waitpid` once and then loops on `yield`, those later orphans die and sit as zombies with nobody to reap them.
**Fix**: Init's main loop must non-blockingly reap every ready child on every iteration:
```rust
loop {
    loop {
        let pid = sys_waitpid(-1, &mut exit_code, WNOHANG);
        if pid <= 0 { break; }        // nothing more to reap right now
    }
    sys_yield();
}
```
`-1` matches any child pid; `WNOHANG` returns immediately when no zombie is ready, instead of blocking.

---

## 6.8 Review & what's next

You now have a bootable OS with paging, preemption, a filesystem, pipes, and a
shell. From here the roadmap forks:

- **SMP**: multi-hart boot, per-cpu scheduling, real RCU
- **Networking**: virtio-net + a user-land tcp/ip stack
- **Real filesystem**: replace easy-fs with ext2 or a journaling FS
- **Fuzzing**: syzkaller-style call-sequence fuzzing against your syscall table

## References

### Required

- xv6 book, Ch. 1 *Operating system interfaces* — the canonical
  `fork`/`exec`/`pipe` implementation.
  — https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf
- rCore tutorial, §7 *Processes*
  — https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter7/
- OSTEP Ch. 5 *Process API* — motivation and pitfalls of
  `fork`/`exec`/`wait`.
  — https://pages.cs.wisc.edu/~remzi/OSTEP/

### Deep dive

- APUE (Stevens), Ch. 15 *Interprocess Communication* — authoritative
  POSIX semantics for pipes, FIFOs, and redirection.
- Linux `fs/pipe.c` — industrial ring-buffer + wake-up policy for
  pipes; compare against your `Pipe::read/write`.
  — https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/pipe.c
- Bash source, `execute_pipeline` in `execute_cmd.c` — how a real
  shell forks, `dup2`s, and closes each end.
  — https://git.savannah.gnu.org/cgit/bash.git/tree/execute_cmd.c

### Stretch questions

- If the parent `fork`s and immediately `exec`s, are the hundreds of
  COW copies wasted work? (Hint: yes — POSIX added `posix_spawn` and
  `vfork` to skip copying the PCB and page table; Linux has
  `CLONE_VM`.)
- In `ls | grep hello`, what exact condition lets `grep` see EOF?
  (Hint: `Pipe::read` returns 0 only after every write-end fd is
  dropped. That means `ls` must exit **and** the shell must close its
  own copy — miss either and the reader hangs forever.)
- If the shell neither handles `SIGCHLD` nor calls `waitpid`, what
  happens to dead children? (Hint: they become zombies — the PCB
  lingers though the resources are freed. Accumulate enough and PIDs
  exhaust; Linux's `init` (PID 1) reaps orphans on purpose.)
