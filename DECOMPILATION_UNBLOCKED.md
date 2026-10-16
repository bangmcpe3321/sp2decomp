# Unblocking real decompilation

**Status: solved and verified.** REA drives Ghidra on this target, and **real
decompiled function bodies have been obtained** from a Nintendo Switch module.

---

## 0. Verification: an actual function body

`rtld` — the 13 KB runtime loader from the same ExeFS — went through the whole
pipeline, ending in decompiled C:

| Step | Result |
|---|---|
| hactool decompressed `rtld` NSO | 4 sections, build id `F6824124…` |
| `nso2elf.mjs` rebuilt it as ELF64 AArch64 | 30,088 bytes, 5 program headers |
| `validate-elf.mjs` structural check | **VALID — no structural problems found** |
| `rea inspect --provider ghidra` | exit 0, format `elf`, arch `arm64`, **`procedure_count: 56`** |
| **`rea decompile 0x1000 --provider ghidra`** | **exit 0, 22,578 bytes, `operation: procedure_pseudo_code`** |
| payload | **9,433 characters of Ghidra decompiled C** |

The output is genuine, not a stub — it identifies itself as the loader and contains
real control flow:

```c
void FUN_00000de0(long param_1, uint param_2)
{
  ...
  pcVar3 = DAT_000053a8;
  uVar4 = *(ulong *)(param_1 + 0x88);
  uVar13 = *(ulong *)(param_1 + 0x90);
  if (uVar13 < uVar4 >> 4) {
    ...
    do {
      lVar11 = *(long *)(param_1 + 0x18);
      uVar8 = *(ulong *)(lVar11 + lVar15 + 8);
      iVar7 = (int)uVar8;
      if ((iVar7 - 0x101U < 2) || (iVar7 == 0x401)) {
        ...
        uVar4 = FUN_00000c5c(param_1, &local_68, local_98);
        if ((uVar4 & 1) == 0) {
          if (*pcVar3 != '\0') {
            lVar11 = *(long *)(param_1 + 0x60) + uVar8;
            uVar5 = FUN_00001704("[rtld] warning: unresolved symbol = '");
            FUN_000014e4("[rtld] warning: unresolved symbol = '", uVar5);
```

That string — `[rtld] warning: unresolved symbol = '` — is `rtld` describing its own
job. **This is a decompiled Nintendo Switch loader function.**

Evidence: `ev_73f0bc75bc81621242ef102c41fafab8e4e9ff40f719a1d013385462d4189b5b`,
provider `ghidra 12.1.2`.

### The one argument that mattered

`rea decompile <path> 0x0` **fails**, and the message explains why:

> *"File offset 0x0 maps to analysis address `_elfHeader:0x0`, but no procedure starts
> at or contains that address."*

`0x0` is the ELF header in the reconstructed image, not code. The first real code
address is **`0x1000`**. That single detail was the difference between two failed
attempts and a successful decompilation.

---

## 1. What was blocked, and why

On Windows, REA's Ghidra adapter refused this target outright:

```
code: target_format_unsupported
"Windows Ghidra P0 accepts native x86 and x86-64 PE applications and DLLs,
 and explicitly selected raw 6502 images"
```

Both an ELF and a headerless `--architecture arm64` attempt were rejected. That
restriction is **Windows-specific**, and it is why every earlier analysis in this
repository used hand-written ARM64 decoding.

## 2. The fix: run REA on Linux, via WSL

This machine already had **WSL2 with Ubuntu**. That is enough, and it needed **no root
password** — Node and a JDK install entirely under `$HOME` from prebuilt tarballs.

| Component | Version / path |
|---|---|
| Host | `ubuntu 26.04` (WSL2, x86_64) |
| Node | v24.22.0 at `~/tools/node` |
| JDK | Temurin 21.0.12.1 at `~/tools/jdk21` |
| REA | `rea-agents@6.5.0`, prefix `~/.npm-global` |
| Ghidra | the **existing Windows install**, reused via `/mnt/c` |

Two details made this cheap:

1. **The Windows Ghidra install is reusable as-is** — it already ships
   `Ghidra/Features/Decompiler/os/linux_x86_64/` beside `win_x86_64`, so no second
   Ghidra download was needed.
2. **No `sudo`.** `apt` is not required; Node and the JDK are prebuilt tarballs.

`rea doctor` on Linux passes every check, including `ghidra-java` — which on Windows
passed only under sandbox escalation:

```
host                      ok=True   ubuntu 26.04
ghidra-platform           ok=True   linux
ghidra-architecture       ok=True   x64
ghidra-version            ok=True   12.1.2; compatible 12.1.x release
ghidra-headless           ok=True
ghidra-native_decompiler  ok=True
ghidra-java               ok=True   21.0.12.1; 64-bit; JDK; ~/tools/jdk21
provider ghidra: configured=True available=True version=12.1.2
```

REA then launches its own private headless Ghidra over a unix socket
(`transport: unix-socket`), and the target is accepted.

## 3. `main` specifically: a timeout, not a wall

The 21 MB `main` did not finish within REA's budget:

```
code: provider_timeout   retryable: true   timeout_ms: 330000
```

That is an **analysis-duration budget against 113,150 functions**. Capability is
proven by `rtld`; `main` is simply too large for a per-request budget.

**An uncapped pre-analysis of `main` is running** on the Linux side
(`tools/wsl/wsl-preanalyze.sh`), copying the input into the Linux filesystem first to
avoid `/mnt/c` I/O, and writing an inventory via `ExportInventory.py` when it
completes. It has no wrapper timeout by design.

## 4. Next steps, in expected-payoff order

1. **Let the uncapped `main` pre-analysis finish**, then reuse the saved project
   instead of paying analysis cost per request.
2. **Install SwitchLoader on the Linux Ghidra side** and point REA at the *original
   NSO*. That yields **named** functions (`Game::PlayerInkAction::shotBullet_B`)
   instead of `FUN_00000de0`. This is the single highest-value improvement — the
   binary carries 113,150 real names and the reconstructed ELF has none.
3. **Copy the Ghidra install into the Linux filesystem** to avoid slow `/mnt/c` I/O.
4. **Work at `rtld`/`subsdk1` scale meanwhile** — `rtld` works now; `subsdk1` is 67 KB.

## 5. Why this matters for the repository

Everything before this came from **hand-written ARM64 decoding** —
`arm64-callgraph.mjs`, `boot-closure.mjs`, `layout-disasm.mjs`, `vt-by-content.mjs`.
That was necessary because no decompiler could be driven, and it worked: closure,
layout and vtable order were all established from raw bytes.

It is also why those results carry the caveats they do — no function bodies, `BLR`
targets invisible, devirtualisation impossible. **A working decompiler removes all of
those at once**, and that is now demonstrated rather than hoped for.

## 6. Reproduce

```bash
# from an elevated Windows shell
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-install-node.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-install-jdk.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-probe-rea.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-verify-small.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-get-body.sh
```

Scripts are committed under `tools/wsl/`.

## 7. Honest limits

- **`main` has no function bodies yet.** Only `rtld` does, and the uncapped run's
  outcome is unknown.
- **One function was decompiled** (`FUN_00000de0`). That proves the pipeline; it does
  not survey a module.
- **The symbols are unnamed** (`FUN_*`) because this is a *reconstructed* ELF with no
  symbol table. Reading the original NSO directly needs SwitchLoader on the Linux
  Ghidra side, which is not yet installed.
- **REA's 330 s budget was not confirmed configurable.**
- **The Windows headless run of `main` was still progressing** when last checked and
  may yet finish independently.
