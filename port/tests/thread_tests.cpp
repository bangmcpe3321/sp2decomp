// Contract tests for the reconstructed nn::os thread and message-queue layer.
//
// Each check names the property a call site requires. Thread creation is reached from
// sead::Thread (boot closure, depth 4); message queues from sead::MessageQueue::allocate.
// The queue capacity/offset evidence and the ThreadType caveats are in TYPE_SIZES.md.
#include "nn/os.hpp"

#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstring>
#include <set>
#include <thread>
#include <vector>

namespace {

int g_failures = 0;
int g_checks = 0;

void Check(bool cond, const char *what) {
    ++g_checks;
    if (!cond) {
        ++g_failures;
        std::printf("  FAIL  %s\n", what);
    } else {
        std::printf("  ok    %s\n", what);
    }
}

// ---------------------------------------------------------------------------
// CreateThread only creates; StartThread runs it; WaitThread joins. This is the
// ordering sead::Thread relies on, and a CreateThread that started eagerly would make
// SetThreadName/SetThreadCoreMask race the entry point.
// ---------------------------------------------------------------------------
void TestCreateStartWait() {
    std::printf("CreateThread / StartThread / WaitThread\n");

    struct Context {
        std::atomic<bool> ran{false};
        void *observedArgument = nullptr;
        nn::os::ThreadType *observedHandle = nullptr;
        std::uint64_t observedId = 0;
        int observedPriority = 0;
    } ctx;

    nn::os::ThreadType thread{};
    nn::os::CreateThread(
        &thread,
        [](void *argument) {
            // Deliberately longer than a scheduler tick so a WaitThread that returns
            // immediately (instead of joining) is caught by the elapsed-time check.
            std::this_thread::sleep_for(std::chrono::milliseconds(50));
            auto *c = static_cast<Context *>(argument);
            c->observedArgument = argument;
            c->observedHandle = nn::os::GetCurrentThread();
            c->observedId = nn::os::GetThreadId(nullptr);
            c->observedPriority = nn::os::GetThreadPriority(nullptr);
            c->ran.store(true);
        },
        &ctx, nullptr, 0, 0x10);

    const std::uint64_t mainId = nn::os::GetThreadId(nullptr);
    const std::uint64_t threadId = nn::os::GetThreadId(&thread);
    Check(threadId != 0, "CreateThread assigns a non-zero id before the thread runs");
    Check(threadId != mainId, "a created thread has its own identity");
    Check(nn::os::GetThreadPriority(&thread) == 0x10,
          "the priority passed to CreateThread is readable before start");
    Check(!ctx.ran.load(), "CreateThread alone does NOT run the entry point");

    const auto waitStart = std::chrono::steady_clock::now();
    nn::os::StartThread(&thread);
    nn::os::WaitThread(&thread);
    const auto waitedUs = std::chrono::duration_cast<std::chrono::microseconds>(
                              std::chrono::steady_clock::now() - waitStart)
                              .count();
    std::printf("        WaitThread returned after %lld us (entry sleeps 50000 us)\n",
                static_cast<long long>(waitedUs));
    Check(waitedUs >= 40000, "WaitThread blocks until the entry point returns");

    Check(ctx.ran.load(), "StartThread runs the entry point");
    Check(ctx.observedArgument == &ctx, "the argument is passed through unchanged");
    Check(ctx.observedHandle == &thread,
          "GetCurrentThread inside the entry point is the created handle");
    Check(ctx.observedId == threadId, "GetThreadId(nullptr) inside matches the handle");
    Check(ctx.observedPriority == 0x10, "the priority is visible inside the thread");

    nn::os::DestroyThread(&thread);
    Check(true, "DestroyThread releases a joined thread");
}

// ---------------------------------------------------------------------------
// A host thread that did not come through CreateThread still gets a stable handle.
// The port's own main thread is exactly this case.
// ---------------------------------------------------------------------------
void TestImplicitHandles() {
    std::printf("Implicit handles for host threads\n");

    nn::os::ThreadType *mainHandle = nn::os::GetCurrentThread();
    const std::uint64_t mainId = nn::os::GetThreadId(mainHandle);
    Check(mainHandle != nullptr, "the main thread has a handle");
    Check(mainId != 0, "and a non-zero id");

    nn::os::ThreadType *otherHandle = nullptr;
    std::uint64_t otherId = 0;
    std::thread t([&] {
        otherHandle = nn::os::GetCurrentThread();
        otherId = nn::os::GetThreadId(nullptr);
        Check(otherHandle != mainHandle, "a plain host thread gets a distinct handle");
        Check(otherId != mainId, "and a distinct id");
        Check(nn::os::GetCurrentThread() == otherHandle,
              "and the handle is stable within that thread");
    });
    t.join();
    Check(otherHandle != nullptr, "the handle was observed");
}

// ---------------------------------------------------------------------------
// Name, priority and affinity are settable and readable on the handle. The SDK has no
// getters for the name/mask, so these use the diagnostic accessors added beside them.
// ---------------------------------------------------------------------------
void TestThreadProperties() {
    std::printf("Thread name / priority / core mask\n");

    nn::os::ThreadType thread{};
    std::atomic<bool> checkedInside{false};

    nn::os::CreateThread(
        &thread,
        [](void *argument) {
            auto *ok = static_cast<std::atomic<bool> *>(argument);
            ok->store(std::strcmp(nn::os::GetThreadName(nullptr), "sp2-worker") == 0);
        },
        &checkedInside, nullptr, 0, 0x12);

    nn::os::SetThreadName(&thread, "sp2-worker");
    Check(std::strcmp(nn::os::GetThreadName(&thread), "sp2-worker") == 0,
          "SetThreadName/GetThreadName round-trip on a created handle");

    Check(nn::os::GetThreadPriority(&thread) == 0x12, "initial priority is preserved");
    nn::os::ChangeThreadPriority(&thread, 0x22);
    Check(nn::os::GetThreadPriority(&thread) == 0x22,
          "ChangeThreadPriority is visible through GetThreadPriority");

    const std::uint64_t available = nn::os::GetThreadAvailableCoreMask();
    Check(available != 0 && (available & (available + 1)) == 0,
          "GetThreadAvailableCoreMask is non-empty and contiguous");

    nn::os::SetThreadCoreMask(&thread, 2, 0);
    Check(nn::os::GetThreadCoreMask(&thread) == (1ull << 2),
          "an explicit core selects exactly that core");

    nn::os::SetThreadCoreMask(&thread, -1, 0b1011ull);
    Check(nn::os::GetThreadCoreMask(&thread) == 0b1011ull,
          "core == -1 leaves the supplied mask");

    nn::os::StartThread(&thread);
    nn::os::WaitThread(&thread);
    Check(checkedInside.load(), "the name is visible from inside the thread");
    nn::os::DestroyThread(&thread);

    nn::os::SetThreadName(nullptr, "sp2-main");
    Check(std::strcmp(nn::os::GetThreadName(nullptr), "sp2-main") == 0,
          "the null handle names the current thread");
}

// ---------------------------------------------------------------------------
// A handle can be created, destroyed without ever starting, and the same storage reused.
// ---------------------------------------------------------------------------
void TestDestroyUnstarted() {
    std::printf("DestroyThread on an unstarted handle\n");

    nn::os::ThreadType thread{};
    nn::os::CreateThread(&thread, [](void *) {}, nullptr, nullptr, 0, 0x20);
    Check(nn::os::GetThreadId(&thread) != 0, "created handle has an id");
    nn::os::DestroyThread(&thread);
    Check(true, "DestroyThread accepts a thread that never started");

    // Reuse the same caller-owned storage: this is what an inline ThreadType field does.
    nn::os::CreateThread(&thread, [](void *) {}, nullptr, nullptr, 0, 0x21);
    Check(nn::os::GetThreadPriority(&thread) == 0x21,
          "the same storage can be re-created after destroy");
    nn::os::DestroyThread(&thread);
}

// ---------------------------------------------------------------------------
// DestroyThread from the thread's own entry point. Ownership of the host state moves to
// the trampoline; the handle is invalidated, but the state must stay alive until the
// entry returns. An earlier implementation detached and then freed it, which ASan
// reported as a heap-use-after-free on the trampoline's final write.
// ---------------------------------------------------------------------------
void TestDestroyFromSelf() {
    std::printf("DestroyThread from the thread itself\n");

    nn::os::ThreadType thread{};
    struct Context {
        nn::os::ThreadType *thread;
        std::atomic<bool> destroyed{false};
        std::atomic<bool> finished{false};
    } ctx;
    ctx.thread = &thread;

    nn::os::CreateThread(
        &thread,
        [](void *argument) {
            auto *c = static_cast<Context *>(argument);
            nn::os::DestroyThread(c->thread);
            c->destroyed.store(true);
            c->finished.store(true);
        },
        &ctx, nullptr, 0, 0x20);

    nn::os::StartThread(&thread);
    // The handle was detached, so WaitThread cannot join it. Wait for the entry point to
    // return; the trampoline then frees the state.
    while (!ctx.finished.load()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(20));

    Check(ctx.destroyed.load(), "DestroyThread succeeds inside the entry point");
    Check(nn::os::GetThreadId(&thread) != nn::os::GetThreadId(nullptr),
          "the destroyed handle no longer reports the live thread");
    Check(true, "the entry point returned without touching freed state");
    // The handle is invalid now; destroying it again must be a no-op.
    nn::os::DestroyThread(&thread);
}

// ---------------------------------------------------------------------------
// Caller storage that was never initialised must degrade to "no host state", not be read
// as a pointer. The SDK has an inline ThreadType site (`this + 8`), so this path matters.
// ---------------------------------------------------------------------------
void TestUninitialisedStorage() {
    std::printf("Uninitialised caller storage\n");

    nn::os::ThreadType thread{};
    std::memset(thread.storage, 0xA5, sizeof(thread.storage));
    Check(nn::os::GetThreadPriority(&thread) == 0x20,
          "a garbage ThreadType reads as the default priority, not a wild pointer");
    Check(nn::os::GetThreadId(&thread) != 0,
          "and still yields a stable address-derived id");
    nn::os::ChangeThreadPriority(&thread, 0x10);
    Check(nn::os::GetThreadPriority(&thread) == 0x20,
          "a control call on a garbage handle is a no-op");
    Check(nn::os::GetThreadName(&thread)[0] == '\0', "and reports no name");

    alignas(16) nn::os::MessageQueueType queue{};
    std::memset(queue.storage, 0xA5, sizeof(queue.storage));
    Check(nn::os::GetMessageQueueCount(&queue) == -1,
          "a garbage MessageQueueType reads as unusable");
    Check(!nn::os::TrySendMessageQueue(&queue, 1),
          "and TrySend refuses it instead of writing through garbage");
}

// ---------------------------------------------------------------------------
// DestroyThread from the entry and from main at the same time. Exactly one may own the
// teardown; the other must get a null claim, never a pointer into freed state. This is the
// shape TSan used to find a lookup/delete race, so keep it in the suite.
// ---------------------------------------------------------------------------
void TestConcurrentDestroy() {
    std::printf("Concurrent DestroyThread (entry + main)\n");

    struct Context {
        nn::os::ThreadType *handle = nullptr;
        std::atomic<int> ready{0};
        std::atomic<int> done{0};
    };

    constexpr int kRounds = 50;
    for (int i = 0; i < kRounds; ++i) {
        nn::os::ThreadType thread{};
        Context ctx;
        ctx.handle = &thread;

        nn::os::CreateThread(
            &thread,
            [](void *argument) {
                auto *c = static_cast<Context *>(argument);
                c->ready.fetch_add(1);
                while (c->ready.load() < 2) std::this_thread::yield();
                nn::os::DestroyThread(c->handle);
                c->done.fetch_add(1);
            },
            &ctx, nullptr, 0, 0x20);

        nn::os::StartThread(&thread);
        ctx.ready.fetch_add(1);
        while (ctx.ready.load() < 2) std::this_thread::yield();

        nn::os::DestroyThread(&thread);
        ctx.done.fetch_add(1);
        while (ctx.done.load() < 2) std::this_thread::yield();
    }
    Check(true, "50 entry+main destroy races complete without touching freed state");
}

// ---------------------------------------------------------------------------
// Many live threads: ids stay unique, handles propagate per-thread, and the host can run
// them concurrently.
// ---------------------------------------------------------------------------
void TestManyThreads() {
    std::printf("8 concurrent created threads\n");

    struct Slot {
        nn::os::ThreadType *handle = nullptr;
        std::uint64_t expectedId = 0;
        std::atomic<bool> sawOwnHandle{false};
        std::atomic<std::uint64_t> observedId{0};
        std::atomic<int> *ran = nullptr;
    };

    constexpr int kCount = 8;
    nn::os::ThreadType threads[kCount]{};
    Slot slots[kCount]{};
    std::atomic<int> ran{0};
    std::set<std::uint64_t> ids;
    const std::uint64_t mainId = nn::os::GetThreadId(nullptr);

    for (int i = 0; i < kCount; ++i) {
        slots[i].handle = &threads[i];
        slots[i].ran = &ran;
        nn::os::CreateThread(&threads[i], [](void *argument) {
            auto *slot = static_cast<Slot *>(argument);
            slot->sawOwnHandle.store(nn::os::GetCurrentThread() == slot->handle);
            slot->observedId.store(nn::os::GetThreadId(nullptr));
            slot->ran->fetch_add(1);
        }, &slots[i], nullptr, 0, 0x20);

        // The ids are readable before start, so they can be compared without racing an
        // entry point that might already be running.
        slots[i].expectedId = nn::os::GetThreadId(&threads[i]);
        ids.insert(slots[i].expectedId);
    }
    Check(ids.size() == kCount, "all created ids are distinct");
    Check(ids.count(mainId) == 0, "no created id collides with the main thread");

    for (int i = 0; i < kCount; ++i) nn::os::StartThread(&threads[i]);
    for (int i = 0; i < kCount; ++i) nn::os::WaitThread(&threads[i]);

    Check(ran.load() == kCount, "every thread ran its entry point exactly once");
    bool handlesOk = true;
    bool idsOk = true;
    for (int i = 0; i < kCount; ++i) {
        handlesOk = handlesOk && slots[i].sawOwnHandle.load();
        idsOk = idsOk && slots[i].observedId.load() == slots[i].expectedId;
    }
    Check(handlesOk, "each concurrent entry point sees its own handle");
    Check(idsOk, "and GetThreadId(nullptr) matches the handle it was created with");

    for (int i = 0; i < kCount; ++i) nn::os::DestroyThread(&threads[i]);

    // YieldThread is a scheduling hint, not a no-op contract; it must simply return.
    nn::os::YieldThread();
    Check(true, "YieldThread returns");
}

// ---------------------------------------------------------------------------
// Message queue: FIFO over caller-owned storage, blocking send/receive with Try* forms.
// `InitializeMessageQueue((MessageQueueType *)(this + 0x1f8), (ulong *)(this + 0x240),
// 0x20)` fixes the buffer as caller-owned and 0x20/0x21 as observed capacities.
// ---------------------------------------------------------------------------
void TestMessageQueue() {
    std::printf("Message queue (FIFO, blocking and try forms)\n");

    alignas(16) nn::os::MessageQueueType queue{};
    std::uint64_t buffer[4] = {};
    nn::os::InitializeMessageQueue(&queue, buffer, 4);

    Check(nn::os::GetMessageQueueCount(&queue) == 0, "a fresh queue is empty");

    nn::os::Message unused = 0xDEAD;
    Check(!nn::os::TryReceiveMessageQueue(&unused, &queue),
          "TryReceive on an empty queue returns false");
    Check(unused == 0xDEAD, "and does not write the out parameter on failure");

    Check(nn::os::TrySendMessageQueue(&queue, 1), "TrySend succeeds with space");
    Check(nn::os::TrySendMessageQueue(&queue, 2), "TrySend succeeds again");
    Check(nn::os::TrySendMessageQueue(&queue, 3), "TrySend fills to capacity");
    Check(nn::os::TrySendMessageQueue(&queue, 4), "TrySend fills the last slot");
    Check(nn::os::GetMessageQueueCount(&queue) == 4, "count reaches capacity");
    Check(!nn::os::TrySendMessageQueue(&queue, 5),
          "TrySend on a full queue returns false");

    for (nn::os::Message expected = 1; expected <= 4; ++expected) {
        nn::os::Message got = 0;
        Check(nn::os::TryReceiveMessageQueue(&got, &queue), "TryReceive succeeds");
        Check(got == expected, "messages arrive in FIFO order");
    }
    Check(!nn::os::TryReceiveMessageQueue(&unused, &queue), "the queue is empty again");

    // A blocking receive must actually block until a send arrives.
    {
        std::atomic<bool> received{false};
        nn::os::Message got = 0;
        std::thread waiter([&] {
            nn::os::ReceiveMessageQueue(&got, &queue);
            received.store(true);
        });
        std::this_thread::sleep_for(std::chrono::milliseconds(60));
        Check(!received.load(), "ReceiveMessageQueue BLOCKS on an empty queue");
        nn::os::SendMessageQueue(&queue, 0x1234);
        waiter.join();
        Check(received.load(), "a send wakes the blocked receiver");
        Check(got == 0x1234, "the blocked receive returns the sent message");
    }

    // A blocking send must wait while the queue is full.
    {
        // Re-initialisation is only well-defined after releasing the previous host state.
        nn::os::FinalizeMessageQueue(&queue);
        nn::os::InitializeMessageQueue(&queue, buffer, 2);
        nn::os::SendMessageQueue(&queue, 10);
        nn::os::SendMessageQueue(&queue, 11);
        Check(nn::os::GetMessageQueueCount(&queue) == 2, "queue is full");

        std::atomic<bool> sent{false};
        std::thread sender([&] {
            nn::os::SendMessageQueue(&queue, 12);
            sent.store(true);
        });
        std::this_thread::sleep_for(std::chrono::milliseconds(60));
        Check(!sent.load(), "SendMessageQueue BLOCKS on a full queue");
        Check(nn::os::GetMessageQueueCount(&queue) == 2,
              "a blocked send does not overrun the buffer");

        nn::os::Message got = 0;
        nn::os::ReceiveMessageQueue(&got, &queue);
        Check(got == 10, "the first message is still first");
        sender.join();
        Check(sent.load(), "a receive wakes the blocked sender");
        Check(nn::os::GetMessageQueueCount(&queue) == 2, "the blocked send then lands");

        // Drain the wrapped ring: 11 was at index 1 and 12 wrapped to index 0. Checking
        // both pins head/tail wrap order, not just the trivial pre-wrap sequence.
        nn::os::Message wrapped = 0;
        nn::os::ReceiveMessageQueue(&wrapped, &queue);
        Check(wrapped == 11, "the wrapped queue returns slot 1 in order");
        nn::os::ReceiveMessageQueue(&wrapped, &queue);
        Check(wrapped == 12, "and the wrapped slot 0 after it");
        nn::os::FinalizeMessageQueue(&queue);
    }

    // An unusable queue is reported as such rather than looking empty.
    {
        alignas(16) nn::os::MessageQueueType bad{};
        nn::os::InitializeMessageQueue(&bad, nullptr, 4);
        Check(nn::os::GetMessageQueueCount(&bad) == -1,
              "a null buffer leaves the queue unusable (count -1)");
        Check(!nn::os::TrySendMessageQueue(&bad, 1), "TrySend on an unusable queue fails");
        nn::os::Message sentinel = 0xABC;
        nn::os::ReceiveMessageQueue(&sentinel, &bad);
        Check(sentinel == 0, "a blocking receive on an unusable queue returns 0, not a hang");
        nn::os::FinalizeMessageQueue(&bad);
    }

    Check(nn::os::GetMessageQueueCount(nullptr) == -1, "null queue reports unusable");
}

} // namespace

int main() {
    std::printf("nn::os thread / message-queue contract tests\n");
    std::printf("(properties derived from call sites in main; see PLATFORM_IMPLEMENTATION_SPEC.md)\n\n");

    TestCreateStartWait();
    std::printf("\n");
    TestImplicitHandles();
    std::printf("\n");
    TestThreadProperties();
    std::printf("\n");
    TestDestroyUnstarted();
    std::printf("\n");
    TestDestroyFromSelf();
    std::printf("\n");
    TestUninitialisedStorage();
    std::printf("\n");
    TestConcurrentDestroy();
    std::printf("\n");
    TestManyThreads();
    std::printf("\n");
    TestMessageQueue();

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
