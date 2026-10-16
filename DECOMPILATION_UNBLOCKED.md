# Unblocking real decompilation

**Status: the blocker is lifted.** REA now accepts this target. What remains is a
timeout, not a capability restriction.

This document records the working procedure so it can be reproduced.

---

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

This machine already had **WSL2 with Ubuntu** installed. That is enough, and it
required **no root password** — Node and a JDK were installed entirely under
`$HOME`.

### Environment that works

| Component | Version / path |
|---|---|
| Host | `ubuntu 26.04` (WSL2, kernel 6.x, x86_64) |
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
profile_digest: 018052730a1ef463e7c1e71a10b3fcec878e93843e4d106f4d1fa9bdff859af4
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

**That is the unblock.** The format restriction is gone.

## 3. What remains: a timeout, not a wall

The call still did not return a result:

```
code: provider_timeout   category: timeout   retryable: true
message: Analysis took too long.
timeout_ms: 330000
```

This is an **analysis-duration budget (330 s) against a 21 MB binary with 113,150
functions**. It is the same underlying cost that made the Windows headless run
appear to "wedge" — the analysis is genuinely long, and REA serves nothing until
Ghidra reports default auto-analysis complete:

> *"The session serves operations only after Ghidra reports default auto-analysis
> complete; incomplete analysis does not expose partial results."*

So the remaining work is to make the analysis **cheaper**, not to find another route.

## 4. Next steps, in order of expected payoff

1. **Pre-analyse once, reuse.** Run `analyzeHeadless` directly on the Linux side to
   completion (no 330 s cap), save the project, and only then point REA at it. The
   cost is paid once rather than per request.
2. **Shrink the first target.** Decompile a *small* module instead of `main`:
   `rtld` (13 KB) or `subsdk1` (66 KB). Those fit the budget comfortably and prove
   the pipeline end-to-end — which is also the sequencing
   [PORTING.md](PORTING.md) recommends for the port itself.
3. **Raise the budget if configurable.** Check whether REA exposes an analysis
   timeout setting; the doctor output shows a `--json` contract worth inspecting.
4. **Consider `nn::vi` alone.** Once any session succeeds, the 51-function
   [PORT_WORKLIST.md](PORT_WORKLIST.md) surface is small enough to decompose
   incrementally with real pseudocode behind each entry.

## 5. Why this matters for the repository

Everything in this repository was produced by **hand-written ARM64 decoding** —
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
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-test-ghidra.sh
```

The scripts are committed under `tools/wsl/`.

## 7. Honest limits of this result

- **No function body has been produced yet.** This document records that the route
  is open and the target is accepted; it does not claim a decompilation was
  obtained. The timeout must be beaten first.
- **The 330 s figure is from one call.** Whether REA's budget is configurable was
  not determined.
- **Analysis cost is unmeasured.** Nobody has timed a full Ghidra run of this binary
  to completion on either platform, so "shrink the target" is a reasoned guess about
  the cheapest path, not a measured one.
- **`GHIDRA_INSTALL_DIR` points across `/mnt/c`.** Running Ghidra over the Windows
  filesystem mount is slow I/O; copying the install into the Linux filesystem would
  likely speed analysis up materially and was not tried.
