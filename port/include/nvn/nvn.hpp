// nvnLoadCProcs — the NVN API resolver, reconstructed from its decompiled body.
//
// CORRECTION TO GRAPHICS_NVN.md §2 AND TO THIS PORT'S FIRST VERSION
//   Both described nvnLoadCProcs as "one entry point returning a struct of function pointers".
//   The decompiled body (0x7100ddd6e4, 12,712 BYTES) shows something different: it is a
//   GetProcAddress-style RESOLVER.
//
//       void nvnLoadCProcs(void* device, void* (*getProcAddress)(void*, const char*)) {
//           PTR_pfnc_nvnDeviceBuilderSetDefaults = getProcAddress(device, "nvnDeviceBuilderSetDefaults");
//           PTR_pfnc_nvnDeviceBuilderSetFlags    = getProcAddress(device, "nvnDeviceBuilderSetFlags");
//           ... one named resolution per NVN function ...
//       }
//
//   So NVN is not a returned table but a SET OF NAMED GLOBALS filled in by name lookup. The
//   consequence for a port is favourable: the function NAMES are the interface, they are all
//   present in the binary as string literals, and they can be COUNTED rather than guessed.
//
// THE MEASURED SURFACE: 453 FUNCTIONS
//   Three independent counts agree:
//     - 453 distinct "nvn*" string literals in the body
//     - 453 distinct PTR_pfnc_nvn*_7102xxxxxx destination globals
//     - 453 resolver call sites
//   Grouped by object (the shape of the API):
//     Command 130 | Texture 90 | Sampler 45 | Device 25 | Queue 24 | Multisample 23
//     Memory 17 | Buffer 17 | Window 16 | Blend 15 | Depth 13 | Vertex 10
//     Polygon 9 | Color 7 | Program 5 | Sync 4 | Channel 3
//
//   THIS REPLACES A PLACEHOLDER. The first version of this header used kProcCount = 256 and
//   said so, because the nnsdk header that would have enumerated the table was not in the
//   cloned references. The binary itself answered the question, so no external reference is
//   needed for the count.
//
// WHAT IS STILL NOT MODELLED: the GPU. Resolution succeeding does not mean any function
// renders. Each slot in the port reports being unbacked when called.
#pragma once

#include <cstdint>

namespace nvn {

// The measured NVN API surface: 453 functions, from nvnLoadCProcs's body.
constexpr int kProcCount = 453;

// A resolved NVN entry point. The real signatures vary per function and are not recovered
// here; the port stores the pointer and calls it through a cast at the call site.
using Proc = void (*)();

// The lookup callback the engine supplies: (device, name) -> function pointer.
using GetProcAddressFn = void *(*)(void *device, const char *name);

// The resolved table, indexed by resolution order. Index i corresponds to the i-th name
// nvnLoadCProcs resolves.
Proc *ResolvedProcs();

// The name resolved at slot i, or null. Present so a caller (and the tests) can check that the
// port's ordering matches the binary's, rather than assuming it.
const char *ProcName(int index);

// 0x7100ddd6e4, 12,712 BYTES. `device` and `getProcAddress` are the two parameters the
// decompiled body uses. Returns the number of functions resolved (453).
int LoadCProcs(void *device, GetProcAddressFn getProcAddress);

// --- nvnBootstrapLoader (0x7101413d48) ----------------------------------------------------
//
// The binary symbol is the GLOBAL `nvnBootstrapLoader`, resolved by imported name. Its own body
// was not decompiled (NVN_DEVICE_CREATION.md §5), but the call sites settle the contract: it
// takes a function NAME and returns that function's address.
//
//   pcVar12 = (code *)nvnBootstrapLoader("nvnDeviceInitialize");
//   puVar13 = (undefined *)nvnBootstrapLoader("nvnDeviceGetProcAddress");
//   if ((pcVar12 != 0) && (puVar13 != 0)) { ... device created ... }
//
// (sead::GameFrameworkNx::initializeGraphicsSystem 0x7100e6738c; nn::gfx DeviceImpl::Initialize
// 0x710135d8d8 has a third site. See NVN_DEVICE_CREATION.md §1 and §3 for the two routes.)
//
// LOOKUP ORDER, chosen to stay consistent with LoadCProcs rather than invent a table:
//   1. host registrations made with RegisterBootstrapProc (a port seam, not in the binary);
//   2. if LoadCProcs has run, the same name->slot mapping it uses (ProcName/ResolvedProcs),
//      but ONLY when the slot is backed. A slot still pointing at UnbackedProc is treated as a
//      miss: returning it would make the call site's non-null check pass and the "device" would
//      silently be a no-op.
//   3. otherwise null. That is the DOCUMENTED FALLBACK, and it is a contract the binary
//      already handles: both call sites test the result for null and skip device creation.
//
// Null is therefore a normal, expected answer on this port until something registers real NVN
// entry points -- not an error to paper over. nvn::LoadCProcs remains the table-shaped route;
// this is the per-name route to the same surface.
Proc BootstrapLoader(const char *name);

// Registers a host implementation for a name, so a backend (or a test) can make the loader
// answer without fabricating the 453-entry table. A second registration of the same name
// replaces it; returns false for a null/empty name, a null proc, or a full table.
bool RegisterBootstrapProc(const char *name, Proc proc);

// True once LoadCProcs has resolved the table, so a caller can tell "not loaded" from
// "loaded but this slot is unbacked".
bool ProcsLoaded();

// Whether slot `index` holds a real resolved pointer rather than the UnbackedProc reporter.
bool ProcIsBacked(int index);

// Every call to BootstrapLoader, and the subset that produced no backed pointer (including
// null/empty names). lookups - misses == answers served, so a test can distinguish "never
// asked" from "asked and refused".
int bootstrapLookupCount();
int bootstrapMissCount();

// How many times a resolved slot has been invoked with no implementation behind it. Exposed so
// a test can assert the stubs REPORT rather than silently succeed.
int unbackedCallCount();

// Resets the resolved table, the host registration table and the lookup counters.
void ResetForTesting();

} // namespace nvn
