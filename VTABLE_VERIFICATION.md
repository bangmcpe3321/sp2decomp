# Vtable order verification

Second half of the layout verification. [VERIFICATION.md](VERIFICATION.md) confirmed
field **offsets** match; this confirms virtual **order**, which is the property that
actually breaks a port.

Both are verified by reconstructing the vtable **from the binary**, not from
another decompilation.

---

## Method, and why it needed inventing

Vtable order is normally checked by reading `_ZTV`/`_ZTI` symbols. **This binary has
neither** — a check found **zero** `_ZTV`/`_ZTI`/`_ZTS` symbols for `ui2d`. Tracing
the constructor's `ADRP`+`ADD`+`STR` also failed: the class address is computed
(`ADRP x8 → 0x2f9af00`, `ADD → 0x2f9af10`) but stored through a register the simple
decoder did not follow.

So the vtable was found **by content** instead:

1. Take a set of known virtual functions from the symbol table as anchors.
2. Invert `.rela.dyn`: map every relocated slot to its target.
3. Walk outward from each anchor while slots stay contiguous (8 bytes apart), giving
   candidate runs.
4. Score each candidate by **what fraction of its entries are declared by the target
   class**. This step is essential — derived classes inherit the base's virtuals, so
   74 candidate runs contained the anchors. The base vtable is the one whose entries
   are predominantly that class's own.

Result for `nn::ui2d::Pane`:

```
vtable  0x2f8de10 .. 0x2f8def0
entries 29
pane-fraction 97%   (next best candidate: 89%)
```

The Itanium ABI shape is present and self-consistent: slot `[0]` is the
deleting-destructor thunk (the symbol that disassembles to a bare 4-byte `ret`), then
the RTTI and the virtuals.

---

## Result: order matches, with one real discrepancy

Reconstructed order (abridged to the `Pane`-declared entries):

| idx | Entry |
|---:|---|
| 3 | `GetRuntimeTypeInfo` |
| 4 | `Finalize` |
| 5–6 | `GetVertexColor` / `SetVertexColor` |
| 7–8 | `GetColorElement` / `SetColorElement` |
| 9–10 | `GetVertexColorElement` / `SetVertexColorElement` |
| 11–12 | `GetMaterialCount` / `GetMaterial` |
| 13–14 | `FindPaneByName` (non-const / const) |
| 15–16 | `FindMaterialByName` (non-const / const) |
| 17–19 | `BindAnimation` / `UnbindAnimation` / `UnbindAnimationSelf` |
| 20 | `CalculateMtx` |
| 21 | `Calculate` |
| 22 | `Draw` |
| 23 | `DrawSelf` |
| 24 | `LoadMtx` |
| 25 | `FindPaneByNameRecursive` |
| 26 | `FindPaneByNameRecursive` (const) |
| 27 | `FindMaterialByNameRecursive` |
| 28 | `FindMaterialByNameRecursive` (const) |

**This is exactly the header's declaration order**, and it independently confirms the
earlier inference in [VERIFICATION.md](VERIFICATION.md) §6.1 — that the const
overloads sit immediately after their non-const counterparts.

### The discrepancy

The `nnware` header declares only:

```cpp
virtual Pane* FindPaneByNameRecursive(const char*);
virtual const Pane* FindPaneByNameRecursive(const char*) const;
virtual Material* FindMaterialByNameRecursive(const char*);
virtual const Material* FindMaterialByNameRecursive(const char*) const;
```

but the binary's vtable has **pairs for all four finders**:

| Finder | Header | Binary |
|---|---|---|
| `FindPaneByName` | both | both ✅ |
| `FindMaterialByName` | both | both ✅ |
| `FindPaneByNameRecursive` | both | both ✅ |
| **`FindMaterialByNameRecursive`** | **non-const only** | **both** ❌ |

**The binary has a const `FindMaterialByNameRecursive` vtable slot that the header
does not declare.**

This is a header *omission*, not a wrong order — the declared entries are in the
right sequence and the count includes an extra slot. But the consequence is concrete:

> A port that builds a `Pane` subclass from the `nnware` header would produce a vtable
> **one slot short**, and every virtual after that point would be called at the wrong
> index.

That is precisely the failure mode this verification existed to catch.

---

## What this establishes

| Property | Status |
|---|---|
| `nn::ui2d::Pane` virtual **order** | ✅ verified against the binary |
| Virtual **count** | ⚠ binary has 29 entries; header declares one fewer |
| `nnware` header usable as-is | ❌ **must add the const `FindMaterialByNameRecursive`** |

## What this does *not* establish

Stated plainly, because one class is not a blanket result:

1. **Only `nn::ui2d::Pane` was verified.** The method generalises (any class with
   known virtual symbols can be checked the same way) but no other class was run.
2. **`sead` and `agl` vtable order remain unverified.** `sead`'s `GameFrameworkNx`
   was verified on sizes only; its virtual order was not checked. `agl` was not
   checked at all.
3. **The header set is not uniformly trustworthy.** One omission was found in the
   first class checked by this method, which is a reason to run it on the classes
   that matter before relying on them — not a reason to assume the rest are correct.
4. **`ui2d::Pane` inherits `detail::PaneBase`**, whose vtable entries were not
   separately verified. The base's virtuals occupy the low slots.

## Recommended next step

Run the same reconstruction over the classes on the boot path — `nn::atk`
(1,426 functions, the largest single boot dependency), `nn::g3d`, and `sead::Framework`
— and add each header omission found to a compatibility patch list. That list, not the
headers as shipped, is what an implementation should be built against.

Reproduce with:

```bash
node tools/static/vt-by-content.mjs main.elf inventory.txt vt-pane.txt "<anchor VAs>"
```
