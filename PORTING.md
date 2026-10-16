# Porting assessment and roadmap

Scope analysis for bringing **Splatoon 2** (title `01003bc0000a0000`) to PC, built
from the symbol and subsystem analysis in this repository.

Read this as a **feasibility and sequencing document**, not a promise. The short
version is in [Bottom line](#bottom-line).

---

## 1. What is being ported

| Component | Size | Functions |
|---|---|---|
| `main` | 23,162 KB | 113,150 |
| `sdk` | 2,962 KB | not yet inventoried |
| `subsdk0` | 769 KB | not yet inventoried |
| `subsdk1` | 66 KB | not yet inventoried |
| `subsdk2` | 48 KB | not yet inventoried |
| `subsdk3` | 170 KB | not yet inventoried |
| `rtld` | 13 KB | — |
| `romfs` | 5,390 files, 17 subsystems | — |

Architecture is AArch64. `main` alone is 113,150 functions, and its `.text` is
21,045,608 bytes.

### The decisive fact

Counting the platform and middleware surface inside `main`:

| Subsystem | Functions | Portable? |
|---|---:|---|
| `nn::nex` — matchmaking, rankings, protocol framework | 6,815 | **No** — server-side |
| `nn::pia` — peer-to-peer session layer | 4,687 | **No** — Nintendo infrastructure |
| `nn::atk` — UI toolkit | 1,426 | Yes (reimplement) |
| `nn::ui2d` | 476 | Yes |
| `nn::vfx` — effects | 396 | Yes |
| `nn::g3d` / `nn::gfx` — rendering | 292 / 289 | Yes (reimplement on Vulkan) |
| `nn::font` | 230 | Yes (map to FreeType/HarfBuzz) |
| `nn::audio` | 182 | Yes (map to miniaudio/OpenAL) |
| `nn::os` | 159 | Yes (map to pthreads/OS primitives) |
| `nn::hid` — input | 112 | Yes (map to SDL) |
| `nn::sf`, `nn::socket`, `nn::ldn` | 189 | Partly |
| `nn::fs` | 44 | Yes |
| `nn::nfp` — Amiibo | 40 | Needs hardware substitute |
| `nn::account`, `nn::friends`, `nn::bcat`, `nn::capsrv` | ~148 | Redesign |

**`nn::nex` + `nn::pia` are 11,502 functions — roughly 10% of the entire codebase
— and they are not portable.** They are clients for Nintendo's online services and
peer-to-peer infrastructure. A port therefore does not *translate* the online
layer; it *replaces* it. That reframes the project: what gets ported is the game,
and what gets written is a new network stack.

---

## 2. Game systems (from the symbol namespaces)

These counts are functions whose symbols live in the corresponding namespace. They
measure API surface, not difficulty.

### Multiplayer modes

| System | Functions | Notes |
|---|---:|---|
| `Game::Coop` | 2,995 | Salmon Run |
| `Game::Cmp` | 1,641 | competitive versus |

### Player

| System | Functions |
|---|---:|
| `Game::Player` | 542 |
| `Game::PlayerInkAction` | 209 |
| `Game::PlayerEffect` | 87 |
| `Game::PlayerNetControl` | 78 |
| `Game::PlayerCloneHandle` | 105 |
| `Game::PlayerMake` | 132 |
| `Game::PlayerViewer` | 86 |

### Salmon Run bosses (internal codenames)

| Class | Functions | Shipped name (inferred) |
|---|---:|---|
| `Game::EnemyLastKing` (+`Punch`) | 221 + 114 | King Salmonid |
| `Game::EnemyHangedKing` / `EnemyHangKing` | 164 / 99 | — |
| `Game::EnemyRollerKing` (+`Test`) | 139 + 110 | — |
| `Game::EnemyStampKing2` / `EnemyStampKingDeco` | 124 / 149 | — |
| `Game::EnemyBakeryKing` | 141 | — |
| `Game::EnemyGelidiumKing` (+`_Mark2`, `_Mark4`) | 103 / 98 / 119 | — |
| `Game::EnemyTakolienMovable`, `EnemyTakopter`, `EnemyTakodozer` | 74 / 73 / 70 | — |

The codename→shipped-name mapping is **not established** and should not be
assumed; these are namespace labels.

### Match flow and objectives

`Game::SeqMgrWorld` (146), `Game::SeqMgrMission` (104),
`Game::SeqPlazaVender` (123), `Game::SeqPlazaAmiibo` (99),
`Game::PageHandlerVersus` (113), `Game::PageHandlerPlaza` (86),
`Game::PageHandlerMission` (84), `Game::PageHandlerCoop` (81),
`Game::Gachihoko` (107, Tower Control), `Game::InkRail` / `InkRailVersus`
(90 / 93), `Game::VictoryLift` (78), `Game::BulletMgr` (115).

### Framework layers

`Lp::Sys` (4,676), `Lp::UI` (3,282), `Lp::Utl` (1,902), `Lp::Net` (812),
`Game::Utl` (426), `Cmn` (4,447), `gsys` (2,099).

### Third-party middleware

| Component | Functions | Portable |
|---|---:|---|
| `xlink2` (audio/effect linking) | 1,075 | Yes, but proprietary-adjacent |
| `sead` (Nintendo C++ library) | 4,022 | Community reimplementation exists |
| `agl` (Nintendo graphics) | 2,852 | Reimplement |
| libcurl | 24 | Drop-in |
| wslay (WebSocket) | 53 | Drop-in |
| zlib | 49 | Drop-in |
| libc++ | 292 | Drop-in |

---

## 3. Offline-only scope

**This project targets offline play.** That decision removes the single largest
unportable component and is reflected throughout this document.

Measured against the 113,150 functions in `main`:

| Bucket | Functions | Share |
|---|---:|---:|
| **Online-only — stub, replace, or drop** | **15,485** | **13.7%** |
| Platform APIs — reimplement on PC | 4,070 | 3.6% |
| Engine / middleware (`sead`, `agl`, `xlink2`) | 8,629 | 7.6% |
| Framework / UI (`Lp`, `Cui`, `eui`, `aal`, `gsys`, `Cmn`) | 21,701 | 19.2% |
| Offline gameplay | 6,454 | 5.7% |
| Unattributed by symbol prefix | 56,811 | 50.2% |

The 13.7% matches the earlier `nex` + `pia` estimate and is now bounded by the
full online surface.

> **Caveat.** The 50.2% "unattributed" bucket is a limitation of symbol-prefix
> attribution, **not** a measure of unknown code. Many entries are local symbols,
> operators and thunks whose namespace the prefix rule cannot recover. It must be
> resolved before this scoping can be treated as precise.

### What gets cut

| Surface | Functions |
|---|---:|
| `nn::nex` — online service | 6,815 |
| `nn::pia` — P2P session layer | 4,687 |
| `Lp::Net` — game network layer | 812 |
| `Lobby` — online lobby | 792 |
| `Cnet` — network transport | 590 |
| `Match` — matchmaking | 555 |
| `Shop` — online shop | 509 |
| `Game::PageHandlerVersus` — versus match UI | 113 |
| `Game::PageHandlerCoop` — Salmon Run match UI | 81 |
| `Game::PlayerNetControl` — network sync | 78 |
| `Game::SeqMgr*Versus/Coop` — online match sequences | 74 |
| `Game::MissilePositionOnline` | 68 |
| `nn::socket` | 62 |
| `nn::ldn` — local wireless | 50 |
| `nn::web`, `nn::account`, `nn::friends` | 128 |

### Key architectural advantage: dummy implementations already exist

The binary already ships **offline simulation paths for networked systems**:

```
DummyMatch            18
DummyLocalMatch       17
LobbyForShow          18
LobbyForShow / Show    —   offline lobby presentation
Boot                  19
```

`DummyMatch` and `DummyLocalMatch` strongly suggest the game already has a
local/offline match harness alongside the networked one, and `LobbyForShow`
implies lobby UI that renders without a live service. **These are the seam to
build on** — an offline port may be able to drive the dummy path directly rather
than inventing a replacement. Confirming this is the highest-value early research
task for the offline goal.

### What must keep working

| Surface | Functions | Contents |
|---|---:|---|
| `Game::SeqMgrMission` | 104 | single-player mission sequence (Octo Canyon) |
| `Game::PageHandlerMission` | 84 | mission UI |
| `Game::SeqMgrWorld` | 146 | world/hub sequence |
| `Game::PageHandlerPlaza` | 86 | hub plaza UI |
| `Game::Player` + `PlayerInkAction` + `PlayerEffect` | 838 | the player and ink mechanics |
| `Game::BulletMgr` | 115 | projectiles |
| `Game::Enemy*` | 40+ classes | enemy AI (single-player and Salmon Run) |
| `Game::Utl` | 426 | gameplay utilities |
| `MiniGame` | 184 | local minigames |
| `Game::DbgSetting` | 120 | options/debug |

### Content implications

- **Single-player (Octo Canyon) is fully offline** — no redesign needed.
- **Salmon Run and Turf War / Ranked are server-gated in the retail game.** With
  the online layer removed they must be driven either through the `Dummy*` paths
  or through bots and local play. Local Salmon Run is plausible; large-scale Turf
  War is a design problem, not a porting problem.
- Amiibo (`nn::nfp`, 40) has no PC equivalent and needs a data-file substitute.
- `nn::bcat` (36) delivered content in the background; with no service, formerly
  delivered content must be shipped or omitted.

### Revised sequencing for offline

Phase 5 (online) from the original plan is **deleted**. The order becomes:

1. **Phase 0 — Harness.** Extraction and analysis pipeline.
2. **Phase 1 — Platform layer.** `nn::gfx`/`g3d` → Vulkan, `hid` → SDL,
   `audio` → miniaudio, `fs` → std::filesystem, `font` → FreeType.
3. **Phase 2 — Engine.** `sead`, then `agl`, then `xlink2`.
4. **Phase 3 — Framework.** `Lp::Sys`, `Lp::Utl`, `Lp::UI`, `gsys`, `Cmn`.
5. **Phase 4 — Offline gameplay.** `Game::Player` + `PlayerInkAction` +
   `BulletMgr`, then single-player via `SeqMgrMission` / `PageHandlerMission`.
6. **Phase 5 — Local multiplayer.** Drive `DummyMatch` / `DummyLocalMatch`.

Removing online also removes the need for a new backend service, which was
previously the largest single unknown in the project.

---

## 4. Dependency order

A port cannot be built in the order the subsystems appear above. It must be built
bottom-up, because nothing above can run until the layer below produces frames,
sound and input.

### Phase 0 — Harness (no game code)

- Reproducible extraction and analysis pipeline (already in `tools/`).
- A decompiler workspace that survives the analysis stall documented in the
  [README](README.md#limitations).
- Decide the language and toolchain for reimplemented code.

### Phase 1 — Platform layer (hardest, unavoidable)

Replace the `nn::` platform surface. Each is a mapping problem, not a research
problem:

| Nintendo | PC equivalent |
|---|---|
| `nn::gfx`, `nn::g3d` (NVN on Switch) | Vulkan (closest to NVN) |
| `nn::ui2d`, `nn::atk` | Own retained-mode UI, or Dear ImGui for tooling |
| `nn::audio` | miniaudio or OpenAL |
| `nn::hid` | SDL2/SDL3 |
| `nn::fs` | std::filesystem |
| `nn::font` | FreeType + HarfBuzz |
| `nn::os`, threads, events | OS primitives |

### Phase 2 — Engine layer

`sead` (allocation, task graph, strings, paths, math — note `sead::CalculateTask`,
the frame calculate/draw graph) then `agl` (rendering), then `xlink2` (audio
effects).

`agl` is where the Switch-specific rendering assumptions concentrate. Expect this
to be the single largest reimplementation task after the platform layer.

### Phase 3 — Game framework

`Lp::Sys`, `Lp::Utl`, `Lp::UI`, then `gsys`, `Cmn`.

### Phase 4 — Gameplay

`Game::Player` + `Game::PlayerInkAction` + `Game::BulletMgr` first — the ink system
is the mechanical core. Then `Game::Cmp` (versus), then `Game::Coop` (Salmon Run).

### Phase 5 — Online (replacement, not port)

Redesign against a new backend:

- Replace `nn::nex` matchmaking/rankings with your own service.
- Replace `nn::pia` P2P with a rollback-friendly transport, or Steam networking.
- Replace `nn::account` / `nn::friends` with platform identity.
- `nn::nfp` (Amiibo) has no PC equivalent — substitute a data file.

**Recommendation: cut online from the first milestone.** Build offline play
(training range, single-player Octo Canyon, local Salmon Run) first. It removes
10% of the codebase from v0.1 and the entire remainder of the game still works.

---

## 5. Realistic sequencing

1. **Do not start with `main`.** Start with `subsdk1` (66 KB) or `rtld` (13 KB).
   The objective is to prove the pipeline end-to-end on something finishable.
2. **Then `sdk` (2,962 KB).** Large enough to be representative, small enough to
   complete. Shared runtime lives here.
3. **Then offline `main`**, with online stubbed.
4. **Then online**, on a new backend.

## 6. Legal and distribution

Practical constraints that shape architecture:

- The port must not ship Nintendo's assets, code, or keys.
- A port that requires the user's own dumped copy for assets is the established,
  lower-risk pattern (Ship of Harkinian, SM64 port).
- A clean-room reimplementation is cleaner than distributing reconstructed
  original source.
- This repository contains no assets, code, or keys, and should stay that way —
  see [`.gitignore`](.gitignore).

## 7. Bottom line

**Scale.** For calibration: the Super Mario 64 decompilation — roughly 10 MB of
MIPS, about 300k lines of C — took a distributed team *years* before its PC port
was possible. Splatoon 2 is **23 MB of AArch64 with 113,150 functions**. The
offline-only decision removes the 13.7% that could not be ported at all, but it
does not change the scale of the remainder: this is still a multi-year,
multi-person undertaking. Any plan that claims otherwise is wrong.

**What the offline decision bought:**

- Roughly 15,485 functions removed from scope, including the entire unportable
  online stack.
- **No new backend service to build** — previously the largest single unknown.
- A plausible existing seam: `DummyMatch` / `DummyLocalMatch` / `LobbyForShow`
  suggest offline simulation paths are already present in the binary.

**What is genuinely favourable here:**

- The binary is **not stripped** — 113,150 real function names, including
  gameplay systems named in the clear (`PlayerInkAction::shotBullet_B`).
- The engine stack is understood and has public prior art (`sead`).
- The platform mappings are well-trodden; nothing requires new research.
- Single-player Octo Canyon is already offline and needs no redesign.

**What is genuinely unfavourable:**

- `agl` + `nn::gfx` rendering reimplementation is very large.
- 50.2% of functions are unattributed by symbol prefix and need proper
  classification before scope is final.
- Retail Salmon Run and Turf War are server-gated; driving them offline is a
  design problem, not a translation problem.
- No prior decompilation of this title exists to build on.

**Highest-value next steps, in order:**

1. Confirm the `DummyMatch` / `DummyLocalMatch` path can drive a match without a
   live service — this decides whether offline multiplayer is cheap or expensive.
2. Resolve the 50.2% unattributed bucket so the scope numbers become trustworthy.
3. Prove the whole pipeline on `subsdk1`, then `sdk`. Finishing a small module
   teaches more than starting a large one.
