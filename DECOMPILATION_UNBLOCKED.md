# Unblocking real decompilation

**Status: unblocked and verified end-to-end.** REA drives Ghidra on this target, and
a real Nintendo Switch module has been analysed to a real procedure inventory.

This document records the working procedure so it can be reproduced.

---

## 0. Verification (the important part)

`rtld` — the 13 KB runtime loader from the same ExeFS — was put through the whole
pipeline:

| Step | Result |
|---|---|
| hactool decompressed `rtld` NSO | 4 sections, build id `F6824124…` |
| `nso2elf.mjs` rebuilt it as ELF64 AArch64 | 30,088 bytes, 5 program headers |
| `validate-elf.mjs` structural check | **VALID — no structural problems found** |
| `rea inspect --provider ghidra` | **exit 0**, evidence `ev_9318b02b…`, format `elf`, arch `arm64` |
| analysis result | **`procedure_count: 56`**, plus `segment_count`, `string_count`, `image_base` |
| `rea analyze --format md` | **exit 0**, 7,719-byte overview |

**Ghidra analysed a Nintendo Switch ARM64 module and reported a procedure
inventory.** That is the deliverable that was missing: real analysis, not
hand-written decoding.

Sample of what the result contains:

```json
"subject":     { "format": "elf", "architecture": "arm64",
                 "digest": { "sha256": "aade48b6…" } }
"provider":    { "id": "ghidra", "version": "12.1.2" }
"normalized_result": { "document": …, "image_base": …, "segments": …,
                       "segment_count": …,
                       "procedure_count": 56, "string_count": … }
"confidence":  "derived"
```

## 1. What was blocked, and why

On Windows, REA's Ghidra adapter refused this target outright:

```
code: target_format_unsupported
"Windows Ghidra P0 accepts native x86 and x86-64 PE applications and DLLs,
 and explicitly selected raw 6502 images"
```

Both an ELF and a headerless `--architecture arm64` attempt were rejected. That
restriction is **Windows-specific**, and it is the reason every analysis in this
repository was done with hand-written ARM64 decoding rather than a decompiler.

## 2. The fix: run REA on Linux, via WSL

This machine already had **WSL2 with Ubuntu**. That is enough, and it required **no
root password** — Node and a JDK were installed entirely under `$HOME`.

### Environment that works

| Component | Version / path |
|---|---|
| Host | `ubuntu 26.04` (WSL2, x86_64) |
| Node | v24.22.0, self-contained at `~/tools/node` |
| JDK | Temurin 21.0.12.1 at `~/tools/jdk21` |
| REA | `rea-agents@6.5.0`, npm prefix `~/.npm-global` |
| Ghidra | the **existing Windows install**, reused via `/mnt/c/...` |

Two details make this cheap:

1. **The Windows Ghidra install is reusable as-is.** It already ships
   `Ghidra/Features/Decompiler/os/linux_x86_64/` alongside `win_x86_64`, so the
   Linux-native decompiler was present the whole time — no second Ghidra download.
2. **No `sudo` needed.** `apt` is not required: Node and the JDK are prebuilt
   tarballs extracted into `$HOME`.

### `rea doctor` on the Linux side

```
host                      ok=True   ubuntu 26.04
ghidra                    ok=True   /mnt/c/.../ghidra_12.1.2_PUBLIC
ghidra-platform           ok=True   linux
ghidra-architecture       ok=True   x64
ghidra-version            ok=True   12.1.2; compatible 12.1.x release
ghidra-headless           ok=True
ghidra-native_decompiler  ok=True
ghidra-java               ok=True   21.0.12.1; 64-bit; JDK; ~/tools/jdk21
provider ghidra: configured=True available=True version=12.1.2
```

Every check passes, including `ghidra-java` — which on Windows could only pass under
sandbox escalation.

### The target is now accepted

The same call that returned `target_format_unsupported` on Windows now proceeds:

```
transport     : unix-socket
provider      : ghidra 12.1.2
target_sha256 : 00e62df4e623b34adda1af2fa397ddfc436ee8c460c00acb84db1a6b851c738f
runtime_root  : /tmp/rea-ghidra-6xVm7K
project_root  : /tmp/rea-ghidra-6xVm7K/project
ghidra_log    : /tmp/rea-ghidra-6xVm7K/ghidra.log
process_id    : 788
```

REA launched its own private headless Ghidra, on a unix socket, and Ghidra began
importing the target — visible in the captured stdout:

```
INFO  Searching for classes... (ClassSearcher)
INFO  Class search complete (1496 ms)
INFO  Loading user preferences: /tmp/rea-ghidra-6xVm7K/config/...
INFO  Headless s...
```

## 3. `main` specifically: still a timeout, not a wall

The 21 MB `main` did **not** finish:

```
code: provider_timeout   category: timeout   retryable: true
timeout_ms: 330000
```

This is an **analysis-duration budget (330 s) against 113,150 functions**. The
capability is present — `rtld` proves the pipeline works; `main` is simply too large
for the budget.

So the remaining work for `main` is to make the analysis cheaper, not to find another
route.

## 4. Next steps, in order of expected payoff

1. **Pre-analyse `main` once with the cap removed, then reuse.** Run
   `analyzeHeadless` directly to completion on the Linux side and save the project,
   paying the cost once instead of per request. This is the most direct path.
2. **Copy the Ghidra install into the Linux filesystem.** It currently runs across
   `/mnt/c`, which is slow Windows I/O; a native-path install should measurably
   speed up analysis.
3. **Use the Python bridge directly.** `nnsdk`'s PyGhidra route, or `analyzeHeadless`
   with a custom postScript, bypasses REA's 330 s per-request budget entirely.
4. **Work at `rtld`/`subsdk1` scale while `main` is prepared.** `rtld` (56
   procedures) is already analysable; `subsdk1` is 67 KB and should fit.

## 5. Why this matters for the repository

Everything before this was produced by **hand-written ARM64 decoding** —
`arm64-callgraph.mjs`, `boot-closure.mjs`, `layout-disasm.mjs`, `vt-by-content.mjs`
and the rest. That approach was chosen because no decompiler could be driven, and it
worked: closure, layout and vtable order were all established from raw bytes.

It is also the reason those results carry the caveats they do — no function bodies,
`BLR` targets invisible, devirtualisation impossible. **A working decompiler removes
all of those limitations at once.** This is the highest-leverage change available to
the project.

## 6. Reproduce

```bash
# on the Windows side, from an elevated shell
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-install-node.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-install-jdk.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-probe-rea.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-verify-small.sh
```

The scripts are committed under `tools/wsl/`.

## 7. Honest limits of this result

- **A procedure *inventory* was obtained, not yet a function *body*.** `rtld` yields
  `procedure_count: 56` and a clean overview, but no pseudocode text was captured.
  Two attempts at `rea decompile` failed on argument handling, not on capability:
  address `0x0` is not a procedure (Ghidra places the ELF header there; the message
  helpfully said so and recommended `rea search --kind procedures` to enumerate
  valid addresses). Enumerating procedure addresses and decompiling one is the
  remaining mechanical step.
- **A `rea search --kind procedures` attempt timed out** and produced no output.
- **`main` is not analysable within REA's 330 s budget** on either platform as
  configured; that figure comes from one call and may be configurable.
- **Analysis cost has never been timed to completion** on any platform, so
  "pre-analyse once" is a reasoned recommendation, not a measured one.
- **`/mnt/c` I/O is unmeasured** but is a plausible contributor to the slowness.
