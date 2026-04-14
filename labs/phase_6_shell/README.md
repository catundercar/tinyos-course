# Phase 6 — Shell, Pipes, Coreutils

> *"The OS we built from zero finally grows a shell."*

The finale. Everything from Phase 0 (boot) through Phase 5 (filesystem) comes
together as a Unix-like user-land: type `ls | wc -l` into a REPL running on top
of your own kernel and watch fork/exec/pipe/dup orchestrate a real pipeline.

## Labs

| Lab | Difficulty | File(s) | What you build |
|-----|------------|---------|----------------|
| 1   | ⭐⭐        | `src/syscall/process.rs`, `src/task/manager.rs` | `sys_fork`, `sys_exec`, `sys_waitpid`, orphan reparenting |
| 2   | ⭐⭐        | `src/fs/pipe.rs`, `src/syscall/fs.rs` | 2 KiB ring-buffer pipe + `sys_pipe`/`sys_dup`/`sys_close`, fd table in TCB |
| 3   | ⭐⭐⭐      | `user/src/bin/sh.rs` + 8 coreutils | Line parser, pipeline runner, `ls` `cat` `echo` `mkdir` `rm` `ps` `kill` `wc` |

## Quickstart

```sh
make build          # kernel + user ELFs
make run            # boots qemu; drops into init → sh
make test           # runs all 3 lab test suites on host
make grade          # prints the visual progress report
```

## Directory map

```
src/                  # kernel (Phase 5 baseline + extensions)
  task/               # PCB, scheduler, pid allocator (PROVIDED + 2 TODOs)
  syscall/process.rs  # fork, exec, waitpid  ← Lab 1
  syscall/fs.rs       # pipe, dup, close     ← Lab 2
  fs/pipe.rs          # ring buffer + File   ← Lab 2
user/src/bin/
  sh.rs               # the shell            ← Lab 3
  {ls,cat,echo,mkdir,rm,ps,kill,wc}.rs       ← Lab 3
tests/                # host-side unit tests for each lab
scripts/grade.py      # visual grader + qemu integration
```

## The finish line

When all three labs pass, this sequence should work end-to-end:

```
$ echo hello > greeting.txt
$ cat greeting.txt | wc -l
1
$ ls | wc -l
5
```

See `COURSE.en.md` (or `COURSE.zh-CN.md`) for the full textbook.
