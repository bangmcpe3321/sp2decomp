# The cycle, confirmed by memory: a list node whose `next` points to itself

Round 12 read the actual memory at the spin. The hypothesis from round 11 is now **confirmed by direct
inspection**, not inference.

---

## 1. The node is self-referential

At the hang, from `gdb`:

```
rax  0x710304fb90
x/2gx 0x710304fb90:
  0x710304fb90:  0x0000007102ef98a8   0x000000710304fb90
```

**The word at `0x710304fb90 + 8` is `0x710304fb90` — the node's `next` field points to the node
itself.**

Any traversal that follows `next` from this node returns to it, forever. **That is the loop.** No
inference required.

## 2. The loop, from the disassembly

```
+151:  mov    0xa0(%rbx),%rax     ; rax = c.x[N]  (the list node)
       mov    (%rax),%rdx         ; rdx = node->field0
       mov    %rdx,0x40(%rbx)
       mov    0x28(%rdx),%rsi
       mov    %rsi,0x40(%rbx)
       mov    %rax,(%rbx)         ; c.x[0] = node
+222:  mov    %r12,0xf0(%rbx)
       mov    %rbx,%rdi
       call   nx::call(CPU&, ...) ; <-- calls guest code each iteration
       mov    (%rbx),%rax
       mov    %rax,0xa0(%rbx)     ; node = c.x[0]  -> UNCHANGED, still the same node
       jmp    +151                ; LOOP FOREVER
```

`rbx` is the `CPU&` (host address `0x567bda9b0fc0`); the internal offsets `0xa0`, `0x40`, `0xf0` are
**guest register slots inside the CPU struct**, and `r12 = 0x7100d2f130` is a **guest text address** in
`main`. So this is a recompiled guest `while` loop that calls a guest function each iteration and
re-reads a pointer that never changes.

## 3. What the root cause now is — and what it is not

Round 11's leading guess was *"the head sentinel was never initialised, so the list is zero or
self-referential."*

**The self-referential part is confirmed; the "never initialised" part is not.** A node whose `next`
equals itself is also the **normal sentinel form of an empty circular list**. So there are two live
readings and the memory does not yet distinguish them:

1. **The list is legitimately empty and circular** (head → itself), and the *traversal termination
   check* is what fails — it should stop when it returns to the head, and does not.
2. **The list is corrupt** — insertion wrote `next = self` on a node that should have been linked
   elsewhere or terminated with null.

**Reading 1 is at least as likely as reading 2**, and I want to be explicit that the previous round's
framing leaned too hard on corruption. The decisive question is now narrow: *what is the loop's exit
condition, and why is it never satisfied?*

## 4. What this establishes

| Item | State |
|---|---|
| `next` points to itself | ✅ **confirmed by memory** |
| The loop re-reads an unchanging pointer | ✅ **confirmed by disassembly** |
| A guest call is made each iteration | ✅ confirmed (so the spin is not a bare `jmp`; it burns more than a tight loop) |
| Root cause is "uninitialised list" | ❌ **NOT established** — circular-empty is an equally valid reading |
| Loop exit condition | ❌ not identified |

## 5. What this does NOT establish

- **The loop's termination condition was not read.** That is the one missing fact.
- **Whether the list is legitimately empty or corrupt is unresolved.** Both fit the memory.
- **`PseudoGlobalVariableList`'s own constructor was not checked** against the constructor log.
- **The loop was not broken**; no fix was designed or tested.
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **The `nx::call` target each iteration was not identified** — it may be the guest function whose
  side effect should have advanced the list.
- **No NVN, no window, no render.** Display and audio are stubs.

## 6. Next increment

Read the **exit condition**: disassemble `main_00D2F0F4` from its start (not from `+151`), so the
comparison that ends the loop is visible, and identify what the loop is comparing against. If it
compares against a head pointer that was never set, that is the bug; if it compares against a counter
or a service response, the spin is a *wait* on something the HLE never provides — which would put it
back in the "no real service behind `nex`" category.

Either answer is one attach away, and the debugger is now installed.
