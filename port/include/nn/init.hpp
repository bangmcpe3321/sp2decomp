// nn::init — the boot allocator foundation.
//
// Reconstructed from the boot root's decompiled body (Lp::Sys::SysInit::nninitStartup):
//
//   nn::os::QueryMemoryInfo(&memInfo);
//   uVar1 = memInfo.total - memInfo.used & 0xffffffffffe00000;   // mask to 2 MB
//   nn::os::SetMemoryHeapSize(uVar1);
//   *PTR_sIs6GB = 0x100000000 < uVar1;                           // > 4 GB => 6 GB devkit
//   nn::os::AllocateMemoryBlock(&block, 0x2000000);              // 32 MB
//   nn::init::InitializeAllocator(block);                        // <-- this function
//
// So `InitializeAllocator` receives a pointer to the 32 MB block the previous two calls
// produced, and must make it the process-wide allocator backing the SDK's heap APIs.
#pragma once

#include <cstdint>
#include <cstddef>

namespace nn::init {

// Takes the base of the memory block `AllocateMemoryBlock` returned. Returns a result
// code; the boot root ignores it, but later framework code depends on the allocator
// being usable.
int InitializeAllocator(void *blockBase);

// The allocator NVN and the graphics path expect (see PLATFORM_IMPLEMENTATION_SPEC.md:
// nv::SetGraphicsAllocator is imported but has no attributed call site).
void *GetDefaultAllocator();

// Standard allocator entry points routed to the initialised block.
void *Allocate(std::size_t size);
void *Allocate(std::size_t size, std::size_t alignment);
void Free(void *ptr);

} // namespace nn::init
