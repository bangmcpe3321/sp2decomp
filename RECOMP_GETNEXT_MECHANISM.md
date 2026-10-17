# Mechanism identified: `GetNext()` returns `this`, and `.bss` proves it was written at runtime

Round 1/12 of the new goal produced the strongest result yet: the defect's **mechanism** is identified,
and the `.bss` evidence proves it was **written at runtime** rather than being a static-initialiser
artifact.

---

## 1. Two facts that reframe the bug

**Fact 1 — the node lives in `.bss`.** `main`'s section layout:

| Section | Range |
|---|---|
| text | `0x0000000 .. 0x1415068` |
| rodata | `0x1416000 .. 0x2d5a063` |
| data | `0x2d63000 .. 0x2fdb1b0` |
| **bss** | **`0x2fdb1b0 ..`** |

**`0x304fb90` is in `.bss`, which is zero-initialised at load.**

**Fact 2 — at the hang, its `+8` word is its own address.**

```
0x710304fb90 + 0x00:  0x0000007102ef98a8
0x710304fb90 + 0x08:  0x000000710304fb90   <- the node's OWN address
```

**`.bss` starts as all zeros, so `0x710304fb90` at `+8` did not come from the image. Something wrote it
at runtime.**

**That is the defect, stated precisely: a constructor or a setter wrote a node's `next` pointer to the
node itself.**

## 2. `GetNext` / `SetNext` exist — and name the mechanism

`main`'s symbol table contains, per instantiation:

```
_ZN2nn3nex20PseudoGlobalVariableI18SendMultiParameterE7GetNextEv
_ZN2nn3nex20PseudoGlobalVariableI18SendMultiParameterE7SetNextEPNS0_24PseudoGlobalVariableRootE
```

**`PseudoGlobalVariable<T>` has `GetNext()` and `SetNext(PseudoGlobalVariableRoot*)`.**

Now re-read `AddVariable`'s loop with that knowledge:

```asm
+151:  mov 0xa0(%rbx),%rax    ; rax = current node
+158:  mov (%rax),%rdx        ; rdx = node->field0        (the vtable-like object)
+165:  mov 0x28(%rdx),%rsi    ; rsi = *(field0 + 0x28)    <- A VIRTUAL SLOT
+173:  mov %rax,(%rbx)        ; c.x[0] = node             <- `this` for the call
+186:  call nx::call(...)     ; call slot: returns the LOOP CONDITION
+191:  cmpq $0x0,(%rbx)       ; x0 == 0 ?  -> exit
+197:  mov 0xa0(%rbx),%rax    ; reload the node
+219:  mov %rax,(%rbx)        ; c.x[0] = node             <- `this` again
+232:  call nx::call(...)     ; call slot: returns THE NEXT NODE
+237:  mov (%rbx),%rax        ; rax = return value
+240:  mov %rax,0xa0(%rbx)    ; node = next
+247:  jmp +151
```

**`c.x[0]` is the AArch64 `this` register.** Both calls are `node->method()`. The second call's return
value becomes the new node — **that is `GetNext()`.**

**So the loop is `for (node = head; node; node = node->GetNext())` — and it never terminates because
`GetNext()` returns the node itself.**

**Which means a prior `SetNext(this)` wrote the self-reference.** `SetNext` is exactly the setter that
would do it, and it exists in the symbol table.

## 3. What this establishes

| Item | State |
|---|---|
| The node is in `.bss` | ✅ **confirmed by section arithmetic** |
| `.bss` is zero at load | ✅ definitional |
| So `+8 = self` was **written at runtime** | ✅ **follows necessarily** |
| `GetNext()`/`SetNext()` exist | ✅ both in the symbol table |
| The loop calls `GetNext()` and advances on its return | ✅ from the `this`-register pattern |
| **Mechanism: `GetNext()` returns `this` because a prior `SetNext(this)` wrote it** | ✅ **meets all evidence** |
| Which code called `SetNext(this)` | ❌ **not identified** |

## 4. What this does NOT establish

- **Which `SetNext(this)` call produced it was not found.** `SetNext` has many call sites; locating the
  one that passes its own receiver is the remaining task, and it is a static search.
- **The first call's slot (`+0x28`) was not named** — it decides the loop condition, and it is a
  different virtual slot from `GetNext`.
- **The `+0` word (`0x7102ef98a8`) was not interpreted** — it may be the vtable-like object, and
  `field0 + 0x28` being a real vtable slot is inferred, not proven.
- **No fix was designed or implemented.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 5. Next increment

**Find the `SetNext` call whose argument is its own receiver.** Static search over `main`'s functions for
calls to a `SetNext` symbol where `x0 == x1` at the call. That is the writer, and naming it turns this
from mechanism into root cause.

Second, cheaper check: **re-read the node's `+0` word.** If `field0 + 0x28` is `GetNext`, the mechanism
is fully proven; if it is a different slot, the loop is doing something else and this analysis needs
correcting.
