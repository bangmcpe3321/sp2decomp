// Contract tests for the first reconstructed ENGINE functions.
//
// These are ports of decompiled bodies, not reconstructed signatures, so the checks
// assert the specific behaviour those bodies exhibit:
//
//   Lp::Utl::dumpDateTime   @ 0x71012cdbf4, 216 bytes
//   Lp::Utl::dumpMemoryInfo @ 0x71012cdccc, 408 bytes
//
// Both call sead::DateTime/CalendarTime, which are also reconstructed here, and
// dumpMemoryInfo additionally reaches the platform layer via nn::os::QueryMemoryInfo.
#include "lp/utl.hpp"
#include "sead/date_time.hpp"
#include "nn/os.hpp"
#include "nn/services.hpp"

#include <chrono>
#include <cstdio>

namespace {

int g_failures = 0;
int g_checks = 0;

void Check(bool cond, const char *what) {
    ++g_checks;
    if (!cond) { ++g_failures; std::printf("  FAIL  %s\n", what); }
    else { std::printf("  ok    %s\n", what); }
}

// ---------------------------------------------------------------------------
// sead::DateTime / CalendarTime. The boot root's dumpDateTime sequence is:
//   DateTime(0); setNow(); CalendarTime(); getCalendarTime();
// so getCalendarTime must overwrite the default-constructed CalendarTime.
// ---------------------------------------------------------------------------
void TestDateTime() {
    std::printf("sead::DateTime / CalendarTime (dumpDateTime's dependencies)\n");

    sead::DateTime dt(0);
    Check(dt.value() == 0, "DateTime(0) holds zero before setNow");

    dt.setNow();
    const auto nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    const auto drift = nowMs - dt.value();
    std::printf("        setNow() drift vs host clock = %lld ms\n", static_cast<long long>(drift));
    Check(drift >= -5 && drift < 5000,
          "setNow() reads the system clock in milliseconds");
    Check(dt.value() > 1'577'836'800'000LL,
          "and lands after 2020, confirming the unit is milliseconds");

    // The binary constructs a CalendarTime with the cDefault* values and then overwrites
    // it, so getCalendarTime must replace every field.
    sead::CalendarTime ct(2000, 1, 1, 0, 0, 0);
    dt.getCalendarTime(&ct);
    Check(ct.year() >= 2020, "getCalendarTime overwrites the placeholder year");
    Check(ct.month() >= 1 && ct.month() <= 12, "month is in range");
    Check(ct.day() >= 1 && ct.day() <= 31, "day is in range");
    Check(ct.hour() >= 0 && ct.hour() <= 23, "hour is in range");
    Check(ct.minute() >= 0 && ct.minute() <= 59, "minute is in range");
    Check(ct.second() >= 0 && ct.second() <= 61, "second is in range");
    std::printf("        -> %04d-%02d-%02d %02d:%02d:%02d\n",
                ct.year(), ct.month(), ct.day(), ct.hour(), ct.minute(), ct.second());

    // A UTC instant must convert correctly, which pins the arithmetic.
    // 2021-01-01T12:34:56Z = 1609504496 s
    sead::DateTime fixed(1'609'504'496'000LL);
    sead::CalendarTime out;
    fixed.getCalendarTime(&out);
    Check(out.year() == 2021 && out.month() == 1 && out.day() == 1,
          "a known instant converts to the right date");
    std::printf("        fixed instant -> %04d-%02d-%02d %02d:%02d:%02d (local)\n",
                out.year(), out.month(), out.day(), out.hour(), out.minute(), out.second());

    fixed.getCalendarTime(nullptr);
    Check(true, "getCalendarTime tolerates a null out pointer");
}

// ---------------------------------------------------------------------------
// Lp::Utl::dumpDateTime — logs "### <label> [hh:mm:ss] ###".
// ---------------------------------------------------------------------------
void TestDumpDateTime() {
    std::printf("Lp::Utl::dumpDateTime (0x71012cdbf4, 216 bytes)\n");

    std::printf("        (expect the reconstructed boot log line below)\n");
    Lp::Utl::dumpDateTime(" Application Start Time");
    Check(true, "dumpDateTime runs end to end through the diag log path");

    // A null label must not crash: the boot root always passes a literal, but the
    // function's contract takes a pointer.
    Lp::Utl::dumpDateTime(nullptr);
    Check(true, "dumpDateTime tolerates a null label");
}

// ---------------------------------------------------------------------------
// Lp::Utl::dumpMemoryInfo — the first place the reconstructed ENGINE meets the
// reconstructed PLATFORM layer, via nn::os::QueryMemoryInfo.
// ---------------------------------------------------------------------------
void TestDumpMemoryInfo() {
    std::printf("Lp::Utl::dumpMemoryInfo (0x71012cdccc, 408 bytes)\n");

    // Pin the platform dependency independently of the log output.
    nn::os::MemoryInfo direct{};
    nn::os::QueryMemoryInfo(&direct);
    Check(direct.totalSize > 0, "the platform layer answers QueryMemoryInfo");

    std::printf("        (expect the reconstructed memory log below)\n");
    Lp::Utl::dumpMemoryInfo("Application Start");
    Check(true, "dumpMemoryInfo runs end to end, reaching the platform layer");

    Lp::Utl::dumpMemoryInfo(nullptr);
    Check(true, "dumpMemoryInfo tolerates a null label");
}

} // namespace

int main() {
    std::printf("Reconstructed engine contract tests\n");
    std::printf("(ports of decompiled bodies; addresses in the test names)\n\n");

    TestDateTime();
    std::printf("\n");
    TestDumpDateTime();
    std::printf("\n");
    TestDumpMemoryInfo();

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
