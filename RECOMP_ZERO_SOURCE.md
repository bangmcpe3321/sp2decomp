# The zero is a load: `Framework::initialize` receives an `InitializeArg` with both size fields zero

The `HeapMgr::initialize(0)` call has been traced to the exact instruction that produces the zero.

---

## 1. The backtrace

```
#0  main_00E7C4E0   sead::HeapMgr::initialize(size_t)          <- x0 = 0x0
#1  main_00E698AC   sead::Framework::initialize(InitializeArg const&)
#2  main_00E69FE4   sead::GameFramework::initialize(...)
#3  main_00E6724C   sead::GameFrameworkNx::initialize(...)
#4  main_011F5B20   Lp::Sys::SysInit::Init()
#5  main_0019A3E0   nnMain
```

**The caller is `sead::Framework::initialize`** — the same frame that later faults in
`ExpHeap::tryCreate`. So it asks for a heap it never sets up, then fails to find one: **one defect, two
symptoms.**

## 2. The instructions that produce the zero

Disassembling just before the call (`main_00E698AC` = `Framework::initialize`):

```asm
+102:  mov   0x8(%rax),%rdx      ; rdx = *(arg + 8)
+106:  mov   %rdx,(%rdi)         ; x0 = rdx
+109:  test  %rdx,%rdx
+112:  jne   +555                ; if non-zero, take another path
+118:  mov   (%rax),%rax         ; rax = *(arg + 0)      <- the zero path
+121:  mov   %rax,(%rdi)         ; x0 = *arg
+124:  movabs $0x7100e698d8,%rax
+134:  mov   %rax,0xf0(%rdi)     ; return address
+141:  call  main_00E7C4E0       ; HeapMgr::initialize(x0)
```

**This is a two-field fallback:**

```
size = arg->[+8];
if (size == 0) size = arg->[+0];      // fallback
HeapMgr::initialize(size);
```

**Both fields are zero**, so the fallback yields zero, and `HeapMgr::initialize(0)` follows.

## 3. What that means

**The defect is upstream of the heap manager entirely.** `sead::Framework::initialize` is handed an
`InitializeArg` whose two size-ish fields are **both zero** — it is not computing a size wrongly, it is
**receiving no size at all**.

The `InitializeArg` is constructed by the game's own startup:
`nnMain` → `Lp::Sys::SysInit::Init` → `GameFrameworkNx::initialize` → `GameFramework::initialize` →
`Framework::initialize`.

**So the missing input is a value the game's `SysInit` was supposed to fill in and did not** — most likely
because it derives that value from something the port does not provide.

## 4. What this establishes

| Item | State |
|---|---|
| Caller of `HeapMgr::initialize` | ✅ **`sead::Framework::initialize`** |
| The zero's origin | ✅ **`*(arg+8)==0` and `*(arg+0)==0`, a two-field fallback** |
| Precise instruction | ✅ **`main_00E698AC+102` … `+141`** |
| `get_info` involvement | ❌ **none — eliminated last increment** |
| `system_resource_size` | ❌ eliminated |
| Root cause of the missing size | ❌ **not identified** |

## 5. What this does NOT establish

- **What `rax` points to was not confirmed.** It is *consistent with* being the `InitializeArg` passed to
  `Framework::initialize`, but the preceding instructions that set `rax` were not disassembled.
- **The identity of the two zero fields is unknown** — they are described as "size-ish" from their use, not
  from a header.
- **Who should have filled them, and from what source, is unknown.**
- **`HeapMgr::initialize` with a non-zero size was still not tried** — so it remains unconfirmed that a real
  size would clear the fault.
- **The game is not booted** — it faults in `GameFrameworkNx::initialize`.
- **Nothing is rendered.** No NVN, no window, no shaders. **This is not a playable game.**

## 6. Next increment

Two options, in order of cost:

1. **Disassemble `Framework::initialize` from its start** to see where `rax` comes from and which fields it
   reads. That identifies the struct and both fields, and shows whether the value is a parameter or a global.
2. **Try `HeapMgr::initialize` with a non-zero size** from the port, as a diagnostic — if the fault clears,
   the whole reading is confirmed and the remaining work is purely "supply the right number"; if it does not,
   more is wrong in the framework path than the one argument.

**Step 2 is one line and answers the strategic question**: whether this is a one-input problem or a
framework-initialisation problem. That is worth knowing before investing further.
