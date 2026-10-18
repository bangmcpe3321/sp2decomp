#!/usr/bin/env bash
# Round 16: platform_linux.cpp grows the five functions the full runtime needs (Vulkan loader/surface,
# headless, memguard) and drops the eight stubs that the shared files now provide (frame_stats,
# touch_layout, perf_hint, input_script). window_minimized() must be false: vk_swapchain's wait loop
# would otherwise block forever with no window to un-minimize.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

python3 - "$P/runtime/src/platform_linux.cpp" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()

if 'vulkan_surface_extension' in s:
    print('already patched')
    raise SystemExit

# 1. include dlfcn
old = '#include <cerrno>\n'
assert old in s
s = s.replace(old, old + '#include <dlfcn.h>\n', 1)

# 2. window_minimized: false (no window; wait_while_minimized must not block)
old = 'bool window_minimized() { return true; }'
assert old in s
s = s.replace(old, 'bool window_minimized() { return false; }  // no window to minimize; vk_swapchain waits on this', 1)

# 3. replace the eight duplicate stubs with the five new functions
old = '''size_t touch_overlay(OverlayShape* out, size_t max) { (void)out; (void)max; return 0; }
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
'''
assert old in s
new = '''// PATCHED (round 16): touch_overlay, perf_hint_*, gpu_turbo, frame_thread_tick/frame_presented,
// thread_counters and input_script are implemented by the shared files (touch_layout.cpp, perf_hint.cpp,
// frame_stats.cpp, input_script.cpp) on Linux as on Windows -- stubs here were duplicate definitions.

// NX_HEADLESS=1: nothing presented (frames still render; NX_DUMP_FRAMES still writes them). Same as Windows.
bool headless() {
    static const bool on = std::getenv("NX_HEADLESS") != nullptr;
    return on;
}

// memguard_android.cpp has the real one; zero elsewhere (platform.h).
uint64_t memguard_overlap_ns(uint64_t from, uint64_t to) { (void)from; (void)to; return 0; }

// ---- Vulkan loader and surface --------------------------------------------------------------
// The loader at run time, as platform_win.cpp does with vulkan-1.dll; the port never links Vulkan.
void* vulkan_get_instance_proc_addr() {
    static void* p = [] {
        void* m = dlopen("libvulkan.so.1", RTLD_NOW | RTLD_LOCAL);
        return m ? dlsym(m, "vkGetInstanceProcAddr") : nullptr;
    }();
    return p;
}

// VK_EXT_headless_surface: a real surface with no window system. Both ICDs on this box (lavapipe,
// gfxstream) support it, so a surface -- and therefore the present-capable queue nvn_vk wants -- exists
// without a display. vulkan_create_surface below makes the matching surface.
const char* vulkan_surface_extension() { return "VK_EXT_headless_surface"; }

int vulkan_create_surface(void* instance, void* native_window, uint64_t* surface, void* gipa) {
    (void)native_window;  // headless: there is no window to attach to
    auto gipa_fn = reinterpret_cast<void* (*)(void*, const char*)>(gipa);
    auto create = reinterpret_cast<int (*)(void*, const void*, const void*, uint64_t*)>(
        gipa_fn(instance, "vkCreateHeadlessSurfaceEXT"));
    *surface = 0;
    if (create == nullptr) return -3;  // VK_ERROR_INITIALIZATION_FAILED
    // VkHeadlessSurfaceCreateInfoEXT{ sType=1000257000, pNext, flags } -- without the header, spelled out.
    struct { uint32_t sType; const void* pNext; uint32_t flags; } ci = {1000257000u, nullptr, 0u};
    uint64_t s = 0;
    int r = create(instance, &ci, nullptr, &s);
    *surface = s;
    return r;
}
'''
s = s.replace(old, new, 1)
open(p, 'w').write(s)
print('platform_linux.cpp patched')
PY

echo
echo "=== rebuild platform_linux.o + relink ==="
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src -I "$HOME/vkheaders/include" \
    runtime/src/platform_linux.cpp -o obj-all/_runtime/platform_linux.o 2> pl.txt || { echo "COMPILE FAILED"; head -20 pl.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(find "$P/obj-all/_runtime" -name '*.o' | tr '\n' ' ')
g++ -o "$P/sp2.new" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2> link2.txt || { echo "LINK FAILED"; head -25 link2.txt; exit 1; }
mv -f "$P/sp2.new" "$P/sp2"
echo "  linked: $(du -h "$P/sp2" | cut -f1)"

echo
echo "=== run (lavapipe ICD, headless) ==="
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json NX_HEADLESS=1 timeout 300 "$P/sp2" > "$P/vk.log" 2>&1
echo "  exit: $?"

echo
echo "=== signal ==="
grep -nE 'nvnBootstrapLoader|nvn:|nvn/vk|vulkan|fault address|guest lr|missing import|FATAL|assert|linking|linked:' "$P/vk.log" | head -60
echo "=== tail ==="
tail -25 "$P/vk.log"
