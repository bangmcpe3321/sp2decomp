# sp2decomp

**English** · [Tiếng Việt](README_vi.md)

Reverse-engineering research notes and tooling for the Nintendo Switch executable
`main` of **Splatoon 2** (USA), specifically the retail build whose ExeFS lives in
the `Splatoon 2 USA.xci` dump.

This repository documents what was established about the module's **structure,
architecture and subsystem layout**, together with the scripts used to establish
it. It is a research log, not a finished decompilation.

> **Porting to PC?** See **[PORTING.md](PORTING.md)** for scope, **[BOOT_MILESTONE.md](BOOT_MILESTONE.md)** for the narrowed target, **[BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md)** for the decoded startup chain, **[SEAD_COVERAGE.md](SEAD_COVERAGE.md)** for what the existing sead decompilation covers, **[GRAPHICS_NVN.md](GRAPHICS_NVN.md)** for how NVN dispatch makes the GPU layer tractable, **[NNWARE_COVERAGE.md](NNWARE_COVERAGE.md)** for NintendoWare (`g3d`/`ui2d`/`atk`/`vfx`/`font`) header coverage, **[AGL_COVERAGE.md](AGL_COVERAGE.md)** for `agl` graphics/lighting/AAMP, **[ECOSYSTEM.md](ECOSYSTEM.md)** for a complete survey of all 16 `open-ead` repositories, **[VERIFICATION.md](VERIFICATION.md)** for layout verification against the binary, **[PORT_WORKLIST.md](PORT_WORKLIST.md)** for the concrete boot implementation worklist, **[VTABLE_VERIFICATION.md](VTABLE_VERIFICATION.md)** for virtual-order verification and a header omission it uncovered, **[DECOMPILATION_UNBLOCKED.md](DECOMPILATION_UNBLOCKED.md)** for the WSL route that makes a real decompiler usable, **[DECOMPILED_BODIES.md](DECOMPILED_BODIES.md)** for the first decompiler-verified function bodies from `main`, **[PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md)** for the observed ABI signatures of the 51 platform functions, **[ENGINE_REFERENCE.md](ENGINE_REFERENCE.md)** for the 126 boot-closure engine functions, and **[SDK_ANALYSIS.md](SDK_ANALYSIS.md)** with **[SDK_REFERENCE.md](SDK_REFERENCE.md)** for the `sdk` module analysis, and **[PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md)** with **[PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md)** for where the platform layer actually lives and the call-site contracts the port must satisfy. Full 109-subsystem breakdown in [subsystem-map.txt](subsystem-map.txt).

---

## Status

| Area | State |
|---|---|
| Target identification | Done |
| Container/format handling | Done |
| Memory map | Done |
| Function/symbol inventory | Done (113,150 functions) |
| Subsystem decomposition | Done (55 namespaces) |
| Engine & middleware identification | Done |
| **Function-body decompilation** | **Not done** — see [Limitations](#limitations) |

Everything below is from static analysis of the shipped binary. No behaviour is
claimed for any function, because no function body was decompiled. Where a
conclusion is an inference rather than a direct observation, it is labelled.

---

## Target

| Property | Value |
|---|---|
| Module | `exefs/main` (23,717,627 bytes) |
| Container | **NSO0** (not an ELF on disk) |
| Architecture | AArch64, 64-bit little-endian |
| Title ID | `01003bc0000a0000` |
| ACID | `Is Retail: 1` |
| Build ID | `F18FF3CFCBAD0884D72ABBEB6C540D6B00000000000000000000000000000000` |
| Main thread stack | `0x100000` |
| Main thread priority | 44 (ACID allowed range 28–59) |
| ExeFS siblings | `main.npdm`, `rtld`, `sdk`, `subsdk0`–`subsdk3` |
| Image base (as loaded) | `0x7100000000` |

### Confirmation that this is Splatoon 2

Resource names recovered from `.rodata` are conclusive:

```
WeaponInfo_%s.byml      GearInfo_%s.byml        UdemaeGrade.byml
TankInfo.byml           SkillInfo.byml          BrandInfo.byml
BottomInfo.byml         HairInfo.byml           PaintResTex.byml
PlayerRank.byml         EnemyInfo.byml          DamageRateInfo.byml
MapInfo.byml            NpcInfo.byml            ActorDb.byml
WorldHotaruTalkInfo.byml                        WorldHotaruFreeTalkInfo.byml
```

The map that shipped as **MakoMart** carries the internal codename **Blitz** —
`Map/Blitz.mutre.szs` — independently corroborated by a `BlitzViewer` symbol
namespace in the binary.

---

## NSO container layout

`main` is an NSO0 container: the sections are LZ4-compressed and packed
back-to-back on disk, but each section's *memory* offset is page-aligned. That
gap is the single most important detail when reconstructing the image.

| Section | Memory range | Size |
|---|---|---|
| `.text` | `0x0000000` – `0x1415068` | 21,045,608 |
| `.rodata` | `0x1416000` – `0x2d624b3` | 26,526,899 |
| `.rwdata` | `0x2d63000` – `0x2fdb1b0` | 2,589,104 |
| `.bss` | `0x2fdc000` – `0x3699e50` | 7,065,504 |

### MOD0

The module header `MOD0` sits at **`.text+0x8`**. Per the
[SwitchBrew MOD specification](https://switchbrew.org/wiki/MOD) it is a
replacement for `PT_DYNAMIC` and **contains no entry point**:

| Offset | Field | This build |
|---|---|---|
| 0x0 | Signature `"MOD0"` | `4d4f4430` |
| 0x4 | `DynamicOffset` | `0x2f9a468` |
| 0x8 | `BssStartOffset` | `0x2fdbff8` |
| 0xC | `BssEndOffset` | `0x3698f98` |
| 0x10 | `ExceptionInfoStartOffset` | `0x2921ec0` |
| 0x14 | `ExceptionInfoEndOffset` | `0x2a00eac` |
| 0x18 | `ModuleOffset` (runtime-generated, ≈ `.bss` base) | `0x2fdbff8` |

> **Correction.** An earlier revision of this README derived an "entry VA" from
> `entryTarget + entryOffset` using offsets `0x10`/`0x14`. Those fields are
> exception-handling metadata. There is no entry point in MOD0; the module is
> entered through the dynamic section. See
> [BOOT_MILESTONE.md](BOOT_MILESTONE.md) for the real boot chain.

The dynamic section (VA `0x2f9a470`) carries the boot-relevant pointers:

```
DT_INIT          = 0x24
DT_FINI          = 0x160
DT_INIT_ARRAY    = 0x2fd7f90      1604 static constructors
DT_INIT_ARRAYSZ  = 0x3220
```

### A note on a NSO header field

The 32-bit field at NSO header offset `0x40` is **reserved**. It is not a `.bss`
address, and it must not be read as one — in this container it holds the `.data`
section's compressed size. Treating it as an address produces a `.bss` that
overlaps `.rwdata`. `.bss` follows the last initialised section in memory.

---

## Architecture observations

`.text` holds 5,264,410 instructions. Instruction census:

| Encoding | Count | Meaning |
|---|---|---|
| `STP x29,x30,[sp,#-N]!` | 7,316 | function prologues (lower bound on functions) |
| `STP x29,x30,[sp,#N]` | 60,453 | saved-frame stores |
| `B` (`0x14......`) | 114,236 | unconditional branches |
| `PACIBSP` / `AUTIBSP` | **0** | no pointer authentication |
| `BTI c` | **0** | no branch target identification |

The first instruction at VA `0x100` is `stp x29,x30,[sp,#-0x10]!`, a textbook
prologue confirming `.text` begins with code.

> **Inference.** Pointer authentication and BTI are the mitigations introduced by
> Nintendo's later SDKs. Their complete absence is consistent with a build from
> the 2017 launch-era toolchain. This is an inference from instruction absence,
> not a build-string observation.

---

## Memory map

As reconstructed by an analysis load of the module (18 blocks):

```
.text          7100000000   21,045,608  r-x
.plt           7101412168       12,032  r-x
.rodata        7101416000           72  r--
.rela.dyn      7101416048    6,121,056  r--   dynamic relocations
.rela.plt      71019ec6a8       18,048  r--
.hash          71019f0d28    1,110,904  r--
.gnu.hash      7101b000a0    1,238,848  r--
.dynsym        7101c2e7e0    3,518,952  r--   148,138 symbols
.dynstr        7101f899c8    8,828,579  r--   8.8 MB of names
.rodata.1      71027f506b    5,690,440  r--
.data          7102d63000    2,323,568  rw-
.dynamic       7102f9a470          400  rw-
.data.1        7102f9a600           80  rw-
.got.plt       7102f9a650        6,040  rw-
.got           7102f9bde8      246,184  rw-
.init_array    7102fd7f90       12,832  rw-
.bss           7102fdc000    7,065,504  rw-
```

**The module is not stripped.** The embedded ELF dynamic symbol table survives:
3.5 MB of `.dynsym` and 8.8 MB of `.dynstr`. This is the single most valuable
property of this target — analysis starts from 113,150 real function names rather
than `FUN_xxxxxxxx`.

---

## Subsystem decomposition

113,150 functions across 55 top-level namespaces.

| Namespace | Functions | Interpretation |
|---|---:|---|
| `Game` | 28,439 | core gameplay |
| `nn` | 15,953 | NintendoSDK |
| `Lp` | 10,672 | game framework layer |
| `Cmn` | 4,447 | shared game code |
| `sead` | 4,022 | first-party C++ library |
| `agl` | 2,852 | graphics |
| `aal` | 2,264 | SDK applet/UI |
| `gsys` | 2,099 | game system layer |
| `Cui` | 1,815 | SDK UI components |
| `eui` | 803 | SDK extended UI |
| `Lobby` | 792 | online lobby |
| `enl` | 717 | — |
| `Cnet` | 590 | network |
| `Match` | 555 | matchmaking |
| `xlink2` | 548 | audio/effect middleware |
| `Shop` | 509 | in-game shop |
| `pead` | 490 | sound |
| `UICheck` | 413 | UI validation |
| `MiniGame` | 184 | — |
| `PlayerMake` | 132 | character creation |
| `Cstm` | 121 | customization |
| `DbgSetting` | 120 | debug settings |
| `PlayerViewer` | 86 | debug viewer |

Plus 33,692 `_Z`-mangled functions (operators, thunks, templates) and 327 plain-C
functions.

### Internal tooling present in the retail build

Debug and test harnesses survive in the shipping binary:

```
DbgSetting 120   PlayerViewer 86   UdgwTest 66      NisdTest 33
EnemyObjViewer 28   ScheduleViewer 27   YmgcTest 25   JintTest 21
GearUnsetupTest 20  BlitzViewer 9   GndColTest 7      MrmtTest 3
```

### Engine and middleware

| Component | Evidence |
|---|---|
| **sead** | `sead::CalculateTask` (calculate/draw task graph), `ExpHeap`, `CriticalSection`, `SafeStringBase`, `Matrix34f`, `TreeNode`, `Path::getExt` |
| **agl** | 2,852 functions, 6,024 `.rodata` hits |
| **Radiance** | `Etc/BRDFFitting/ggx_ltc.byml` (GGX LTC BRDF fitting) |
| **NintendoWare / Nw4f** | 35 `.rodata` hits |
| `nn::nex` | Nintendo networking |
| `nn::bcat` | DeliveryCache (background content delivery) |
| `nn::aoc` | add-on content |
| `nn::nfp` | Amiibo (`Cmn::Def::isSupportedAmiibo`) |
| libcurl | 24 functions / 36 symbols — HTTP |
| **wslay** | 53 functions — WebSocket |
| zlib | 49 functions / 63 symbols |
| libc++ (`std::__1`) | 292 functions |
| `__nnmusl` | Nintendo's musl-derived libc |

The libcurl + wslay + `Cnet`/`Match`/`Lobby`/`Shop` combination is consistent with
a live-service architecture.

---

## Content pipeline

Resource paths recovered from `.rodata`:

```
Model/%s.Nin_NX_NVN.szs      NX NVN (NVIDIA) model container
Map/%s.szs                   Map/Blitz.mutre.szs
Env/%s.szs                   Etc/LightCtrl/%s.byml
Nin_NX_NVN.release.szs       Etc/BRDFFitting/ggx_ltc.byml
HapTexture.bfres             PanelTexture.bfres        IconTexture.bfres
```

One string leaks the internal build toolchain:

```
File = %%AGL_ROOT%%/tools/bat/convertTempTexture.bat, NoWindow = True,
WindowStyle = Hidden, WaitEnd = True, Arg = %%AGL_ROOT%%/tools/temporary/temp_proj_light.bfres
```

`.mutre` is a distinct map variant format from `.szs`.

---

## Toolchain

### Prerequisites

- **Ghidra 12.1.2** (the extension below matches this version)
- **JDK 21+** — `JAVA_HOME` must point at the JDK root
- **[SwitchLoader](https://github.com/Adubbz/Ghidra-Switch-Loader)** — Ghidra
  loader for Nintendo Switch formats. Provides both NSO loading and the ELF
  `.dynsym` recovery used here.
- **hactool** — to extract the ExeFS from the XCI and decompress NSO sections
- **Node.js 18+** for the scripts in `tools/`
- **Python 3** via Ghidra's PyGhidra if you want the scripted inventory export

### Environment

```powershell
$env:GHIDRA_INSTALL_DIR = 'C:\path\to\ghidra_12.1.2_PUBLIC'
$env:JAVA_HOME          = 'C:\Program Files\Java\jdk-21.0.12'
```

Install SwitchLoader through Ghidra's *File → Install Extensions…*, then restart
Ghidra. Do not place the same extension in both the Ghidra install and the user
extension directory — Ghidra aborts with
`Multiple modules collided with same name`.

### Extract the target

```powershell
hactool -t xci --exefsdir=exefs "Splatoon 2 USA.xci"
hactool -t nso exefs/main --uncompressed=main.decompressed
```

Keys are required for the XCI but **are not part of this repository** and must
never be committed.

---

## Reproduction

### 1. Export the symbol inventory

PyGhidra must be started explicitly, otherwise Python scripts fail with
*"Ghidra was not started with PyGhidra"*:

```powershell
& "$env:GHIDRA_INSTALL_DIR\support\pyghidraRun.bat" -H `
    "<project-dir>" Sp2 `
    -import "exefs\main" `
    -noanalysis `
    -scriptPath "<repo>\tools\ghidra" `
    -postScript ExportInventory.py "<repo>\inventory.txt" `
    -deleteProject
```

Expected:

```
ExportInventory wrote inventory.txt (functions=113150 symbols=148138 strings=146621)
```

An import-only pass (`-noanalysis`) is deliberate: the ELF symbol table gives the
function names without paying for analysis. Function *sizes* from this pass are
placeholders and must not be interpreted as code sizes.

### 2. Analyse the inventory

```bash
node tools/static/analyze-inventory.mjs inventory.txt
node tools/static/namespace-report.mjs   inventory.txt
node tools/static/subsystem-map.mjs      inventory.txt subsystem-map.txt
node tools/static/symbol-census.mjs      main.decompressed
node tools/static/check-prologue.mjs     main.decompressed
```

### 3. Container tooling

`tools/nso/nso2elf.mjs` rebuilds a loadable ELF64 from a decompressed NSO. It
exists for analysis engines without NSO support; Ghidra with SwitchLoader does
not need it.

```bash
node tools/nso/nso2elf.mjs main.decompressed main.elf
node tools/nso/validate-elf.mjs main.elf      # structural self-check
node tools/nso/mod0-exports.mjs main.decompressed
```

`validate-elf.mjs` checks the ELF header, the `p_vaddr ≡ p_offset (mod align)`
segment rule, segment/section overlap, and `.bss` placement. It was written after
four real layout bugs were found by hand.

---

## Limitations

These are genuine, unresolved gaps. Do not read the tables above as a complete
account of the binary.

1. **No function bodies were decompiled.** The inventory is symbol-level only.
   Consequently **no claim about runtime behaviour is made anywhere in this
   repository.**

2. **Full auto-analysis does not complete.** Ghidra's headless analyzer wedges
   reproducibly. 22 functions recurse through computed jumps whose targets fall
   outside the image; the log then advances only ~99 bytes per 3 minutes:

   ```
   WARN Decompiling 710090ab30: Unable to read bytes at ram:23504cd0fec
   ```

   This is the decompiler following a computed jump, not a defect in the
   reconstructed image. Running analysis in the **Ghidra GUI**, which can be
   driven incrementally, is the recommended way past it.

3. **REA cannot drive this target on Windows.** The REA 6.5.0 Ghidra adapter
   admits only x86/x86-64 PE and explicitly selected raw 6502 images:

   > "Windows Ghidra P0 accepts native x86 and x86-64 PE applications and DLLs,
   > and explicitly selected raw 6502 images"

   Both an ELF and a headerless `--architecture arm64` attempt are rejected with
   `target_format_unsupported`. Hopper is macOS-only and IDA was unregistered.
   The Ghidra installation itself does ship AArch64, so this is an adapter
   restriction, not a missing processor module.

4. **MOD0 export-table parsing is unresolved.** Two candidate field layouts gave
   contradictory results (one negative offset, one past EOF), so no function
   names in this repository are derived from the MOD0 table. The names come from
   the ELF `.dynsym` via SwitchLoader.

5. **Namespace attribution is by symbol prefix only.** A namespace label
   describes where a symbol is declared, not what the code does.

---

## Legal

This repository contains **no game code, no game data, and no cryptographic
keys** — only analysis notes and original tooling. Splatoon 2 and Nintendo
Switch are trademarks of Nintendo. No affiliation or endorsement is claimed.
Intended for interoperability research and preservation; use your own legally
obtained copy of the game.

## License

Original tooling and notes in this repository are released under the MIT License.
See [LICENSE](LICENSE).
