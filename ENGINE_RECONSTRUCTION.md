# Engine reconstruction: start point

The platform layer is done and cross-architecture verified
([TYPE_SIZES.md](TYPE_SIZES.md)). This is the **engine layer** — the reconstruction
milestone. It is a different scale of problem, so this document fixes a bounded, ordered
target rather than listing 113,000 functions.

---

## 1. The bounded target: the boot root's direct engine dependencies

`Lp::Sys::SysInit::Init` (`0x71011f5b20`, 1308 bytes) is the boot entry. Its decompiled
body calls **13 engine functions**, in first-appearance order. Every one already has a
decompiled body, so work can start immediately:

| # | Function | Address | Body |
|---:|---|---|---|
| 1 | `Lp::Sys::SysInit::Init` (the root itself) | `0x71011f5b20` | 1308 B |
| 2 | `Lp::Utl::dumpDateTime` | `0x71012cdbf4` | 216 B |
| 3 | `sead::AssertConfig::registerCallback` | `0x7101397fac` | — |
| 4 | `sead::Framework::InitializeArg::InitializeArg` | `0x7100e69894` | — |
| 5 | `sead::GameFrameworkNx::initialize` | `0x7100eb9f1c` | — |
| 6 | `Lp::Utl::dumpMemoryInfo` | `0x71012cdccc` | 408 B |
| 7 | `sead::ForegroundBucketMgr::initialize` | `0x7100eb9f1c` | — |
| 8 | `HeapGroup::createInstance` | `0x7100ea1f54` | — |
| 9 | `HeapGroup::createHeap` | `0x71011f5130` | — |
| 10 | `Framework::Framework` | `0x7100e696a4` | — |
| 11 | `sead::GameFrameworkNx::initializeGraphicsSystem` | `0x7100e6738c` | — |
| 12 | `sead::TaskBase::MgrTaskArg::MgrTaskArg` | `0x7100e6b7bc` | — |
| 13 | `sead::Framework::RunArg::RunArg` | `0x7100e698a0` | — |

**13 functions, not 113,000.** That is the tractable first milestone, and it is where the
engine must be stood up first because the boot root cannot proceed without them.

> **Collision resolved.** Rows 5 and 7 originally shared the address `0x7100eb9f1c`
> because `tools/static/boot-dep-coverage.mjs` matched on the trailing name `initialize`,
> which several functions carry once Ghidra strips namespaces. The boot closure inventory
> carries full-namespace names with addresses, so it is now the authoritative source and
> name-matching is only a fallback that **reports ambiguity instead of picking one**.
> Corrected:
>
> | Function | Address | Size |
> |---|---|---:|
> | `sead::GameFrameworkNx::initialize` | `0x7100e6724c` | 20 B |
> | `sead::ForegroundBucketMgr::initialize` | `0x710139fb3c` | 4 B |
>
> All 13 dependencies now resolve unambiguously.

## 2. The four `Lp::Utl` diagnostics ports are the natural first increment

`dumpDateTime` and `dumpMemoryInfo` are fully readable and small. `dumpDateTime` is the
**very first thing the boot root does**, and its body shows the exact dependency shape
the engine port will have:

```c
void Lp::Utl::dumpDateTime(char const *)          // 0x71012cdbf4, 216 bytes
{
  sead::DateTime dt;
  sead::DateTime::DateTime(&dt, 0);
  sead::DateTime::setNow(&dt);                    // real clock, via nn::time
  sead::CalendarTime ct(&ct, cDefaultYear, cDefaultMonth, cDefaultDay,
                        cDefaultHour, cDefaultMinute, cDefaultSecond);
  ...
}

void Lp::Utl::dumpMemoryInfo(char const *)        // 0x71012cdccc, 408 bytes
{
  nn::os::QueryMemoryInfo(&memInfo);              // platform layer — already implemented
  ...
}
```

Two things this establishes:

1. **`dumpMemoryInfo` already reaches into the platform layer** via
   `nn::os::QueryMemoryInfo`, which `port/` implements. The two layers meet here, so this
   function is the first genuine integration point.
2. **`dumpDateTime` needs `sead::DateTime` and `sead::CalendarTime`** — the first real
   engine dependency, and both are covered by `open-ead/sead`.

## 3. Reference material is checked out

`tools/wsl/wsl-clone-refs.sh` clones what the reconstruction needs. All four are present:

| Repo | Size | Relevance |
|---|---:|---|
| `open-ead/sead` | 2.5 MB | **the** reference for the `sead::` layer — framework, heap, thread, gfx |
| `open-ead/agl` | 720 KB | graphics/lighting (later) |
| `open-ead/nnware` | 620 KB | `g3d`/`ui2d`/`atk` headers |
| `open-ead/eui` | 260 KB | UI |

**Licensing remains unresolved.** `sead` ships **no licence file** — the same problem
[GRAPHICS_NVN.md](GRAPHICS_NVN.md) flagged for `nnsdk`. `deko3d` is permissively licensed
and is a counter-example within the same ecosystem. **Do not incorporate `sead` source
until this is settled**; use it as a *reading reference* in the meantime, which is what
"reference" means here.

## 4. The method: fail loudly, do not stub — **now installed and exercised**

The platform layer used stub-and-document successfully because its stubs were bounded.
The engine layer is too large for that — silent stubs would let the harness "pass" while
omitting most of the work.

`port/include/lp/recon.hpp` now provides this. Reconstructed code declares a dependency
it has not got:

```c
LP_ENGINE_REQUIRE("sead::HeapMgr::createCurrentHeap", 0x7100e6b7bc);
```

which throws `MissingEngineDependency` carrying **the name and the address**.

`port/src/boot_sequence.cpp` walks the boot root's observed order, calling reconstructed
functions and stopping at the first gap. The current run reports, truthfully:

```
reconstructed steps completed: 2
  [1] Lp::Utl::dumpDateTime(" Application Start Time")
  [2] nn::os::GetSystemTick -> sRunStartTime
STOPPED AT: sead::AssertConfig::registerCallback (0x7101397fac)
```

**That output is the progress metric.** It is a statement of how far the reconstruction
reaches, not a pass/fail of a simulated boot. As each function is ported the list grows
and the stop moves down the boot order.

### A consequence worth knowing

`dumpMemoryInfo` **is** ported, but it sits after three unported dependencies in the boot
root's order. With fail-loudly the run stops before reaching it, so it is currently
unreachable through the sequence even though it works. That is correct behaviour, and it
is recorded here so the gap is not surprising.

## 5. Progress ledger

| Boot-root dependency | State |
|---|---|
| `Lp::Utl::dumpDateTime` | **ported** (`port/src/utl.cpp`) |
| `nn::os::GetSystemTick` | **ported** (platform layer) |
| `sead::AssertConfig::registerCallback` | **not ported** — needs a `DelegateEvent`/`Slot` model; list primitive done |
| `sead::Framework::InitializeArg::InitializeArg` | not ported |
| `sead::GameFrameworkNx::initialize` | not ported |
| `Lp::Utl::dumpMemoryInfo` | **ported**, but unreachable until the above land |
| `sead::ForegroundBucketMgr::initialize` | not ported |
| `HeapGroup::createInstance` / `createHeap` | not ported |
| `Framework::Framework` | not ported |
| `sead::GameFrameworkNx::initializeGraphicsSystem` | not ported |
| `sead::TaskBase::MgrTaskArg::MgrTaskArg` | not ported |
| `sead::Framework::RunArg::RunArg` | not ported |

**Supporting primitives ported:** `sead::ListNode` (`insertFront_`, `insertBack_`,
`erase_`) and `sead::DateTime`/`CalendarTime`.

## 6. Honest scale statement

- **13 functions** on the boot root's direct path. Tractable, and this document exists to
  keep the work anchored there.
- **126** in the wider boot closure ([ENGINE_REFERENCE.md](ENGINE_REFERENCE.md)).
- **~113,000** total in `main`. This is community-decompilation scale — years, not
  sessions.

Boot-to-menu is the only defensible target, and even that requires the graphics system to
come up: row 11 is `initializeGraphicsSystem`, and `sead::GameFrameworkNx::initialize`
(row 5) runs **before** the heap group is created (rows 8–9). The ordering is not the
naive "memory, then graphics last" progression that
[BOOT_MILESTONE.md](BOOT_MILESTONE.md) assumed — worth re-checking against that document.

## 6. Next increments, in order

1. Port `Lp::Utl::dumpDateTime` and `Lp::Utl::dumpMemoryInfo` against `open-ead/sead` as a
   reading reference, with `dumpMemoryInfo` exercising the platform layer through
   `nn::os::QueryMemoryInfo` for the first time.
2. Resolve the `ForegroundBucketMgr::initialize` address collision (§1 caveat).
3. Add a `reconstructed/` target to the CMake build and have the boot harness call
   reconstructed engine code rather than replayed patterns.
4. Install the fail-loudly dependency reporting described in §4.
