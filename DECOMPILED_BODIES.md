# Decompiler-verified function bodies from `main`

The milestone this project was built toward: **actual decompiled pseudocode from the
retail Splatoon 2 `main` binary**, produced by Ghidra 12.1.2 through REA's provider.

Nothing here is hand-decoded. These are decompiler outputs.

---

## How it was obtained

Two things had to be true at once, and earlier attempts had neither:

1. **Analysis must complete.** A full `analyzeHeadless` run on the 21 MB binary
   finished and saved its project (`FullRun.rep`) on the Windows side. This is the
   run that previously looked "wedged" — it was simply long.
2. **Not the NSO, and not through REA's per-request budget.** The analysis ran
   against the **original NSO** via SwitchLoader, so the program carries the
   module's own symbols — which is why the output shows real C++ types instead of
   `FUN_xxxxxxxx`.

Once a fully-analysed project exists, extracting bodies is cheap:

```powershell
& "$GHIDRA\support\pyghidraRun.bat" -H <project-dir> FullRun -process main -noanalysis `
    -scriptPath <scripts> -postScript ExtractDecompiled.py <out.txt>
```

`-noanalysis -process main` reuses the saved analysis instead of redoing it.
PyGhidra is required — plain `analyzeHeadless` runs Jython and fails with
*"Ghidra was not started with PyGhidra"*.

## Result

| Address | Function | Body size | Decompiled |
|---|---|---:|---|
| `0x710090ab30` | `Game::PlayerInkAction::shotBullet_B` | 1180 B | ✅ |
| `0x71011f5b20` | `Lp::Sys::SysInit::Init` | 1308 B | ✅ |
| `0x71011f5ab4` | `Lp::Sys::SysInit::nninitStartup` | 108 B | ✅ |
| `0x7100e6724c` | `sead::GameFrameworkNx::initialize` | 20 B | ✅ |
| `0x7101375144` | `nn::ui2d::Pane::Pane()` | 132 B | ✅ |

**5 of 5 decompiled, 0 failures.**

The types are real, which is the strongest signal that the symbols were used:

```c
/* Game::PlayerInkAction::shotBullet_B() */
void __thiscall Game::PlayerInkAction::shotBullet_B(PlayerInkAction *this)
{
  ...
  MainWeaponMgr *pMVar13;
  ...
}
```

`PlayerInkAction*` as the implicit `this`, and `MainWeaponMgr*` as a local — both
resolved from the module's own symbol table.

## What this validates

**Three independent cross-checks now agree with the hand-decoded work:**

### 1. Body sizes confirm the earlier fix

| Function | Hand-decoded estimate | Ghidra | Verdict |
|---|---:|---:|---|
| `SysInit::Init` | 1308 B | **1308 B** | exact |
| `nninitStartup` | 108 B | **108 B** | exact |
| `GameFrameworkNx::initialize` | 20 B | **20 B** | exact |
| `Pane::Pane()` | 132 B | **132 B** | exact |

The hand-decoded sizes in [BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md) used a
next-symbol-plus-`RET` heuristic. They match Ghidra's independently computed function
boundaries exactly. This is direct validation of the decoding method used throughout
the repository — including the `B`-vs-`BL` tail-call rule that fixed the closure from
232 to 184.

### 2. `GameFrameworkNx::initialize` is the 20-byte tail-call wrapper

The hand-decoded disassembly showed a build-then-tail-call wrapper. Ghidra agrees,
at the same size.

### 3. `Pane::Pane()` is 132 bytes

Consistent with the field-offset analysis in
[VTABLE_VERIFICATION.md](VTABLE_VERIFICATION.md).

## Why this is the turning point

Every earlier result in this repository carried the same three caveats:

- no function bodies, only names and addresses;
- `BLR` register-indirect targets invisible, so virtual dispatch was missing;
- devirtualisation impossible.

**All three are now removable.** The decompiler sees what hand-decoding cannot, and
the symbol table gives it real types to work with.

## Honest limits

- **Five functions were decompiled, out of 113,150.** This proves the method and
  validates the earlier work; it is not a survey of the binary.
- **The decompiled output is Ghidra pseudocode, not idiomatic C++.** Variable names
  like `uVar13` and `local_e8` are Ghidra's, not the original source.
- **No function has been verified to recompile to a matching binary.** That is the
  matching-decompilation standard and nothing here approaches it.
- **The output file is not committed.** It is Ghidra's rendering of Nintendo's code;
  the procedure is committed instead, so it can be regenerated.
- **Bodies were extracted from the Windows-side analysis.** The uncapped Linux run
  was still in progress and may produce a second, independent project.
