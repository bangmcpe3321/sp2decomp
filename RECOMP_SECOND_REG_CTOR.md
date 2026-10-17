# Who re-registers the node: a legitimate `init_array` constructor

Round 8/12. The host backtrace names the caller of the **second** registration. The result **reframes the
remaining question** and **promotes the circular-list reading from unlikely to leading**.

---

## 1. The backtrace

```
#0  main_00D2F0F4   (AddVariable)
#1  main_00D0CB08
#2  main_00D1A3E8            <- a main init_array entry
#3  nx::call
#4  nx::call_preserving
#5  nx::init_module
#6  nx::nn_main
#7  nx::call
#8  nx::boot()
```

**The second registration comes from `init_module` → a constructor in `main`'s `init_array`.**

And `main+d1a3e8` is a constructor the earlier log already named:

```
main init[1364] +0xd1a3e8 -> main+d1a3e8
```

**So constructor #1364 is what re-registers `0x710304fb90`.**

## 2. What that rules out and what it forces

Round 7 established that `init_array` has **1604 entries, zero duplicates.** Combined with this backtrace:

> **Two *different* `init_array` constructors both end up calling `AddVariable` on the same
> `PseudoGlobalVariable` object.**

That is **legitimate-looking game behaviour**, not a duplicated array entry and not a runtime double-run.
**The port is not driving the constructors twice** — the game itself reaches that registration from two
distinct constructors.

## 3. This changes the leading hypothesis

Rounds 2–7 carried the assumption that `m_pNext == self` is **corruption**. That assumption now looks
**less likely**, and the alternative needs to be taken seriously:

**`PseudoGlobalVariableList` may be an intentionally CIRCULAR list**, in which the tail's `m_pNext`
points back to the **head**. Under that reading:

- `0x710304fb90` is registered **first**, so it **is the head**;
- the chain closing back onto it is **the normal circular-list design**, not a bug;
- `GetNext()` returning the head is **correct behaviour**;
- and the defect is the **walk's termination test**.

And here is the sharp part: **`AddVariable`'s exit test compares against 0:**

```asm
+191:  cmpq   $0x0,(%rbx)      ; x0 == 0 ?  -> exit
+195:  je     +259
```

**A circular list never yields 0, so that test can never fire — but a correct test would compare against
the head.** So either:

- **(a)** the list is meant to be **null-terminated** and the double registration is a genuine game bug; or
- **(b)** the list is **circular**, and the exit test comparing to `0` is wrong — **in the guest code, or
  in the recompilation.**

**On the evidence now in hand, (b) is at least as likely as (a), and it is the first time that has been
true.**

## 4. What would decide it

If the list is circular, the walk's true termination condition is `next == head`. The guest code would
therefore hold the head in a register and compare against it. **Round 1's disassembly shows a compare
against the literal `0`, not against a register.** If the original AArch64 instruction compared two
registers (`cmp x0, xHead`), and the recompiled C++ compares `x0` to `0`, that is a **recompilation
defect** — and a serious one, because it would be silent.

**This has not been checked.** It is the single most valuable thing to check next, and it is cheap:
disassemble the **original AArch64** at `main+0xd2f208` (the instruction just after the call at `+186`,
which the recompiler rendered as `+191: cmpq $0x0,(%rbx)`) and see what it actually compares.

## 5. What this round establishes

| Item | State |
|---|---|
| Caller of the second registration | ✅ **`main_00D1A3E8` = `main init[1364]`** |
| Route | ✅ **init_module → call_preserving → nx::call → ctor → `main_00D0CB08` → AddVariable** |
| Port drives constructors twice | ❌ **eliminated** |
| Two different ctors register the same PGV | ✅ **follows** (with round 7's clean `init_array`) |
| Self-link is corruption | 🟡 **no longer the leading reading** |
| Circular-list design | 🟡 **now at least as likely**, and would make `GetNext` correct |
| Exit test compares to literal `0` | ✅ observed in the recompiled output |

## 6. What this does NOT establish

- **Whether the list is circular is NOT determined.** No documentation, no second implementation of this
  SDK's `PseudoGlobalVariableList` was consulted.
- **The original AArch64 compare was not examined.** That is the decisive check and it was not run.
- **`main_00D0CB08` was not resolved to a symbol** — the frame between the constructor and `AddVariable`.
- **`init[1364]`'s identity is uncertain**: the symbol lookup resolved `0xd1a3e8` to
  `nn::nex::SharedCounter<...>::DeletePointer+70`, which is implausible for a constructor and suggests the
  offset falls inside a larger function rather than at a symbol start.
- **No fix was designed or implemented.**
- **`nnMain` is still not reached.** No NVN, no window. **This is not a booted game.**

## 7. Next increment

**Disassemble the ORIGINAL AArch64 at `main+0xd2f208`** — the instruction the recompiler turned into
`cmpq $0x0,(%rbx)` at `+191`. Convert the NSO offset (`0x100 + (0x7100d2f208 - 0x7100000000)` =
file `0xd2f308`) and read 4 bytes.

- **`cmp xN, xM`** → the exit test compares two **registers**, the recompiled version dropped one, and this
  is a **recompilation defect** that explains the hang completely.
- **`cmp xN, #0`** → the test really is against zero, the list really is null-terminated, and the double
  registration is a genuine bug in the game or in how the port reached it.

**That single 4-byte read decides the entire remaining question**, and it costs nothing.
