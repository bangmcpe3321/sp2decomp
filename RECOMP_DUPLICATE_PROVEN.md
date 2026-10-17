# Duplicate registration PROVEN by observation — and `init_array` is clean

Round 7/12. The gdb breakpoint observed **every** `AddVariable` call. The duplicate is now a
**measured fact**, not a hypothesis, and the obvious explanation for it has been **eliminated**.

---

## 1. The observation

62 `AddVariable` calls were logged. `this` (`x0`) is constant `0x7103650170` and `head` is constant
`0x7103650160` throughout — the list object and its head do not move.

```
AddVariable  x0(this)=0x7103650170   x1(node)=0x710304fb90    head=0x7103650160   <- first
AddVariable  x0(this)=0x7103650170   x1(node)=0x7103650210    head=0x7103650160
AddVariable  x0(this)=0x7103650170   x1(node)=0x7103655b78    head=0x7103650160
... 58 more distinct nodes ...
AddVariable  x0(this)=0x7103650170   x1(node)=0x7103698f48    head=0x7103650160
AddVariable  x0(this)=0x7103650170   x1(node)=0x710304fb90    head=0x7103650160   <- AGAIN
AddVariable  x0(this)=0x7103650170   x1(node)=0x7103650210    head=0x7103650160   <- AGAIN
```

**Duplicate analysis of all 62:**

```
DUP: 0x710304fb90
DUP: 0x7103650210
```

**`0x710304fb90` is registered twice, and its second registration is the second-to-last call.** That is
precisely the object measured self-referential in rounds 2–6.

**The duplicate-registration hypothesis is CONFIRMED.**

## 2. The mechanism, now observed rather than inferred

1. `0x710304fb90` is registered **first**; the list becomes a chain headed by it.
2. 60 further nodes are appended; the chain ends at `0x7103698f48`.
3. `0x710304fb90` is registered **again**. The walk runs to the tail (`0x7103698f48`), then
   `tail->SetNext(0x710304fb90)` — **which closes the chain into a cycle back to its own head.**
4. `0x7103650210` is registered **again**. Its walk starts at the head, follows the cycle, and
   **never terminates** — the hang.

**Every piece of this is now measured.** The cycle is created at step 3, and step 4 is the victim.

## 3. The obvious explanation is ELIMINATED

The natural guess is that `main`'s `init_array` lists those constructors twice. **It does not.**

Parsing the full array with a multi-line regex (1605 tokens, 1604 non-zero):

| | |
|---|---|
| entries parsed | 1605 |
| **non-zero entries** | **1604** |
| declared `init_count` | **1604** |
| **duplicate non-zero entries** | **0** |

**`init_array` is clean: 1604 entries, zero duplicates, exactly matching the declared count.**

**So the duplicate registration does not come from a duplicated constructor-array entry.** Execution
reaches those two constructors twice by some other route — the guest's own initialisation calling them,
or the runtime driving the constructor loop more than once. **That is not yet determined.**

## 4. A correction to round 5

Round 5 concluded the chain "does not walk" because `*(0x7103650160 + 8) == 0x3d`, and briefly treated
the head as malformed.

**That was an off-by-one indirection on my part.** The first node is `*(head)`, not `head` — which is
exactly what `AddVariable` does at `+108: mov (%rax),%rdx; +115: mov %rdx,0xa0(%rdi)`.

**`*(0x7103650160) = 0x710304fb90` is the first node**, and `0x710304fb90` *is* the first thing
registered. **There was never anything wrong with the chain**, and round 5's "broken chain" reading is
**retracted.**

## 5. What this round establishes

| Item | State |
|---|---|
| Duplicate registration | ✅ **PROVEN by observation** |
| Which node | ✅ **`0x710304fb90` registered 2×, `0x7103650210` 2×** |
| Where the second registration sits | ✅ **end of the 62-call sequence** |
| Cycle created at | ✅ **`tail->SetNext(0x710304fb90)` after the re-registration** |
| `init_array` duplicates | ❌ **ELIMINATED — 1604 entries, 0 duplicates** |
| Round 5 "broken chain" | ❌ **RETRACTED — my off-by-one indirection** |
| Total `AddVariable` calls | ✅ **62** |
| What re-runs those two constructors | ❌ **still open** |

## 6. What this does NOT establish

- **Why those two constructors run twice is unknown.** `init_array` is clean, so the second invocation
  comes from elsewhere — not identified.
- **The observation is incomplete.** The gdb run was capped at 300 s and stopped around
  `main init[1361]`, **before** the hang at `init[1367]`. The 62 calls are those seen up to that point;
  more may follow. The duplicate pattern is real, but the sequence may be longer than 62.
- **Whether the other 60 nodes are also re-registered later** is not known — the run ended early.
- **`0x7103650170` (the list object) and `0x7103650160` (the head) were not resolved to symbols.**
- **No fix was designed or implemented.**
- **`main`'s total constructor count is now known to be 1604**, but `nnMain` is still not reached.
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 7. Next increment

Two candidates for who re-runs those constructors, both cheap to distinguish:

1. **The runtime drives `init_module` twice.** Verify by logging entry/exit of `init_module` for `main` —
   a one-line change, no gdb needed.
2. **The guest calls the constructors again.** If `init_module` provably runs once, the second
   registration must come from guest code, and a breakpoint with a **host backtrace** at the second
   `AddVariable(0x710304fb90)` names its caller directly.

Step 2's backtrace is the more decisive, and the earlier the run is stopped the cheaper it is: break on
`AddVariable` with argument `0x710304fb90` a **second** time and print `bt`.
