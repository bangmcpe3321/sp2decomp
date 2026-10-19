#!/usr/bin/env python3
"""Apply the nn::os condition-variable mutex-tag fix to the port's kernel HLE.

svcWaitProcessWideKeyAtomic must be told the caller's mutex tag so that, when the waiter
is woken, the kernel can write that tag back into the mutex word (handing the lock over).
The SDK reads the tag from GetCurrentThread()+0x1B8. The loader resolves every function
relocation to an HLE before looking at module exports, so the sdk module's GOT slot for
GetCurrentThread binds to the port's synthetic per-thread context, whose +0x1B8 is 0.
The guest therefore passes tag=0, and unlock_mutex hands the mutex to the waiter as 0 --
the waiter resumes *without* owning the critical section, races the LightEvent re-check
against a concurrent resetSignal, and can lose a wakeup. That is the sead::WorkerMgr::
sync() deadlock: the worker sleeps on the queue-event condvar with the event state
signalled and the queue complete.

The mutex word already carries the owner tag (the caller holds the mutex), so derive the
tag from it; fall back to the guest-supplied tag when the word is 0 (mutex not held).

Usage: python3 wsl-patch-cv-tag.py [--check]
Exit codes: 0 applied/already applied, 1 anchor missing, 2 --check found the patch missing.
"""
import os
import sys

ROOT = os.path.expanduser('~/sp2port')
PATH = os.path.join(ROOT, 'runtime/src/kernel.cpp')

OLD = """    self->wake = false;
    self->wait_mutex = mutex;
    self->wait_key = key;
    self->wait_tag = tag;
    self->wait_result = 0;
"""

NEW = """    self->wake = false;
    self->wait_mutex = mutex;
    self->wait_key = key;
    // [sp2port] The tag is the caller's own mutex tag: the value the kernel writes back into the mutex
    // word when it hands the lock to this waiter. The SDK gets it from GetCurrentThread()+0x1B8; the sdk
    // module's import of GetCurrentThread binds to this port's synthetic thread context (whose +0x1B8 is
    // 0), while InternalCriticalSection::Enter reads the tag from the guest thread object at
    // [TP+0x1F8]+0x1B8. So the guest passes 0 here, and the handoff used to store 0 -- the waiter resumed
    // without the critical section and could lose the LightEvent signal (WorkerMgr::sync deadlock).
    // Take the owner tag from the mutex word the caller holds; fall back to the guest tag when it is 0.
    {
        const uint32_t owner_tag = load32(mutex) & ~kHandleWaitMask;
        self->wait_tag = owner_tag ? owner_tag : tag;
    }
    self->wait_result = 0;
"""

MARK = 'const uint32_t owner_tag = load32(mutex) & ~kHandleWaitMask;'


def main() -> int:
    check = '--check' in sys.argv[1:]
    if not os.path.exists(PATH):
        print('missing %s (is ~/sp2port built?)' % PATH, file=sys.stderr)
        return 1
    src = open(PATH, 'r', errors='replace').read()
    if MARK in src:
        print('already patched: %s' % PATH)
        return 0
    if check:
        print('NOT patched: %s' % PATH, file=sys.stderr)
        return 2
    if OLD not in src:
        print('anchor not found in %s' % PATH, file=sys.stderr)
        return 1
    src = src.replace(OLD, NEW, 1)
    open(PATH, 'w').write(src)
    print('patched %s' % PATH)
    return 0


if __name__ == '__main__':
    sys.exit(main())
