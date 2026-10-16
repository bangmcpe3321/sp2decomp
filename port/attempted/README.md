# Attempted: `sead::AssertConfig::registerCallback` (0x7101397fac)

**Status: attempted, not reconciled, deliberately not built.** The three files here are
kept as evidence of what was tried, with `.attempted` appended so no build picks them up.

---

## Why it was attempted

It is the **first unported dependency** the fail-loudly boot runner reaches
(`docs/ENGINE_RECONSTRUCTION.md` §5), so porting it is what advances the reconstruction
past step 2.

Its decompiled body is 160 bytes and was read in full. Unlike most engine functions, its
**field offsets are explicit** — there is no need to infer a layout from call sites:

| Access | Meaning |
|---|---|
| `slot + 0x20` | `ListNode` — the slot's link in the subscriber list |
| `slot + 0x38` | pointer stored as the connection |
| `slot + 0x68` | connected flag, set to 1 after registration |
| `*(int *)(lVar2 + 0x10)` | a reference count, decremented on disconnect |
| `event + 0x08` | subscriber list head |
| `event + 0x18` | subscriber count |

The control flow is also unambiguous: a *conditional* disconnect guarded by the
connected flag, then an *unconditional* second disconnect, then link into the global
`sAssertEvent`, increment its count, and set the flag.

## What went wrong

**The connection field does not model cleanly.** The body does:

```c
lVar2 = *(long *)(param_1 + 0x38);          // read the "connection"
*(param_1 + 0x38) = PTR_sAssertEvent + 8;   // store the EVENT's list head there
...
*(int *)(lVar2 + 0x10) += -1;               // decrement a refcount THROUGH it
```

So the same field holds either a connection object *or* a pointer into the event,
depending on which branch ran — and a refcount is written through it either way. That
means the field is really a pointer to some base subobject whose `+0x10` is a refcount,
reachable from both a connection and the event.

Modelling it required either:

- a shared base class, which **shifts the event's own `+0x08`/`+0x18` offsets** and broke
  the `static_assert`s for the event layout; or
- casting through `void *`, which compiled but asserted a relationship between two
  unrelated types that I could not justify from the evidence.

**No decompiled caller exists** for `registerCallback`, so there is no usage evidence to
disambiguate which reading is right. The body alone does not settle it.

## What the `static_assert`s did

They are the reason this was caught rather than shipped. Placing members at the
decompiled offsets is enforced at compile time, so every modelling mistake failed the
build instead of silently corrupting memory:

```
error: static assertion failed: slot connected flag must sit at +0x68
error: static assertion failed: slot connection must sit at +0x38
error: static assertion failed: event list head must sit at +0x08
error: static assertion failed: event count must sit at +0x18
```

That is the mechanism working as intended.

## The honest disposition

The boot sequence **still declares this dependency missing**, so the runner stops here and
reports it. That is the accurate state: a port whose layout is unverified is worse than a
declared gap, because it would let the sequence advance over behaviour that may be wrong.

`docs/ENGINE_RECONSTRUCTION.md` §5 records it as not ported.

## What would settle it

1. **A decompiled caller.** Any code that constructs a `DelegateEvent::Slot` would show
   how the connection field is populated and what type it really points at.
2. **`sead::DelegateEventConnection`'s definition from a reference.** `open-ead/sead` is
   checked out at `~/refs/sead` and may define the delegate types; matching its layout
   against these offsets would resolve the ambiguity. Not yet consulted for this purpose.
3. **`sAssertEvent`'s contents.** It is in `.bss` (target `0x3698490`, beyond EOF), so it
   is not readable from the file — the same limitation recorded for `MutexType` in
   `docs/TYPE_SIZES.md`.

Note that option 2 is the cheapest and was not tried before the port was attempted; that
ordering was a mistake, since the reference was already on disk.
