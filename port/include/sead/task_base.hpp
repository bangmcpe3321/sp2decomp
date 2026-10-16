// sead::TaskBase::CreateArg / MgrTaskArg — ported from the decompiled constructor.
//
// SOURCES
//   reference/seadTaskBase.h (open-ead/sead) gives the class relationships:
//       struct CreateArg {
//           CreateArg(const TaskClassID& factory);
//           TaskClassID factory;  HeapPolicies heap_policies;
//           TaskBase* parent;  TaskParameter* parameter;  FaderTaskBase* fader;
//           TaskBase* src_task;  TaskBase** created_task;
//           DelegateEvent<TaskBase*>::Slot* create_callback;
//           TaskUserID user_id;  Tag tag;  SingletonFunc instance_cb;
//       };
//       struct MgrTaskArg : public CreateArg { explicit MgrTaskArg(const TaskClassID&); };
//   The binary's MgrTaskArg::MgrTaskArg @ 0x7100e6b7bc (308 bytes) gives the OFFSETS and a
//   behaviour the reference does not show.
//
// MODELLED AS ONE EXACT-OFFSET STRUCT, NOT AN INHERITANCE CHAIN.
//   The reference has MgrTaskArg derive from CreateArg, and the first version of this file
//   mirrored that. It does not work here: with MgrTaskArg : CreateArg, the derived members land
//   at sizeof(CreateArg) + n, so fieldA8 measured 0x168 rather than 0xa8 and EVERY offset assert
//   fired. Rather than pad CreateArg to exactly 0xb8 (which would put fieldA8 back at 0xa8 but
//   leaves 0xb8 bytes where the decompile shows 0xa8), the object is modelled FLAT with a pad
//   byte at 0xa8 and the two words at 0xac/0xb0. That reproduces the observed layout exactly and
//   removes the offset arithmetic that was the source of the error.
//
// THE BEHAVIOUR THE REFERENCE DOES NOT SHOW: the constructor sets a PER-ROOT-HEAP flags array.
// It reads the heap manager's root heap count and writes byte 1 into a slot for each root heap,
// unrolled four at a time with a remainder loop. So a MgrTaskArg's flags depend on how many root
// heaps exist when it is constructed -- which is why this constructor needs the heap layer to
// have run first, as the boot sequence arranges.
#pragma once

#include <cstdint>

namespace sead {

// A task's class identifier: a type-info pair, copied whole by the constructor.
struct TaskClassID {
    const void *typeInfo = nullptr; // +0x00
    std::uint64_t extra = 0;        // +0x08
};

// +0xb8. The constructor the boot root calls. Flat and exact-offset; see the note above.
class MgrTaskArg {
public:
    // 0x7100e6b7bc, 308 bytes.
    explicit MgrTaskArg(const TaskClassID &classID);

    // The per-root-heap flag bytes. The decompiled loop starts at +0x24 and advances 0x18 per
    // root heap, unrolled four at a time (+0x3c in that form, less the 0x18 to the first slot).
    static constexpr unsigned kFlagsOffset = 0x24;
    static constexpr unsigned kFlagsStride = 0x18;
    static constexpr int kMaxFlags = 4; // the reference's FixedPtrArray<Heap,4>

    // Fields, at the offsets the decompiled body writes.
    TaskClassID factory;          // +0x00, copied whole
    unsigned char pad10[0x10] = {}; // +0x10
    void *parent = nullptr;       // +0x20
    unsigned char pad28[0x20] = {}; // +0x28
    void *create_callback = nullptr; // +0x48
    unsigned char pad50[0x58] = {}; // +0x50..0xa8
    unsigned char fieldA8 = 0;    // +0xa8, set to 0 by the body
    std::int32_t fieldAc = 0;     // +0xac, set to 1
    void *fieldB0 = nullptr;      // +0xb0

    // Reads back the flag byte for root heap `index`.
    unsigned char flagForRootHeap(int index) const;
};

static_assert(sizeof(MgrTaskArg) >= 0xb8, "the object is at least 0xb8 bytes");

} // namespace sead
