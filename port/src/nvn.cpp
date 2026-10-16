// nvnLoadCProcs — the NVN resolver, with unbacked slots that report rather than lie.
//
// The contract is taken from the decompiled body (0x7100ddd6e4, 12,712 bytes): resolve each
// NVN function BY NAME through a caller-supplied GetProcAddress callback, in the binary's
// order, and store the result. See include/nvn/nvn.hpp for the correction to the earlier
// "returns a struct" description.
#include "nvn/nvn.hpp"

namespace nvn {

namespace {

int gUnbackedCalls = 0;

// Every resolved slot points here by default. Returning silently was the wrong option: if the
// engine reaches a slot expecting it to have drawn something, a quiet success would let it
// believe a frame was produced. Counting the call keeps the gap visible.
void UnbackedProc() { ++gUnbackedCalls; }

Proc gProcs[kProcCount];
bool gLoaded = false;

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

int unbackedCallCount() { return gUnbackedCalls; }

void ResetForTesting() {
    gUnbackedCalls = 0;
    gLoaded = false;
    for (int i = 0; i < kProcCount; ++i) gProcs[i] = &UnbackedProc;
}

} // namespace nvn
