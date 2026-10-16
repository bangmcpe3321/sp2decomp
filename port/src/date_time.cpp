// sead::DateTime / sead::CalendarTime implementation.
#include "sead/date_time.hpp"

#include <chrono>
#include <ctime>

namespace sead {

namespace {
// The default date the binary's CalendarTime constructor is handed lives in .rodata and
// is pointed to by PTR_cDefault* symbols. The six slots are consecutive 32-bit words.
// Their exact contents were not recovered, so a defined placeholder is used and clearly
// labelled rather than invented-as-fact: this value is only observable if getCalendarTime
// fails to overwrite it, which is itself a defect worth seeing.
constexpr int kDefaultYear = 2000;
constexpr int kDefaultMonth = 1;
constexpr int kDefaultDay = 1;
constexpr int kDefaultHour = 0;
constexpr int kDefaultMinute = 0;
constexpr int kDefaultSecond = 0;
} // namespace

CalendarTime::CalendarTime()
    : mYear(kDefaultYear), mMonth(kDefaultMonth), mDay(kDefaultDay),
      mHour(kDefaultHour), mMinute(kDefaultMinute), mSecond(kDefaultSecond) {}

CalendarTime::CalendarTime(int year, int month, int day, int hour, int minute, int second)
    : mYear(year), mMonth(month), mDay(day), mHour(hour), mMinute(minute), mSecond(second) {}

void CalendarTime::set(int year, int month, int day, int hour, int minute, int second) {
    mYear = year;
    mMonth = month;
    mDay = day;
    mHour = hour;
    mMinute = minute;
    mSecond = second;
}

DateTime::DateTime() : mMillis(0) {}
DateTime::DateTime(std::int64_t millis) : mMillis(millis) {}

void DateTime::setNow() {
    const auto now = std::chrono::system_clock::now().time_since_epoch();
    mMillis = std::chrono::duration_cast<std::chrono::milliseconds>(now).count();
}

void DateTime::getCalendarTime(CalendarTime *out) const {
    if (out == nullptr) return;
    std::time_t secs = static_cast<std::time_t>(mMillis / 1000);
    std::tm tmv{};
#if defined(_WIN32)
    if (localtime_s(&tmv, &secs) != 0) return;
#else
    if (localtime_r(&secs, &tmv) == nullptr) return;
#endif
    // Local time, not UTC: a boot-log timestamp is meant to read as wall-clock time.
    out->set(tmv.tm_year + 1900, tmv.tm_mon + 1, tmv.tm_mday,
             tmv.tm_hour, tmv.tm_min, tmv.tm_sec);
}

} // namespace sead
