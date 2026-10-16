// Whole-binary scan, corrected: find callers of the platform THUNK ENTRIES.
//
// The previous version enumerated references to the GOT slot symbols. That found NVN and
// data imports but zero platform functions, because callers invoke the platform imports
// as NAMED functions (Ghidra renders `nn::os::GetSystemTick()`), not through the PTR
// indirection the thunk itself uses. So the correct handle is a reference to the thunk's
// entry address.
//@category REA-Export

import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionManager;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PlatformThunkCallers extends GhidraScript {

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = (args.length > 0 && !args[0].isEmpty()) ? args[0] : "platform-thunk-callers.txt";
        String mapFile = (args.length > 1) ? args[1] : "";

        FunctionManager fm = currentProgram.getFunctionManager();
        ReferenceManager rm = currentProgram.getReferenceManager();
        Address imageBase = currentProgram.getImageBase();

        // ---- thunk VA -> import name -------------------------------------
        // platform-ptr-slots.txt: <slot>\t<name>\t<thunkVa>\t<thunkName>
        Map<Long, String> thunkName = new LinkedHashMap<Long, String>();
        if (!mapFile.isEmpty()) {
            BufferedReader br = new BufferedReader(new FileReader(mapFile));
            String ln;
            while ((ln = br.readLine()) != null) {
                String[] p = ln.split("\t");
                if (p.length < 3) continue;
                try {
                    long va = Long.parseLong(p[2].replaceFirst("^0x", ""), 16);
                    thunkName.put(va, p[1]);
                } catch (NumberFormatException ignored) {
                }
            }
            br.close();
        }
        println("thunks loaded: " + thunkName.size());

        // ---- find callers of each thunk entry ----------------------------
        Map<Address, Set<String>> callerImports = new LinkedHashMap<Address, Set<String>>();
        int thunksWithCallers = 0;
        for (Map.Entry<Long, String> e : thunkName.entrySet()) {
            Address te = imageBase.add(e.getKey() - 0x7100000000L);
            boolean any = false;
            for (Reference r : rm.getReferencesTo(te)) {
                Function cf = fm.getFunctionContaining(r.getFromAddress());
                if (cf == null) continue;
                if (cf.getEntryPoint().equals(te)) continue; // ignore self
                Set<String> s = callerImports.get(cf.getEntryPoint());
                if (s == null) { s = new LinkedHashSet<String>(); callerImports.put(cf.getEntryPoint(), s); }
                s.add(e.getValue());
                any = true;
            }
            if (any) thunksWithCallers++;
        }
        println("thunks with callers: " + thunksWithCallers);
        println("distinct calling functions: " + callerImports.size());

        // ---- decompile each caller once, keep platform call lines ---------
        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);

        // match any of the import names as a call in the pseudocode
        List<String> names = new ArrayList<String>(new LinkedHashSet<String>(thunkName.values()));
        StringBuilder re = new StringBuilder();
        for (String n : names) {
            if (re.length() > 0) re.append("|");
            re.append(Pattern.quote(n));
        }
        Pattern callPat = re.length() == 0 ? null : Pattern.compile("(" + re + ")\\s*\\(");

        PrintWriter w = new PrintWriter(outPath, "UTF-8");
        int written = 0;
        try {
            w.println("Platform import callers (whole binary), matched on thunk entry references");
            w.println("program: " + currentProgram.getName());
            w.println("thunks: " + thunkName.size() + ", with callers: " + thunksWithCallers);
            w.println("calling functions: " + callerImports.size());
            w.println();

            for (Map.Entry<Address, Set<String>> e : callerImports.entrySet()) {
                Function cf = fm.getFunctionAt(e.getKey());
                if (cf == null) continue;
                DecompileResults res = di.decompileFunction(cf, 90, monitor);
                if (res == null || !res.decompileCompleted()) continue;
                String code = res.getDecompiledFunction().getC();
                List<String> hits = new ArrayList<String>();
                if (callPat != null) {
                    for (String l : code.split("\n")) {
                        Matcher m = callPat.matcher(l);
                        if (m.find()) hits.add(l.trim());
                    }
                }
                w.println("==============================================================");
                w.println("CALLER " + cf.getEntryPoint() + "  " + cf.getName());
                try {
                    w.println("  body size: " + cf.getBody().getNumAddresses() + " bytes");
                } catch (Throwable ignored) {
                }
                w.println("  imports referenced: " + e.getValue().toString());
                for (String h : hits) w.println("  CALL " + h);
                written++;
            }
            w.println();
            w.println("callers written: " + written);
        } finally {
            w.close();
            di.dispose();
        }
        println("PlatformThunkCallers wrote " + outPath + " (" + written + " callers)");
    }
}
