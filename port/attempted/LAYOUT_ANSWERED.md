# registerCallback: the layout question is ANSWERED

> **Superseded in part.** `registerCallback` was successfully ported in round 6 — see
> `port/src/delegate_event.cpp`. It is `DelegateEvent::connect` plus a thin wrapper. This
> document is retained because the *reasoning* about the layout, and the note about the
> reference being consulted late, remain useful.

Supersedes the "what defeated it" section of the disposition note below. The reference
was consulted this time, and it resolves the ambiguity.

## The answer

`open-ead/sead` defines the mechanism at `include/prim/seadDelegateEventSlot.h`:

```cpp
template <typename T>
class DelegateEvent
{
public:
    class Slot;                              // defined below
    using SlotList = TList<Slot*>;
    using SlotListNode = TListNode<Slot*>;

    class Slot : public IDisposer
    {
    public:
        ~Slot() override { release(); }

        void release()
        {
            if (mConnectedToDelegateEvent)
            {
                mNode.erase();
                mConnectedToDelegateEvent = false;
            }
        }
    private:
        SlotListNode mNode{this};
        IDelegate1<T>* mDelegatePtr = nullptr;
        StorageFor<AnyDelegate1<T>, true> mDelegate;
        bool mConnectedToDelegateEvent = false;
    };

    void connect(Slot& slot)
    {
        slot.release();                          // unconditional release
        mList.pushBack(&slot.mNode);
        slot.mConnectedToDelegateEvent = true;
    }

    void disconnect(Slot& slot) { slot.release(); }
    int getNumSlots() const { return mList.size(); }
protected:
    SlotList mList;
};
```

**There is no reference count.** My model invented one. The pointer the decompile reads at
`slot + 0x38` is **`mDelegatePtr`** (the delegate), not a connection object, and
`slot + 0x68` is **`mConnectedToDelegateEvent`**. The decompile's
`*(int *)(lVar2 + 0x10) += -1` reads a field *inside the delegate*, not a slot refcount.

`TListNode<Slot*>` is `ListNode` (next at +0x00, prev at +0x08) followed by `mData` and a
list back-pointer, and `Slot : IDisposer` places `IDisposer::mListNode` at the object's
`+0x20`.

## `registerCallback` maps onto `connect()` exactly

| Decompiled body | sead's `connect()` |
|---|---|
| `if (*(char *)(param_1 + 0x68) != '\0') { ...erase...; *(param_1 + 0x68) = 0; }` | `if (mConnectedToDelegateEvent) { mNode.erase(); mConnectedToDelegateEvent = false; }` |
| the unconditional second `erase_` + decrement | `slot.release()` called unconditionally by `connect()` |
| `ListNode::insertFront_(event + 8, param_1 + 0x20)` | `mList.pushBack(&slot.mNode)` |
| `*(int *)(event + 0x18) += 1` | the list's own size accounting |
| `*(undefined1 *)(param_1 + 0x68) = 1` | `slot.mConnectedToDelegateEvent = true` |

So `sead::AssertConfig::registerCallback` is a thin wrapper that reaches
`DelegateEvent::connect`.

## Layout confirmed empirically

`port/tests/layout_probe.cpp` prints candidate offsets so a decompile-derived layout can be
matched rather than guessed. With the sead structure above:

```
candidate slot layouts (need: node@0x20, ptr@0x38, flag@0x68)
  C: node=0x20 delegate=0x38 flag=0x68   <-- target shape
candidate event layouts (need: list@0x08, count@0x18)
  A: list=0x8 count=0x20                 <-- needs 8 more bytes of padding before count
```

Candidate C matches **all three** slot offsets. The event needs `count` moved from `+0x20`
to `+0x18`, i.e. 8 bytes less padding between the list and the count.

## Why the earlier attempt failed

I modelled a `RefCounted`/`DelegateEventConnection` pair that does not exist in the
mechanism, because I read `*(int *)(lVar2 + 0x10)` as a slot refcount rather than a write
into the delegate. That wrong model then forced type casts that shifted the event's own
offsets and tripped the `static_assert`s.

**The `static_assert`s are what stopped a wrong model from shipping**, and the reference —
already cloned at `~/refs/sead` — was the cheap answer I did not consult until round 5.
