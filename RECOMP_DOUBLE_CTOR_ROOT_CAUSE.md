# ROOT CAUSE FOUND: the constructors were running TWICE

The watchpoint answered the open question, and the answer is not in the data — it is in the **runtime**.
The port ran every static constructor **two times**, and that is what created the self-link.

---

## 1. The four writes to `node->m_pNext` (`0x710304fb98`)

A hardware watchpoint on the node's `m_pNext` caught every write, with a host backtrace:

| # | New value | Writer (`#0`) | Chain to `init_module` |
|---:|---|---|---|
| **1** | `0x0` | `main_00D2F404` (PGV base ctor) | `… → main_00000024 → main_00D1A3E8 → main_00D0CB08 → main_00D2F404` |
| **2** | `0x7103650210` | `main_00D181E0` (**`SetNext`**) | `… → AddVariable → main_00D5A238` |
| **3** | `0x0` | `main_00D2F404` (**again**) | `… → main_00D1A3E8 → main_00D0CB08 → main_00D2F404` ← **no `main_00000024`** |
| **4** | **`0x710304fb90`** | `main_00D181E0` (**`SetNext`**) | `… → AddVariable → main_00D0CB08 → main_00D1A3E8` |

**Write #4 is the self-link, and it comes from `AddVariable`, invoked by constructor `main_00D1A3E8`.**

## 2. The smoking gun is write #1 vs write #3

Both write `0x0` to the same field via the same function — but the **chains differ**:

- **#1**: `init_module → call_preserving → nx::call → `**`main_00000024`**` → nx::call → main_00D1A3E8 → …`
- **#3**: `init_module → call_preserving → nx::call → main_00D1A3E8 → …`

**`main_00000024` is `_init`** — offset `0x24`, the very same offset `init_module` uses for `_init`
(`sdk: _init at +0x24`, `main: _init at +0x24`).

**And `_init` runs the constructor table itself.** So:

```cpp
static void init_module(CPU& c, const ModuleInfo& m) {
    call_preserving(c, m.base + init_off);        // _init -> runs EVERY constructor   (pass 1)
    ...
    for (size_t k = 0; k < m.init_count; k++)     // then the port runs them ALL AGAIN (pass 2)
        call_preserving(c, m.base + m.init_array[k]);
}
```

**Every static constructor ran twice.**

## 3. Why that produces exactly the observed corruption

1. **Pass 1** registers the PGVs and builds the chain normally (write #2).
2. **Pass 2** re-runs the `PseudoGlobalVariable` constructor, which resets `m_pNext = 0` (**write #3**).
3. Its `AddVariable` then walks the list, finds that node as the tail (its `m_pNext` was **just zeroed**),
   and calls `tail->SetNext(node)` where `tail == node` — **`node->m_pNext = node`** (**write #4**).
4. The next registration walks into the cycle and **hangs**.

**This accounts for every observation since round 7**: the duplicate registration, the `.bss` node whose
self-pointer was written at runtime, the "walk stops immediately", and the CPU-bound spin. **None of it was a
game bug.**

## 4. The fix, and the result

`init_module` now relies on `_init` alone; the `init_array` loop is gated behind `NX_DOUBLE_CTOR` so both
behaviours remain testable.

**Before (constructors twice):** hang at `main init[1367]`,
`nn::nex::PseudoGlobalVariable<StreamSettings>`, exit 124.

**After (constructors once):** the PGV hang is **gone**, and the run gets **further**:

```
nnosInitialize returned
sdk: _init at +0x24
  sdk: init_status @ sdk+6bf678 = 2, init_count = 74
installing game allocator at kHeapBase: 0x5000000000 size 0x20000000 (guest space)
main: _init at +0x24
  main: init_status @ main+2fdc0b8 = 2, init_count = 1604
=== HOST SIGSEGV ===
  fault address : 0x88
  guest lr      : main+e767d0
                  (_ZN4sead7ExpHeap9tryCreateEmRKNS_14SafeStringBaseIcEEPNS_4HeapEiNS5_13HeapDirectionEb+44)
```

**`_init` demonstrably runs the constructors** — it reached `sead::ExpHeap::tryCreate`, the game's own heap
manager, which only happens after a great deal of static initialisation.

**The failure has moved out of `nn::nex` entirely** and into `sead::ExpHeap` creation at `this + 0x88` — a
null-ish dereference, not a spin.

## 5. What this establishes

| Item | State |
|---|---|
| Who wrote the self-link | ✅ **`SetNext` called from `AddVariable`** |
| Which constructor invoked it | ✅ **`main_00D1A3E8`** |
| **Root cause** | ✅ **`init_module` ran every constructor twice (`_init` + `init_array` loop)** |
| Why duplicates appeared | ✅ **pass 2 re-registered pass 1's objects** |
| Why the node's `m_pNext` was zero at pass 2 | ✅ **the PGV ctor re-initialised it (write #3)** |
| Why it self-linked | ✅ **walk found the node as tail, and tail == node** |
| Is it a game bug | ❌ **no — a port bug** |
| **PGV hang** | ✅ **FIXED** |
| New failure | ❌ `sead::ExpHeap::tryCreate +0x44`, fault `0x88` |

## 6. What this does NOT establish

- **The new `sead::ExpHeap::tryCreate` fault is not diagnosed.** Whether it is caused by the 512 MB heap at
  `kHeapBase`, by `svcSetHeapSize` still never being called, or by something else is **unknown**.
- **`main`'s constructors completing is not proven** — the fault occurs during `main: _init`. **`nnMain` is
  still not reached.**
- **`_init` was called once, not twice, in the new run** — but that was not independently verified with a
  watchpoint; it is inferred from the hang disappearing.
- **`NX_DOUBLE_CTOR` was not tested** — the retention path exists but was not exercised.
- **The allocator's 512 MB size is still an arbitrary choice**, not derived from the NPDM.
- **No NVN, no window, no shaders, no render.** **This is not a booted game.**

## 7. Next increment

**Diagnose `sead::ExpHeap::tryCreate +0x44`.** It is now the first fault after a *correct* single-pass
constructor run, which makes it the next real blocker rather than a symptom of the first one.

Two candidate causes, both cheap to test:

1. **`svcSetHeapSize` still never being called** — the kernel's heap bookkeeping (`g_heap_size`, `vm_set`) is
   never established, only our manual `commit`. Calling the svc path first would match hardware exactly.
2. **The 512 MB heap at `kHeapBase` not matching what `sead::ExpHeap` expects** — `tryCreate` may require a
   parent heap that `nnosInitialize` would normally have made.
