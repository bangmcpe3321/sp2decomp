# `nn::gfx::detail::DeviceImpl<4,8>::Initialize` — the nested bring-up, and a correction

`NNGFX_LAYER.md` recorded that the `DeviceImpl` constructor is only 28 bytes, so the real
device initialisation is in another method. It is `Initialize`, and reading it **corrects a
conclusion in `NVN_BOOT_SUBSET.md`.**

---

## 1. The body

`nn::gfx::detail::DeviceImpl<ApiVariation<ApiType<4>, ApiVersion<8>>>::Initialize(DeviceInfo const&)`
at **`0x710135d8d8`, 192 bytes**:

```c
UseMiddleWare();
puVar2 = nvnBootstrapLoader("nvnDeviceGetProcAddress");
nvnLoadCProcs(0, puVar2);                                    // pass 1: device == NULL

nvnDeviceBuilderSetDefaults(&builder);
nvnDeviceBuilderSetFlags(&builder, 0);
nvnDeviceInitialize(device, &builder);                       // <-- the device comes to life

nvnLoadCProcs(device, puVar2);                               // pass 2: real device
uVar1 = Nvn::GetDeviceFeature(device);
*(uint *)(this + 0x300c) = uVar1;
*(byte *)(this + 0x3009) &= 0xfe;
*(this + 0x3008) = 1;
```

## 2. Three things this establishes

**`nvnLoadCProcs` IS CALLED TWICE, AND THAT IS THE POINT.** Once with a NULL device, then again
with the initialised device. This fits `nvnLoadCProcs`'s own body exactly — a `GetProcAddress`
resolver — and explains why the binary needs an entry point that takes the device as a
parameter: **the function pointers are device-specific, so they must be re-resolved after the
device exists.** `NVN_BOOT_SUBSET.md` described the resolver correctly but did not note the
double call. That is a real detail of the architecture, recovered here.

**`nvnBootstrapLoader` appears by name**, corroborating `GRAPHICS_NVN.md` §2's symbol list
(`nvnBootstrapLoader` at `0x7101413d48` / `0x7103877000`) from a second call site. The string
`"nvnDeviceGetProcAddress"` is passed to it — which is how the resolver callback is obtained.

**The `0x3018`-byte object's layout is now clearer**: NVNdevice at `+0x0000`, flags byte at
`+0x3008`, a bit-cleared byte at `+0x3009`, device-feature bitmask at `+0x300c`. `NNGFX_LAYER.md`
had the `+0x3008`/`+0x300c` fields; `+0x3009` is new.

## 3. CORRECTION to `NVN_BOOT_SUBSET.md`

That document states:

> "No blend, no depth, no vertex, no polygon, no color, no program, no texture creation, and 127
> of 130 command functions. The bring-up path allocates and initialises; it does not draw."

The **"does not draw"** half is untouched and still correct. But its framing implied the 30-NVN
set was the bring-up surface, and **it is not complete**: `DeviceImpl::Initialize` reaches

- `nvnDeviceBuilderSetDefaults`
- `nvnDeviceBuilderSetFlags`
- `nvnDeviceInitialize`

and `nvnDeviceInitialize` was **not** in the 30. So:

> **The 30 is a LOWER BOUND established from three specific bodies, not the whole bring-up set.**
> `DeviceImpl::Initialize` is a fourth bring-up body, and it adds at least three more —
> **≤ 33 so far.** The scan method was sound; the body list was incomplete, and the earlier
> document did not say so clearly enough.

This is the same class of error as the `registerCallback` model and the `+0x80` method
misidentification: a conclusion that was **right about its own evidence** and **overstated as a
general claim**. It is corrected here rather than quietly amended.

## 4. What this means for the plan

`DeviceImpl::Initialize` is **192 bytes and is the single most load-bearing graphics function
found so far**: it is where the NVN device is actually created. Its dependency set is small and
entirely enumerable — `UseMiddleWare`, `nvnBootstrapLoader`, 2× `nvnLoadCProcs`,
`Nvn::GetDeviceFeature`, and 3 `nvnDevice*` calls.

**Who calls it is not yet established.** `GraphicsNvn::initializeImpl` calls the *constructor*
(`0x710135d8b8`), not `Initialize`, so the caller is elsewhere — most likely a device-creation
path reached from `nn::gfx` proper or from `agl`. Locating it is the next step, and it is a
bounded one.

## 5. Limits

- **The caller of `DeviceImpl::Initialize` was NOT located.**
- **`UseMiddleWare()` was not decompiled** — its role is unestablished.
- **The NVN call set is still open.** With 1 body added and ≥3 functions found, further bring-up
  bodies will add more; the final count is unknown.
- **`*param_1 = (long)(param_1 + 1)` in the decompiled body is Ghidra's rendering of a pointer
  store into the object's first field** (the NVNdevice at `+0x0000`), not an arithmetic
  oddity — noted because it reads strangely.
- **No code was ported.** The boot runner still stops at step 11.
