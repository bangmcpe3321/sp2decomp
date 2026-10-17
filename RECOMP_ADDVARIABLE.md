# `AddVariable` *is* the spinning function — and its empty-list branch is correct

Round 14. A useful correction first: `gdb` refused the symbol lookup because **`0xd2f0f4` resolves to
`AddVariable` itself** — the function already disassembled in round 13. **The loop and the insertion
logic are the same function.** That removes a step from the plan, and the disassembly already answers
the question.

---

## 1. The empty-list branch, from the round-13 dump

```
+105:  movabs 0x7102fc7520,%rax    ; rax = address of the head global
+108:  mov    (%rax),%rdx          ; rdx = head value
+115:  mov    0x8(%rdi),%rcx       ; rcx = c.x[1]  = the NEW NODE (AddVariable's argument)
+119:  mov    %rcx,0x98(%rdi)      ; stash it
+126:  test   %rdx,%rdx            ; is head NULL?
+129:  je     +249                 ; YES -> the EMPTY-LIST branch
...
+249:  mov    %rcx,(%rax)          ; *head = node      <-- head = node  (CORRECT)
+252:  mov    $0x1,%edx            ; edx = 1
+257:  jmp    +339
...
+339:  mov    %rdx,0x40(%rbx)      ; set the guest register
+353:  movabs 0x7102fc75b0,%rax
+357:  mov    %edx,(%rax)          ; *(0x7102fc75b0) = 1   (a count / flag)
```

**The empty-list path is correct: it writes `head = node` and sets a count-or-flag to 1.** There is no
`head = node` fault and no self-link here.

## 2. So the defect is not in the empty-list insertion

**This is the decisive result of the round.** Round 13 asked whether `AddVariable` writes
`node->next = node` on the empty path. **It does not.** Which means:

1. **The list was not empty when the spin happened.** `+126`/`+129` did not take the empty branch — and
   round 13 already proved the head was non-null, because a null head would have skipped the loop
   entirely and not spun.
2. **The self-reference is in a node that was linked earlier**, not created by this call.
3. **The defect is therefore in the new node's own initialisation** — the `PseudoGlobalVariable<T>`
   constructor that runs *before* `AddVariable` — or in an earlier insertion.

**This is exactly candidate mechanism (1) from round 13, now the only remaining one:**

> *The node was never fully initialised — `PseudoGlobalVariable<T>`'s constructor ran before its
> `next`-equivalent field was cleared, so it holds a stale or self address.*

Candidate (2) — "`AddVariable` linked the node to itself" — is **eliminated** by reading its own empty
branch.

## 3. What the walk actually traverses

From the loop body:

```
+151:  mov 0xa0(%rbx),%rax    ; rax = current node
+158:  mov (%rax),%rdx        ; rdx = node->field0
+165:  mov 0x28(%rdx),%rsi    ; rsi = *(field0 + 0x28)   <- a FUNCTION POINTER
+169:  mov %rsi,0x40(%rbx)
+173:  mov %rax,(%rbx)        ; c.x[0] = node
+186:  call nx::call(...)     ; call it
```

So the traversal is **`node->field0` is a vtable-like object, and `+0x28` in it is the callback that
yields the next node.** The node does not hold `next` directly at `+8` for this purpose — the `+8`
word measured in round 12 was the field that happened to equal the node's own address.

**So the self-reference is in `node->field0`'s chain, or in the callback's return.** Round 12 measured
`*(node+8) == node`; round 13 showed the exit test is `x0 == 0` after the call. **The two are consistent
only if the callback returns the node itself.**

**I should be careful here:** I have not proven that the `+8` word is the same field the callback
returns. That link is inferred, not measured.

## 4. What this round establishes

| Item | State |
|---|---|
| `AddVariable` **is** `main_00D2F0F4` | ✅ confirmed (gdb resolved the offset to that symbol) |
| Empty-list branch writes `head = node` | ✅ **correct** |
| `AddVariable` self-links on empty insert | ❌ **eliminated** |
| List was non-empty at the spin | ✅ follows from `+126` not being taken |
| Defect is in node initialisation | ✅ **only remaining candidate** |
| Exact field / exact writer | ❌ **not identified** |

## 5. What this does NOT establish

- **`PseudoGlobalVariable<T>`'s constructor was not disassembled.** That is now the prime suspect and it
  has not been read.
- **The claim that the `+8` word is the field the callback returns is inferred, not measured.**
- **The callback at `field0 + 0x28` was not named.**
- **No fix was designed or implemented.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 6. Next increment

**Disassemble `nn::nex::PseudoGlobalVariable<nn::nex::StreamSettings>::PseudoGlobalVariable()`
(`main_00D5A238`), statically.** It is the only remaining suspect: it runs immediately before
`AddVariable` and is responsible for putting the new node into a known state. Look for whether it
writes the `next`/`field0` word at all, and what it writes.

Static, cheap, and it either names the defect or eliminates the last candidate and moves the suspicion
into `PseudoGlobalVariableRoot`'s constructor.
