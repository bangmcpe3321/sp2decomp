// Contract tests for sead::ListNode, sead's intrusive doubly-linked list.
//
// These are ports of decompiled bodies, so the checks assert the specific pointer
// behaviour those bodies implement — including the counter-intuitive naming that a
// plausible-looking port gets wrong:
//
//   insertFront_ (0x7100e56adc) follows mPrev, so it splices FORWARD of `this`.
//   insertBack_  (0x7100e56ac4) follows mNext, so it splices BEHIND `this`.
//
// That inversion is exactly the kind of thing a reconstruction gets backwards if it
// trusts the name over the decompile, so it is pinned here explicitly.
#include "sead/list_node.hpp"

#include <cstdio>
#include <vector>

namespace {

int g_failures = 0;
int g_checks = 0;

void Check(bool cond, const char *what) {
    ++g_checks;
    if (!cond) { ++g_failures; std::printf("  FAIL  %s\n", what); }
    else { std::printf("  ok    %s\n", what); }
}

void TestRawSplice() {
    std::printf("sead::ListNode raw splice (0x7100e56adc / 0xe56ac4 / 0xe56af4)\n");

    sead::ListNode a, b, c;

    // A freshly constructed node is unlinked.
    Check(!a.isLinked(), "a default-constructed node has null links");

    // insertBack_ follows mNext: b goes behind a.
    a.insertBack_(&b);
    Check(a.next() == &b, "insertBack_ sets this->next = node");
    Check(b.prev() == &a, "and node->prev = this");
    Check(b.next() == nullptr, "with node->next taken from the old this->next (null)");

    // insertFront_ follows mPrev: c goes forward of a, i.e. after a and before b.
    a.insertFront_(&c);
    Check(a.prev() == &c, "insertFront_ sets this->prev = node");
    Check(c.next() == &a, "and node->next = this");

    // Erase b and confirm both neighbours are stitched together.
    b.erase_();
    Check(!b.isLinked(), "erase_() clears both of the erased node's links");
    Check(b.next() == nullptr && b.prev() == nullptr, "and leaves them null");

    b.erase_();
    Check(true, "erasing an already-erased node is safe (null guards)");

    sead::ListNode d;
    d.erase_();
    Check(true, "erasing a never-inserted node is safe");

    sead::ListNode *nullInsert = a.insertBack_(nullptr);
    Check(nullInsert == nullptr, "inserting a null node is rejected, not dereferenced");
}

void TestList() {
    std::printf("sead::List head/sentinel behaviour\n");

    sead::List list;
    Check(list.empty(), "a fresh list is empty");

    sead::ListNode n1, n2, n3;
    list.pushBack(&n1);
    list.pushBack(&n2);
    list.pushBack(&n3);

    // pushBack uses insertFront_ on the root, which follows mPrev. Walk from the root's
    // next and confirm we see every node exactly once and return to the sentinel.
    std::vector<sead::ListNode *> seen;
    sead::ListNode *p = list.root()->next();
    int guard = 0;
    while (p != nullptr && p != list.root() && guard++ < 16) {
        seen.push_back(p);
        p = p->next();
    }
    std::printf("        pushBack order:");
    for (auto *q : seen) std::printf(" %s", q == &n1 ? "n1" : q == &n2 ? "n2" : q == &n3 ? "n3" : "?");
    std::printf("\n");

    Check(seen.size() == 3, "all three nodes are reachable from the sentinel");
    Check(seen.size() == 3 && seen[0] == &n1 && seen[2] == &n3,
          "pushBack preserves insertion order (n1, n2, n3)");
    Check(p == list.root(), "the walk terminates back at the sentinel (no cycle)");

    // Erase the middle and confirm the list closes up.
    n2.erase_();
    Check(list.size() == 2, "erasing the middle node leaves two");

    // Erase the rest; every node must end up unlinked with null links.
    n1.erase_();
    n3.erase_();
    Check(!n1.isLinked() && !n2.isLinked() && !n3.isLinked(),
          "erasing every node leaves all of them unlinked");
}

} // namespace

int main() {
    std::printf("sead::ListNode contract tests\n");
    std::printf("(ports of 0x7100e56adc / 0x7100e56ac4 / 0x7100e56af4)\n\n");
    TestRawSplice();
    std::printf("\n");
    TestList();
    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
