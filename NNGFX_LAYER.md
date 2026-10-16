# What `nn::gfx` is, and the NVN reference scan that did not work

`NVN_BOOT_SUBSET.md` answered which NVN functions the bring-up path reaches (30 of 453) and
closed with the next unknown: **`nn::gfx` sits between `sead::GraphicsNvn` and NVN**, so those
30 calls go *through* a 289-function layer. This document records what that layer is, and — with
equal importance — a measurement attempt that **failed**, so it is not repeated or mistaken for
a result.

---

## 1. The verified entry points

`GraphicsNvn::initializeImpl` (`0x7100e70e1c`, 484 bytes) is where the gfx layer is created:

```c
this_00 = operator_new(0x3018, heap, 8);                       // 0x3018 = 12,312 bytes
nn::gfx::detail::DeviceImpl<nn::gfx::ApiVariation<nn::gfx::ApiType<4>, nn::gfx::ApiVersion<8>>>::DeviceImpl(this_00);
*(this + 0x48) = this_00;
*this_00 = *(this + 0x30);                                     // the NVNdevice
*(*(this + 0x48) + 0x3008) = 1;
uVar2 = nn::gfx::detail::Nvn::GetDeviceFeature(*(this + 0x30));
*(lVar5 + 0x300c) = uVar2;
(**(code **)PTR_pfnc_nvnDeviceGetInteger_7102fc8800)(*(this + 0x30), 0xf, &iStack_24);   // 0xf
(**(code **)puVar1)(*(this + 0x30), 0x10, &local_28);                                     // 0x10
(**(code **)puVar1)(*(this + 0x30), 0x11, &local_34);                                     // 0x11
(**(code **)puVar1)(*(this + 0x30), 0x12, &local_38);                                     // 0x12
```

Two concrete facts fall out:

| Symbol | Address | Body size |
|---|---|---:|
| `nn::gfx::detail::Nvn::GetDeviceFeature(NVNdevice const*)` | `0x7100de0bac` | 660 bytes |
| `nn::gfx::detail::DeviceImpl<ApiVariation<ApiType<4>,ApiVersion<8>>>::DeviceImpl()` | `0x710135d8b8` | **28 bytes** |

**The `DeviceImpl` constructor is 28 bytes** — it is a vtable/field initialiser, not the
initialisation. The `0x3018`-byte object it constructs has an NVNdevice at `+0x0000`, a flag
written at `+0x3008`, and the device-feature bitmask at `+0x300c`. So the real work of bringing
the gfx device up is elsewhere (an `Initialize`-style method reached later), which is the next
thing to trace.

`GetDeviceFeature` is 660 bytes and returns a `uint` bitmask, queried from the NVNdevice. The
four `nvnDeviceGetInteger` calls with selectors `0xf`, `0x10`, `0x11`, `0x12` immediately
afterwards are reads of device limits (max texture size and similar), cached for later use.

## 2. The shape of the layer

From the symbol inventory, `nn::gfx` is **289 functions**. Two components dominate what is
visible by name:

**`nn::gfx::detail::Nvn` — 32 functions, and they are almost all enum translation.** Examples:

```
Nvn::GetImageFormat(ImageFormat)          Nvn::GetAttributeFormat(AttributeFormat)
Nvn::GetImageTarget(ImageDimension)       Nvn::GetDepthFunction(ComparisonFunction)
Nvn::GetStencilOperation(StencilOperation) Nvn::GetStencilFunction(ComparisonFunction)
Nvn::GetBlendEquation(BlendFunction)      Nvn::GetBlendFunction(BlendFactor)
Nvn::GetLogicOperation(LogicOperation)    Nvn::GetFrontFace(FrontFace)
Nvn::GetFillMode(FillMode)                Nvn::GetDrawPrimitive(PrimitiveTopology)
Nvn::GetMinFilter(FilterMode)             Nvn::GetMagFilter(FilterMode)
Nvn::GetWrapMode(TextureAddressMode)      Nvn::GetShaderStage(ShaderStage)
Nvn::GetShaderStageBits(int)              Nvn::GetRComparisonFunction(ComparisonFunction)
```

**Every one of these is a pure `enum -> enum` mapping**, and every one is a *rendering-state*
conversion. They are exactly the functions `NVN_BOOT_SUBSET.md` §3 showed are **not reached at
bring-up** — the reachable set has no blend, depth, stencil, fill-mode or primitive-topology
call in it. So this component is real work, but it belongs to the **drawing** half, not the
bring-up half.

**`DeviceImpl` — 172 symbols.** The `ApiVariation<ApiType<4>, ApiVersion<8>>` specialisation is
one of several; the layer is templated over API type/version, which is why the same logical
class appears many times.

## 3. The measurement that FAILED — recorded so it is not repeated

I tried to answer "which NVN globals does the whole binary reference?" by decoding the binary's
own AArch64 `ADRP+ADD` instruction pairs and matching targets against the 453 global addresses,
**instead of** decompiling 289 functions one at a time (Ghidra's script arguments are
whitespace-split, so a batch address list silently drop all but the first — a limitation already
recorded in this project).

**It did not work.** The sequence of attempts:

1. **ADRP+ADD only → 2,290 hits in a narrow region, but 0 matching any of the 453 globals.**
   The hits were false positives from unrelated data in the scanned address window.
2. Checked whether the globals fell outside the window. They do not all: the 453 globals span
   **178.8 KB** (`0x7102f9ca18` .. `0x7102fc9568`), and **23 fall outside** the initially scanned
   `0x7102fc8000..0x7102fd0000` — including `nvnCommandBufferDrawArrays`,
   `nvnCommandBufferDrawElements`, `nvnPolygonStateSetCullFace` and `nvnBufferGetAddress`. That
   is a genuine correction to the window, and it matters: **draw calls exist outside the
   bring-up region**, consistent with §2.
3. Dumped real instructions at a site whose ADRP page matched `0x7102fc8000`:
   ```
   0x7100d9b4a0  adrp x8, 0x7102fc8000 ; 0xf9400108 (ldr x8,[x8]) ; ...
   ```
   So the access is **ADRP + LDR**, not ADRP + ADD — a wrong assumption on my part.
4. Added `LDR (immediate, 64-bit)` decoding. **Still 0 matches.**

So the residual cause is unresolved. The likely explanations, none of which I confirmed:
the `PTR_pfnc_nvn*` addresses embedded in symbol *names* may not be the addresses the code
computes; the load may go through an additional GOT indirection; or Ghidra's symbol naming uses
a different base than the one I assumed.

**What this means:** the "how much NVN does the binary use in total" question is **not
answered**, and the 27-distinct-globals figure an earlier run printed was an artifact of the
broken scan, not a finding. `NVN_BOOT_SUBSET.md`'s **30** stands, because it came from the
decompiled bodies by a different method (referenced global *names*), not from this scan.

## 4. Limits

- **`nn::gfx`'s NVN subset is NOT established.** Only the two entry points in §1 were
  decompiled. The other 287 functions were not examined.
- **The `DeviceImpl` initialisation proper was not located.** Its constructor is 28 bytes, so
  the real bring-up is in another method, unnamed in this pass.
- **The binary-wide NVN reference count is unknown**, for the reason in §3.
- **No code was ported.** The boot runner still stops at step 11.
