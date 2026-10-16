# The NVN subset the boot path actually reaches

`GRAPHICS_NVN.md` and `HEAP_INTERFACE.md`'s sibling documents established that NVN is **453
functions**, resolved by name in `nvnLoadCProcs` (`0x7100ddd6e4`). This document answers the
question that makes those 453 tractable: **which of them does the graphics bring-up path
actually touch?**

> **CORRECTED — the 30 is a LOWER BOUND, not the whole bring-up set.** A fourth bring-up body
> was found after this document was written:
> `nn::gfx::detail::DeviceImpl<4,8>::Initialize` (`0x710135d8d8`, 192 bytes) reaches
> `nvnDeviceBuilderSetDefaults`, `nvnDeviceBuilderSetFlags` and **`nvnDeviceInitialize`** — none
> of which are in the 30. So the bring-up set is **at least 33**. The method below (counting
> referenced globals in decompiled bodies) was sound; the **body list was incomplete**, and this
> document did not say so clearly enough. See
> [DEVICE_IMPL_INITIALIZE.md](DEVICE_IMPL_INITIALIZE.md) §3.

**Answer: 30 of 453 — 6.6% — from the three bodies scanned below (see the correction above).**
And the untouched 93.4% is concentrated in exactly one place:
drawing.

---

## 1. Method

NVN is not called through a table pointer in the port's sense — the binary calls resolved
functions through named globals:
`PTR_pfnc_nvnDeviceGetInteger_7102fc8800`, and so on. Counting the **distinct referenced
globals** across the bring-up bodies therefore gives a real reached-set, not an estimate.

Three bodies were scanned, and every name found was cross-checked against the 453-name measured
surface:

| Body | Address | NVN globals referenced |
|---|---|---:|
| `sead::GraphicsNvn::GraphicsNvn` | `0x7100e70d54` | 1 |
| `sead::GraphicsNvn::initializeImpl` | `0x7100e70e1c` | 8 |
| `sead::GameFrameworkNx::initializeGraphicsSystem` | `0x7100e6738c` | 27 |
| **union** | | **30** |

**Zero names were reached that are absent from the 453 surface** — the two independent
extractions agree, which is a useful cross-check on both.

## 2. The 30 functions, in three groups

**Device (5)** — `nvnDeviceBuilderSetDefaults`, `nvnDeviceBuilderSetFlags`,
`nvnDeviceInstallDebugCallback`, `nvnDeviceGetInteger`, `nvnDeviceSetWindowOriginMode`

**Queue (9)** — `nvnQueueBuilderSet{Defaults,Flags,Device,ComputeMemorySize,CommandMemorySize,ControlMemorySize}`,
`nvnQueueBuilderGetQueueMemorySize`, `nvnQueueBuilderSetQueueMemory`, `nvnQueueInitialize`

**Memory (5)** — `nvnMemoryPoolBuilderSet{Defaults,Device,Flags,Storage}`, `nvnMemoryPoolInitialize`

**Buffer (5)** — `nvnBufferBuilderSet{Device,Defaults,Storage}`, `nvnBufferInitialize`, `nvnBufferMap`

**Command (3)** — `nvnCommandBufferInitialize`, `nvnCommandBufferSetMemoryCallback`,
`nvnCommandBufferSetMemoryCallbackData`

**Pools (3)** — `nvnSamplerPoolInitialize`, `nvnTexturePoolInitialize`, `nvnSyncInitialize`

That is a **resource-creation API**: build a device, build a queue, create memory pools, create
a buffer, create a command buffer, initialise the sampler/texture pools and a sync object. Every
one is a `Builder`/`Initialize` pair — the shape of setup, not of use.

## 3. What is NOT reached — and this is the important half

| Object | Reached / Total | |
|---|---:|---|
| Command | 3 / 130 | only the command buffer's creation, none of its recording |
| Texture | 1 / 90 | only the pool's creation, no texture creation |
| Sampler | 1 / 45 | only the pool's creation |
| **Multisample** | **0 / 23** | not touched |
| **Window** | **0 / 16** | not touched |
| **Blend** | **0 / 15** | not touched |
| **Depth** | **0 / 13** | not touched |
| **Vertex** | **0 / 10** | not touched |
| **Polygon** | **0 / 9** | not touched |
| **Color** | **0 / 7** | not touched |
| **Program** | **0 / 5** | not touched |
| **Channel** | **0 / 3** | not touched |
| Device | 5 / 25 | |
| Queue | 9 / 24 | |
| Memory | 5 / 17 | |
| Buffer | 5 / 17 | |
| Sync | 1 / 4 | |

**Every single rendering-state and drawing function is untouched.** No blend, no depth, no
vertex, no polygon, no color, no program, no texture creation, and 127 of 130 command functions.
The bring-up path allocates and initialises; it does not draw.

## 4. Why this is the useful result

It splits the graphics work into two problems with **very different sizes and very different
justifications**:

**Bring-up — 30 functions, all resource creation.** Bounded, enumerated, and each one is an
`Initialize` whose contract is visible at its call site. This is what "get a frame on screen
eventually" needs *first*, and it is the same order of magnitude as the `nn::vi` layer (6
functions) and the heap layer, both of which are now done and tested.

**Drawing — 423 functions, all of rendering.** Unavoidable for actual gameplay and **not
required to reach the point where the engine has created its device, queue and command buffer**
— which is what "boot to menu" exercises before a single triangle is submitted.

**So the honest reading is that boot-to-menu does not need most of NVN.** It needs the 30. Whether
the *menu* then draws is a separate question that this scan cannot answer — the menu's rendering
lives in `agl`/`g3d`/`nn::ui2d`, not in the bring-up bodies scanned here, and those were not
traced.

## 5. Limits — stated plainly

- **Only three bodies were scanned.** NVN calls made later, from `agl` (2,852 functions),
  `nn::g3d` (292), `nn::ui2d`, or the render loop, are NOT counted. The 30 is the **bring-up**
  subset, not "all NVN the game ever calls". A menu that draws will use more.
- **Indirect dispatch is invisible here.** The bring-up bodies contain indirect call sites
  (`initializeGraphicsSystem` has 46), and any NVN function reached through one is missed. This
  is the same limitation recorded for the boot root's 10 indirect sites.
- **The scan is by referenced global, not by executed path.** A global referenced in a branch
  that does not run at bring-up still counts. The true executed set is likely **smaller**.
- **`GraphicsNvn::GraphicsNvn` showed only 1 NVN reference** (`nvnDeviceSetWindowOriginMode`),
  so the constructor is almost entirely field initialisation and three `CriticalSection`
  constructions — consistent with its 192-byte body.
- **`nn::gfx` sits between `sead::GraphicsNvn` and NVN.** `initializeImpl` allocates a
  `nn::gfx::detail::DeviceImpl<ApiVariation<ApiType<4>, ApiVersion<8>>>` of **0x3018 bytes** and
  calls `nn::gfx::detail::Nvn::GetDeviceFeature`. So the 30 NVN functions are reached *through*
  `nn::gfx`, and **`nn::gfx`'s own 289 functions are an additional, unscanned layer.**
- **No code was ported in this pass.** The boot runner still stops at step 11.
