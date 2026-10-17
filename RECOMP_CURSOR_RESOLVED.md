# Resolved: the cursor is `x20`, round 2 stands, and the self-link pre-existed this call

Round 6/12. One read of the CPU struct at the spin **settles round 5's doubt in favour of round 2** and
produces a new fact that changes what to look for next.

---

## 1. The measurement

```
pc                = 0x5dd60e07ef05        (inside nx::call)
c.x[20] (cursor)  = 0x710304fb90
c.x[0]            = 0x710304fb90
c.x[1]            = 0x7103650210
c.x[30] (lr)      = 0x7100d2f130           (AddVariable + 0x3c)
cursor +0 (vptr)  = 0x7102ef98a8
cursor +8 (next)  = 0x710304fb90           (itself)
```

## 2. `0xa0(%rbx)` is `c.x[20]` — a guest register, not a "slot"

The CPU struct begins with `x[0]` at offset 0 (`(%rbx)` is `c.x[0]`, `0x8(%rbx)` is `c.x[1]`, …). So
`0xa0(%rbx)` is **`c.x[20]`** — the guest's **`x20` register**, which the compiler chose as the loop's
cursor. Earlier rounds called it "a slot"; it is an ordinary callee-saved guest register.

## 3. Round 2 is CONFIRMED; round 5's "head" claim is retracted

The loop computes its call target as `*(*(cursor) + 0x28)`, and **the cursor is `0x710304fb90`**:

```
cursor            = 0x710304fb90
*(cursor)         = 0x7102ef98a8      (a .data vtable)
*(0x7102ef98a8+0x28) = 0x7100d181d8   = GetNext()
```

**So round 2's pointer path was right and its slot table stands.** `GetNext()` really is the callee.

**And round 5's doubt is resolved the other way:** `0x7103650160` (the value in `main+0x2fc7520`) is
**not the loop's cursor at the spin** — `x20` had already advanced to `0x710304fb90`. Round 5's `next=0x3d`
reading was of a structure the loop is not currently walking through.

## 4. The new fact that matters: the object being added is a DIFFERENT one

```
c.x[1] = 0x7103650210
```

`c.x[1]` is `x1`, which `AddVariable`'s insertion path sets to **the node being registered**. And
`0x7103650210` is *not* `0x710304fb90`.

**So at the moment of the hang, `AddVariable` is trying to register `0x7103650210` — while the list it is
walking contains a node (`0x710304fb90`) whose `m_pNext` already points to itself.**

**The self-link therefore PRE-EXISTED this call.** The current `AddVariable` call is a **victim**, not the
culprit: it cannot reach the tail because the chain is already circular, so it spins.

**This is decisive for what to look for.** Rounds 3–5 were each reasoning about *this* call as though it
might have created the link. It did not. The corruption was created by an **earlier** registration of
`0x710304fb90`.

## 5. The corrected account

1. At some **earlier** point, `AddVariable(0x710304fb90)` ran and left that node's `m_pNext == itself`
   (still unexplained — that is now the only open question);
2. some time later, `AddVariable(0x7103650210)` runs;
3. its walk starts at the head and can never terminate, because the chain it enters already contains the
   self-linked node;
4. the boot hangs — at constructor #1367, but the cause is earlier.

## 6. What this round establishes

| Item | State |
|---|---|
| `0xa0(%rbx)` is `c.x[20]`, the guest `x20` | ✅ established |
| Cursor at the spin | ✅ **`0x710304fb90`** |
| **Round 2's `GetNext` resolution** | ✅ **CONFIRMED — stands** |
| Round 5's "head is `0x7103650160`" | ❌ **retracted as the walk cursor** |
| `GetNext` returns the cursor ⇒ infinite loop | ✅ **confirmed** |
| Node being registered at the hang | ✅ **`0x7103650210`** |
| **The self-link pre-existed this call** | ✅ **follows necessarily** |
| Who created the self-link | ❌ **still open — and now the only question** |

## 7. What this does NOT establish

- **The earlier `AddVariable(0x710304fb90)` call was not observed.** Its existence is inferred from the
  state, not seen.
- **Why it self-linked is unknown.** The duplicate-registration mechanism from round 3 remains a
  hypothesis; it was not tested.
- **What `0x7103650210` is** (which `PseudoGlobalVariable<T>`) was not resolved to a symbol.
- **What the structure at `0x7103650160` is** was not identified.
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **No fix was designed or implemented.**
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 8. Next increment

**Observe every `AddVariable` call with a gdb breakpoint**, which is now the natural tool because the
recompiler emits direct calls that `call_preserving` hooks cannot see:

```
break main_00D2F0F4
commands
  silent
  printf "AddVariable(x1=0x%lx) head=0x%lx\n", *(unsigned long long*)($rdi+8), <head>
  continue
end
run
```

**Every registration is then logged in order.** The first call whose argument is `0x710304fb90`, and the
state of the list at that moment, is the corruption event. That is observation, not inference, and it
closes the last open question in this chain.
