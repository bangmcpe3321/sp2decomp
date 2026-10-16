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

## 3. Dependency order

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

## 4. Realistic sequencing

1. **Do not start with `main`.** Start with `subsdk1` (66 KB) or `rtld` (13 KB).
   The objective is to prove the pipeline end-to-end on something finishable.
2. **Then `sdk` (2,962 KB).** Large enough to be representative, small enough to
   complete. Shared runtime lives here.
3. **Then offline `main`**, with online stubbed.
4. **Then online**, on a new backend.

## 5. Legal and distribution

Practical constraints that shape architecture:

- The port must not ship Nintendo's assets, code, or keys.
- A port that requires the user's own dumped copy for assets is the established,
  lower-risk pattern (Ship of Harkinian, SM64 port).
- A clean-room reimplementation is cleaner than distributing reconstructed
  original source.
- This repository contains no assets, code, or keys, and should stay that way —
  see [`.gitignore`](.gitignore).

## 6. Bottom line

**Scale.** For calibration: the Super Mario 64 decompilation — roughly 10 MB of
MIPS, about 300k lines of C — took a distributed team *years* before its PC port
was possible. Splatoon 2 is **23 MB of AArch64 with 113,150 functions**, plus a
full online stack that cannot be ported at all.

This is a multi-year, multi-person undertaking. Any plan that claims otherwise is
wrong.

**What is genuinely favourable here:**

- The binary is **not stripped** — 113,150 real function names, including
  gameplay systems named in the clear (`PlayerInkAction::shotBullet_B`).
- The engine stack is understood and has public prior art (`sead`).
- The platform mappings are well-trodden; nothing requires new research.

**What is genuinely unfavourable:**

- 10% of the code is an unportable online stack.
- `agl` + `nn::gfx` rendering reimplementation is very large.
- No prior decompilation of this title exists to build on.

**Highest-value next step:** prove the whole pipeline on `subsdk1`, then `sdk`.
Finishing a small module teaches more than starting a large one.
