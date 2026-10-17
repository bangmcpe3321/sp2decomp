// Splatoon 2 (01003BC0000A0000) glue for the shared MIT runtime.
//
// This is the whole per-game file: the runtime asks each game for an Info struct and three hooks
// (see nx/game.h), and for the generated module tables, which the recompiler already emitted as
// `extern const nx::ModuleInfo nx_module_<name>` in each module's table.cpp.
//
// Splatoon 2's dump: title 01003BC0000A0000, USA, build id F18FF3CFCBAD0884..., image base
// 0x7100000000 (established in the platform-layer work in port/ and docs/PLATFORM_REFERENCE.md).
#include <nx/game.h>
#include <nx/module.h>
#include <nx/runtime.h>

namespace nx {

const game::Info game::kInfo = {
    "sp2",                          // id: lowercase tag
    "Splatoon 2",                   // title
    0x01003BC0000A0000ull,          // program id (Splatoon 2 USA)
    "",                             // android_package: no APK for this port
    "private/sp2",                  // pc_data_root
    0x0,                            // system_resource_size: not established; 0 disables VAMM
};

// The recompiler emitted these per module; they are `extern const` in each table.cpp.
extern const ModuleInfo nx_module_main;
extern const ModuleInfo nx_module_sdk;
#if defined(NX_HAVE_SUBSDKS)
extern const ModuleInfo nx_module_subsdk0;
extern const ModuleInfo nx_module_subsdk1;
extern const ModuleInfo nx_module_subsdk2;
extern const ModuleInfo nx_module_subsdk3;
#endif

void game::after_init() {}
void game::renderer_start() {}
void game::first_frame() {}

} // namespace nx
