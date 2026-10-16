# `nn::gfx::Device`'s public entry points â€” what Path A found

`DEVICE_INIT_CALLER_SEARCH.md` recommended reading `nn::gfx::Device`'s public entry points to
find what calls `DeviceImpl<4,8>::Initialize` (`0x710135d8d8`). This is the result, and it is
**structural rather than a caller**.

---

## 1. There is no `nn::gfx::Device`

Searching the symbol table for `_ZN2nn3gfx6Device` returns **zero results**. The public device
type is **templated**:

```
_ZN2nn3gfx37NvnGetMaxRecommendedScratchMemorySizeINS0_12ApiVariationINS0_7ApiTypeILi4EEENS0_10ApiVersionILi8EEEEEEEmPNS0_7TDeviceIT_EEPKPKNS0_13ResShaderFileEi
_ZN2nn3gfx15TInteroperationINS0_12ApiVariationINS0_7ApiTypeILi4EEENS0_10ApiVersionILi8EEEEEE17ConvertToGfxQueueEPNS0_6TQueueIS7_EEP8NVNqueuePNS0_7TDeviceIS7_EE
_ZN2nn3gfx15TInteroperationINS0_12ApiVariationINS0_7ApiTypeILi4EEENS0_10ApiVersionILi8EEEEEE25ConvertToGfxCommandBufferEPNS0_14TCommandBufferIS7_EEPNS0_7TDeviceIS7_EEP16NVNcommandBuffer
```

The device type is `nn::gfx::TDevice<ApiVariation<ApiType<4>, ApiVersion<8>>>`, and the same
pattern holds for `TQueue<...>` and `TCommandBuffer<...>`. The `nn::gfx` public API is a
**template family parameterised on API type and version**, with the concrete instantiation at
`ApiVariation<ApiType<4>, ApiVersion<8>>` â€” which is the same specialisation `GraphicsNvn::
initializeImpl` allocates (`DeviceImpl<4,8>`, `NNGFX_LAYER.md` Â§1). The pieces agree.

## 2. But `TDevice<4,8>` has no symbols either

Searching for a mangled `_ZN2nn3gfx<len>TDevice` finds **nothing**, and the `Device`-matching
results are all `detail::`:

```
0x7100de0bac  nn::gfx::detail::Nvn::GetDeviceFeature(NVNdevice const*)
0x710135d8d8  nn::gfx::detail::DeviceImpl<...>::Initialize(DeviceInfo const&)
0x710135de1c  NvnGetMaxRecommendedScratchMemorySize<...>(TDevice<...>*, ResShaderFile const* const*, int)
```

**`TDevice` appears only as a parameter type in other functions' signatures, never as a symbol
itself.** That is consistent with `TDevice<ApiVariation<...>>` being a thin **non-virtual
wrapper** â€” the kind whose methods are small enough to be inlined at every call site, leaving no
out-of-line symbol. If so, `TDevice::Initialize` **has no address to find**, and my search for it
was looking for something that does not exist as a symbol.

That would also explain Â§3 of `DEVICE_INIT_CALLER_SEARCH.md`: if the caller is an inlined
wrapper, there is no `BL` to it, which is exactly what that scan found.

## 3. What `initializeImpl` actually does â€” re-read

Returning to the body (`0x7100e70e1c`, 484 bytes), it:

```c
this_00 = operator_new(0x3018, heap, 8);
DeviceImpl<4,8>::DeviceImpl(this_00);      // the 28-byte CONSTRUCTOR, not Initialize
*(this + 0x48) = this_00;
*this_00 = *(this + 0x30);                 // the NVNdevice
*(*(this + 0x48) + 0x3008) = 1;
uVar2 = Nvn::GetDeviceFeature(...);
...
```

**It calls the constructor and never calls `Initialize`.** So `DeviceImpl::Initialize` â€” the
function that actually creates the NVN device â€” is **not on the `initializeImpl` path at all**.
The device must already exist by the time `initializeImpl` runs, which fits the boot order:
`initializeGraphicsSystem` (which calls `nvnLoadCProcs` and `nvnDeviceInitialize` per
`DEVICE_IMPL_INITIALIZE.md`) runs **before** `GameFrameworkNx::initialize` reaches this point.

**So `DeviceImpl::Initialize` is reached from a DIFFERENT device-creation path**, not from
`GraphicsNvn`. Candidates:
- the engine's own `nn::gfx` device set-up, reached from the game rather than from sead;
- an `agl` graphics-device wrapper;
- a path this repository has not touched.

## 4. What Path A established, and what it did not

**Established:**
- The public type is `TDevice<ApiVariation<ApiType<4>, ApiVersion<8>>>`, a **template family**,
  and `TQueue`/`TCommandBuffer` follow the same shape. The API's structure is now known.
- `TDevice` has **no out-of-line symbols**, so `TDevice::Initialize` may be inlined and
  **unfindable by symbol search** â€” a plausible complete explanation for the two failed scans.
- `GraphicsNvn::initializeImpl` calls `DeviceImpl`'s **constructor**, not `Initialize`, so the
  NVN-device-creating function is **off the sead graphics path**.

**NOT established:**
- **The caller of `DeviceImpl::Initialize` is still not located.** Path A narrowed the search
  space and produced a hypothesis (inlined wrapper) but not the answer.
- **`TDevice`'s method surface is unknown** â€” it has no symbols, so the enumeration Path A set
  out to do could not be performed.
- **`UseMiddleWare()`, `Nvn::GetDeviceFeature` and `NvnGetMaxRecommendedScratchMemorySize` were
  not decompiled.**

## 5. The recommended scan was attempted and FAILED

§2's hypothesis is testable: if `TDevice::Initialize` is inlined, find functions that allocate a
**`0x3018`-byte object** — the unmistakable signature of `DeviceImpl<4,8>` creation — by scanning
for the constant.

**The scan found ZERO sites, and I do not trust that result.** My `MOVZ` encoding check was
almost certainly wrong again: this is the **third** hand-written AArch64 decoder in this effort
to produce a null result, following the `ADRP+ADD` scan (`NNGFX_LAYER.md` §3, wrong instruction
form) and the `BL` scan (`DEVICE_INIT_CALLER_SEARCH.md` §1, blind to computed targets).

**Three hand-written decoders, three null results.** At this point the honest conclusion is not
"the constant is absent" but **"my instruction decoding is not reliable enough to conclude
anything from a null result."** Recording that is more useful than a fourth attempt:
verifying a decoder against known-good instructions has to come *before* trusting its output,
and I did not do that for any of the three.

So §2's hypothesis **remains untested**, and the recommendation stands but should be executed
with a decoder validated against instructions whose meaning is already known.

## 6. Limits

- **Only the symbol table and two bodies were examined.** No `nn::gfx` method body beyond
  `initializeImpl` and `DeviceImpl::Initialize` was decompiled in this pass.
- **The `TDevice`-is-inlined hypothesis is UNCONFIRMED.** It is consistent with two failed scans,
  which is suggestive, not proof.
- **No code was ported.** The boot runner still stops at step 11.
