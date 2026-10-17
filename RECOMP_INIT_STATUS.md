# 74 SDK constructors were being silently skipped — fixed

Round 8. Both round-7 candidates were tested at once, and one of them found a **root cause** that
unblocked 74 SDK constructors. The `nn::nex::WaterMark` fault persists but has moved *inside* `main`'s
`_init`.

---

## 1. The root cause

Instrumenting the status word produced, immediately:

```
sdk: init_status @ sdk+6bf678 = 2, init_count = 74
sdk constructors: 0
```

**`init_count = 74`, but the status word is `2`.** The stock runtime runs constructors only when
`status == 1`:

```cpp
if (status == 1)
    for (size_t k = 0; k < m.init_count; k++) call_preserving(c, m.base + m.init_array[k]);
```

**Splatoon 2's SDK writes `2`.** Wonder's writes `1`. So **all 74 of `sdk`'s constructors were silently
skipped** — the whole of the SDK's service initialisation: hipc, fs, htc, socket, account, applet,
codec, nfc, pwm, `std::ios_base::Init`, and more.

## 2. The fix, and the result

Accept any non-zero status:

```cpp
if (status != 0)
```

and the run now executes them:

```
sdk init[0]  +0x40a6c  _ZN2nn2sf4hipc6detail17HipcMessageReader10InitializeEPKv
sdk init[1]  +0x4adf0  _ZN2nn2fs6detail10UnregisterEPKc
sdk init[2]  +0x56dc8  nn::sf::cmif::client::...DomainProxyClientCoreProcessor::Process
sdk init[3]  +0x5f698  _ZN2nn3htc35BindHostDisconnectionEventForSystemEPNS_2os11SystemEventE
...
sdk init[70] +0x1e8da8  _ZN2nn3pwm10GetEnabledEPNS0_14ChannelSessionE
sdk init[73] +0x2024f4  _ZNSt3__18ios_base4InitD1Ev
sdk constructors: 74 (status 2)
```

**All 74 ran, and the run reports `74 (status 2)`.** That is the SDK's entire service layer
initialising — the deepest the port has ever reached.

## 3. This is the fourth Wonder-vs-Splatoon-2 constant

| # | Assumption | Consequence |
|---|---|---|
| 1 | `g_fast[4]` | six modules, two silently dropped |
| 2 | 16 MB module stride | `sdk` mapped over `main` |
| 3 | `kDtInit = 0x30` | called `_init+0xc` |
| 4 | **`init_status == 1`** | **74 SDK constructors silently skipped** |

**The pattern is now unmistakable**: this runtime encodes several facts that are true of Wonder's SDK
and false for Splatoon 2's. Each one fails *silently* rather than loudly. That is the single most
useful thing this project has learned about adapting the runtime to another game.

## 4. The fault persists — but it moved

```
sdk constructors: 74 (status 2)
main: _init at +0x24
=== HOST SIGSEGV ===
  fault address : 0x10
  guest lr      : main+d08790 (_ZN2nn3nex9WaterMarkC2EPKcbj+84)
  x0  0000000000000000     <- this == NULL
```

Two things changed:

1. **`main init[N] lines: 0`** — `main`'s constructors never ran, because the fault happens **inside
   `main`'s `_init`**: the log shows `main: _init at +0x24` and then the crash, with no `main:
   init_status` line after it.
2. **The fault is unchanged in identity** — still `nn::nex::WaterMark`, still `this == NULL`, still
   `+0x10`.

**So the skipped `sdk` constructors were NOT the cause of the null `this`** — that hypothesis is
disproved. The fault is in `main`'s own static initialisation.

## 5. The remaining hypothesis: a null `new`

`this == NULL` in a static constructor most directly means **`operator new` returned null**. Splatoon 2
exports `nn::init::InitializeAllocator` and `nn::init::GetAllocator` — the game's allocator entry
points — and if the allocator was never installed, every `new` in `main`'s static init returns null,
and `WaterMark` is simply the first one to dereference it.

**This is the leading hypothesis and is untested.** It is also testable cheaply: check whether
`nn::init::InitializeAllocator` is called before the fault, or log the first `operator new` result.

## 6. What this round establishes

| Item | State |
|---|---|
| Round-7 candidate (a): `sdk constructors: 0` | ✅ **root-caused and FIXED** |
| Root cause | ✅ `init_status == 1` vs Splatoon 2's `2` |
| `sdk` constructors running | ✅ **74 / 74** |
| Round-7 candidate (b): null `new` | 🟡 leading hypothesis, **untested** |
| Fault moved | ✅ now **inside `main`'s `_init`** |
| Fault fixed | ❌ still `nn::nex::WaterMark`, `this == NULL` |

## 7. What this does NOT establish

- **No game initialisation has completed.** `main`'s static constructors are still failing.
- **`main`'s `init_count` and status were never printed** — the crash happens before the diagnostic
  line, so `main`'s constructor list is unknown.
- **The null-`new` hypothesis was not tested.**
- **The HLE is still barely exercised** — one import called across the whole run.
- **No NVN, no window, no render.**
- **`nnosInitialize`'s return value is still unchecked.**
- **The 74 constructors were run but their individual return behaviour was not inspected** — a
  constructor that silently failed would not be visible here.

## 8. Next increment

Test the null-`new` hypothesis: instrument the runtime's allocator path and log the first
`operator new` result in `main`'s static init, and whether `nn::init::InitializeAllocator` ran. That
either explains `WaterMark` or names the next real cause.
