# Boot engine porting order

The reconstruction target list, derived from the boot root's own body rather
than from the 126-function closure in arbitrary order. `Lp::Sys::SysInit::Init`
(`0x71011f5b20`, 1308 bytes) is the entry point; the engine functions it calls are
listed in **first-appearance order**, which is the order the engine must be stood up.

Source: `main-decompiled.txt`, the Ghidra body of the boot root.

---

## Engine dependencies (13)

| # | Function | first seen at line |
|---:|---|---:|
| 1 | `Lp::Sys::SysInit::Init` | 9 |
| 2 | `Utl::dumpDateTime` | 56 |
| 3 | `sead::AssertConfig::registerCallback` | 61 |
| 4 | `sead::Framework::InitializeArg::InitializeArg` | 64 |
| 5 | `sead::GameFrameworkNx::initialize` | 68 |
| 6 | `Utl::dumpMemoryInfo` | 69 |
| 7 | `sead::ForegroundBucketMgr::initialize` | 71 |
| 8 | `HeapGroup::createInstance` | 78 |
| 9 | `HeapGroup::createHeap` | 82 |
| 10 | `Framework::Framework` | 119 |
| 11 | `sead::GameFrameworkNx::initializeGraphicsSystem` | 126 |
| 12 | `sead::TaskBase::MgrTaskArg::MgrTaskArg` | 171 |
| 13 | `sead::Framework::RunArg::RunArg` | 175 |

---

## Indirect / vtable dispatch sites (10)

These are **not resolvable statically** — the target is loaded from a vtable slot.
They are where `sead::`'s virtual interfaces must match the binary's vtable layout,
and they are the reason [VTABLE_VERIFICATION.md](VTABLE_VERIFICATION.md) exists.

- slot `0x10` — `(**(code **)(*plVar16 + 0x10))(plVar16);`
- slot `0x20` — `iVar7 = (**(code **)(*plVar16 + 0x20))(plVar16);`
- slot `0x38` — `puVar11 = (undefined4 *)(**(code **)(*plVar16 + 0x38))(plVar16);`
- slot `0x40` — `puVar9 = (undefined8 *)(**(code **)(*plVar16 + 0x40))(plVar16);`
- slot `0x18` — `(**(code **)(*plVar16 + 0x18))(plVar16,&local_138);`
- slot `0x28` — `(**(code **)(*plVar12 + 0x28))(plVar12);`
- slot `0x28` — `(**(code **)(*plVar12 + 0x28))(plVar12);`
- slot `0x28` — `(**(code **)(*plVar16 + 0x28))(plVar16);`
- slot `0x20` — `local_148._0_4_ = (**(code **)(*plVar16 + 0x20))(plVar16);`
- slot `0x28` — `(**(code **)(*(long *)this + 0x28))(this,*(undefined8 *)(lVar18 + 0x128),&local_138,&local_148);`

---

## Platform calls already satisfied (3)

These are handled by the reconstructed platform layer in `port/`.

- `nn::os::GetSystemTick`
- `nn::os::QueryMemoryInfo`
- `nn::nifm::Initialize`

---

## How to use this

1. Work down the engine list in order. A function cannot be ported before the ones
   it depends on, and first-appearance order approximates dependency order because
   the boot root constructs things before using them.
2. For each `sead::` entry, check `open-ead/sead` first — it is the most mature
   reference (252 stars) and covers framework, heap, thread, gfx.
3. Record every **unimplemented dependency reached** rather than stubbing silently:
   the harness should fail loudly at the first missing engine function, which is the
   fastest way to discover the true porting order.

## Limits

- **This is the boot root only.** The remaining 125 boot-closure functions and the
  wider engine (113,000 functions) are not represented here.
- **First-appearance order is a heuristic**, not a dependency graph. Static call
  order can differ from runtime order where branches reorder work.
- **Vtable dispatch is opaque.** Roughly a third of the boot root's calls go through
  indirect slots, so the list above understates the true dependency set.
