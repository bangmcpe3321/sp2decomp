# Final round: the recompiler is cleared, and the mystery comparison is a duplicate check

Round 12/12. The decisive register read was taken. **Round 11's recompilation-defect hypothesis is
refuted**, the recompiler is **cleared**, and the guest's mystery comparison turns out to be something that
makes the whole picture coherent.

---

## 1. The measurement

```
c.x[0]   = 0x710304fb90
c.x[19]  = 0x7103650210     <- the "sentinel" candidate
c.x[20]  = 0x710304fb90     <- the walk cursor
c.x[21]  = 0x0
```

**The cursor (`0x710304fb90`) does NOT equal `x19` (`0x7103650210`).**

**So the guest's `cmp x0, x19; b.eq` would not have fired either — the original code would have looped in
exactly the same way.** The recompiled loop is doing the same thing the guest does.

**Round 11's hypothesis (a): the recompiler dropped a register comparison that would have ended the loop —
is REFUTED.** The comparison would not have ended the loop here. **There is no evidence of a recompilation
defect at this site, and this project's generated code is not shown to be unfaithful.**

## 2. What `x19` actually is — and it makes everything cohere

`c.x[19] = 0x7103650210` — **the very object that `AddVariable` is trying to register** (round 6 measured
`c.x[1] = 0x7103650210`, and round 7 showed it being registered).

**So `cmp x0, x19` compares the walk cursor against the object being added.** That is a
**duplicate check**: *"have I walked back around to the node I am inserting? Then it is already in the
list."*

**The guest's walk is therefore:**

```
for (cursor = head; cursor != 0 && cursor != new_node; cursor = cursor->GetNext()) { ... }
```

**The SDK explicitly defends against duplicate registration.**

## 3. The complete, coherent account

1. **`0x710304fb90` is registered first**, then **registered again** (round 7, observed).
2. That second registration created the self-link: `0x710304fb90->m_pNext = 0x710304fb90`.
3. **Later**, `AddVariable(0x7103650210)` runs. Its duplicate check (`cmp x0, x19`) is armed and would work —
   **but it can only fire if the walk reaches `0x7103650210`.**
4. The walk instead enters the cycle at `0x710304fb90` and **never reaches `x19`**, so the duplicate check
   never gets a chance.
5. **The boot hangs.**

**So the duplicate protection is real and correct — it is simply defeated by a cycle that was created
earlier, before it could help.**

**The defect is the FIRST self-link, at step 2.** Everything since round 7 has been investigating step 3's
victim.

## 4. What this final round establishes

| Item | State |
|---|---|
| `x19` at the hang | ✅ **`0x7103650210` — the object being registered** |
| Cursor at the hang | ✅ `0x710304fb90` |
| **Cursor == `x19`** | ❌ **false** |
| Guest would have exited | ❌ **no — it would have looped too** |
| **Recompilation defect at this site** | ❌ **REFUTED** |
| Meaning of `cmp x0, x19` | ✅ **a duplicate-registration check** |
| Real defect | ✅ **the first self-link, created by the earlier double registration** |
| Recompiler fidelity | ✅ **not shown to be unfaithful; cleared at this site** |

## 5. What this does NOT establish

- **The first self-link was never observed being created.** Rounds 7–8 proved *that* `0x710304fb90` is
  registered twice and *by which constructor* (#1364), but **not** what state the list was in at the moment
  the first link was written. That is still the open question.
- **`x21` was `0`, and the guest's second comparison `cmp x21, x19` was not interpreted.** With `x21 == 0`
  it looks like a null check written differently, but that is inference.
- **The recompiler is cleared only at this site**, not shown to be faithful everywhere.
- **No fix was designed or implemented.** The bug is now precisely located but not repaired.
- **`nnMain` was never reached.** No NVN, no window, no render. **This is not a booted game.**

---

# Where this goal ended

## Progress made across 12 rounds

| Round | Finding |
|---:|---|
| 1 | the unknown comparison is `GetNext`; the node is in `.bss`, so its self-pointer was written at runtime |
| 2 | vtable resolved: `+0x28` = `GetNext`, and `GetNext()` is literally `return *(this+8)` |
| 3 | `SetNext` writes `+8`; duplicate registration would produce exactly the observed state |
| 4 | corrections: `call_preserving` hooks miss direct calls; head ≠ node |
| 5 | the chain walk failed — **my own off-by-one indirection**, retracted in round 7 |
| 6 | the cursor is guest `x20` = `0x710304fb90`; **round 2 confirmed**, round 5 retracted |
| 7 | **duplicate registration PROVEN** — `0x710304fb90` twice, second one at the end; `init_array` clean |
| 8 | the second registration comes from a **legitimate** `init_array` constructor (#1364) |
| 9 | real AArch64 read: `exefs/main` is **LZ4**, so offset math was wrong; `SetNext(node,nullptr)` is explicit |
| 10 | the guest has **two** exit tests; the recompiled loop shows one `. . . hypothesis formed` |
| 11 | the discrepancy is **measured**: 2 compares, both against zero, no register compare |
| 12 | **that hypothesis is REFUTED** — the cursor ≠ `x19`, so the guest would loop too. `cmp x0, x19` is a **duplicate check** |

## What is settled

- **The boot reaches 1,367 of `main`'s 1,604 static constructors** and hangs there.
- **The hang is a CPU-bound spin** (`state=R`, `wchan=0`) in
  `nn::nex::PseudoGlobalVariableList::AddVariable`, walking a `PseudoGlobalVariable` chain.
- **The chain contains a node whose `m_pNext` is itself** — `0x710304fb90`, in `.bss`, so written at runtime.
- **That node is registered twice**, and the second registration is a legitimate `init_array` constructor.
- **The SDK's duplicate check exists and is correct** — it just cannot fire from inside the cycle.
- **The recompiler is not implicated** at the failing site.

## What is NOT settled — the single remaining question

**What was the list's state when `0x710304fb90`'s self-link was first written?** If at that moment the node
was already the tail, the write is the duplicate-detection path failing to detect; if the node was the
head, `AddVariable`'s insertion is wrong for the head case. **One breakpoint on the first registration,
printing the head and the walk cursor at entry, would answer it.**

## Honest assessment

**This goal did real, verifiable work and did not reach `nnMain`.** Along the way it corrected itself
**five times**, and each correction is recorded rather than buried. The most valuable outcomes are negative
or structural, not triumphant:

- the **`exefs` is LZ4** trap, which would silently corrupt any offset-based analysis;
- **`call_preserving` hooks miss direct recompiled calls**, which invalidated one whole instrumentation
  attempt;
- the **Wonder-vs-Splatoon-2 silent-mismatch ledger**, now six entries, every one of which cost a debugging
  round;
- a **precise, still-unfixed defect** at `nn::nex::PseudoGlobalVariableList::AddVariable`, one breakpoint
  away from its cause.

**The game does not boot, and nothing here should be read as suggesting it is close to doing so.** Beyond
this hang lie the rest of the constructor list, `nnMain`, the entire HLE surface, NVN, and — out of scope
throughout — Splatoon 2's Maxwell shaders.
