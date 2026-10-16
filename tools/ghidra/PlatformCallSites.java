// For each platform thunk, find its call sites inside main and decompile the callers.
//
// The platform implementations are NOT in this dump (see PLATFORM_LAYER_LOCATION.md),
// so the contract each import must satisfy is only observable from how main CALLS it.
// This is the achievable form of the goal: read the caller, implement the callee.
//@category REA-Export

import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionManager;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.app.util.demangler.DemanglerUtil;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class PlatformCallSites extends GhidraScript {

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = (args.length > 0 && !args[0].isEmpty()) ? args[0] : "platform-callsites.txt";
        String addrList = (args.length > 1) ? args[1] : "";

        FunctionManager fm = currentProgram.getFunctionManager();
        ReferenceManager rm = currentProgram.getReferenceManager();
        Address imageBase = currentProgram.getImageBase();

        String[] parts = addrList.isEmpty() ? new String[0] : addrList.split(",");

        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);

        PrintWriter w = new PrintWriter(outPath, "UTF-8");
        int totalCallers = 0;
        try {
            w.println("Platform import call sites inside main");
            w.println("program: " + currentProgram.getName());
            w.println("imports examined: " + parts.length);
            w.println();

            for (String raw : parts) {
                String s = raw.trim();
                if (s.isEmpty()) continue;
                long off;
                try {
                    off = Long.parseLong(s.replaceFirst("^0x", ""), 16);
                } catch (NumberFormatException e) {
                    continue;
                }
                Address a = imageBase.add(off);
                Function thunk = fm.getFunctionContaining(a);
                w.println("==============================================================");
                if (thunk == null) {
                    w.println("0x" + Long.toHexString(off) + "  NO THUNK");
                    w.println();
                    continue;
                }
                w.println("IMPORT " + thunk.getName() + "  @ " + thunk.getEntryPoint());
                // demangled form is the namespace-qualified name
                try {
                    Object d = DemanglerUtil.demangle(currentProgram, thunk.getName());
                    if (d != null) w.println("  demangled: " + d.toString());
                } catch (Throwable ignored) {
                }

                // who calls this thunk?
                Set<Address> callerEntries = new LinkedHashSet<Address>();
                for (Reference r : rm.getReferencesTo(thunk.getEntryPoint())) {
                    Address from = r.getFromAddress();
                    Function cf = fm.getFunctionContaining(from);
                    if (cf != null && !cf.getEntryPoint().equals(thunk.getEntryPoint())) {
                        callerEntries.add(cf.getEntryPoint());
                    }
                }

                w.println("  distinct callers: " + callerEntries.size());
                int shown = 0;
                for (Address ce : callerEntries) {
                    Function cf = fm.getFunctionAt(ce);
                    if (cf == null) continue;
                    w.println("  ----------------------------------------------------------");
                    w.println("  CALLER " + cf.getEntryPoint() + "  " + cf.getName());
                    try {
                        w.println("    caller body size: " + cf.getBody().getNumAddresses() + " bytes");
                    } catch (Throwable ignored) {
                    }
                    DecompileResults res = di.decompileFunction(cf, 120, monitor);
                    if (res != null && res.decompileCompleted()) {
                        String c = res.getDecompiledFunction().getC();
                        // keep output bounded: the import's own line plus a little context
                        String[] lines = c.split("\n");
                        int emitted = 0;
                        for (int i = 0; i < lines.length && emitted < 45; i++) {
                            w.println("      " + lines[i]);
                            emitted++;
                        }
                        if (lines.length > emitted) {
                            w.println("      ... (" + (lines.length - emitted) + " more lines)");
                        }
                    } else {
                        w.println("      <decompile failed>");
                    }
                    shown++;
                    totalCallers++;
                    if (shown >= 4) {
                        if (callerEntries.size() > 4) {
                            w.println("    ... (" + (callerEntries.size() - 4) + " more callers not shown)");
                        }
                        break;
                    }
                }
                if (callerEntries.isEmpty()) {
                    w.println("  (no callers found -- reached only indirectly)");
                }
                w.println();
            }
            w.println("callers decompiled: " + totalCallers);
        } finally {
            w.close();
            di.dispose();
        }
        println("PlatformCallSites wrote " + outPath);
    }
}
