// nn::util / nn::diag — platform utilities reconstructed from call-site evidence.
//
// Both namespaces are imported by `main` and provided by the system at runtime (see
// docs/PLATFORM_LAYER_LOCATION.md). Signatures below come from literal call expressions
// in the whole-binary scan (docs/PLATFORM_IMPLEMENTATION_SPEC.md).
#pragma once

#include <cstdint>
#include <cstddef>
#include <cstdarg>

namespace nn::util {

// `uVar1 = nn::util::VSNPrintf(auStack_220, 0x200, param_1, &local_240);` — 17 sites.
// Observed shape: (char *dst, size_t size, const char *fmt, va_list *args) -> int.
// The fourth argument is a POINTER to a va_list at every observed site, which is the
// SDK's own quirk; forward it to vsnprintf accordingly.
int VSNPrintf(char *dst, std::size_t size, const char *format, std::va_list *args);

// `nn::util::SNPrintf(dst, size, fmt, ...)` — variadic convenience wrapper.
int SNPrintf(char *dst, std::size_t size, const char *format, ...);

// Base64 helpers carried over from the module's own symbol table (seen in the sdk
// export names). Declared for completeness; not yet exercised by observed call sites.
enum class Base64Mode : int { Mode0 = 0, Mode1 = 1 };
std::size_t ToBase64String(char *dst, std::size_t dstSize, const void *src,
                           std::size_t srcSize, Base64Mode mode);
std::size_t FromBase64String(void *dst, std::size_t dstSize, const char *src,
                             std::size_t srcSize, Base64Mode mode);

} // namespace nn::util

namespace nn::diag {

// `nn::diag::detail::LogImpl((LogMetaData *)local_c8, "%4ld MB: Program\n", local_68 >> 0x14);`
// — 14 sites. Shape: (LogMetaData *meta, const char *format, ...) -> void.
// The metadata pointer is a caller-owned local; the format string is a real printf
// format, so the variadic arguments are formatted output, not opaque handles.
struct LogMetaData {
    alignas(8) unsigned char storage[0x20];
};

namespace detail {
void LogImpl(LogMetaData *meta, const char *format, ...);
} // namespace detail

// `nn::diag::detail::AbortImpl(msg, cond, file, line)` appears in the module's own
// symbol table; provide the underlying abort path so a failed assert is observable.
[[noreturn]] void AbortImpl(const char *message, const char *condition,
                            const char *file, int line);

} // namespace nn::diag
