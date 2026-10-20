#!/usr/bin/env python3
"""set:GetLanguageCode -> real LanguageCode bytes (the game was stuck in Japanese).

`nn::settings::LanguageCode` is a `char[8]` holding the ASCII tag ("en-US"), so the bytes
must land in guest memory in reading order. The port built each code as a *number* with the
tag's first character in the **high** byte (`0x656E2D5553` for "en-US"), which little-endian
memory stores as "SU-ne". The game compares the returned tag against its own list, matches
nothing, and falls back to Japanese: it loaded /Message/CommonMsg_JPja.szs even though
nn::oe::GetDesiredLanguage (which memcpy's "en-US", svc_am.cpp) already answered en-US.

This patch derives every entry from its string literal at compile time, so the tag always
sits in memory in reading order. After it the game should load CommonMsg_USen.szs.

runtime/src/svc_settings.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-language-code.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/svc_settings.cpp")

OLD = """// nn::settings::Language order in this SDK: ja, en-US, fr, de, es-419, es, it, nl, fr-CA, pt, ru, en-GB, zh-CN,
// zh-TW, ko. A LanguageCode is the ASCII tag (up to 5 bytes) in an 8-byte value.
constexpr uint64_t kLanguageCodes[] = {
    0x6A61ull,          // 0  Japanese               "ja"
    0x656E2D5553ull,    // 1  AmericanEnglish        "en-US"
    0x6672ull,          // 2  French                 "fr"
    0x6465ull,          // 3  German                 "de"
    0x65732D343139ull,  // 4  LatinAmericanSpanish   "es-419"
    0x6573ull,          // 5  Spanish                "es"
    0x6974ull,          // 6  Italian                "it"
    0x6E6Cull,          // 7  Dutch                  "nl"
    0x66722D4341ull,    // 8  CanadianFrench         "fr-CA"
    0x7074ull,          // 9  Portuguese             "pt"
    0x7275ull,          // 10 Russian                "ru"
    0x656E2D4742ull,    // 11 BritishEnglish         "en-GB"
    0x7A682D434Eull,    // 12 SimplifiedChinese      "zh-CN"
    0x7A682D5457ull,    // 13 TraditionalChinese     "zh-TW"
    0x6B6Full,          // 14 Korean                 "ko"
};"""

NEW = """// nn::settings::Language order in this SDK: ja, en-US, fr, de, es-419, es, it, nl, fr-CA, pt, ru, en-GB, zh-CN,
// zh-TW, ko. A LanguageCode is a char[8] holding the ASCII tag, so the bytes have to land in memory in reading
// order: the tag's first character is the low byte (little-endian), not the high one. Writing these as "readable"
// numbers (0x656E2D5553 for "en-US") made memory say "SU-ne"; the game matched no language and fell back to ja.
template <int N>
constexpr uint64_t language_code(const char (&tag)[N]) {
    uint64_t code = 0;
    for (int i = 0; i + 1 < N; i++) code |= uint64_t(uint8_t(tag[i])) << (8 * i);
    return code;
}
constexpr uint64_t kLanguageCodes[] = {
    language_code("ja"),       // 0  Japanese
    language_code("en-US"),    // 1  AmericanEnglish
    language_code("fr"),       // 2  French
    language_code("de"),       // 3  German
    language_code("es-419"),   // 4  LatinAmericanSpanish
    language_code("es"),       // 5  Spanish
    language_code("it"),       // 6  Italian
    language_code("nl"),       // 7  Dutch
    language_code("fr-CA"),    // 8  CanadianFrench
    language_code("pt"),       // 9  Portuguese
    language_code("ru"),       // 10 Russian
    language_code("en-GB"),    // 11 BritishEnglish
    language_code("zh-CN"),    // 12 SimplifiedChinese
    language_code("zh-TW"),    // 13 TraditionalChinese
    language_code("ko"),       // 14 Korean
};"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if NEW not in t:
            print("nothing to restore")
            return
        open(F, "w", encoding="utf-8", newline="").write(t.replace(NEW, OLD, 1))
        print("restored")
        return
    if NEW in t:
        print("already applied")
        return
    if OLD not in t:
        raise SystemExit("pattern not found: " + F)
    open(F, "w", encoding="utf-8", newline="").write(t.replace(OLD, NEW, 1))
    print("patched", F)


if __name__ == "__main__":
    main()
