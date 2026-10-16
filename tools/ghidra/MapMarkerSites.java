// Map marker-site addresses to the functions that actually contain them, then
// decompile each distinct function once.
//
// This replaces byte-scanning for prologues, which attributed sites to the wrong
// function because `stp x29,x30,[sp,#-N]!` also occurs for secondary stack frames.
// Ghidra already has authoritative function boundaries, so ask it directly.
//@category REA-Export

import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionManager;
import ghidra.app.util.demangler.DemanglerUtil;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class MapMarkerSites extends GhidraScript {

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = (args.length > 0 && !args[0].isEmpty()) ? args[0] : "marker-functions.txt";
        String siteList = (args.length > 1) ? args[1] : "";

        FunctionManager fm = currentProgram.getFunctionManager();
        Address imageBase = currentProgram.getImageBase();

        String[] parts = siteList.isEmpty() ? new String[0] : siteList.split(",");

        // site -> containing function, deduplicated by function entry
        Map<Address, List<Address>> byFunction = new LinkedHashMap<Address, List<Address>>();
        int unresolved = 0;

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
            Function f = fm.getFunctionContaining(a);
            if (f == null) {
                unresolved++;
                continue;
            }
            Address entry = f.getEntryPoint();
            List<Address> sites = byFunction.get(entry);
            if (sites == null) {
                sites = new ArrayList<Address>();
                byFunction.put(entry, sites);
            }
            sites.add(a);
        }

        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);

        PrintWriter w = new PrintWriter(outPath, "UTF-8");
        int done = 0;
        try {
            w.println("Marker sites mapped to containing functions");
            w.println("program: " + currentProgram.getName());
            w.println("sites supplied: " + parts.length + ", unresolved: " + unresolved);
            w.println("distinct functions: " + byFunction.size());
            w.println();

            w.println("=== SUMMARY ===");
            for (Map.Entry<Address, List<Address>> e : byFunction.entrySet()) {
                Function f = fm.getFunctionAt(e.getKey());
                long size = -1;
                try {
                    size = f.getBody().getNumAddresses();
                } catch (Throwable ignored) {
                }
                w.println(String.format("%s\tsize=%d\tsites=%d\t%s",
                        e.getKey(), size, e.getValue().size(), f.getName()));
            }
            w.println();

            for (Map.Entry<Address, List<Address>> e : byFunction.entrySet()) {
                Function f = fm.getFunctionAt(e.getKey());
                if (f == null) continue;
                done++;
                w.println("==============================================================");
                w.println("FUNCTION " + f.getEntryPoint() + "  " + f.getName());
                String dem = f.getName();
                try {
                    Object d = DemanglerUtil.demangle(currentProgram, f.getName());
                    if (d != null) dem = d.toString();
                } catch (Throwable ignored) {
                }
                w.println("  demangled : " + dem);
                try {
                    w.println("  body size : " + f.getBody().getNumAddresses() + " bytes");
                } catch (Throwable ignored) {
                }
                StringBuilder sb = new StringBuilder("  marker sites:");
                for (Address a : e.getValue()) sb.append(" ").append(a);
                w.println(sb.toString());
                w.println("--------------------------------------------------------------");
                DecompileResults res = di.decompileFunction(f, 120, monitor);
                if (res != null && res.decompileCompleted()) {
                    w.println(res.getDecompiledFunction().getC());
                } else {
                    w.println("<decompilation failed>");
                }
                w.println();
            }
            w.println("decompiled: " + done);
        } finally {
            w.close();
            di.dispose();
        }
        println("MapMarkerSites wrote " + outPath + " (" + byFunction.size() + " functions)");
    }
}
