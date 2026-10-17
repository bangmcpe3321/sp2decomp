# Root cause: duplicate registration links a node to itself

Round 3/12. `SetNext`'s offset is confirmed, `AddVariable`'s **non-empty** insertion path is read, and
the two together **explain the observed `m_pNext == this` exactly**. Plus one correction to my own
round-2 worry.

---

## 1. `SetNext` writes `*(this + 8)` — confirmed

```asm
SetNext(n)  main_00D181E0:
  +0:  endbr64                 (host preamble)
  +4:  mov (%rdi),%rax         ; rax = c.x[0]  = this
  +7:  mov 0x8(%rdi),%rdx      ; rdx = c.x[1]  = the argument
  +11: mov %rdx,0x8(%rax)      ; *(this + 8) = argument    <-- WRITES +8
  +15: ret
```

**`SetNext` is exactly `this->m_pNext = n`.** So it *is* the writer of the field round 2 measured as
self-referential.

## 2. The full vtable, read straight from the raw image

Reading the unrelocated `.data` at the vtable's file offset — no running process:

| Slot | Value | Symbol |
|---|---|---|
| `+0x00` | `0xd0cc20` | `~PseudoGlobalVariable()` (D2) |
| `+0x08` | `0xd17f60` | `~PseudoGlobalVariable()` (D0) |
| `+0x10` | `0xd17fcc` | `AllocateExtraContexts()` |
| `+0x18` | `0xd18108` | `FreeExtraContexts()` |
| `+0x20` | `0xd18198` | `ResetContext(unsigned)` |
| `+0x28` | `0xd181d8` | **`GetNext()`** |
| **`+0x30`** | **`0xd181e0`** | **`SetNext()`** |
| `+0x38` | `0xd181e8` | (a further method, unnamed) |

## 3. `AddVariable`'s non-empty path is `tail->SetNext(new_node)`

From round 13's dump of `main_00D2F0F4`, the code reached when the walk **exits**:

```asm
+259:  mov 0xa0(%rbx),%rax    ; rax = node  (the tail the walk stopped on)
+266:  mov (%rax),%rdx        ; rdx = node->vptr
+273:  mov 0x30(%rdx),%rsi    ; rsi = vptr[+0x30]  == SetNext
+281:  mov %rax,(%rbx)        ; x0 = node        <- `this`
+284:  mov 0x98(%rbx),%rax    ; rax = the NEW node (AddVariable's argument)
+291:  mov %rax,0x8(%rbx)     ; x1 = the NEW node <- the argument to SetNext
+315:  call nx::call(...)      ; *** tail->SetNext(new_node) ***
```

**That linking is correct in isolation.** `+0x18` of `c` is `x1`, and it is set to the new node right
before the call — so the call is `SetNext(new_node)`, not `SetNext(tail)`.

## 4. The deduction that explains everything

**If a node is added to the list while it is *already* the only element in it:**

1. the walk starts at `head`, which is that node;
2. `GetNext()` returns `m_pNext`, which is **already 0** for a `.bss` static — so the walk stops at once
   with `node == head == the node itself`;
3. the insertion then runs `node->SetNext(new_node)` where **`new_node` is the same object**;
4. **`*(this + 8) = this`** → `m_pNext = this`;
5. the *next* walk never terminates — which is the hang.

**Every observed fact falls out of this:**

| Observation | Explained |
|---|---|
| `m_pNext == this` | step 4 |
| `.bss` was zero, so it was written at runtime | step 4 writes it |
| The writer is `SetNext` | confirmed above |
| The loop advances via `GetNext()` and exits on 0 | round 1–2 |
| The walk stops immediately (no other nodes) | step 2 |

**So the root cause is a DUPLICATE REGISTRATION: `PseudoGlobalVariable<SendMultiParameter>` had
`AddVariable` called on it twice.**

**This is a hypothesis that reproduces the exact state, not a proof** — it was not observed happening.

## 5. A correction to my own round-2 worry

In round 2 I flagged that `GetNext` at `0xd181d8` "disassembles to 15 bytes" and therefore **overlapped**
`SetNext` at `0xd181e0`, suggesting an inconsistent symbol table.

**That was my error.** Those 15 bytes are *host* bytes; `endbr64` is a recompiler preamble, and
`mov %rax,(%rdi)` is the write-back of the destination register, not a third guest instruction.
**`GetNext` is 2 guest instructions (`ldr x0,[x0,#8]` / `ret`) = 8 bytes: `0xd181d8..0xd181df`. `SetNext`
at `0xd181e0` follows exactly. There is no overlap and no symbol-table inconsistency.**

## 6. What this establishes

| Item | State |
|---|---|
| `SetNext` writes `+8` | ✅ **confirmed by disassembly** |
| `vtable[+0x30] == SetNext` | ✅ **read from the raw image** |
| `AddVariable` links with `tail->SetNext(new_node)` | ✅ confirmed (x1 set before the call) |
| `m_pNext == this` requires `tail == new_node` | ✅ follows |
| **Duplicate registration reproduces the state exactly** | 🟡 **hypothesis, not observed** |
| `GetNext`/`SetNext` overlap worry | ❌ **retracted — my misreading** |

## 7. What this does NOT establish

- **The duplicate `AddVariable` call was not observed.** Nothing yet shows the same node being added
  twice; that is inferred from the state it would produce.
- **Why a duplicate would occur is unknown** — a repeated ctor-array entry, or the game calling
  `AddVariable` itself.
- **The `+0x38` vtable slot was not named.**
- **No fix was designed or implemented.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 8. Next increment

**Observe the duplicate directly.** Log every `AddVariable` entry with its argument address and the
current head, via a hook on `main+0xd2f0f4`. If the same pointer appears twice, the duplicate is proven;
if not, this hypothesis dies and the self-link must come from somewhere else. That is a small
instrumentation change and it settles the question either way.
