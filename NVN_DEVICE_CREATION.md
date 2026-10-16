# The NVN device-creation path — located

`PATH_A_DEVICE_API.md` and `DEVICE_INIT_CALLER_SEARCH.md` both failed to find the device-creation
path, and three hand-written instruction decoders produced null results. **Reading the body —
the method that has actually worked — found it immediately.** It is exactly what now looks
obvious in hindsight.

---

## 1. The path is inside `initializeGraphicsSystem` itself

From `sead::GameFrameworkNx::initializeGraphicsSystem` (`0x7100e6738c`):

```c
pcVar12 = (code *)nvnBootstrapLoader("nvnDeviceInitialize");
puVar13 = (undefined *)nvnBootstrapLoader("nvnDeviceGetProcAddress");
if ((pcVar12 != 0) && (puVar13 != 0)) {
    ...
    pcVar12(...);            // the device is initialised here
    nvnLoadCProcs(device, puVar13);
    ...
}
```

Three things fall out, each resolving an open question:

**`nvnDeviceInitialize` is not a symbol — it is a STRING.** The engine resolves it at runtime by
passing the literal `"nvnDeviceInitialize"` to `nvnBootstrapLoader`. So there was **never a symbol
to find**, and my two cross-reference scans were searching for something that does not exist as a
symbol:

- the `BL` scan (`DEVICE_INIT_CALLER_SEARCH.md` §1) — correct that it found no caller, wrong to
  conclude the caller was hidden;
- the ADRP scan (`NNGFX_LAYER.md` §3) — same category.

**`nvnBootstrapLoader` is the real entry point.** It takes a **function name** and returns that
function's address. That is why `GRAPHICS_NVN.md` §2 found only `nvnBootstrapLoader` and
`nvnLoadCProcs` as `nvn*` symbols: **both are name-based resolution mechanisms**, one per function
and one for the whole table. The earlier conclusion — "NVN has no per-function surface because it
is reached through pointers" — was right in spirit and wrong in mechanism: it is reached **by
name, through a loader**.

**`nv::InitializeGraphics` is probably `nvnBootstrapLoader` itself.** `ATTEMPT` (the previous
commit) recorded that `nv::InitializeGraphics` was **not found in the symbol table**, as called by
`initializeGraphicsSystem`. The body now shows `nvnBootstrapLoader("nvnDeviceInitialize")` at
exactly that position. The most economical explanation is that the decompiler named the
`nv::InitializeGraphics` call as a `nvnBootstrapLoader` call — **the same function under two
names** — rather than that there are two separate calls.

## 2. Why the location defeated every scan

`nvnDeviceInitialize` is the device creation, and it appears in `initializeGraphicsSystem` as a
**computed call**: `pcVar12(...)`, where `pcVar12` came from a loader. Every scan I wrote looked
for a *static* relationship:

| Scan | Looked for | Why it could not succeed |
|---|---|---|
| `BL` callers of `DeviceImpl::Initialize` | a direct branch | the call is `pcVar12(...)` — an indirect call through a loader result |
| `ADRP+ADD`/`LDR` for `PTR_pfnc_nvn*` | a data reference | those globals exist, but the device path uses the **loader**, not the resolved table |
| `MOVZ` for `0x3018` | a constant | the device object is not allocated by this path at all |

**All three were doomed by the same mistake: assuming a static link where the binary uses name
resolution.** That is the generalisable finding, and it is why reading beat scanning four times.

## 3. The corrected picture of NVN's interface

Putting this together with `DEVICE_IMPL_INITIALIZE.md` and `GRAPHICS_NVN.md` §2:

```
engine bring-up
  └─ nvnBootstrapLoader("nvnDeviceInitialize")      -> fn ptr   [initializeGraphicsSystem]
     nvnBootstrapLoader("nvnDeviceGetProcAddress")  -> resolver ptr
     fn(device, &builder)                            -> DEVICE EXISTS
     nvnLoadCProcs(device, resolver)                 -> 453 named globals filled
        └─ each entry reached as PTR_pfnc_<name>

nn::gfx's own path (a DIFFERENT route, not taken at sead bring-up)
  └─ DeviceImpl<4,8>::Initialize (0x710135d8d8)
        nvnLoadCProcs(0, resolver)      pass 1, null device
        nvnDeviceInitialize(...)        via the table, not the loader
        nvnLoadCProcs(device, resolver) pass 2
```

**So there are TWO device-creation routes**, and they differ in mechanism: the sead bring-up uses
`nvnBootstrapLoader` by name, while `nn::gfx`'s `DeviceImpl::Initialize` uses the resolved table.
Both reach the same NVN operation. That explains why `DeviceImpl::Initialize` had no caller on the
sead path — it is on the *other* route.

## 4. What this means for the port

**The device-creation path is now known and it is four steps**, all inside
`initializeGraphicsSystem`:

1. `nvnBootstrapLoader("nvnDeviceInitialize")` → function pointer
2. `nvnBootstrapLoader("nvnDeviceGetProcAddress")` → resolver pointer
3. call the device-initialise pointer with the builder
4. `nvnLoadCProcs(device, resolver)` → fill the 453-entry table

**A port can implement all four**, because `nvnLoadCProcs` is already ported (with the measured 453
names) and `nvnBootstrapLoader` is a name→function lookup that a port controls entirely. That is a
categorically better position than "the device comes from a path we have not located".

## 5. Limits

- **The full `initializeGraphicsSystem` body was NOT read this round** — only the region around
  `nvnDeviceInitialize`. The `if` branch shown is partial (its condition and the call inside were
  read; the surrounding 2,372 bytes were not re-examined).
- **`nvnBootstrapLoader`'s own body was NOT decompiled.** That it takes a name and returns an
  address is inferred from the call sites, not read from the function.
- **§1's third claim (that `nv::InitializeGraphics` and `nvnBootstrapLoader` are the same function)
  is an INFERENCE, not established.** It is the most economical reading, but it is not confirmed.
- **The builder's contents were not read**, so what the device is configured with is unknown.
- **No code was ported this round.** The boot runner still stops at step 11.
