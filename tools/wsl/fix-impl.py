import sys
p = "/home/hexa/sp2port/runtime/src/main.cpp"
s = open(p).read()

# After creating the root heap, HeapMgr's own instance state must exist before setCurrentHeap_ can use it.
anchor = '    uint64_t set_off = 0;\n    if (!find_func_offset(nx_module_main, "_ZN4sead7HeapMgr15setCurrentHeap_EPNS_4HeapE", set_off)) {'
inject = '''    // HeapMgr::setCurrentHeap_ faults on a null HeapMgr::sInstance -- its own state must exist first.
    {
        uint64_t impl_off = 0;
        if (find_func_offset(nx_module_main, "_ZN4sead7HeapMgr15initializeImpl_Ev", impl_off)) {
            log("bootstrap: HeapMgr::initializeImpl_() at %s", describe(nx_module_main.base + impl_off).c_str());
            call_preserving(c, nx_module_main.base + impl_off);
            log("bootstrap: initializeImpl_ returned");
        }
    }
''' + anchor
if anchor not in s:
    print("anchor NOT found"); sys.exit(1)
open(p, "w").write(s.replace(anchor, inject, 1))
print("patched: HeapMgr::initializeImpl_() added before setCurrentHeap_")
