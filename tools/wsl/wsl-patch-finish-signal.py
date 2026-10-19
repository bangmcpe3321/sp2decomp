#!/usr/bin/env python3
"""Apply the sead::JobQueue::FINISH completion-signal fix to the translated main module.

The main thread is a job-queue participant: WorkerMgr::run() adds its runAll() count to
[queue+0x70] but, unlike Worker::proc_, never performs the "count >= getNumJobs()" test that
signals the queue's completion event. A worker that already entered FINISH (its own test
failed because the main's batch was still outstanding) then waits forever, never signals its
own worker event, and WorkerMgr::sync() waits forever too.

FINISH's early-out already knows the queue is complete (isDone_() == [queue+0x70] == getNumJobs()).
A participant that observes that state must release the barrier's waiters, so signal the queue
event (sead::Event::setSignal) before returning. The event is manual-clear (FixedSizeJQ's
constructor initializes the nn::os LightEvent with clearMode 0: cleared 0xfe, signalled 1,
SignalLightEvent broadcasts), so this wakes every waiter and is a no-op when already signalled.

Usage: python3 wsl-patch-finish-signal.py [--check]
Exit codes: 0 applied/already applied, 1 anchor missing, 2 --check found the patch missing.
"""
import os
import sys

ROOT = os.path.expanduser('~/sp2port')
PATH = os.path.join(ROOT, 'gen/main/code_317.cpp')

OLD = """    if (((uint32_t(c.x[0]) >> 0) & 1) == 0) goto L_EA9A48; // tbz w0, #0, #0xea9a48
L_EA9A3C:;
"""

NEW = """    if (((uint32_t(c.x[0]) >> 0) & 1) == 0) goto L_EA9A48; // tbz w0, #0, #0xea9a48
    // [sp2port] A participant that observes the queue complete must release the FINISH waiters.
    // WorkerMgr::run adds the main thread's count to [queue+0x70] without the ">= getNumJobs()"
    // setSignal that Worker::proc_ performs, so a worker already waiting on the queue event would
    // otherwise sleep forever (WorkerMgr::sync deadlock).
    c.x[0] = uint64_t(c.x[19] + 0x28ull);
    main_00E98E00(c); // sead::Event::setSignal
L_EA9A3C:;
"""

MARK = 'main_00E98E00(c); // sead::Event::setSignal'


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
