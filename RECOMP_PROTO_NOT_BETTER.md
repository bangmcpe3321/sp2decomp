# The proto is not a better target: the static-init graph is identical

The comparison was run. **The March-2017 proto and retail are the same engine generation with the same
static-init graph.** Switching builds does not help.

---

## 1. The numbers

| Metric | **Proto** | **Retail** |
|---|---:|---:|
| Distinct `PseudoGlobalVariable<T>` types in `main` | **202** | **202** |
| Same, in `sdk` / `subsdk*` | 0 | 0 |
| `nnos*` symbols in `sdk` | **121** | **121** |
| `nnosInitialize` present in `sdk` | ✅ 1 | ✅ 1 |
| `nn::init::Start` (`_ZN2nn4init5StartEmmPFvvE`) | ❌ **0** | ❌ **0** |

**Every metric that matters is identical.** The proto has 202 distinct pseudo-global-variable
instantiations in `main` — exactly retail's count — and its `sdk` carries the same 121-symbol `nnos*` C API
surface with no `nn::init::Start`.

## 2. What that means

**The proto buys nothing for this bug.**

- It is the **same SDK era** (`nnos*`, no `nn::init::Start`), so the five silent Wonder-vs-Splatoon-2
  mismatches all still apply.
- It has the **same middleware graph** — the `nn::nex` / `nn::pia` netcode that the hang is stuck inside is
  present in the same quantity.
- Its `main` is **2.2 MB larger** (debug build), so there is strictly *more* code to run.

**Its only advantage is the debug menu** — `DbgSetting`, scene redirection, `[+] Load map`, `[-] FreeTest` —
and **that sits behind the blocker.** You cannot reach a debug scene-jump if static initialisation does not
complete.

## 3. The question this answers

Two turns ago the question was *"how can Wonder run but Splatoon 2 can't?"* The proto was the obvious
candidate for a build that might escape the problem.

**It does not.** The blocker is not a property of *which Splatoon 2 build* — it is a property of the
**engine generation and its middleware stack**, and both builds share it.

**That is a genuinely useful negative result**, because it removes a plausible and attractive-looking option
before more time is spent on it.

## 4. What this does NOT establish

- **The proto was never recompiled or run.** Only its NSOs were decompressed and string-searched.
- **`main`'s 202 PGV *types* is not the same as retail's 62 *registrations*.** Types over-count: a
  `PseudoGlobalVariable<T>` type can have several instances, and some types may be linked but unused. **The
  202-vs-202 equality shows the two builds are structurally the same; it does not prove the runtime
  registration sequence is identical** — that would need a run of a ported proto, which was not done.
- **`subsdk9` was not analysed** beyond decompression; it is 152 KB and its role is unknown.
- **The proto's debug menu was not exercised or reached.**
- **The hang's cause is unchanged and still unexplained.**
- **`nnMain` still not reached.** No NVN, no window. **This is not a booted game.**

## 5. The honest conclusion

**Neither Splatoon 2 build is a good fit for this toolchain as it stands.** The port reaches 1,367 of
`main`'s 1,604 static constructors and hangs in `nn::nex::PseudoGlobalVariableList::AddVariable` — and the
proto has the same 202-type networking graph that put it there.

**The options, stated plainly:**

| Option | Cost | Likelihood of a running game |
|---|---|---|
| Keep debugging the `AddVariable` hang | small, bounded | unclear — one open question remains |
| Build a `nex`/`pia` HLE or offline bypass | large | low without the whole HLE surface |
| Port a **different game** — newer SDK, no online stack | medium | **materially better** |
| Use an emulator instead of recompilation | n/a | high, but a different project |

**The reusable assets this project produced** — the six-entry silent-mismatch ledger, the `exefs`-is-LZ4
trap, the `call_preserving`-misses-direct-calls trap, and the `nnos`-era entry discovery — **transfer to any
title** attempted with this toolchain. That is the part worth keeping.
