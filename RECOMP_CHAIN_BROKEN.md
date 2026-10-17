# The chain does not walk — and round 2's pointer path needs re-verifying

Round 5/12. The chain trace **does not produce a valid linked list**, which casts doubt on the pointer
path round 2 used to resolve `GetNext`. Recording the raw measurements and the open doubt rather than
building further on them.

---

## 1. What the trace actually returned

```
head = 0x7103650160
  [ 0] node=0x7103650160   vptr=0x710304fb90   next=0x3d
  [ 1] node=0x3d           -> Cannot access memory at address 0x3d
```

Read as raw memory:

| Address | Value |
|---|---|
| `0x7102fc7520` (the "head" global) | `0x7103650160` |
| `0x7103650160 + 0x00` | `0x710304fb90` |
| `0x7103650160 + 0x08` | **`0x3d`** |
| `0x710304fb90 + 0x00` | `0x7102ef98a8` (a `.data` vtable) |
| `0x710304fb90 + 0x08` | `0x710304fb90` (itself) |

**`0x3d` is not a pointer.** So whatever `0x7103650160` is, treating it as a list node with
`{vptr, next}` gives a nonsense `next` at the very first step.

## 2. What that means — two possibilities, neither established

**(a) `0x7103650160` is not the list head.** I assumed `*(main+0x2fc7520)` is the PseudoGlobalVariable
list head because `AddVariable` loads it at `+105`/`+108`. It may be a different structure, or the global
may hold something else (an allocator, a lock, a table) and the real head is reached through one more
indirection.

**(b) The chain is corrupt from the first node.** Less likely, because `0x3d` looks like a small integer
(a count, a state), not a corrupted pointer — which points back at (a).

**On the evidence, (a) is the more economical reading.**

## 3. This puts round 2's vtable resolution in doubt

`AddVariable`'s loop computes its call target as:

```asm
+151:  mov 0xa0(%rbx),%rax    ; rax = the current walk cursor
+158:  mov (%rax),%rdx        ; rdx = *(cursor)
+165:  mov 0x28(%rdx),%rsi    ; rsi = *(rdx + 0x28)   <- the call target
```

**Round 2 resolved the slot as `*(*(0x710304fb90) + 0x28)` = `*(0x7102ef98a8 + 0x28)` = `GetNext`.**

**But that is only correct if the walk cursor was `0x710304fb90` at that moment.** If the cursor was
`0x7103650160`, the code computes `*(*(0x7103650160) + 0x28)` = `*(0x710304fb90 + 0x28)` — **a different
address, and one in `.bss` which was zero at load.**

**Both are consistent with the gdb stack**: the spin is at `+222`/`+232`, and by then the cursor has been
overwritten at `+240` from the previous iteration's return value. So round 2's reading may have been of
the *second* call site while the code path's first call used the head.

**I cannot tell, from what has been measured, which pointer path produced `0x7102ef98a8`.**
`*(0x710304fb90) = 0x7102ef98a8` is a fact; that the loop read *through* it is an inference.

## 4. What this round establishes

| Item | State |
|---|---|
| Raw memory at head and node | ✅ measured (table above) |
| `head`'s `+8` is `0x3d`, not a pointer | ✅ **measured** |
| Treating head as a list node is wrong | ✅ **follows** |
| The PGV list head is `0x7102ef98a8`-style node at `0x710304fb90`? | ❌ **not established** |
| Round 2's `GetNext` resolution | 🟡 **valid as a fact about that address, but the pointer path is unverified** |
| Duplicate registration | 🟡 not tested this round; unaffected but unproven |

## 5. What this does NOT establish

- **The actual PseudoGlobalVariable list head was not located.** That is now the blocking unknown.
- **The structure at `0x7103650160` was not identified** — its `+0` is a pointer to the node and `+8` is
  `0x3d`, which does not match `{vptr, next}`.
- **Whether `0x710304fb90` is a list node at all is not independently confirmed** — its `+0` looks like a
  `.data` vtable and its `+8` is self, which *is* node-shaped, but that is shape-matching, not proof.
- **Round 2's vtable table was not re-verified against the correct pointer path.**
- **No fix was designed or implemented.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 6. Next increment

**Establish the real cursor at the spin.** At the hang, read the value of the walk cursor — the guest
register slot the code uses at `0xa0(%rbx)`, i.e. `c.x[N]` — rather than recomputing the pointer path by
hand. Then:

- if the cursor is `0x710304fb90`, round 2's resolution is **valid** and `GetNext` stands;
- if it is something else, **round 2's slot table must be retracted** for this loop and re-derived.

That is one gdb read of `c` at the suspended PC and it removes the remaining inference from the whole
chain of reasoning.
