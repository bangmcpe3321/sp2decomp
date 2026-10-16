// Whole-binary scan: find every call to a platform import and decompile its caller.
//
// Handle used: each import is called through a GOT slot named PTR_<Name>_<slot>. Ghidra
// resolves those slots as symbols, so references to them are enumerable. This walks all
// 502 slots, collects the distinct calling functions across the WHOLE binary, decompiles
// each once, and keeps only the lines that mention a platform PTR symbol.
//@category REA-Export

import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionManager;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolIterator;
import ghidra.program.model.symbol.SymbolTable;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class PlatformAllCallSites extends GhidraScript {

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = (args.length > 0 && !args[0].isEmpty()) ? args[0] : "platform-all-callsites.txt";
        String slotFile = (args.length > 1) ? args[1] : "";

        FunctionManager fm = currentProgram.getFunctionManager();
        ReferenceManager rm = currentProgram.getReferenceManager();
        Address imageBase = currentProgram.getImageBase();

        // ---- read the slot -> import-name map -----------------------------
        Map<Long, String> slotName = new LinkedHashMap<Long, String>();
        if (!slotFile.isEmpty()) {
            BufferedReader br = new BufferedReader(new FileReader(slotFile));
            String ln;
            while ((ln = br.readLine()) != null) {
                String[] p = ln.split("\t");
                if (p.length < 2) continue;
                try {
                    long off = Long.parseLong(p[0].replaceFirst("^0x", ""), 16);
                    // strip the 0x7100000000 image base to get an in-program offset
                    slotName.put(off, p[1]);
                } catch (NumberFormatException ignored) {
                }
            }
            br.close();
        }
        println("slots loaded: " + slotName.size());

        // ---- find every referencing function ------------------------------
        // The slot values in the file are full addresses (0x7102...). Map each to the
        // program address and enumerate references to it.
        Set<Address> callers = new LinkedHashSet<Address>();
        Map<Address, Set<String>> callerSlots = new LinkedHashMap<Address, Set<String>>();
        int slotsResolved = 0;

        for (Map.Entry<Long, String> e : slotName.entrySet()) {
            Address slotAddr = imageBase.add(e.getKey() - 0x7100000000L);
            boolean any = false;
            for (Reference r : rm.getReferencesTo(slotAddr)) {
                Address from = r.getFromAddress();
                Function cf = fm.getFunctionContaining(from);
                if (cf == null) continue;
                String cname = cf.getName();
                // skip the 13-byte import thunks themselves
                if (cname.equals(e.getValue())) continue;
                callers.add(cf.getEntryPoint());
                Set<String> s = callerSlots.get(cf.getEntryPoint());
                if (s == null) { s = new LinkedHashSet<String>(); callerSlots.put(cf.getEntryPoint(), s); }
                s.add(e.getValue());
                any = true;
            }
            if (any) slotsResolved++;
        }
        println("slots with at least one calling function: " + slotsResolved);
        println("distinct calling functions: " + callers.size());

        // ---- decompile each caller once, keep platform lines --------------
        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);

        PrintWriter w = new PrintWriter(outPath, "UTF-8");
        int written = 0;
        try {
            w.println("Whole-binary platform call sites");
            w.println("program: " + currentProgram.getName());
            w.println("slots considered: " + slotName.size() + ", resolved: " + slotsResolved);
            w.println("distinct calling functions: " + callers.size());
            w.println();

            for (Address ce : callers) {
                Function cf = fm.getFunctionAt(ce);
                if (cf == null) continue;
                DecompileResults res = di.decompileFunction(cf, 90, monitor);
                if (res == null || !res.decompileCompleted()) continue;
                String code = res.getDecompiledFunction().getC();
                String[] lines = code.split("\n");

                List<String> hits = new ArrayList<String>();
                for (String l : lines) {
                    if (l.contains("PTR_") && containsPlatform(l)) hits.add(l.trim());
                }
                if (hits.isEmpty()) continue;

                Set<String> slots = callerSlots.get(ce);
                w.println("==============================================================");
                w.println("CALLER " + cf.getEntryPoint() + "  " + cf.getName());
                try {
                    w.println("  body size: " + cf.getBody().getNumAddresses() + " bytes");
                } catch (Throwable ignored) {
                }
                w.println("  imports used: " + (slots == null ? "?" : slots.toString()));
                for (String h : hits) w.println("  " + h);
                written++;
            }
            w.println();
            w.println("callers with platform call sites: " + written);
        } finally {
            w.close();
            di.dispose();
        }
        println("PlatformAllCallSites wrote " + outPath + " (" + written + " callers)");
    }

    private boolean containsPlatform(String line) {
        String[] nss = {"os", "mem", "init", "vi", "fs", "time", "diag", "util", "nifm", "oe", "nv"};
        if (line.contains("PTR_AllocateMemoryBlock") || line.contains("PTR_GetSystemTick")
                || line.contains("PTR_QueryMemoryInfo") || line.contains("PTR_CreateThread")) {
            return true;
        }
        // generic: PTR_<Something>_710... names we loaded all belong to the platform set
        return line.contains("PTR_");
    }
}
