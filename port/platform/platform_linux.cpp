// platform_linux.cpp -- the host layer the MIT runtime needs, for Linux.
//
// The runtime's own header (runtime/src/platform.h) says: "What the runtime needs from the host OS.
// platform_win.cpp and platform_android.cpp implement it." There is no Linux implementation -- the
// project's README says so explicitly ("Linux is not ported yet, but close ... What is missing is a
// platform_linux.cpp (window, input, audio) and a memguard_linux.cpp").
//
// A link of the full Splatoon 2 tree measured exactly 26 nx::plat::* symbols missing, which is this
// file. That measurement is in RECOMP_LINK_RESULT.md.
//
// DESIGN
//   Real implementations for everything the CPU/runtime path needs: memory reservation at fixed
//   guest addresses, threads, time, file I/O, logging, and an entry point.
//   HONEST STUBS for display, input, audio and perf, which are Android/PC-specific and which this
//   goal explicitly excludes (no GPU, no window, no shaders).
//
// NOT stubbed here: write_watch_*, which runtime/src/write_watch.cpp already implements with POSIX
// page protection -- that works on Linux, and duplicating it produced "multiple definition" errors.
#include "platform.h"

#include <cerrno>
#include <cctype>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <thread>

#include <pthread.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

namespace nx::plat {

// ---- memory: fixed-address reservations ---------------------------------------------------
bool reserve(uint64_t addr, uint64_t size) {
    void* p = mmap(reinterpret_cast<void*>(addr), size, PROT_NONE,
                   MAP_PRIVATE | MAP_ANONYMOUS | MAP_NORESERVE | MAP_FIXED_NOREPLACE, -1, 0);
    if (p == MAP_FAILED) return false;
    return reinterpret_cast<uint64_t>(p) == addr;
}

bool commit(uint64_t addr, uint64_t size) {
    // "Make [addr, addr+size) read/write" must WORK EVEN IF NOTHING IS MAPPED THERE YET -- the
    // loader commits module memory without a preceding reserve on this path, and a bare mprotect
    // then fails with ENOMEM ("FATAL: cannot commit module main", observed on the first run).
    // So: try mprotect first (cheap, respects an earlier PROT_NONE reservation), and if that fails,
    // install the mapping outright.
    if (mprotect(reinterpret_cast<void*>(addr), size, PROT_READ | PROT_WRITE) == 0) return true;
    void* p = mmap(reinterpret_cast<void*>(addr), size, PROT_READ | PROT_WRITE,
                   MAP_PRIVATE | MAP_ANONYMOUS | MAP_FIXED, -1, 0);
    return p != MAP_FAILED && reinterpret_cast<uint64_t>(p) == addr;
}

void decommit(uint64_t addr, uint64_t size) {
    (void)madvise(reinterpret_cast<void*>(addr), size, MADV_DONTNEED);
    (void)mprotect(reinterpret_cast<void*>(addr), size, PROT_NONE);
}

// ---- threads and time ---------------------------------------------------------------------
void start_thread(ThreadFn fn, void* arg, size_t stack_size) {
    (void)stack_size;
    std::thread t([fn, arg] { fn(arg); });
    t.detach();
}

void exit_thread() { pthread_exit(nullptr); }
void exit_process(int code) { std::exit(code); }

void sleep_ns(int64_t ns) {
    if (ns <= 0) return;
    timespec ts;
    ts.tv_sec = static_cast<time_t>(ns / 1000000000);
    ts.tv_nsec = static_cast<long>(ns % 1000000000);
    while (nanosleep(&ts, &ts) == -1 && errno == EINTR) {
    }
}

void yield() { std::this_thread::yield(); }

void set_thread_name(const char* name) {
    if (name == nullptr) return;
    char buf[16];
    std::strncpy(buf, name, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    (void)pthread_setname_np(pthread_self(), buf);
}

int64_t current_thread_id() { return static_cast<int64_t>(gettid()); }

bool profile(const int64_t* tids, const uint64_t* const* guest_lr, size_t count, int seconds,
             const std::string& path) {
    (void)tids; (void)guest_lr; (void)count; (void)seconds; (void)path;
    return false;
}

uint64_t monotonic_ns() {
    timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return static_cast<uint64_t>(ts.tv_sec) * 1000000000ull + static_cast<uint64_t>(ts.tv_nsec);
}

// ---- files --------------------------------------------------------------------------------
FILE* fopen_utf8(const std::string& path, const char* mode) { return std::fopen(path.c_str(), mode); }
int64_t ftell64(FILE* f) { return static_cast<int64_t>(ftello(f)); }
int fseek64(FILE* f, int64_t off, int origin) { return fseeko(f, static_cast<off_t>(off), origin); }

uint64_t read_at(FILE* f, int64_t off, void* buf, uint64_t size) {
    if (f == nullptr || buf == nullptr) return 0;
    ssize_t n = pread(fileno(f), buf, static_cast<size_t>(size), static_cast<off_t>(off));
    return n > 0 ? static_cast<uint64_t>(n) : 0;
}

bool make_dirs(const std::string& path) {
    if (path.empty()) return false;
    std::string acc;
    for (size_t i = 0; i < path.size(); ++i) {
        acc.push_back(path[i]);
        const bool last = (i + 1 == path.size());
        if (path[i] == '/' || last) {
            if (acc == "/" || acc.empty()) continue;
            if (mkdir(acc.c_str(), 0755) != 0 && errno != EEXIST) return false;
        }
    }
    return true;
}

// ---- output -------------------------------------------------------------------------------
void log_line(const char* line) {
    if (line == nullptr) return;
    std::fputs(line, stderr);
    std::fputc('\n', stderr);
    std::fflush(stderr);
}

std::string data_root() {
    const char* env = std::getenv("NX_DATA");
    return env != nullptr ? std::string(env) : std::string("private");
}

std::string setting(const std::string& key) {
    std::string name = "NX_";
    for (char c : key) name.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(c))));
    const char* env = std::getenv(name.c_str());
    return env != nullptr ? std::string(env) : std::string();
}

// ---- display and input -- STUBS -----------------------------------------------------------
void* create_window() { return nullptr; }
void release_window(void* w) { (void)w; }
uint64_t window_generation() { return 0; }
bool window_minimized() { return true; }
void window_size(uint32_t& w, uint32_t& h) { w = 1280; h = 720; }
void screen_size(uint32_t& w, uint32_t& h) { w = 1280; h = 720; }
float default_render_scale() { return 1.0f; }
void read_pad(PadState& p) { p = PadState{}; }
size_t touch_overlay(OverlayShape* out, size_t max) { (void)out; (void)max; return 0; }
void perf_hint_thread() {}
void perf_hint_frame(int64_t ns) { (void)ns; }
void gpu_turbo() {}
void frame_thread_tick(int role) { (void)role; }
void frame_presented() {}
void thread_counters(uint64_t& cpu_ns, long faults[2], long switches[2]) {
    cpu_ns = 0;
    faults[0] = faults[1] = 0;
    switches[0] = switches[1] = 0;
}
void input_script(PadState& p) { (void)p; }

// ---- audio -- STUB, and honestly so -------------------------------------------------------
// platform.h says audio_submit returning false means "no device (caller paces itself)". Opening NO
// device is the correct headless behaviour: the game's audio renderer then paces itself instead of
// waiting on a device that does not exist.
bool audio_open(AudioDone done) { (void)done; return false; }
bool audio_submit(const void* data, size_t bytes, void* ctx) {
    (void)data; (void)bytes; (void)ctx;
    return false;
}
uint32_t audio_queued() { return 0; }
void audio_pause(bool paused) { (void)paused; }

} // namespace nx::plat

// ---- the entry point ----------------------------------------------------------------------
// platform_win.cpp and platform_mac.cpp each provide main(); the runtime has no entry point of its
// own. Same shape as the Windows one, minus the Win32 crash/watch setup.
#include <nx/runtime.h>

namespace nx {
void boot(); // defined in runtime/src/main.cpp; declared in no header
}

int main() {
    try {
        nx::boot();
    } catch (const nx::LongJmp& j) {
        (void)j;
        nx::plat::log_line("longjmp with no setjmp frame");
        return 3;
    } catch (const std::exception& e) {
        nx::plat::log_line(e.what());
        return 4;
    }
    return 0;
}
