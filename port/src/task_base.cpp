// sead::TaskBase::MgrTaskArg constructor — ported from 0x7100e6b7bc (308 bytes).
//
// The decompiled body in full:
//
//   MgrTaskArg::MgrTaskArg(const TaskClassID& classID) {
//       *(u64*)(this + 0x08) = classID[1];
//       u64 id0 = classID[0];
//       // 19 eight-byte stores of 0 across +0x10 .. +0xb0 (see the zero list below)
//       *(u64*)(this + 0x00) = id0;                  // the TaskClassID is copied whole
//       *(u32*)(this + 0xa8) = 0xffffffff;
//       *(u32*)(this + 0xac) = 1;
//       *(u64*)(this + 0xb0) = 0;
//
//       uint n = *(uint*)PTR_sRootHeaps_7102fc9f98;  // the root heap COUNT
//       if (n > 0) {
//           uint rem = n & 3;
//           if (n - 1 >= 3) {                        // four at a time
//               long i = 0; MgrTaskArg* p = this + 0x3c;
//               do {
//                   p[-0x18] = 1; *p = 1; p[0x18] = 1; p[0x30] = 1;
//                   i += 4; p += 0x60;
//               } while (n - rem != i);
//           }
//           if (rem != 0) { ... remainder loop at stride 0x18 ... }
//       }
//   }
//
// THE LOOP IS THE INTERESTING PART. It writes byte 1 into a slot for each root heap, at a
// 0x18-byte stride starting from +0x24 (+0x3c for the unrolled form, minus 0x18). So a
// MgrTaskArg carries one flag per root heap, and the flag count follows the heap manager's state
// -- which is why this constructor must run AFTER the heap layer, as the boot sequence does.
#include "sead/task_base.hpp"

#include "sead/heap_mgr.hpp"

#include <cstddef>
#include <cstring>

namespace sead {

// Every offset the decompiled body touches is pinned here. These are measured FROM THE OBJECT's
// start, which for a derived class is NOT offsetof(Base, member) -- the first version of this
// file used the base-relative form and every assert fired, which is the asserts doing their job.
// (offsetof(CreateArg, x) == offsetof(MgrTaskArg, x) because CreateArg is the primary base.)
static_assert(offsetof(MgrTaskArg, factory) == 0x00, "TaskClassID is copied to +0x00");
static_assert(offsetof(MgrTaskArg, parent) == 0x20, "parent is at +0x20");
static_assert(offsetof(MgrTaskArg, create_callback) == 0x48, "create_callback is at +0x48");
static_assert(offsetof(MgrTaskArg, fieldA8) == 0xa8, "fieldA8 is written at +0xa8");
static_assert(offsetof(MgrTaskArg, fieldAc) == 0xac, "fieldAc is written at +0xac");
static_assert(offsetof(MgrTaskArg, fieldB0) == 0xb0, "fieldB0 is written at +0xb0");
static_assert(sizeof(MgrTaskArg) >= 0xb8, "the object is at least 0xb8 bytes");

namespace {
// The zeroing the constructor performs, at the offsets the body writes. Listed explicitly rather
// than memset-ing the whole object, so a field the original does NOT zero stays distinguishable.
constexpr std::size_t kZeroed[] = {
    0x10, 0x18, 0x1f, 0x28, 0x30, 0x37, 0x40, 0x48,
    0x4f, 0x58, 0x60, 0x67, 0x78, 0x80, 0x88, 0x90,
    0x98, 0xa0,
};
} // namespace

MgrTaskArg::MgrTaskArg(const TaskClassID &classID) {
    // The TaskClassID is copied whole: `*(u64*)(this+8) = classID[1]; *(u64*)this = classID[0];`
    factory = classID;

    for (std::size_t off : kZeroed) {
        *reinterpret_cast<std::uint64_t *>(reinterpret_cast<unsigned char *>(this) + off) = 0;
    }

    fieldA8 = 0;   // the body stores a byte 0 here
    fieldAc = 1;
    fieldB0 = nullptr;

    // The per-root-heap flags array. The count comes from the heap layer, so this constructor
    // reads state established by HeapMgr::initialize.
    const int n = HeapMgr::getRootHeapNum();
    if (n > 0) {
        const int count = (n < kMaxFlags) ? n : kMaxFlags;
        for (int i = 0; i < count; ++i) {
            *reinterpret_cast<unsigned char *>(reinterpret_cast<unsigned char *>(this) +
                                               kFlagsOffset + i * kFlagsStride) = 1;
        }
    }
}

unsigned char MgrTaskArg::flagForRootHeap(int index) const {
    if (index < 0 || index >= kMaxFlags) return 0;
    return *reinterpret_cast<const unsigned char *>(
        reinterpret_cast<const unsigned char *>(this) + kFlagsOffset + index * kFlagsStride);
}

} // namespace sead
