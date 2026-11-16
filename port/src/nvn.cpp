// nvnLoadCProcs / nvnBootstrapLoader — the two NVN name-resolution routes.
//
// LoadCProcs: the contract is taken from the decompiled body (0x7100ddd6e4, 12,712 bytes):
// resolve each NVN function BY NAME through a caller-supplied GetProcAddress callback, in the
// binary's order, and store the result. See include/nvn/nvn.hpp for the correction to the
// earlier "returns a struct" description.
//
// BootstrapLoader: the per-name route. Its body was not decompiled, so the contract comes from
// its call sites (name in, function address out, null tolerated by the caller). See the header
// for the lookup order and why null is the documented answer.
#include "nvn/nvn.hpp"

#include <cstring>
#include <string>

namespace nvn {

namespace {

int gUnbackedCalls = 0;

// Every resolved slot points here by default. Returning silently was the wrong option: if the
// engine reaches a slot expecting it to have drawn something, a quiet success would let it
// believe a frame was produced. Counting the call keeps the gap visible.
void UnbackedProc() { ++gUnbackedCalls; }

Proc gProcs[kProcCount];
bool gLoaded = false;

// Host registrations for BootstrapLoader. This is a port seam, not a reconstruction: the
// binary's loader reaches the sdk module, which the port does not have. Fixed capacity keeps
// it allocation-free and makes exhaustion reportable (RegisterBootstrapProc returns false).
constexpr int kMaxHostProcs = 32;
struct HostProc {
    std::string name;
    Proc proc;
};
HostProc gHostProcs[kMaxHostProcs];
int gHostProcCount = 0;

int gBootstrapLookups = 0;
int gBootstrapMisses = 0;

} // namespace

int LoadCProcs(void *device, GetProcAddressFn getProcAddress) {
    // The decompiled body resolves unconditionally; a null callback would fault. Refusing
    // loudly beats crashing inside the resolver.
    if (getProcAddress == nullptr) return 0;

    int resolved = 0;
    for (int i = 0; i < kProcCount; ++i) {
        const char *name = ProcName(i);
        if (name == nullptr) continue;
        // The real call: `uVar1 = (*(code *)param_2)(param_1, "nvn...");`
        void *fn = getProcAddress(device, name);
        // A resolver that returns null for a name means that function is not available on this
        // device. The binary stores whatever it gets; so does the port -- but an unavailable
        // entry points at UnbackedProc rather than at null, so a caller dereferencing it
        // reports instead of crashing.
        gProcs[i] = (fn != nullptr) ? reinterpret_cast<Proc>(fn) : &UnbackedProc;
        ++resolved;
    }
    gLoaded = true;
    return resolved;
}

Proc *ResolvedProcs() { return gProcs; }

bool ProcsLoaded() { return gLoaded; }

bool ProcIsBacked(int index) {
    if (index < 0 || index >= kProcCount) return false;
    return gProcs[index] != nullptr && gProcs[index] != &UnbackedProc;
}

Proc BootstrapLoader(const char *name) {
    ++gBootstrapLookups;
    if (name == nullptr || name[0] == '\0') {
        ++gBootstrapMisses;
        return nullptr;
    }

    // 1. Host registrations win: an explicit implementation is better evidence than a slot from
    //    a resolver that may only have been asked in a test.
    for (int i = 0; i < gHostProcCount; ++i) {
        if (gHostProcs[i].name == name) return gHostProcs[i].proc;
    }

    // 2. The LoadCProcs table, by the same names, but only when the slot is really backed.
    if (gLoaded) {
        for (int i = 0; i < kProcCount; ++i) {
            const char *resolvedName = ProcName(i);
            if (resolvedName != nullptr && std::strcmp(resolvedName, name) == 0) {
                if (ProcIsBacked(i)) return gProcs[i];
                // The name is part of the NVN surface but nothing implements it. Reporting a
                // no-op as if it were the function would defeat the call site's null check.
                break;
            }
        }
    }

    // 3. Documented fallback: the loader does not know this name. The binary's call sites both
    //    check for null and skip device creation, so this is a handled outcome, not a fault.
    ++gBootstrapMisses;
    return nullptr;
}

bool RegisterBootstrapProc(const char *name, Proc proc) {
    if (name == nullptr || name[0] == '\0' || proc == nullptr) return false;
    for (int i = 0; i < gHostProcCount; ++i) {
        if (gHostProcs[i].name == name) {
            gHostProcs[i].proc = proc;
            return true;
        }
    }
    if (gHostProcCount >= kMaxHostProcs) return false; // exhaustion is reported, not wrapped
    gHostProcs[gHostProcCount].name = name;
    gHostProcs[gHostProcCount].proc = proc;
    ++gHostProcCount;
    return true;
}

int bootstrapLookupCount() { return gBootstrapLookups; }
int bootstrapMissCount() { return gBootstrapMisses; }

int unbackedCallCount() { return gUnbackedCalls; }

void ResetForTesting() {
    gUnbackedCalls = 0;
    gLoaded = false;
    for (int i = 0; i < kProcCount; ++i) gProcs[i] = &UnbackedProc;

    for (int i = 0; i < gHostProcCount; ++i) {
        gHostProcs[i].name.clear();
        gHostProcs[i].proc = nullptr;
    }
    gHostProcCount = 0;
    gBootstrapLookups = 0;
    gBootstrapMisses = 0;
}

} // namespace nvn
