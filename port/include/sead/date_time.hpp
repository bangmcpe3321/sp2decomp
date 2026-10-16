// sead::DateTime / sead::CalendarTime — the first reconstructed engine types.
//
// Ported from the decompiled bodies that Lp::Utl::dumpDateTime calls:
//   sead::DateTime::DateTime(DateTime *, int)        @ from dumpDateTime's body
//   sead::DateTime::setNow(DateTime *)
//   sead::CalendarTime::CalendarTime(ct, year, month, day, hour, minute, second)
//   sead::DateTime::getCalendarTime(DateTime *, CalendarTime *)
//
// This is a PURPOSE-BUILT port, not a copy of open-ead/sead. Only the pieces the boot
// path actually reaches are implemented, so the surface stays small enough to verify.
// sead ships no licence file (see docs/ENGINE_RECONSTRUCTION.md), so it is used as a
// reading reference only.
#pragma once

#include <cstdint>

namespace sead {

// Observed: the constructor takes six ints in Y/M/D/h/m/s order. The binary's own
// defaults live in .rodata and are pointed to by PTR_cDefault* symbols; those point at
// six consecutive 32-bit slots, which is where these field values come from.
class CalendarTime {
public:
    CalendarTime();
    CalendarTime(int year, int month, int day, int hour, int minute, int second);

    int year() const { return mYear; }
    int month() const { return mMonth; }
    int day() const { return mDay; }
    int hour() const { return mHour; }
    int minute() const { return mMinute; }
    int second() const { return mSecond; }

    void set(int year, int month, int day, int hour, int minute, int second);

private:
    // Layout matches the decompiled frame: a 16-byte leading region followed by three
    // 32-bit fields that dumpDateTime reads as the [hh:mm:ss] triple.
    int mYear, mMonth, mDay, mHour, mMinute, mSecond;
};

// DateTime is a 64-bit millisecond count in the SDK. dumpDateTime constructs it with 0
// then calls setNow, so the zero value is never observed — only the clock's.
class DateTime {
public:
    DateTime();
    explicit DateTime(std::int64_t millis);

    // sead::DateTime::setNow -- reads the system clock.
    void setNow();

    std::int64_t value() const { return mMillis; }

    // Writes the broken-down local time into `out`. The binary passes a CalendarTime it
    // constructed itself, so this must not assume `out` is default-initialised.
    void getCalendarTime(CalendarTime *out) const;

private:
    std::int64_t mMillis;
};

} // namespace sead
