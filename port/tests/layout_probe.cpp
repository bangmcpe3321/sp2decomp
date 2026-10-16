// Empirical layout probe: find the field arrangement that reproduces the four offsets the
// decompiled registerCallback body reaches, using sead's actual class structure as the
// guide (Slot : IDisposer, with a TListNode then delegate pointer then flag).
//
// Rather than guess padding repeatedly, this prints the offsets for a small set of
// candidate arrangements so the right one can be read off directly.
#include "sead/list_node.hpp"

#include <cstddef>
#include <cstdio>
#include <cstdint>

namespace sead { class Unused {}; }

// Candidate A: IDisposer contributes two pointers, then node, then delegate, then flag.
namespace candA {
struct SlotA {
    void *a0 = nullptr;            // +0x00
    void *a1 = nullptr;            // +0x08
    sead::ListNode node;           // +0x10 ?
    void *delegate = nullptr;
    unsigned char storage[0x28] = {};
    unsigned char connected = 0;
};
} // namespace candA

// Candidate B: node at +0x20 (two pointers of padding first).
namespace candB {
struct SlotB {
    unsigned char pad0[0x20] = {};
    sead::ListNode node;           // +0x20
    void *delegate = nullptr;      // +0x30
    unsigned char pad1[0x30] = {};
    unsigned char connected = 0;   // +0x68
};
} // namespace candB

// Candidate C: node at +0x20, delegate at +0x38 (so a further pointer sits between).
namespace candC {
struct SlotC {
    unsigned char pad0[0x20] = {};
    sead::ListNode node;           // +0x20
    void *between = nullptr;       // +0x30
    void *delegate = nullptr;      // +0x38
    unsigned char pad1[0x28] = {};
    unsigned char connected = 0;   // +0x68
};
} // namespace candC

// Candidate Event: virtual destructor occupies +0x00 (vptr), list head at +0x08.
namespace candEv {
struct EventA {
    void *vptr = nullptr;          // +0x00  (virtual dtor in sead's DelegateEvent)
    sead::List list;               // list itself is one ListNode = +0x08
    unsigned char pad[0x08] = {};
    int count = 0;                 // +0x18?
};
} // namespace candEv

int main() {
    std::printf("candidate slot layouts (need: node@0x20, ptr@0x38, flag@0x68)\n");
    std::printf("  A: node=0x%zx delegate=0x%zx flag=0x%zx\n",
                offsetof(candA::SlotA, node), offsetof(candA::SlotA, delegate),
                offsetof(candA::SlotA, connected));
    std::printf("  B: node=0x%zx delegate=0x%zx flag=0x%zx\n",
                offsetof(candB::SlotB, node), offsetof(candB::SlotB, delegate),
                offsetof(candB::SlotB, connected));
    std::printf("  C: node=0x%zx delegate=0x%zx flag=0x%zx  <-- target shape\n",
                offsetof(candC::SlotC, node), offsetof(candC::SlotC, delegate),
                offsetof(candC::SlotC, connected));

    std::printf("\ncandidate event layouts (need: list@0x08, count@0x18)\n");
    std::printf("  A: list=0x%zx count=0x%zx\n",
                offsetof(candEv::EventA, list), offsetof(candEv::EventA, count));

    std::printf("\nsead::List contains one ListNode, so sizeof(List)=0x%zx\n", sizeof(sead::List));
    std::printf("sead::ListNode size = 0x%zx (expected 0x10)\n", sizeof(sead::ListNode));
    return 0;
}
