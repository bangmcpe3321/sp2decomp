# nn::os thread and message-queue layer

Host implementation: `port/src/os.cpp`; declarations: `port/include/nn/os.hpp`; tests:
`port/tests/thread_tests.cpp`. Evidence comes from `PLATFORM_IMPLEMENTATION_SPEC.md`,
`PLATFORM_CALL_SITES.md` and `PORT_WORKLIST.md`; entries lacking it are marked.

## 1. Scope

The 24-function `nn::os` boot list in `PORT_WORKLIST.md` is implemented in full. This note
covers the 11 thread and queue functions on that list plus 13 supporting entries.

| Group | Boot-list functions | Here |
|---|---|---:|
| memory | `AllocateMemoryBlock`, `QueryMemoryInfo`, `SetMemoryHeapSize` | — |
| time | `GetSystemTick`, `SleepThread`, `ConvertToTimeSpan` | — |
| TLS | `GetTlsValue`, `SetTlsValue`, `AllocateTlsSlot` | — |
| mutex / semaphore | `InitializeMutex`, `LockMutex`, `UnlockMutex`, `InitializeSemaphore` | — |
| threads | `CreateThread`, `GetCurrentThread`, `GetThreadId`, `GetThreadPriority`, `ChangeThreadPriority`, `GetThreadAvailableCoreMask`, `SetThreadCoreMask`, `SetThreadName`, `GetCurrentCoreNumber`, `GetCurrentStackInfo` | 10 |
| message queue | `InitializeMessageQueue` | 1 |

Supporting entries, none a boot-list import: `StartThread`, `WaitThread`,
`DestroyThread`, `YieldThread`, `GetThreadCoreMask`/`GetThreadName` (diagnostics), the
queue data path (`SendMessageQueue`, `TrySendMessageQueue`, `ReceiveMessageQueue`,
`TryReceiveMessageQueue`, `GetMessageQueueCount`), and the host-state finalizers
`FinalizeSemaphore`/`FinalizeMessageQueue`. These are inferred SDK lifecycle and
finalisation rather than observed imports.

## 2. API surface

| Function(s) | Group | Observed evidence |
|---|---|---|
| `CreateThread` | lifecycle | One boot site in `sead::Thread` (0x7100e98f50): `CreateThread(pTVar3, PTR_ninThreadFunc, this, *(void **)(this + 0xe8), (long)param_6, *(int *)(this + 0xf8))` — entry, argument, guest stack/size, priority. |
| `StartThread`, `WaitThread`, `DestroyThread`, `YieldThread` | lifecycle | No observed call site; modelled from the SDK lifecycle. |
| `GetCurrentThread`, `GetThreadId` | control | `GetCurrentThread` 17 sites / 16 callers, result cast to `ThreadType *`: `pTVar4 = (ThreadType *)nn::os::GetCurrentThread();`. `GetThreadId` 3/3: `uVar2 = nn::os::GetThreadId(pTVar4);`. |
| `GetThreadPriority`, `ChangeThreadPriority` | control | 3/3 and 8/8, e.g. `ChangeThreadPriority(*(ThreadType **)(this + 0xe0), param_1)`. |
| `GetThreadAvailableCoreMask`, `SetThreadCoreMask` | control | 3/3 and 4/4; three sites pass `-1` plus a mask, one an explicit core: `SetThreadCoreMask(*(ThreadType **)(this + 0xe0), -1, (ulong)uVar1)`. Reached from `sead::Thread::setAffinity`. `GetThreadCoreMask` is a test-only diagnostic. |
| `GetCurrentCoreNumber` | control | 121 / 112, including `ThreadMgr::initMainThread_`. |
| `SetThreadName`, `GetThreadName` | control | `SetThreadName` 3/3: `SetThreadName(pTVar3, (char *)param_1[1])`. `GetThreadName` is a test-only diagnostic. |
| `GetCurrentStackInfo` | control | 3 / 3, two out parameters: `GetCurrentStackInfo((ulong *)&local_38, (ulong *)local_48);` |
| `InitializeMessageQueue` | message queue | 7 / 6. Four sibling-field sites fix queue-to-buffer spacing at 0x48; capacities 1, 0x20, 0x21 observed. Reached from `sead::MessageQueue::allocate`. |
| `SendMessageQueue`, `TrySendMessageQueue`, `ReceiveMessageQueue`, `TryReceiveMessageQueue`, `GetMessageQueueCount`, `FinalizeMessageQueue` | message queue | No observed call site; only queue initialisation is captured. Contracts come from the header comments and tests; `FinalizeMessageQueue` releases host state before re-initialisation. |

## 3. Design decisions

**Thread state is in an address-keyed registry.** `g_threads` is a heap-allocated
`std::unordered_map<ThreadType *, ThreadState *>` protected by `g_threadsLock`; it is
intentionally leaked so a detached thread cannot race a static map's destructor.
`ThreadType::storage` (an unobservable 0x80 reserve) is never interpreted and is kept only
for SDK size/alignment fidelity.
Keying on the handle address makes an uninitialised or stale inline handle — the observed
`this + 8` site can reach a control call before `CreateThread` — degrade to "no host
state" instead of dereferencing caller bytes.

**Queue state is tagged in caller storage.** `MessageQueueStorage` holds `{kQueueMagic,
state *}` in the measured 0x48 bytes, and the tag is validated before the pointer is
followed; a registry lookup on every send/receive would add a global lock to the hot path.
`MessageQueueType` is `alignas(8)`, not 16: 16-byte alignment made `sizeof()` 0x50 on both
x86-64 and AArch64, padding the measured region, while 8-byte alignment keeps
`sizeof() == 0x48`. Both host states are heap-allocated, so their internal size does not
affect the visible layout. `TYPE_SIZES.md` records the case that forced this indirection:
an in-place semaphore state was 96 bytes on x86-64 and 104 on AArch64. The 0x80 is a
reserve, not a measurement; 0x48 is the only measured size.

**`CreateThread` creates; it does not start.** It heap-allocates `ThreadState`, assigns an
id from a process-wide atomic, records entry/argument/stack/stack size/priority, sets the
core mask to `GetThreadAvailableCoreMask()`, and registers the state by handle address. It
does not touch caller storage. A re-create over a live handle is rejected and the handle is
left unchanged, so storage is reusable only after `DestroyThread`. No host thread exists
until `StartThread`, so id and priority are readable without racing the entry point.

**The host thread is detached, not owned.** `ThreadState` deliberately has no `std::thread`
member: `pthread_create` can run the entry point before a move-assignment into such a member
completes, so the entry could observe a default-constructed or concurrently written object.
`StartThread` creates a local `std::thread`, detaches it immediately, and publishes
completion through `doneLock`/`doneCv`/`finished`.

**State ownership is an intrusive reference count.** `ThreadState::refs` (a
`std::atomic<int>`) starts at 1 for the registry entry. `StartThread` adds a reference for
the running trampoline, and every `AcquireThreadRef` caller (control, wait, start) takes a
temporary one for a registered handle; the implicit per-thread handle is thread_local and
not refcounted. `DestroyThread` claims the registry reference through `ClaimThread` instead
of taking a temporary. `ReleaseThread` deletes only when the count reaches zero, so a
self-destroying entry, a waiting destroyer and a concurrent control call cannot free state
another still uses.

**Guest stack is recorded, not used.** `stack` and `stackSize` are stored and never passed
to the host thread, which uses its default stack; they describe guest memory.

**Priority and affinity are stored, not applied.** Nothing calls `pthread_setschedparam` or
`sched_setaffinity`. `ChangeThreadPriority` writes the integer, `SetThreadCoreMask` the
mask; `GetCurrentCoreNumber` returns 0 and the mask is `min(hw, 4)` bits (floor 1).

**The queue ring is caller-owned.** Host state holds head/tail/count/capacity, a mutex and
two condition variables. Initialisation zero-fills the caller's buffer
(`count * sizeof(std::uint64_t)`), an observable side effect, and rejects a `count` above
`SIZE_MAX / sizeof(std::uint64_t)` so the byte size cannot wrap. `FinalizeMessageQueue`
deletes the state and clears the tag; re-initialising without it is unsupported (§6).

**A message is one machine word.** `Message` is `std::uintptr_t` with
`static_assert(sizeof(Message) == sizeof(std::uint64_t))`, matching observed `ulong` slots.

## 4. Semantics

- **Lifecycle is an atomic state machine.** `ThreadState::lifecycle` (a `std::atomic<int>`)
  runs created → started → finished; `StartThread` CASes created → started, so a racing
  second start does not create two host threads against one state. Normal completion stores
  the finished lifecycle, sets the guarded `finished` bool and calls `doneCv.notify_all()`
  while still holding `doneLock`; notifying under the lock prevents a waiter from waking
  after the unlock and freeing the state before `notify_all` finishes touching the CV. If
  host-thread construction fails, the same completion is published so a waiter cannot hang.
  The trampoline releases its running reference after that lock is gone. `WaitThread` waits
  on `doneCv` until `finished`, and returns immediately for a never-started handle. It
  releases its reference only after the `unique_lock` scope ends.
- **Destroy is a claim plus a reference.** `DestroyThread` on a registered handle calls
  `ClaimThread`, which finds and erases the handle under `g_threadsLock` and transfers the
  registry's reference; exactly one concurrent destroyer gets the state, the other gets
  null. From another thread it waits on `doneCv` for a started handle before releasing; a
  handle that never started or is already finished is released directly. Self-destroy is
  detected with `g_runningState`: the caller marks the handle destroyed and releases its
  reference, while the trampoline's running reference keeps the state alive until it
  publishes completion and releases after the entry returns. Deletion is always the last
  `ReleaseThread`.
- **Null handle means the current thread for control calls.** `ThreadOf(nullptr)` lazily
  creates a `thread_local` implicit handle, so `GetThreadId(nullptr)`,
  `GetThreadPriority(nullptr)`, `SetThreadName(nullptr, ...)` and the mask/priority setters
  address the calling thread. `DestroyThread(nullptr)` returns immediately; on a host thread
  with only the implicit handle, pass `GetCurrentThread()` to `DestroyThread`, which clears
  `g_currentThread`/`g_implicitReady` so the next `GetCurrentThread()` rebuilds it.
- **`Try*` never blocks.** `TrySend` returns false when full or unusable, `TryReceive` when
  empty or unusable; `TryReceive` does not write its out parameter on failure.
- **`ReceiveMessageQueue` writes its out parameter only on success**, except on an unusable
  queue where it writes 0 rather than hanging; the `Try` form returns false there.
- **An unusable queue reports `-1`.** `GetMessageQueueCount` returns `-1` for a null or
  never-initialised queue, or one with a null buffer or zero capacity. A blocking send on
  such a queue returns immediately, discarding the message.
- **Core selection, defaults and stack info.** `SetThreadCoreMask` uses `1 << core` for
  `core` in `[0, 64)`, otherwise `mask`; `-1` is the observed "keep mask" form, and the
  mask is not validated. For a non-null handle with no host state: priority 0x20, id =
  handle address, name `""`. `GetCurrentStackInfo` returns real bounds on Windows
  (`GetCurrentThreadStackLimits`) and on Linux (`pthread_getattr_np`), or zero on other
  platforms and on failure.

## 5. Test coverage

`thread_tests.cpp` registers as `thread_contract`; it prints `77 checks, 0 failures`. CTest
registers 17 suites; this one has a 30 s timeout.

Verification recorded with this revision: TSan clean for both binaries; 50/50 stress runs
passed; the concurrent-destroy probe ran 2,500 iterations clean; ASan/UBSan/LSan clean.

| Test | Checks | Properties pinned |
|---|---:|---|
| `TestCreateStartWait` | 11 | id assigned before start and distinct from main; priority readable before start; `CreateThread` alone does not run the entry; `WaitThread` blocks for a 50 ms entry (measured ≥ 40 ms); start/wait runs it once with the same argument; `GetCurrentThread` inside is the created handle; id and priority visible inside. |
| `TestImplicitHandles` | 6 | main thread has a non-zero id; a plain `std::thread` gets a distinct, stable handle and id. |
| `TestThreadProperties` | 8 | name round-trip; initial priority; `ChangeThreadPriority` visibility; available mask contiguous; explicit core → that bit; `-1` keeps the mask; name visible inside; null names the current thread. |
| `TestDestroyUnstarted` | 3 | unstarted handle has an id, can be destroyed, and its storage re-created. |
| `TestDestroyFromSelf` | 3 | `DestroyThread` succeeds inside the entry point; the destroyed handle no longer reports the live thread; the entry returns without touching freed state. |
| `TestUninitialisedStorage` | 6 | garbage `ThreadType` reads default priority and an address-derived id; a control call is a no-op; the name is empty; garbage `MessageQueueType` reports `-1` and `TrySend` refuses it. |
| `TestConcurrentDestroy` | 1 | 50 rounds of entry and main destroying the same handle concurrently; the loop completes without touching freed state. |
| `TestManyThreads` | 6 | 8 distinct ids, none equal to main; all entries run; each concurrent entry sees its own handle; `GetThreadId(nullptr)` matches the handle it was created with; `YieldThread` returns. |
| `TestMessageQueue` | 33 | FIFO; empty/full `Try*`; failed `TryReceive` leaves the out parameter untouched; blocking receive waits and is woken by a send; blocking send waits on a full queue without overrunning; head/tail wrap returns 11 then 12; Finalize then re-initialise is the supported reuse path; null buffer gives count `-1`, failed `TrySend`, and a blocking receive returning 0; null queue gives `-1`. |

Build and run from the repository root:

```bash
cmake -S port -B build -G Ninja
cmake --build build
ctest --test-dir build --output-on-failure
```

`ctest --output-on-failure` alone must run inside `build/`; for this suite only use
`ctest --test-dir build -R thread_contract` or `./build/thread_tests`.

## 6. Known limitations

- **Re-initialising a queue without Finalize leaks.** `InitializeMessageQueue` zeroes the
  queue storage before installing state, so calling it on an already-initialised queue
  without `FinalizeMessageQueue` makes the previous state unreachable and leaks it; a
  thread blocked on that state stays blocked. The supported sequence is
  `FinalizeMessageQueue` then `InitializeMessageQueue`; `FinalizeSemaphore` is the
  equivalent release path for semaphores.
- **Finalisation is caller-driven.** Queue and semaphore host state is heap-allocated with
  no process-exit destructor, so callers must invoke `FinalizeSemaphore`/
  `FinalizeMessageQueue`; thread state is freed by the last `ReleaseThread` after
  `DestroyThread`, or after a self-destroying entry's trampoline releases its running
  reference. After finalisation, `GetMessageQueueCount` returns `-1`, `Try*` returns false,
  sends are no-ops and a blocking receive returns 0.
- **Thread creation is silent on rejection.** `CreateThread` returns `void`; a null handle,
  a re-create over a live handle, or allocation failure starts nothing and reports no error.
- **Host threads are detached.** There is no host thread object to wait on; completion is
  observed through `doneCv`, and `WaitThread` on a never-started handle returns immediately
  rather than hanging.
- **No host scheduler mapping.** Priority, core mask and core number are bookkeeping only;
  nothing changes where the host runs a thread.
- **Threads cannot be restarted.** After the entry returns, the handle is no longer in the
  created state, so `StartThread`'s CAS fails; it must be destroyed and created again.
- **Properties are unsynchronised.** `ThreadState::name`, `priority` and `coreMask` have no
  lock; changing them while the entry point reads them would race. Tests set them before
  `StartThread`.
- **Not ABI-compatible with the SDK.** `ThreadType` is a host-chosen 0x80 reserve that the
  layer does not use; `MessageQueueType` is the measured 0x48. This is safe only because
  observed sites never walk arrays of these types.
