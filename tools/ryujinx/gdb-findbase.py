import gdb

# The modules moved after the title restart, so the earlier base is stale. Find them by their MOD0
# headers instead of assuming an address. main+0x8 == "MOD0", so module_base = MOD0_addr - 8.
# Then identify the SDK by checking that *(base + 0x9e660) is `svc #1` (0xD4000021).

inf = gdb.selected_inferior()
LO, HI, STEP = 0x9000000, 0x12000000, 0x100000

print("--- scanning for MOD0 module headers ---")
found = []
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
        if base not in [b for b, _ in found]:
            found.append((base, start + i))
        i += 4

print(f"--- {len(found)} MOD0 header(s) ---")
sdk_base = None
for base, mod0 in found:
    tag = ""
    try:
        w = int.from_bytes(bytes(inf.read_memory(base + 0x9e660, 4)), "little")
        if w == 0xD4000021:
            tag = "  <== SDK (svc #1 at +0x9e660)"
            sdk_base = base
    except gdb.MemoryError:
        tag = "  (probe unmapped)"
    print(f"  module base 0x{base:08x}   MOD0 at 0x{mod0:08x}{tag}")

if sdk_base is not None:
    print(f"\n--- sdk_base = 0x{sdk_base:08x} ---")
    print(f"--- svcSetHeapSize = 0x{sdk_base + 0x9e660:08x} ---")
    gdb.execute(f"break *0x{sdk_base + 0x9e660:x}")
    print("--- breakpoint armed; continuing ---")
    gdb.execute("continue")
else:
    print("\n--- sdk not identified; PC was:", hex(int(gdb.parse_and_eval("$pc"))))
