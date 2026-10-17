# `nnosInitialize` confirmed: the missing SDK init, and the next fault

Round 7. The round-6 hypothesis — *"the port enters at `nnMain`, bypassing SDK system
initialisation"* — is **confirmed**, the missing initialiser is **found and now runs**, and the boot
advances substantially further to a new, precisely-located fault.

---

## 1. The finding

Splatoon 2's SDK is the **old `nnos*` C API era**, not the `nn::init` era:

- **121 distinct `nnos*` symbols** — `nnosAcquireSemaphore`, `nnosAllocateTlsSlot`,
  `nnosCreateThread`, `nnosAttachSystemEvent`, and so on.
- And crucially **`nnosInitialize`**, at **`sdk+0x86bd8`** (`{"nnosInitialize", 0x86bd8, 468, 2, 1, 0}`).

**That is the system initialisation the port was skipping.** The round-6 crash in
`nn::os::LockMutex` on uninitialised state is exactly what a missing `nnosInitialize` produces.

## 2. It now runs, and the boot advances

```
nn::init::Start absent -- older SDK; running nnosInitialize, then nnMain
nnosInitialize at sdk+86bd8 (nnosInitialize+0)
missing import called: nnosGetDefaultUserExceptionStackForApplication
    (lr sdk+86d6c (nnosInitialize+194)) -> 0
nnosInitialize returned
sdk: _init at +0x24
sdk constructors: 0
main: _init at +0x24
```

Compare with round 6, which died **inside `sdk`'s `_init`** before reaching `main` at all. The boot
now completes `nnosInitialize`, `sdk`'s `_init`, and `main`'s `_init` in sequence.

**One of the 34 previously-unresolved imports was actually exercised**: `nnosGetDefaultUserException
StackForApplication` was *called* from inside `nnosInitialize+0x194`, hit the missing-import stub, and
returned 0. That is the first unresolved import in this project to be **proven reachable** rather
than merely counted.

## 3. The new fault

```
=== HOST SIGSEGV ===
  fault address : 0x10
  guest lr      : 0x7100d08790  main+d08790 (_ZN2nn3nex9WaterMarkC2EPKcbj+84)
  x0  0000000000000000     <- this == NULL
  x1  000000710287442c
  x3  000000000000ea60
```

**`nn::nex::WaterMark::WaterMark(const char*, bool, unsigned)` is being constructed with a null
`this`.** (`nex` is Nintendo's networking library.) The constructor dereferences `this+0x10`, hence
the fault at `0x10`.

**A `this == NULL` construction almost always means the enclosing object was allocated by a `new`
that returned null, or is a static pointer that was never assigned** — i.e. a heap or static-init
dependency that is still not satisfied.

`x3 = 0xea60` = 60000, and `x20 = 1` — plausible constructor arguments — so the *arguments* arrived
correctly and the *object* did not.

## 4. What this round establishes

| Item | State |
|---|---|
| Round-6 hypothesis | ✅ **CONFIRMED** |
| SDK generation identified | ✅ **`nnos*` C API era, 121 symbols** |
| Missing initialiser | ✅ **found: `nnosInitialize` at `sdk+0x86bd8`** |
| `nnosInitialize` runs | ✅ yes, returns cleanly |
| Boot distance | ✅ **past `nnosInitialize`, `sdk::_init`, `main::_init`** |
| First unresolved import proven reachable | ✅ `nnosGetDefaultUserExceptionStackForApplication` |
| Next fault | ❌ `nn::nex::WaterMark` ctor, `this == NULL`, **located not fixed** |

## 5. What this does NOT establish

- **`nn::nex::WaterMark`'s null `this` is not diagnosed** beyond `this == NULL`. Whether the cause is
  a null `new`, an unset static, or a missing allocator is unknown.
- **`sdk constructors: 0`** — the `init_array` loop reported **zero** constructors for `sdk`, which is
  suspicious and was not investigated. `main`'s count was not printed before the fault.
- **`nnosGetDefaultUserExceptionStackForApplication` returned 0** and its consequence was not
  traced; it may or may not be related to the null `this`.
- **No game initialisation has completed.**
- **The HLE remains largely unexercised** — one import called, 115 not.
- **No NVN, no window, no render.**
- **`nnosInitialize`'s return value was not checked** — the code logs "returned" regardless.

## 6. Next increment

Two candidate causes for the null `this`, both cheap to distinguish:

1. **`sdk constructors: 0`** — if `sdk`'s `init_array` genuinely has zero entries, or the status word
   is wrong, then whatever registers the object behind `WaterMark` never ran.
2. **A null `new`** — the heap/SDK allocator path. `nn::init::InitializeAllocator` is one of the four
   `nn::init` symbols Splatoon 2 *does* export; if the game's allocator was never installed, every
   `new` returns null and this fault is the first symptom.

Instrumenting `main`'s constructor count and the first `new` result would settle it.
