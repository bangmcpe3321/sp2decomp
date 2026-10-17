# Correction: the list is not one element, and `call_preserving` hooks miss direct calls

Round 4/12 produced **two corrections to my own earlier work** and one important tooling finding. The
round-3 hypothesis is *weakened as stated*, though its core survives in a modified form.

---

## 1. My instrumentation was in the wrong place

I hooked `AddVariable` in `call_preserving`. **No log line ever appeared.**

The reason is in the constructor's own disassembly from round 3:

```asm
+285:  call   0x31e69fc <_Z13main_00D2F0F4RN2nx3CPUE>    ; DIRECT host call
```

**The recompiler emitted `AddVariable` as a direct C++ call, not through `nx::call`.** So:

> **Any runtime hook placed on `call_preserving` or `nx::call` misses every direct recompiled call.**

That is a **general tooling constraint for this project**, not a one-off: instrumentation must be attached
to the target function itself, or to the generated code, not to the dispatch helpers.

## 2. The list head is NOT the node — round 3's framing was wrong

Reading the head global (`main+0x2fc7520`) at the hang:

| Item | Value |
|---|---|
| **list head** | **`0x7103650160`** |
| the node under the walk | `0x710304fb90` |
| node `+0` (vptr) | `0x7102ef98a8` |
| node `+8` (m_pNext) | `0x710304fb90` (itself) |

**`head ≠ node`.** Round 3 argued the failure as *"a node added while it was the only element: the walk
stops at it immediately, then `SetNext` links it to itself."* **That reasoning is wrong** — the list is
**not** a single element, and the walk does not start at the bad node.

**So the corrected picture:** the self-linked node `0x710304fb90` sits **somewhere inside a longer
chain**. The walk starts at `0x7103650160`, advances through the chain, reaches `0x710304fb90`, and
there `GetNext()` returns the node itself and never advances again.

## 3. The core hypothesis survives, in a modified form

The state is still explained by a duplicate registration — but by a **different mechanism** than round 3
described:

1. `0x710304fb90` is first added and becomes the **tail** of the chain (`m_pNext == 0`);
2. it is added **again**;
3. the walk runs from the head all the way to the **tail, which is `0x710304fb90` itself** — `GetNext()`
   returns `0` there, so the walk stops **on that very node**;
4. the insertion then runs **`0x710304fb90->SetNext(new_node)` where `new_node` is `0x710304fb90`**;
5. → `m_pNext = this`, and every later walk hangs.

**Same conclusion — duplicate registration — but step 3 is the tail case, not the only-element case.**
The hypothesis is **not proven**; nothing has yet observed the second `AddVariable` call.

## 4. A third correction: `+0x2fc75b0` is not a count

Round 3's dump of the empty-list branch set `*(0x7102fc75b0) = 1`, and I described that global as "a
count / flag". **At the hang it reads `56,951,144`.** Whatever that global is, **it is not a
registration count**, and my earlier description of it was wrong.

## 5. What this round establishes

| Item | State |
|---|---|
| `call_preserving` hook on `AddVariable` | ❌ **never fired — direct call** |
| Direct recompiled calls bypass the dispatch helpers | ✅ **confirmed, general constraint** |
| List head at the hang | ✅ **`0x7103650160`** |
| `head == node` | ❌ **false — round 3's framing retracted** |
| `m_pNext == this` on `0x710304fb90` | ✅ re-confirmed |
| Duplicate registration | 🟡 **survives in modified form, still unproven** |
| `+0x2fc75b0` is a registration count | ❌ **retracted** |

## 6. What this does NOT establish

- **The duplicate was still not observed.** The hypothesis survives; it is not proven.
- **The chain from `head` to `0x710304fb90` was not traced** — its length and members are unknown.
- **Whether `0x710304fb90` is actually the tail is inferred**, not measured.
- **What `+0x2fc75b0` really is, is unknown.**
- **No fix was designed or implemented.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 7. Next increment

**Trace the chain.** Walk `m_pNext` from `head = 0x7103650160` in gdb, printing each node and its type,
until the walk reaches `0x710304fb90` or cycles. That gives:

- the chain length (is `0x710304fb90` the tail?),
- whether any node appears **twice** — which would prove the duplicate directly, and
- whether the chain is otherwise well-formed.

It is a single gdb session with a loop, needs no rebuild, and answers the duplicate question by
observation rather than inference.
