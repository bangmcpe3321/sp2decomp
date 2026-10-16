// Reconstruction progress tracker with fail-loudly dependency reporting.
//
// WHY THIS EXISTS. The platform layer used stub-and-document successfully because its
// stubs were bounded (51 imports). The engine layer is ~113,000 functions, so a silent
// stub would let the harness "pass" while omitting almost all of the work. This header
// makes an unimplemented engine dependency a LOUD, NAMED failure, so the build itself
// becomes the mechanism that discovers porting order.
//
// Usage in reconstructed code:
//     LP_ENGINE_REQUIRE("sead::HeapMgr::createCurrentHeap", 0x7100e6b7bc);
// at the point the dependency would be used. The macro records the requirement and
// throws MissingEngineDependency, which the harness catches and reports.
#pragma once

#include <cstdint>
#include <cstdio>
#include <stdexcept>
#include <string>
#include <vector>

namespace lp::recon {

// Thrown when reconstructed code reaches an engine function that is not yet ported.
// Carrying the *name and address* is the point: the report names the next thing to port.
class MissingEngineDependency : public std::runtime_error {
public:
    MissingEngineDependency(std::string name, std::uintptr_t address)
        : std::runtime_error("unimplemented engine dependency: " + name),
          mName(std::move(name)), mAddress(address) {}

    const std::string &name() const { return mName; }
    std::uintptr_t address() const { return mAddress; }

private:
    std::string mName;
    std::uintptr_t mAddress;
};

// One entry per distinct dependency the run needed.
struct Dependency {
    std::string name;
    std::uintptr_t address;
    bool implemented;
    int hitCount;
};

class DependencyRegistry {
public:
    static DependencyRegistry &instance() {
        static DependencyRegistry r;
        return r;
    }

    // Called by reconstructed code when a dependency is about to be used.
    // `implemented` is false only for the fail-loudly path; ported functions do not call
    // this at all, so in practice any call here is a missing dependency.
    void require(const char *name, std::uintptr_t address) {
        for (auto &d : mMissing) {
            if (d.address == address && d.name == name) {
                ++d.hitCount;
                throw MissingEngineDependency(name, address);
            }
        }
        mMissing.push_back(Dependency{name, address, false, 1});
        throw MissingEngineDependency(name, address);
    }

    // Record a function as ported, so the report can show real progress.
    void markImplemented(const char *name, std::uintptr_t address) {
        mImplemented.push_back(Dependency{name, address, true, 0});
    }

    const std::vector<Dependency> &missing() const { return mMissing; }
    const std::vector<Dependency> &implemented() const { return mImplemented; }

    void reset() {
        mMissing.clear();
        mImplemented.clear();
    }

    // Human-readable report of what a run reached.
    std::string report() const {
        std::string s;
        s += "engine dependencies implemented: " + std::to_string(mImplemented.size()) + "\n";
        s += "engine dependencies MISSING    : " + std::to_string(mMissing.size()) + "\n";
        for (const auto &d : mMissing) {
            s += "  MISSING  " + d.name;
            if (d.address) {
                char buf[32];
                std::snprintf(buf, sizeof(buf), " (0x%llx)",
                              static_cast<unsigned long long>(d.address));
                s += buf;
            }
            s += "  reached " + std::to_string(d.hitCount) + "x\n";
        }
        return s;
    }

private:
    std::vector<Dependency> mMissing;
    std::vector<Dependency> mImplemented;
};

} // namespace lp::recon

// Declare that reconstructed code needs an engine function that is not ported yet.
#define LP_ENGINE_REQUIRE(name, addr) \
    ::lp::recon::DependencyRegistry::instance().require((name), (addr))

// Declare an engine function as ported (called once per ported function).
#define LP_ENGINE_PORTED(name, addr) \
    ::lp::recon::DependencyRegistry::instance().markImplemented((name), (addr))
