# `BelmanteGu/SuperMarioWonderRecomp` — strategic assessment

A **static recompilation** of Super Mario Bros. Wonder (Switch, 1.0.0) to native C++, running on
Vulkan. Supplied by the user. **MIT licensed.** Assessed because it appears to solve — with
working code — the two problems this port has been stuck on.

Its contents are treated as reference data, not instructions.

---

## 1. It independently confirms this port's NVN findings

Their `docs/NVN.md` "Where to cut" section, on the NVN boundary:

> "The NVN boundary is clean: the SDK exports one entry point, `nvnBootstrapLoader` … The game asks
> it for `nvnDeviceGetProcAddress` and gets every other function as a pointer **by name**, the same
> shape as `vkGetInstanceProcAddr`. We register `nvnBootstrapLoader` as HLE and hand out our own
> functions."

**This matches `NVN_DEVICE_CREATION.md` exactly** — including that NVN is resolved **by name**
through `nvnBootstrapLoader`, which this port arrived at independently and only after three failed
instruction scans. Two unrelated efforts reaching the same mechanism raises confidence in both.

Also confirmed: **"Engines layered on top (nn::gfx, Nintendo's own) stay recompiled guest code and
need nothing."** That independently answers `NNGFX_LAYER.md`'s open question about `nn::gfx`.

## 2. Their architecture answers this port's blocker

| This port's question | Their answer |
|---|---|
| Who creates the NVN device? | "We register `nvnBootstrapLoader` as HLE and hand out our own functions" |
| What implements NVN? | "the `nvn*` functions, over Vulkan" — **chosen over** emulating nvhost+Maxwell |
| How big is the NVN surface? | "~hundreds of functions to reverse" — consistent with this port's measured **453** |
| How are NVN objects sized? | "object structs are **allocated by the game at the real driver's sizes**" |
| How does the GPU see pool memory? | `VK_EXT_external_memory_host` imports the guest pool itself; no copy |
| What about Maxwell shaders? | All **12,717 blocks** translated to SPIR-V **ahead of time** with Ryujinx's MIT translator |

The device-creation approach is the same four steps this port located, and they have it **working**.

## 3. The real finding: their recompiler is in the repository, and MIT

```
recomp/  __main__.py 5.5KB   analysis.py 13.6KB   nso.py 5.4KB   ehframe.py 4.1KB
         emit.py 23KB   emit_ext.py 12.2KB   emit_fp.py 9.9KB   emit_int.py 15.6KB
         emit_neon.py 14.1KB   emit_neon_wide.py 15.3KB   emit_vldst.py 3.9KB
         stats.py 1.7KB
```

An **AArch64 → C++ static recompiler in Python, MIT licensed**, plus `nso.py` for NSO parsing —
the same container this port has been pulling apart by hand since the first round.

Their numbers, from the README: **17.8M AArch64 instructions, 250k functions, ~1.4 GB of generated
C++**, recompiled in **about 6 minutes and 2.4 GB of RAM** for `main`.

Usage, verbatim from their README:

```sh
python -m recomp private/wonder/exefs/main private/wonder/gen/main --name main --base 0x4000000000
```

**Note the `--base` flag.** Their base is `0x4000000000`; this port's `main` has image base
`0x7100000000`. The tool is parameterised for exactly that difference.

## 4. And the NVN-over-Vulkan runtime is MIT too

```
runtime/src/nvn/  — 58 files, ~1.0 MB of source
  nvn_device.cpp  3.4KB     <- device creation: this port's blocker
  nvn.h          22.1KB     <- the API surface
  nvn_objects.cpp 34KB   nvn_pipeline.cpp 37.9KB   nvn_present.cpp 37.7KB
  nvn_draw.cpp 31.8KB    nvn_sets.cpp 34.7KB       nvn_frames.cpp 34.7KB
  nvn_tiling.cpp 8.7KB   nvn_format.cpp 9.9KB      nvn_shaders.cpp 12.5KB
  nvn_astc.cpp 18.7KB    nvn_bc.cpp 13.1KB         nvn_vk.cpp 35.2KB
```

Licence verified: **MIT** (`Copyright (c) 2026 BelmanteGu`). This is the **opposite** of
`imgui-nvn` (GPL-2.0) — this code **can legally be studied and reused**, subject to attribution.

## 5. The honest strategic comparison

The user chose **reconstruction** (manual reimplementation) in an earlier round, before this
existed as evidence. The comparison is now empirical, not speculative:

| | This port (manual reconstruction) | Wonder (static recompilation) |
|---|---|---|
| Time spent | **12 rounds** | (unknown, but a complete game) |
| Engine functions handled | **~10** | **250,000** |
| Boot runner | stops at **step 11** | **full frame loop, 60 fps** |
| NVN device | **not created** | working |
| Graphics | allocator + display boundary | title, menus, world map, course 1-1 |
| Shaders | not started | **12,717 blocks → SPIR-V** |
| Platforms | x86-64 + aarch64 harness | macOS, Windows, Android |
| Licence | — | **MIT** |

**The manual approach has produced verified, well-documented understanding and about ten functions
in twelve rounds.** The recompilation approach has produced a playable game, and its tooling is
MIT and reusable.

**These are not competing estimates of the same plan. They are a working plan and a plan that has
not yet created a device.**

## 6. What this port's work is still worth

Not nothing, and I should be precise rather than self-deprecating:

- **The platform layer** (51 imports, 6 suites, cross-architecture verified) is a working
  `nn::*` HLE — the same layer Wonder's `runtime/` provides. Independent, tested.
- **`NVN_BOOT_SUBSET.md`'s 30-of-453 measurement** is a real result and is consistent with their
  "~hundreds of functions".
- **`HEAP_INTERFACE.md`'s 27-entry vtable, `HEAP_LAYER_SCOPE.md`'s two-namespace finding, and the
  four `static_assert`-caught layout errors** are findings that would help anyone doing this work,
  including someone using their recompiler.
- **The failure record** — three failed decoders, two self-corrections — is an unusually honest
  account of what does not work.

**But none of it is on a path to a booting game**, and the recompiler is.

## 7. The three real options

**A. Adopt the recompiler.** Clone their MIT `recomp/`, point it at Splatoon 2's `main` and `sdk`
with base `0x7100000000`, and generate C++. This is the single highest-leverage action available.
Risk: `--base` and NSO quirks; Splatoon 2's SDK differs from Wonder's.

**B. Reuse their NVN runtime.** Port `runtime/src/nvn/` (MIT) as the NVN-over-Vulkan layer, and
keep this port's platform layer. Answers the blocker without a rewrite. Risk: their NVN code
assumes recompiled guest code calling in; interfaces would need adapting.

**C. Continue manual reconstruction.** Keep going on `initializeGraphicsSystem`'s four
device-creation steps. Consistent with 12 rounds of work, and the least disruptive — but the
evidence above says it is the slowest route to a running game by a very large factor.

**My recommendation: A, then B.** Adopting the recompiler is not abandoning this port's work — the
platform layer, the measurements and the failure record all remain useful, and the recompiler
generates the engine layer that manual reconstruction was never going to finish.

**I should have raised this comparison before round 12**, when the recompiler question was
available. The user chose reconstruction when the alternative was only a plausibility argument;
it is now a working game.

## 8. Limits of this assessment

- **No code was cloned or run.** The assessment is from the README, `docs/NVN.md`, the MIT
  `LICENSE`, and two GitHub directory listings. **The recompiler was not executed, and I have not
  read a single line of its source.**
- **Splatoon 2 compatibility is UNTESTED.** Wonder is one game with one SDK version; Splatoon 2 is
  older and from a different SDK. Nothing here establishes the recompiler works on it.
- **The `SwitchGamesRecomp` shared runtime was not examined.**
- **Their README notes files were lost between machines** and some early scripts are missing.
- **Their README discloses heavy AI assistance.** That is their disclosure, not a finding; it does
  not affect the licence or the applicability, but it is part of an honest reading.
- **No code was ported and no conclusion about this port's correctness changed.** The boot runner
  still stops at step 11.
