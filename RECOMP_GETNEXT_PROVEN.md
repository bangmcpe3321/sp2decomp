# Mechanism fully proven: `GetNext()` is `return *(this+8)`, and that field is the node itself

Round 2/12. Round 1's inference is now **proven with no inference left**. The whole chain is verified
from disassembly and memory, and the defect's identity is named.

---

## 1. The vtable slot is `GetNext` — resolved

The loop computes its call target as `*(node->field0 + 0x28)`. Reading that memory at the hang:

```
node->field0 = 0x7102ef98a8
*(0x7102ef98a8 + 0x28) = 0x7100d181d8
```

Resolving every slot of that vtable against `main`'s 146,622 symbol entries:

| Slot | Symbol |
|---|---|
| `+0x00` | `PseudoGlobalVariable<SendMultiParameter>::~PseudoGlobalVariable()` (D2) |
| `+0x08` | `PseudoGlobalVariable<SendMultiParameter>::~PseudoGlobalVariable()` (D0) |
| `+0x10` | `AllocateExtraContexts()` |
| `+0x18` | `FreeExtraContexts()` |
| `+0x20` | `ResetContext(unsigned)` |
| **`+0x28`** | **`GetNext()`** ← **the slot the loop calls** |

**This also names the object:** the bad node is **`PseudoGlobalVariable<nn::nex::SendMultiParameter>`**,
not `<StreamSettings>` as earlier rounds assumed when looking at the *symptom's* call.

## 2. `GetNext()` reads offset +8 — and that field is the node

```asm
GetNext()  main_00D181D8:
  +4:  mov (%rdi),%rax      ; rax = c.x[0]   (the ABI `this`)
  +7:  mov 0x8(%rax),%rax   ; rax = *(this + 8)     <-- READS OFFSET +8
  +11: mov %rax,(%rdi)      ; c.x[0] = rax          (return value)
  +14: ret
```

**`GetNext()` is exactly `return *(this + 8)`.** So `+8` is `PseudoGlobalVariableRoot::m_pNext`.

And the measured memory at the hang:

```
0x710304fb90 + 0x00:  0x0000007102ef98a8   (vptr -> the table above)
0x710304fb90 + 0x08:  0x000000710304fb90   (m_pNext -> THE NODE ITSELF)
```

## 3. The complete, proven chain

1. `AddVariable` walks: `for (node = head; node; node = node->GetNext())` — **verified in round 1's
   disassembly**, with the `this`-register pattern and the `x0 == 0` exit test at `+191`.
2. `GetNext()` returns `*(this + 8)` — **verified above by disassembly**.
3. The node's `+8` holds **the node's own address** — **verified by memory read**.
4. **Therefore `node = node->GetNext()` is a no-op, the exit test can never fire, and the loop spins.**
5. **The node is in `.bss`**, which is zero-initialised at load — **so `m_pNext` was zero and something
   wrote the node's own address into it at runtime.**

**No inference remains in steps 1–5.** Every link is a disassembly or a memory read.

## 4. What is now established vs still open

| Item | State |
|---|---|
| The loop's callee | ✅ **`GetNext()`** — resolved through the vtable |
| `GetNext`'s implementation | ✅ **`return *(this + 8)`** |
| `+8` is `m_pNext` | ✅ confirmed |
| The bad node's type | ✅ **`PseudoGlobalVariable<SendMultiParameter>`** |
| `m_pNext == this` | ✅ measured |
| `.bss` ⇒ written at runtime | ✅ section arithmetic |
| **Loop cannot terminate** | ✅ **follows necessarily** |
| **Who wrote `m_pNext = this`** | ❌ **still open** |

## 5. What this does NOT establish — and one alternative I should not bury

- **The writer was not found.** `SetNext(this)` is the likely form; `SetNext` exists in the symbol
  table. Locating a call where receiver and argument are the same register is a static search and was
  not done.
- **`ResetContext(unsigned)` at `+0x20` was not examined** — it is a plausible alternative writer of
  object state, and it is called by name in the symbol list.
- **The circular-list possibility is not fully excluded.** If this SDK ever builds an intentionally
  circular `PseudoGlobalVariable` chain, then `GetNext()` returning `this` would be *legal data* and
  the defect would instead be in the **walk's termination test** (`x0 == 0`, which is wrong for a
  circular list). **I have no evidence either way**, and I flagged this in round 1 as well.
- **`AddVariable`'s correctness was not proven** — only that its empty branch looks right.
- **No fix was designed or implemented.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 6. Next increment

Two static searches, either decisive:

1. **Find a `SetNext` call whose argument is its receiver** (`x1 == x0` at the call site) in `main`'s
   855 functions' worth of `PseudoGlobalVariable` code. That is the writer.
2. **Read `SetNext`'s own implementation** — if it writes `*(this + 0x10)` rather than `+8`, then
   `m_pNext` at `+8` is written by something else entirely and the suspect list changes.

Step 2 is cheaper and is the right next move: it pins the setter's offset and may immediately show that
`+8` is not set by `SetNext` at all.
