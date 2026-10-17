import gdb

# The game is paused at startup, so svcSetHeapSize has NOT run yet -- this is the window.
# 1. find sdk_base by MOD0 scan + verify with the svc #1 stub at +0x9e660 (robust to base changes)
# 2. arm the breakpoint with full reporting
# 3. continue and let it fire

inf = gdb.selected_inferior()
LO, HI, STEP = 0x9000000, 0x12000000, 0x100000

print(f"--- attached, PC = 0x{int(gdb.parse_and_eval('$pc')):x} ---")
print("--- scanning for MOD0 ---")
sdk_base = None
for start in range(LO, HI, STEP):
    try:
        data = bytes(inf.read_memory(start, STEP))
    except gdb.MemoryError:
        continue
    i = 0
    while True:
        i = data.find(b"MOD0", i)
        if i < 0:
            break
        base = start + i - 8
        try:
            w = int.from_bytes(bytes(inf.read_memory(base + 0x9E660, 4)), "little")
            if w == 0xD4000021:
                sdk_base = base
                print(f"  sdk  base 0x{base:08x}  (svc #1 verified)")
        except gdb.MemoryError:
            pass
        i += 4

if sdk_base is None:
    print("  sdk NOT identified")
else:
    target = sdk_base + 0x9E660
    print(f"\n--- svcSetHeapSize = 0x{target:08x} ---")
    bp = gdb.Breakpoint(f"*0x{target:x}")

    class Hit(gdb.Command):
        pass

    def on_stop(ev):
        try:
            x0 = int(gdb.parse_and_eval("$x0"))
            x1 = int(gdb.parse_and_eval("$x1"))
            lr = int(gdb.parse_and_eval("$lr"))
            print("\n=== svcSetHeapSize CALLED ===")
            print(f"  x0 (out pointer) = 0x{x0:x}")
            print(f"  x1 (SIZE)        = 0x{x1:x}   {x1} bytes = {x1/1048576:.1f} MB")
            print(f"  lr (caller)      = 0x{lr:x}   sdk+0x{lr-sdk_base:x}")
            print(f"  sp               = 0x{int(gdb.parse_and_eval('$sp')):x}")
        except Exception as e:
            print("  read failed:", e)

    gdb.events.stop.connect(on_stop)
    print("--- armed; continuing (expect a hit during start-up) ---")
    gdb.execute("continue")
