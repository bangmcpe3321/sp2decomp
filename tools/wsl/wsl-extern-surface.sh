#!/usr/bin/env bash
# What EXTERNAL surface does the generated code actually need? Rather than compile 433 TUs
# (~1 hour), extract the non-game symbols the generated code references directly from the source.
set -uo pipefail

GEN="$HOME/sp2recomp/gen"
cd "$GEN" || exit 1

echo "=== every distinct nx:: symbol the generated code uses ==="
grep -rhoE 'nx::[A-Za-z_][A-Za-z0-9_]*' code_*.cpp 2>/dev/null | sort | uniq -c | sort -rn

echo
echo "=== non-nx, non-main external symbols (libm / libc etc.) ==="
grep -rhoE '\b(truncf|sqrtf|floorf|ceilf|fabsf|sinf|cosf|powf|expf|logf|memcpy|memset|memmove|abort|strlen)\b' \
  code_*.cpp 2>/dev/null | sort | uniq -c | sort -rn | head -14

echo
echo "=== any other bare identifiers called that are not main_*/nx::/C++ std? ==="
# Function calls of the form name( where name is a lowercase identifier not preceded by :: or _
grep -rhoE '(^|[^:A-Za-z0-9_])([a-z][a-z0-9_]{2,})\(' code_*.cpp 2>/dev/null \
  | sed -E 's/^[^a-z]*//' | sed 's/($//' | sort -u \
  | grep -vE '^(main|nx|if|for|while|switch|return|sizeof|uint|int|goto|else|static|const|auto|void|char|do|case|break|continue|unsigned|bool|float|double|long|short|struct|class|namespace|template|typename|new|delete|throw|try|catch|operator|this|true|false|nullptr|union|enum|extern|inline|volatile|register|explicit|mutable|friend|using|typedef|default|public|private|protected|virtual|override|final|static_assert|reinterpret_cast|static_cast|const_cast|dynamic_cast|decltype|noexcept|alignof|alignas|thread_local|constexpr|consteval|constinit|co_await|co_return|co_yield|requires|concept)$' \
  | head -24

echo
echo "=== function count per file (sanity) ==="
echo "  files: $(ls code_*.cpp | wc -l)"
echo "  total functions: $(grep -h '^void main_' code_*.cpp | wc -l)"
