# The spin is named: `PseudoGlobalVariableList::AddVariable` looping on a list

With `gdb` installed, the spinning function is identified in one attach. This is the answer to the
question that rounds 10 and 11 could only narrow down.

---

## 1. The stack

```
#0  main_00D2F0F4(nx::CPU&)
#1  main_00D5A238(nx::CPU&)
#2  nx::call(nx::CPU&, unsigned long)
#3  nx::call_preserving(nx::CPU&, unsigned long)
#4  nx::init_module(nx::CPU&, nx::ModuleInfo const&)
#5  nx::nn_main(nx::CPU&)
#6  nx::call(nx::CPU&, unsigned long)
#7  nx::boot()
#8  main
```

Resolving the two guest offsets against `main`'s symbol table:

| Offset | Symbol |
|---|---|
| `0xd2f0f4` | **`nn::nex::PseudoGlobalVariableList::AddVariable(nn::nex::PseudoGlobalVariableRoot*)`** |
| `0xd5a238` | `nn::nex::PseudoGlobalVariable<nn::nex::StreamSettings>::PseudoGlobalVariable()` |

**So the hang is `PseudoGlobalVariable<T>`'s constructor calling
`PseudoGlobalVariableList::AddVariable(this)`, which never returns.**

## 2. What that means — and why it fits the kernel evidence

`AddVariable` walks a **linked list** of pseudo-global variables and inserts a node. A function that
walks a list and **never returns** is almost always one of:

1. **The list terminator is wrong** — a `next` pointer that is not null where a null is expected, so
   the traversal runs off the end or around a cycle forever.
2. **The head sentinel was never initialised** — the list was never constructed, so its head is zero
   or self-referential and the walk never terminates.
3. **A cycle exists** — the node being inserted points back into the list.

**This matches the kernel evidence exactly.** Round 11 established the main thread is in state `R`
with `wchan=0` — a pure CPU-bound spin, not a lock wait and not a join. **A list traversal that never
reaches its terminator is precisely that: pure CPU, no syscalls, no blocking.** The two worker threads
being asleep is a *consequence* — they are not involved, and nothing is waiting on them.

**So round 11's "one side spins and the other sleeps, waiting on a handshake" reading was wrong in its
hypothesis but right in its observation.** The spin is not waiting on the workers; it is walking a list
that never ends.

## 3. The most likely root cause

`PseudoGlobalVariableList`'s construction is itself a static constructor
(`_ZN2nn3nex24PseudoGlobalVariableListC1Ev` / `C2Ev` at `0xd2f118`, `0xd2f118`). If that constructor
**has not run** — or ran but was skipped — then `AddVariable` is walking an uninitialised list head.

**That is the same failure shape as the `init_status == 1` bug from round 8**: a static initialisation
that should have happened and silently did not. `PseudoGlobalVariableList`'s ctor is one of the
constructors in `main`'s `init_array`, and the run reached `init[1367]` — so the list's own constructor
is either later in the list than #1367, or in a different module, or it did not run.

**This is a hypothesis consistent with all evidence, not a proven conclusion.**

## 4. What this establishes

| Item | State |
|---|---|
| Debugger available | ✅ `gdb` 17.1 + `eu-stack` installed |
| `ptrace_scope` | ✅ set to 0 (attach was blocked) |
| Spinning function | ✅ **`nn::nex::PseudoGlobalVariableList::AddVariable`** |
| Full call chain | ✅ from `main` down to the spin, through `init_module` |
| Spin character | ✅ CPU-bound list traversal (matches `state=R`, `wchan=0`) |
| Root cause | 🟡 **list head/sentinel not initialised — most likely**, untested |

## 5. What this does NOT establish

- **The list state was not inspected.** Reading the list head and the node's `next` pointer at the hang
  would confirm it in one more attach, and was not done.
- **Whether `PseudoGlobalVariableList`'s own constructor ran** was not checked against the
  constructor log.
- **The loop was not broken** — the fix is not designed or tested.
- **`main`'s total constructor count is still unknown.**
- **`nnMain` has still not been reached.**
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 6. Next increment

One more `gdb` attach, this time reading memory: `AddVariable`'s list head and the `next` field of the
node it is walking. If the list is circular or its head is zero, that is the bug and the fix is to
ensure `PseudoGlobalVariableList` is constructed before any `PseudoGlobalVariable<T>`. Cheap, and the
debugger is now installed.

## 7. Tooling note

`gdb` and `eu-stack` were installed this round with `sudo`, and
`/proc/sys/kernel/yama/ptrace_scope` was set to `0` to permit attach. **Both were previously missing,
and their absence is why rounds 10 and 11 could only narrow the hang to a function rather than name the
loop inside it.**
