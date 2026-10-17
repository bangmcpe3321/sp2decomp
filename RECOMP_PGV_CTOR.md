# The constructor initialises the node — both round-13 candidates now eliminated

Round 15. `PseudoGlobalVariable<StreamSettings>`'s constructor was disassembled. It **does** put the
node into a known state before calling `AddVariable`, which **eliminates the last candidate from round
13** and forces a different reading of the bug.

---

## 1. The constructor initialises the node, then calls `AddVariable`

```asm
+135:  movabs 0x7102fc7908,%rax   ; the static PseudoGlobalVariable<StreamSettings> object
+145:  mov    %rax,0x98(%rdi)     ; stash it
+152:  mov    %rax,(%rdi)         ; c.x[0] = it
+172:  call   main_00D2F404       ; a base-class constructor
+177:  movabs 0x7102fc7900,%rax
+191:  mov    0x98(%rbx),%rax     ; rax = the object
+198:  movw   $0x0,0x18(%rax)     ; *** obj+0x18 (u16) = 0 ***
+204:  mov    0x98(%rbx),%rax
+211:  movq   $0x0,0x10(%rax)     ; *** obj+0x10 (u64) = 0 ***
+219:  mov    0x40(%rbx),%rax
+223:  add    $0x10,%rax          ; rax = 0x7102fc7900 + 0x10 = 0x7102fc7910
+231:  mov    0x98(%rbx),%rdx     ; rdx = the object (0x7102fc7908)
+238:  mov    %rax,(%rdx)         ; *** obj->field0 = 0x7102fc7910 = obj + 8 ***
...
+261:  mov    %rax,0x8(%rbx)      ; c.x[1] = the object  -> AddVariable's argument
+285:  call   main_00D2F0F4       ; *** AddVariable(object) ***
```

**The object is explicitly cleared (`+0x18 = 0`, `+0x10 = 0`) and given a `field0` pointer before the
call.** It is *not* passed to `AddVariable` in an uninitialised state.

## 2. So both round-13 candidates are now eliminated

| Round-13 candidate | Verdict |
|---|---|
| (1) The node was never fully initialised | ❌ **eliminated** — `+198`/`+211` clear it explicitly |
| (2) `AddVariable` linked the node to itself | ❌ **eliminated in round 14** — its empty branch writes `head = node` |

**Neither holds. The node that `AddVariable` is handed here is correctly initialised.**

## 3. The reading the evidence now forces

Two distinct object addresses have been observed:

| Where | Address |
|---|---|
| The object being constructed here | `0x7102fc7908` (`field0` → `0x7102fc7910` = itself + 8) |
| The node measured self-referential in round 12 | **`0x710304fb90`** (word at `+8` == itself) |

**These are different objects.** So `AddVariable` is walking a list that **already contained the
self-referential node `0x710304fb90` before this constructor ran** — it was inserted by an *earlier*
`PseudoGlobalVariable<T>` construction, and the walk from the head reaches it and never terminates.

**So the defect predates constructor #1367 and belongs to whichever earlier `PseudoGlobalVariable<T>`
produced `0x710304fb90`.** Round 13 and 14 both examined the *symptom's* call, not the *cause's*.

## 4. What this establishes

| Item | State |
|---|---|
| Ctor initialises the node | ✅ **confirmed** (`+198`, `+211`, `+238`) |
| Ctor calls `AddVariable` | ✅ confirmed (`+285`) |
| Candidate (1) uninitialised node | ❌ **eliminated** |
| Candidate (2) self-link by `AddVariable` | ❌ **eliminated** (round 14) |
| **The bad node predates this call** | ✅ **follows from the addresses differing** |
| Which earlier ctor created it | ❌ **not identified** |

## 5. What this does NOT establish

- **Which `PseudoGlobalVariable<T>` produced `0x710304fb90`** was not identified. Finding it means
  locating which constructor writes that address — the object at `0x710304fb90` is in `main`'s `.data`
  region, so it can be mapped to a symbol by searching for its address in the tables.
- **The `field0 = obj + 8` pattern was not interpreted.** Whether a vtable pointer pointing 8 bytes into
  its own object is *normal* for this SDK is unknown — it is unusual, and may itself be the defect.
- **The callback at `field0 + 0x28` was still not named.**
- **No fix was designed or implemented.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 6. Next increment

**Identify `0x710304fb90`.** It is a static object in `main`'s data region, so:
1. find the symbol or `.data` static whose address is `0x710304fb90`; and
2. find which `PseudoGlobalVariable<T>` constructor writes there.

That names the *cause* rather than the symptom, and it is a static table search — no running process.
