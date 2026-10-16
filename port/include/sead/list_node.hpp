// sead::ListNode — sead's intrusive doubly-linked list node.
//
// Ported from the decompiled bodies, which are small and self-contained:
//
//   sead::ListNode::insertFront_(ListNode *)  @ 0x7100e56adc, 24 bytes
//   sead::ListNode::insertBack_(ListNode *)   @ 0x7100e56ac4, 24 bytes
//   sead::ListNode::erase_()                  @ 0x7100e56af4, 40 bytes
//
// WHY THESE FIRST. `sead::AssertConfig::registerCallback` (0x7101397fac) is one of the
// boot root's 13 direct dependencies, and its body is almost entirely these three calls
// plus refcount adjustments. They are also the reusable primitive: a large fraction of
// the engine stores objects in sead intrusive lists, so porting them unblocks more than
// registerCallback alone.
//
// The node is the classic two-pointer form — {next, prev} — and the three operations are
// direct pointer splices with null guards. The ports below mirror the decompiled control
// flow exactly rather than "tidying" it, because the null guards are load-bearing: the
// binary checks each link before writing through it, and a list head that has never been
// inserted legitimately has null links.
#pragma once

#include <cstddef>

namespace sead {

class List;

class ListNode {
public:
    ListNode() : mNext(nullptr), mPrev(nullptr) {}

    // sead::ListNode::insertFront_ @ 0x7100e56adc (24 bytes).
    // NOTE THE NAMING, which is counter-intuitive: the decompiled body follows the
    // mPrev link, so `insertFront_(this, node)` splices `node` in *forward* of `this`
    // (i.e. after it, in list order):
    //   lVar1 = this->mPrev; this->mPrev = node; node->mNext = this;
    //   node->mPrev = lVar1; if (lVar1) lVar1->mNext = node;
    ListNode *insertFront_(ListNode *node) {
        if (node == nullptr) return nullptr;
        ListNode *const wasPrev = mPrev;
        mPrev = node;
        node->mNext = this;
        node->mPrev = wasPrev;
        if (wasPrev != nullptr) wasPrev->mNext = node;
        return node;
    }

    // sead::ListNode::insertBack_ @ 0x7100e56ac4 (24 bytes).
    // Follows the mNext link, so it splices `node` in *behind* `this`:
    //   puVar1 = this->mNext; this->mNext = node; node->mPrev = this;
    //   node->mNext = puVar1; if (puVar1) puVar1->mPrev = node;
    ListNode *insertBack_(ListNode *node) {
        if (node == nullptr) return nullptr;
        ListNode *const wasNext = mNext;
        mNext = node;
        node->mPrev = this;
        node->mNext = wasNext;
        if (wasNext != nullptr) wasNext->mPrev = node;
        return node;
    }

    // sead::ListNode::erase_ @ 0x7100e56af4 (40 bytes): unlink, then clear both links.
    void erase_() {
        if (mNext != nullptr) mNext->mPrev = mPrev;
        if (mPrev != nullptr) mPrev->mNext = mNext;
        mNext = nullptr;
        mPrev = nullptr;
    }

    bool isLinked() const { return mNext != nullptr || mPrev != nullptr; }

    ListNode *next() const { return mNext; }
    ListNode *prev() const { return mPrev; }

private:
    friend class List; // a list head is itself a ListNode and forms the sentinel

    // Field order matches the decompiled accesses: the structure is read as
    // {next at +0x0, prev at +0x8} on a 64-bit target.
    ListNode *mNext;
    ListNode *mPrev;
};

// A list head is itself a ListNode; sead uses the head's own links as the sentinel.
class List {
public:
    List() { init(); }

    void init() {
        mRoot.mNext = &mRoot;
        mRoot.mPrev = &mRoot;
    }

    // pushBack / pushFront follow the same splice the binary performs.
    void pushBack(ListNode *node) { mRoot.insertFront_(node); }
    void pushFront(ListNode *node) { mRoot.insertBack_(node); }

    ListNode *root() { return &mRoot; }

    std::size_t size() const {
        std::size_t n = 0;
        const ListNode *p = mRoot.mNext;
        while (p != nullptr && p != &mRoot) {
            ++n;
            p = p->next();
        }
        return n;
    }

    bool empty() const { return mRoot.mNext == &mRoot; }

private:
    ListNode mRoot;
};

} // namespace sead
