// nvnLoadCProcs — the dispatch table, with unbacked slots that report rather than lie.
#include "nvn/nvn.hpp"

namespace nvn {

namespace {
int gUnbackedCalls = 0;

// Every slot points here. Returning silently was the wrong option: if the engine reaches a
// slot expecting it to have drawn something, a quiet success would let it believe a frame was
// produced. Counting the call keeps the gap visible.
void UnbackedProc() { ++gUnbackedCalls; }

ProcTable gTable;
bool gBuilt = false;
} // namespace

ProcTable *LoadCProcs() {
    if (!gBuilt) {
        for (int i = 0; i < kProcCount; ++i) gTable.slots[i] = &UnbackedProc;
        gBuilt = true;
    }
    return &gTable;
}

int unbackedCallCount() { return gUnbackedCalls; }

void ResetForTesting() {
    gUnbackedCalls = 0;
    gBuilt = false;
}

} // namespace nvn
