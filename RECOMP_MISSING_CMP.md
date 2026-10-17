# The recompiled function has NO register comparison — the guest has two

Round 11/12. The full function was read. **`main_00D2F0F4` contains exactly two compare instructions, and
neither compares two registers.** The guest function contains two register comparisons. This is a
**concrete, reproducible discrepancy** and it needs to be reported precisely.

---

## 1. The measurement

`main_00D2F0F4` (`nn::nex::PseudoGlobalVariableList::AddVariable`), **90 instructions total**:

```
EVERY compare in the whole function:
  0x031e6a7a <+126>:  test   %rdx,%rdx        <- head == NULL ?
  0x031e6abb <+191>:  cmpq   $0x0,(%rbx)      <- x0 == 0 ?
```

**Two compares. Both are against zero. Neither compares two registers.**

## 2. What the guest function contains

From the decompressed image (`main.bin`), inside the same function:

```
0xd2f1a4:  eb13001f   cmp  x0, x19       <- register vs register
0xd2f1a8:  540001a0   b.eq +0x34
0xd2f1ac:  b40004a0   cbz  x0, +0x94     <- register vs zero
0xd2f1b8:  eb1302bf   cmp  x21, x19      <- register vs register
0xd2f1bc:  540001c0   b.eq +0x38
```

**The guest performs two register-vs-register comparisons (`cmp x0, x19` and `cmp x21, x19`). The
recompiled function performs none.**

## 3. Two readings — and I must state both

**(a) A recompilation OPTIMISATION.** If the recompiler could prove `x19 == 0` at those points, then
`cmp x0, x19` is simply `cmp x0, #0` and folding it is correct. That would be a *legitimate* translation and
there would be no defect.

**(b) A recompilation DEFECT.** If `x19` is not provably zero, then the register comparison has been
**dropped**, and the recompiled code silently tests a weaker condition than the original. **That would make
the generated code wrong in a way nothing in this project has detected**, and it would explain the hang
exactly: the guest stops the walk when the cursor returns to the sentinel in `x19`; the recompiled walk only
stops at null, so it spins forever.

**Both remain possible. Neither is proven.** The *absence* of a register compare is a **measured fact**; the
*reason* for it is not.

## 4. Evidence bearing on which it is

| Observation | Leans |
|---|---|
| The recompiled function never mentions any guest register other than `x0`/`x1` | (b) — nothing tracks `x19` |
| `x19` is a callee-saved register, so a value in it survives the calls in this function | (b) — it is a live value, not dead |
| The guest tests **both** `x19` and zero, one after the other | (b) — if `x19` were zero, the first test would be redundant and a compiler would not emit both |
| Recompilers do fold provably-constant comparisons | (a) possible in principle |

**The third row is the strongest single argument for (b): a compiler that emitted `cmp x0, x19; b.eq`
followed by `cbz x0` in the original binary would not do so if `x19` were a known zero — the second test
would then be unreachable-and-redundant.** Since the original toolchain emitted both, `x19` is evidently
**not** a known zero, which means the recompiled code is testing a **different condition** than the original.

**That is reasoning, not proof. It is nevertheless the strongest candidate explanation this project has
produced for the hang, and it is falsifiable in one step.**

## 5. How to falsify it in one step

**Run the same guest function's semantics by hand at the hang.** The cursor at the hang is `0x710304fb90`;
read `x19` at that moment:

- **if `x19 == 0x710304fb90`** → the cursor *equals the sentinel*, the guest would have exited, and the
  recompiled code did not — **(b) confirmed**;
- **if `x19` is something else** → the cursor did not match the sentinel, the guest would also have looped,
  and **(b) is refuted** for this hang.

**This was not run.** It is one `gdb` read of one guest register and it settles the question.

## 6. What this round establishes

| Item | State |
|---|---|
| Compares in `main_00D2F0F4` | ✅ **exactly 2, both against zero** |
| Register compares in the guest function | ✅ **exactly 2 (`cmp x0,x19`, `cmp x21,x19`)** |
| **A discrepancy exists** | ✅ **measured** |
| Recompiler folded `x19` as provably zero | 🟡 **possible, unproven** |
| Recompiler dropped the comparison | 🟡 **more likely, unproven** |
| Which it is | ❌ **not determined** |

## 7. What this does NOT establish

- **A recompilation defect is NOT proven.** The discrepancy is proven; the cause is not.
- **`x19`'s value at the hang was not read** — the single decisive measurement was not taken.
- **Whether `0xd2f1a4` belongs to `AddVariable` or to an inlined callee inside it** was not checked against
  symbol boundaries.
- **Rounds 7–10's data findings are not invalidated** — the duplicate registration is still an observed fact;
  it may simply be *legal*, with the port's missing comparison being the real defect.
- **No fix was designed or implemented.**
- **`nnMain` is still not reached.** No NVN, no window. **This is not a booted game.**

## 8. Why this matters beyond Splatoon 2

If (b) holds, then **the recompiler's generated code is not faithful** — and nothing in this project's
testing would catch that, because the port's own 332 checks test *hand-written* reconstruction code, not
generated code. **A silent mis-translation would affect every game built with this toolchain**, not just
this one.

That is a claim worth being very careful about, and it is why the next step is a single register read rather
than an announcement.

## 9. Next increment

**Read guest `x19` at the hang and compare it to the cursor `0x710304fb90`.** One `gdb` read. It either
confirms the first recompilation defect this project has found, or refutes it and returns the search to the
data.
