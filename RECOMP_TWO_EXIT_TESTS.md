# The guest has TWO exit tests; the recompiled loop shows only one

Round 10/12. Scanning the control flow around the walk found something that **changes the conclusion
again** — and this time it points at the **recompiler**, not the game.

---

## 1. The guest's control flow around the walk

```
0xd2f1a4:  eb13001f   cmp  x0, x19      <== REGISTER compare
0xd2f1a8:  540001a0   b.eq +0x34
0xd2f1ac:  b40004a0   cbz  x0, +0x94    <== ZERO test
...
0xd2f1b8:  eb1302bf   cmp  x21, x19     <== REGISTER compare
0xd2f1bc:  540001c0   b.eq +0x38
0xd2f1d4:  b5ffff00   cbnz x0, +0x1fffe0
0xd2f1d8:  1400001a   b    +0x68
```

**There are TWO exit conditions, not one:**

1. **`cmp x0, x19; b.eq`** — stop when the cursor equals **`x19`**
2. **`cbz x0`** — stop when the cursor is **null**

And the same pair appears again with `x21` at `0xd2f1b8`/`0xd2f1bc`.

## 2. What the recompiled code implements

Round 1's disassembly of `main_00D2F0F4` shows the loop's exit as:

```asm
+191:  cmpq   $0x0,(%rbx)      ; x0 == 0 ?
+195:  je     +259             ; exit
```

**Only the zero test.** The `cmp x0, x19` comparison — a comparison against **a saved guest register** —
**does not appear at `+191`.**

## 3. The consequence, and why it explains the hang

If the guest's walk is `while (x0 != x19 && x0 != 0)`, then **`x19` acts as a sentinel**, and the walk is
designed to **stop when it returns to the sentinel**.

Under that design, the "circular" state found in rounds 7–9 is **not corruption at all** — the tail pointing
back to the sentinel is **the intended structure**, and `cmp x0, x19` is exactly the test that handles it.

**But the recompiled loop only tests for zero.** A cursor equal to `x19` is non-zero, so the test never
fires and **the loop spins — which is precisely the observed hang.**

**Under this reading:**

| Round | Conclusion | Status |
|---|---|---|
| 7 | duplicate registration proven | ✅ still true as an observation |
| 8 | port doesn't double-run ctors | ✅ still true |
| 9 | list is null-terminated, so self-link is corruption | ❌ **weakened** — `x19` sentinel complicates it |
| **10** | **the walk has a register-exit the recompiled loop lacks** | 🟡 **leading, not proven** |

## 4. Why I am NOT calling this proven

**The mapping from guest instruction to recompiled host offset was done by hand and has been wrong before
in this project** (the `GetNext`/`SetNext` "overlap" in round 2, the off-by-one indirection in round 5).
There are two live explanations and I cannot yet separate them:

**(a)** The recompiler **dropped** the `cmp x0, x19` exit test. That would be a serious recompilation defect
and would explain the hang completely.

**(b)** My mapping is incomplete — the comparison **is** emitted somewhere in `main_00D2F0F4` and I have not
looked at enough of the function to see it. Round 1's dump covered `+0` to about `+399`, which is less than
the whole function.

**Distinguishing them is cheap and must be done before any claim is made.**

## 5. What this round establishes

| Item | State |
|---|---|
| Guest walk has a **register** exit test (`cmp x0, x19`) | ✅ **read from the image** |
| Guest walk also has a **zero** exit test (`cbz x0`) | ✅ read from the image |
| Recompiled `+191` tests only zero | ✅ observed in round 1's dump |
| A second register compare exists (`cmp x21, x19`) | ✅ read |
| Recompiler dropped the register test | 🟡 **plausible, NOT proven** |
| My mapping is incomplete | 🟡 **equally plausible** |
| Self-link is corruption | 🟡 **no longer certain** |

## 6. What this does NOT establish

- **Which explanation (a) or (b) is true was not determined.** This is the whole question now.
- **What `x19` holds was not determined.** It is *presumed* to be a sentinel/head pointer, because it is
  compared against the cursor; that is inference.
- **The recompiled function was not read in full**, so (b) cannot be excluded.
- **Round 9's null-termination reading is not retracted, only weakened** — `SetNext(node, nullptr)` is real,
  and both a null terminator and a sentinel comparison can coexist in the same routine.
- **No fix was designed or implemented.**
- **`nnMain` is still not reached.** No NVN, no window. **This is not a booted game.**

## 7. Next increment

**Read `main_00D2F0F4` in full and look for a guest-register comparison.** Specifically: does the recompiled
function ever load a saved guest register and `cmp` it against the cursor (`0xa0(%rbx)`), in the way the
guest's `cmp x0, x19` requires?

- **If it does**, explanation (b) holds, the recompiler is fine, and the search returns to the data.
- **If it does not**, explanation (a) holds and this is a **recompilation defect** — by far the most
  consequential finding of the entire project, because it would mean the generated code is silently wrong
  in a way no test has caught.

`objdump -d --start-address` over the host function, grep for `0xa0(` loads paired with `cmp`, is enough.
