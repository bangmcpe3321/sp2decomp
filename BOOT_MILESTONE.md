# Milestone: boot to main menu (offline, single-player only)

[Tiếng Việt](BOOT_MILESTONE_vi.md)

The narrowest useful target: play the original `main` on PC and reach the title
screen, with no gameplay behind it yet.

This document defines that milestone precisely, identifies the boot machinery, and
states the strategy that makes it tractable.

---

## 1. Correction to the project's earlier assumptions

Earlier notes treated MOD0 as containing an entry point and derived an "entry VA"
from `+0x10 + +0x14`. **That was wrong.** Per the
[SwitchBrew MOD specification](https://switchbrew.org/wiki/MOD), the module header
contains no entry point:

| Offset | Field | This build |
|---|---|---|
| 0x0 | Signature `"MOD0"` | `4d4f4430` |
| 0x4 | `DynamicOffset` | `0x2f9a468` |
| 0x8 | `BssStartOffset` | `0x2fdbff8` |
| 0xC | `BssEndOffset` | `0x3698f98` |
| 0x10 | `ExceptionInfoStartOffset` | `0x2921ec0` |
| 0x14 | `ExceptionInfoEndOffset` | `0x2a00eac` |
| 0x18 | `ModuleOffset` (runtime-generated, ≈ `.bss` base) | `0x2fdbff8` |

So `+0x10`/`+0x14` is **exception-handling metadata**, not an entry, and `+0x18`
is the module object in `.bss` — consistent with `BssStartOffset` and with the
computed `.bss` base `0x2fdc000`. MOD0 is a replacement for `PT_DYNAMIC`, not a
program entry.

Any document in this repo that quotes a "MOD0 entry point" should be disregarded.
The [README](README.md) has been corrected accordingly.

---

## 2. How this module actually starts

Two mechanisms, both real and both readable from the binary:

**Dynamic section** (VA `0x2f9a470`, file offset `0x2f9a570`):

```
DT_INIT          = 0x24
DT_FINI          = 0x160
DT_INIT_ARRAY    = 0x2fd7f90
DT_INIT_ARRAYSZ  = 0x3220      → 1604 constructor entries
DT_SYMTAB        = 0x1c2e7e0
DT_STRTAB        = 0x1f899c8
DT_RELA          = 0x1416048
DT_JMPREL        = 0x19ec6a8
```

1604 static constructors run before anything else. None of them resolve to a named
symbol, which is expected — they are compiler-generated local initialisers.

**Framework startup sequence**, recovered from the symbol table (`Lp::Sys`):

| Address | Symbol | Role |
|---|---|---|
| `0x71011f5b20` | `Lp::Sys::SysInit::Init` | framework entry |
| `0x71011f5ab4` | `Lp::Sys::SysInit::nninitStartup` | SDK startup |
| `0x71011f603c` | `Lp::Sys::SysInit::printFromStartTime` | startup timing |
| `0x71011fca28` | `Lp::Sys::RootTask::parallelInitThreadFunc` | parallel init |
| `0x71011fcb44` | `Lp::Sys::RootTask::runParallelInitThread` | parallel init |
| `0x71011fcba4` | `Lp::Sys::RootTask::waitDoneParallelInitThread` | join init |
| `0x7100053a8c` | `Lp::Sys::Scene::sceneCalc` | per-frame update |
| `0x7100096838` | `Lp::Sys::CalcInGSysCalc` | calc pass dispatch |

`Lp::Sys::SysInit::Init` is the practical entry for a port, and
`RootTask::parallelInitThreadFunc` is the fan-out point where the framework
initialises subsystems concurrently. `sead::JobQueue::run` (`0x7100096a34`)
underlies the dispatch.

Note the boot framework lives in the **`sdk` module**, not `main` — so `sdk` is
not optional scaffolding. It is on the critical path to first frame.

---

## 3. Strategy: patch, don't rewrite

This is the single most important decision, and it changes the milestone from
enormous to bounded.

There are two ways to get an ARM64 Switch binary running on x86-64 PC:

**(a) Full decompilation + recompile.** Reconstruct all 113,150 functions in C++,
recompile natively. This is the classic decomp project, and it is the multi-year,
multi-person effort described in [PORTING.md](PORTING.md). It is *not* a
prerequisite for booting.

**(b) Binary translation with incremental replacement.** Keep the original `main`
binary and execute it, replacing the platform layer underneath it. Each
reimplemented function replaces one dispatcher slot; the other 100,000+ functions
run untouched. This is how several commercial PC ports were actually produced.

**For "boot to menu" and single-player, (b) is the correct path.** Under it, the
milestone is not "reimplement the game" — it is:

> reimplement `nn::` platform functions until the binary stops asking for
> Nintendo hardware.

That is a bounded, enumerable target: approximately **4,070 platform functions**
across the `nn::` namespaces, of which only the boot-reachable subset matters for
this milestone. The `DummyMatch` / `DummyLocalMatch` / `LobbyForShow` paths found
earlier are evidence that the game already tolerates simulated subsystems, which
suits approach (b) directly.

---

## 4. Minimum boot dependency set

To reach the title screen, these must work. Nothing else is required yet.

| Order | Subsystem | Functions | Why it is required to boot |
|---:|---|---:|---|
| 1 | `nn::os` | 159 | threads, mutexes, events, TLS, semaphores — the framework is threaded |
| 2 | `nn::mem` | 17 | heap for the 7 MB `.bss` and every allocation |
| 3 | `nn::oe` | 36 | application lifecycle; `nn::oe::Initialize`, `FinishStartupLogo` |
| 4 | `nn::fs` | 44 | mount romfs; nothing loads without it |
| 5 | `nn::vi` / `nn::nvn` | — | display and presentation |
| 6 | `nn::gfx` | 289 | graphics device, memory pools, command buffers |
| 7 | `nn::g3d` | 292 | 3D renderer the title scene will use |
| 8 | `nn::ui2d` | 476 | 2D renderer for menu layout |
| 9 | `nn::atk` | 1,426 | UI toolkit — titles, menus, buttons |
| 10 | `nn::font` | 230 | menu text |
| 11 | `nn::hid` | 112 | at minimum, "press start" |
| 12 | `nn::audio` | 182 | several games block boot on audio init |

The long poles are `nn::atk` (1,426) and `nn::ui2d` (476) — the menu system is
the largest single boot dependency. `nn::gfx` + `nn::g3d` are next.

Reassuringly, **`nn::nex` (6,815) and `nn::pia` (4,687) are not on this list.**
The entire online stack can be stubbed and boot still proceeds. That is the payoff
of the offline-only decision.

---

## 5. Suggested first execution steps

1. **Get `Lp::Sys::SysInit::Init` under the debugger.** Whether boot proceeds at
   all is answerable by watching where it first calls into un-implemented platform
   code. Every unknown gets a `stub → log → return 0` implementation.
2. **Implement `nn::os` first.** The framework is threaded from very early;
   without working threads and events the binary will hang rather than fail
   cleanly. This is where stubs must be real, not `return 0`.
3. **Stub loudly, not silently.** Every unimplemented platform function should log
   its demangled name. The boot log then becomes the work queue, in dependency
   order, which is how this class of project is normally driven.
4. **Expect the first wall at `nn::fs` / romfs.** The title screen needs layouts
   and fonts from `romfs`. Extraction and a native filesystem shim are early work.
5. **Do not start with `nn::atk`.** It is the largest dependency but it is reached
   late; implementing it before the graphics device exists has nothing to draw to.

## 6. What this milestone deliberately excludes

- No gameplay, no player, no ink mechanics.
- No online, no matchmaking, no lobby — stubbed.
- No Salmon Run, no Turf War.
- No save data, no Amiibo, no screenshots.

## 7. Honest assessment

Even narrowed to "boot to menu", this is a substantial project: the critical path
runs through the OS layer, the filesystem, the graphics device, the 2D/3D
renderers, and a 1,426-function UI toolkit. It is months of work, not days.

The reason it is worth attempting is that the target is **bounded and
observable**. Unlike "port the game", "reach the title screen" has a single binary
success condition, and the boot log tells you exactly what to implement next. Under
the patch-don't-rewrite strategy, that path does not require decompiling 113,150
functions first.
