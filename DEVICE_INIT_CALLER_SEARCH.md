# Looking for the caller of `DeviceImpl<4,8>::Initialize` — and not finding it

`DEVICE_IMPL_INITIALIZE.md` established that
`nn::gfx::detail::DeviceImpl<ApiVariation<ApiType<4>,ApiVersion<8>>>::Initialize`
(`0x710135d8d8`, 192 bytes) is **where the NVN device is created**, and closed with its caller
unlocated. This document records the search, which **did not find the caller**, and why.

Recorded rather than dropped for the same reason as the `NVN_BOOT_SUBSET` correction and the
failed ADRP scan: **a failed search that is not written down gets repeated.**

---

## 1. Direct `BL` callers: none

A `BL` instruction encodes its target directly as a signed 26-bit word offset, so this scan has
no page/GOT indirection to get wrong — unlike the ADRP scan in `NNGFX_LAYER.md` §3.

```
=== callers of 0x135d8d8 ===
found 0
```

**Zero direct callers in the whole 21 MB `.text` range.** So `Initialize` is reached through a
function pointer, a vtable, or a jump table — not by a named call.

## 2. References as data: exactly one

Searching the entire binary for the address stored as an 8-byte value, in both absolute
(`0x710135d8d8`) and image-base-relative (`0x135d8d8`) forms:

```
pointer occurrences of 0x135d8d8: 1
  at file 0x1cf1810 = mem 0x7101cf1710  (RELATIVE)
```

**Exactly one.** And dumping the words around `0x7101cf1710` shows it is **not a vtable** — the
neighbours are a mixture of code addresses and small integers:

```
+0x00  0x000135d8d8  -> 0x710135d8d8   <- our target
+0x08  0x00000000c0  -> 0x71000000c0   <- 0xc0, an integer, not a pointer
+0x10  0x100220002a103                 <- not an address at all
+0x18  0x0000055cb0  -> 0x7100055cb0
+0x20  0x0000000010  -> 0x10, an integer
+0x28  0x10012005f6597                 <- not an address
+0x30  0x0000dc0e08  -> 0x7100dc0e08
+0x38  0x000000004c  -> 0x4c, an integer
```

The repeating shape is *(code address, small integer, packed value, code address, small integer,
packed value)*. That is a **structured metadata table** — plausibly a relocation table or
exception/unwind information — **not a dispatch table**. So the single reference tells us the
address is *recorded* there, which is not the same as being *called* from there.

## 3. What the negative result establishes

Combining §1 and §2:

- `DeviceImpl<4,8>::Initialize` is **not called by name anywhere**.
- Its address appears as data in **exactly one** place, and that place is **metadata, not code**.

**So the caller is reached by a mechanism this repository has not yet identified.** The
candidates, none of which I confirmed:

1. **The call is templated and instantiated elsewhere**, so the address our symbol table gives is
   one instantiation among several and the real call goes to a sibling.
2. **`nn::gfx`'s public `Device::Initialize` is a different function** that this private
   `detail::` method is reached from indirectly through a pointer stored in the `0x3018`-byte
   object itself — which would be consistent with that object's first field being the NVNdevice
   and its layout carrying function pointers.
3. **The `BL` target is computed**, e.g. loaded from the object and called via `BLR`, which the
   `BL` scan cannot see by construction.

Option 3 is the most likely and the least satisfying: it means **the `BL`-scan method is
structurally blind to this call**, and no amount of re-running it will help.

## 4. What would actually answer it

Not another scan. **Decompiling the `nn::gfx` device-creation entry points and reading them** —
the same method that worked for the platform layer, the NVN subset, and `initializeImpl` itself.
Specifically, the functions around `nn::gfx::Device`'s public surface, which were not enumerated
in this pass.

That is a bounded next step, and it is the honest one: the automated cross-reference approach has
now failed twice on this layer (the ADRP scan in `NNGFX_LAYER.md` §3 and the `BL` scan here), for
**different reasons each time** — which is itself the finding. Reading the code beats scanning it.

## 5. Limits

- **The caller of `DeviceImpl::Initialize` remains NOT located.**
- **The table at `0x7101cf1710` was not identified.** I read its shape and concluded "metadata,
  not dispatch"; I did not establish what it actually is.
- **No attempt was made to decompile `nn::gfx::Device`'s public entry points**, which is §4's
  recommendation.
- **`UseMiddleWare()` and `Nvn::GetDeviceFeature` were not decompiled.**
- **No code was ported.** The boot runner still stops at step 11.
