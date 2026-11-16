# Reading the real platform bodies

`PLATFORM_LAYER_FOUND.md` gives the provider module and offset for every boot function.
This note records the first cross-check between those shipped bodies and the host
implementations in `port/`. It is a starting point, not a complete audit.

## Method

```bash
# Convert a decompressed NSO to an ELF with symbols (nso2elf emits .dynsym).
node tools/nso/nso2elf.mjs work/exefs/sdk.decompressed sdk.elf

# Address and size of a symbol.
readelf -sW sdk.elf | grep '_ZN2nn2os13GetSystemTickEv'
#   1972: 0000000000081b40     8 FUNC    GLOBAL DEFAULT    1 _ZN2nn2os13GetSystemTickEv

# Disassemble exactly that extent.
aarch64-linux-gnu-objdump -d --start-address=0x81b40 --stop-address=0x81b48 sdk.elf
```

Offsets are module-relative. Only `main` has the fixed analysis base `0x7100000000`.

## `nn::os::GetSystemTick` — exact, no change needed

`sdk` 0x81b40, 8 bytes:

```
81b40:  mrs  x0, cntpct_el0
81b44:  ret
```

The real function is the physical counter. On Switch `CNTFRQ` is 19.2 MHz; the port's
`GetSystemTick` runs a monotonic steady clock scaled by `192/10000`, i.e. the same 19.2 MHz
domain. The properties the 677 call sites need — monotonic and 19.2 MHz — are already met.

## `nn::mem::StandardAllocator` — the port differs, and it matters

`sdk`:

| Symbol | Offset | Size |
|---|---:|---:|
| `StandardAllocator(void*, unsigned long)` | 0x7bd4c | 0x36 |
| `StandardAllocator::Initialize(void*, unsigned long)` | 0x7bd70 | 0x8 (tail call) |
| `StandardAllocator::Allocate(unsigned long, unsigned long)` | 0x7becc | 0x240 |
| `StandardAllocator::Free(void*)` | 0x7bfc4 | 0x96 |

The real `Allocate` checks the initialised byte at `this+1`, obtains its allocator object
through a TLS/vtable call, takes the lock at `this+0x18`, and allocates from an internal
free-list. `Free` finds the owning allocator and tail-calls its free through the vtable.

The host `port/` implementation is a **bump allocator**: `Free` is a no-op for
buffer-backed storage, so reclaimed memory is never reused. That is a real semantic
difference, not an implementation detail. The first concrete follow-up is to port the
real body, or at least a free-list with the same reuse behaviour; the constructor and
`Initialize(buffer, size)` shape already match.

## `nvnBootstrapLoader` — shape is right

`subsdk0` 0xb35c4, 0x184 bytes. The real body checks a cached module/table pointer
(`adrp 0x1a6000 + 0x3a0`), calls `nvnBootstrapLoaderInternal` (0xb367c) when the cache is
empty, and returns a function pointer. It is a name→pointer resolver, not a jump table.

The port's `nvn::BootstrapLoader` has the same shape (host registrations → backed
`LoadCProcs` slots → null). `RegisterBootstrapProc` is the seam a real NVN backend plugs
into. Null is the documented fallback both binary call sites already test.

## `nn::vi::Initialize` — intentionally still a stub

`subsdk1` 0x2740, 0x1936 bytes. The real body creates and starts service objects,
mutexes, buffer queues and IPC proxies. The port only flips a flag, which is appropriate
until the service layer exists; the recovered body is the reference for the real
implementation.

## Boot heap: the port's fixed values are stand-ins

`sdk`:

| Symbol | Offset | What the body does |
|---|---:|---|
| `AllocateMemoryBlock(unsigned long*, unsigned long)` | 0x81bd0 | delegates to the SDK heap manager at 0x2cb0cc |
| `SetMemoryHeapSize(unsigned long)` | 0x81b84 | delegates to 0x2bf24c |
| `QueryMemoryInfo(MemoryInfo*)` | 0x7ee20 | tail call to 0x2be38c (the `svcGetInfo` path) |

The port's `QueryMemoryInfo` reports a fixed 4 GiB/0 and `AllocateMemoryBlock` uses the
host allocator. Those are boot stand-ins, not reconstructions. They are fine while the
port supplies its own memory, but the real bodies should be ported before heap sizing is
expected to match the console.

## Mutex layout: host behaviour matches, layout does not

`nn::os::InitializeMutex` (`sdk` 0x80d40) writes a real layout:

| Offset | Meaning |
|---:|---|
| +0x00 | initialised flag |
| +0x01 | recursive flag (`& 1`) |
| +0x04 | priority-inheritance flag |
| +0x08 | recursion count (zeroed) |
| +0x10 | owner thread (zeroed) |
| +0x18 | embedded lock, initialised through 0x2cacac |

`UnlockMutex` (0x80e80) decrements +0x08, returns while it is non-zero, then clears the
owner at +0x10 and releases the lock at +0x18. The port's host mutex has the same
observable recursion/ownership behaviour, but its `MutexType` storage is host-chosen; it
does not reproduce this layout. Worth remembering if anything ever reads the fields.

## Thread API: thin wrappers over an SDK manager

The public thread functions are small wrappers over a global manager object reached
through `[0x6bf000+184] + 0x68`:

| Symbol | Offset | Notes |
|---|---:|---|
| `CreateThread` (6-arg) | 0x815dc | forwards to the manager at 0x2cb07c |
| `CreateThread` (7-arg) | 0x81580 | same, plus core number |
| `StartThread` | 0x81648 | manager at 0x2cc67c |
| `WaitThread` | 0x81910 | manager at 0x2be92c |
| `DestroyThread` | 0x81630 | manager at 0x2c491c |
| `GetThreadId` | 0x819d0 | manager at 0x2bcc0c |
| `SetThreadCoreMask` | 0x81970 | manager at 0x2cc2fc |
| `GetThreadPriority` | 0x818dc | `ldr w0, [thread, #0x44]` |
| `GetCurrentThread` | 0x81870 | `mrs tpidrro_el0; ldr x0, [x8, #0x1f8]` |

So the host layer implements the same API and observable semantics, but its `ThreadType`
and manager are host-side; the retail layout (e.g. priority at +0x44) is not reproduced.
Worth keeping in mind if the port ever stores or passes a guest `ThreadType` through.

## Display and graphics entry points

- `nn::vi::OpenDefaultDisplay` (`subsdk1` 0x90a0) is a small IPC wrapper: it passes the
  descriptor at 0x2b324 to the vi helper at 0xd8b4. The port returns a static handle;
  appropriate until the vi service layer exists.
- `nv::InitializeGraphics` (`subsdk0` 0xc8c4) checks a global function-pointer pair and
  branches to 0xb7214 (an assert-style path) when it is non-empty; it is not a simple heap
  handover. The port records the `(heap, size)` pair as a placeholder. Re-check this when
  an NVN backend exists.

## Next candidates

- `nn::os::detail::ThreadManager` (the bodies behind the wrappers: 0x2cb07c / 0x2cc67c /
  0x2be92c / 0x2c491c) — the real thread lifecycle behind the host implementation in
  `port/`.
- `nn::vi::CreateLayer` / `GetDisplayVsyncEvent` — the rest of the display boundary.
- `nn::mem::StandardAllocator::Allocate`'s free-list internals (sdk 0x7becc) — the host
  version now reuses and coalesces, but is not byte-identical to the retail TLSF-like bins.
- `nvnBootstrapLoaderInternal` (subsdk0 0xb367c) — the real resolver behind the loader.

None of this requires the port runtime; it is all module-relative disassembly of the
reader's own dump.
