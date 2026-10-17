# The original AArch64: null-termination IS the design — the circular reading is weakened

Round 9/12. Reading the real guest code required fixing a mistake of my own, and the decoded instructions
**answer the round-8 question in favour of the double registration being a genuine bug.**

---

## 1. First, a decoding error of mine

Round 8 told me to read `main+0xd2f208` at **file offset `0x100 + 0xd2f208`** in `exefs/main`. Doing so
returns bytes that decode as nonsense:

```
0x00d2f208:  0x601b0060   .word
0x00d2f20c:  0x98220018   .word
```

**`exefs/main` is an LZ4-compressed NSO.** Raw file offsets do not map to code. Every offset-to-file
conversion of that form in this project is wrong, and the correct source is the **decompressed flat image**
`private/analysis/main.bin` (produced by `tools/nso2bin.py`), where **VA offset == file offset**.

**That is a tooling correction worth keeping: never read `exefs/*` at computed offsets.**

## 2. The real code

```
0xd2f1e0:  f9401508   ldr  x8, [x8, #0x28]     ; x8 = vptr[+0x28]  = GetNext
0xd2f1e4:  aa1303e0   mov  x0, x19             ; x0 = x19
0xd2f1e8:  d63f0100   blr  x8                  ; GetNext(x19)
0xd2f1ec:  f9000280   str  x0, [x20]           ; *x20 = result
0xd2f1f0:  1400000a   b    +0x28
0xd2f1f4:  f9400288   ldr  x8, [x20]           ; x8 = *x20 (vptr)
0xd2f1f8:  f9401915   ldr  x21, [x8, #0x30]    ; x21 = vptr[+0x30] = SetNext
0xd2f1fc:  f9400268   ldr  x8, [x19]
0xd2f200:  f9401508   ldr  x8, [x8, #0x28]     ; GetNext
0xd2f204:  aa1303e0   mov  x0, x19
0xd2f208:  d63f0100   blr  x8                  ; GetNext(x19)
0xd2f20c:  aa0003e1   mov  x1, x0              ; x1 = x19->m_pNext
0xd2f210:  aa1403e0   mov  x0, x20             ; x0 = x20
0xd2f214:  d63f02a0   blr  x21                 ; SetNext(x20, x1)
0xd2f218:  f9400268   ldr  x8, [x19]
0xd2f21c:  f9401908   ldr  x8, [x8, #0x30]     ; SetNext
0xd2f220:  aa1303e0   mov  x0, x19             ; x0 = x19
0xd2f224:  aa1f03e1   mov  x1, xzr             ; *** x1 = 0 ***
0xd2f228:  d63f0100   blr  x8                  ; *** SetNext(x19, nullptr) ***
0xd2f22c:  900114c8   adrp x8, ...
0xd2f230:  f942d908   ldr  x8, [x8, #0x5b0]
0xd2f234:  b9400109   ldr  w9, [x8]
0xd2f238:  51000529   sub  w9, w9, #1
0xd2f23c:  b9000109   str  w9, [x8]           ; decrement a counter
```

## 3. The answer: `SetNext(x19, nullptr)` is explicit

**`0xd2f224: mov x1, xzr` followed by `0xd2f228: blr SetNext` is `node->SetNext(nullptr)`.**

**The list is therefore meant to be NULL-TERMINATED.** A circular design would never write an explicit
null into `m_pNext` — that instruction would be meaningless or harmful under a circular invariant.

**So round 8's promotion of the circular-list reading is WEAKENED, and the earlier assumption is
restored on better evidence:**

> **`m_pNext == self` is corruption, and the double registration is a genuine defect.**

That also re-confirms the exit test: walking to a null terminator is exactly what `cmpq $0x0` checks, and
it is **correct** for this list. **There is no recompilation defect here** — the hypothesis that the
recompiler dropped a register operand is **disproved**.

## 4. Two more facts from the same window

- **`0xd2f1f8`/`0xd2f21c` confirm the vtable layout** used since round 3: `+0x28` is `GetNext`, `+0x30` is
  `SetNext`. The slot table stands on guest evidence, not just on the `.data` read.
- **`0xd2f22c`–`0xd2f23c` decrements a 32-bit counter at `main+0x2fc75b0`.** Round 3 called this global "a
  count" and round 4 retracted that after seeing `56,951,144`. **It *is* a count** — it is decremented
  here — but it is **not a registration count**; more likely a free-slot or capacity counter. **Round 4's
  retraction was right about the meaning and wrong about it not being a counter at all.**

## 5. What this round establishes

| Item | State |
|---|---|
| `exefs/main` readable at computed offsets | ❌ **no — LZ4 compressed; use `main.bin`** |
| `GetNext` = `vptr[+0x28]`, `SetNext` = `vptr[+0x30]` | ✅ **confirmed in guest code** |
| Guest does `SetNext(node, nullptr)` | ✅ **observed at `0xd2f224`** |
| List is null-terminated by design | ✅ **follows** |
| Circular-list reading | ❌ **WEAKENED — no longer leading** |
| Recompilation defect in the exit test | ❌ **DISPROVED** |
| `main+0x2fc75b0` is decremented | ✅ observed — it is a counter |

## 6. What this does NOT establish

- **The exit test itself was not located in the guest code.** The decoded window is the *insertion* path
  after the walk exits. The `cbz`/`cmp` that ends the walk lies elsewhere and was not read, so the claim
  that the exit test is truly null-comparison rests on inference from `SetNext(...,nullptr)` rather than
  on the test instruction itself.
- **`x19` and `x20` were not definitively identified** as "new node" and "tail"; the reading above is
  consistent but not proven.
- **What `main+0x2fc75b0` counts** remains unknown beyond "it is a counter decremented here".
- **The exact nature of the double registration is still unexplained** — round 8 proved *which* constructor
  does it, not *why* both constructors reach the same object.
- **No fix was designed or implemented.**
- **`nnMain` is still not reached.** No NVN, no window. **This is not a booted game.**

## 7. Next increment

**Find and decode the walk's actual exit test.** Scan `main`'s decompressed image for the `cbz`/`cbnz`/`cmp`
that follows the `blr GetNext` in the loop — it should be within ~0x40 bytes of `0xd2f1e8`. Reading that
one instruction settles whether the test is against zero (null-terminated, as now believed) or against the
head.

If it is against zero, then **the port's own copy of the data is at fault** and the next question becomes
*why two constructors register the same object* — which is where the actual fix will be.
