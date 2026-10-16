// Find the platform import thunks in main BY NAME, then decompile their callers.
//
// The addresses in PORT_WORKLIST.md turned out to be GOT slots that Ghidra promoted to
// functions, not code, so address lookup returns NO THUNK. Ghidra does know the thunks
// by their mangled names, so match on name instead.
//@category REA-Export

import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import ghidra.program.model.listing.FunctionManager;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.app.util.demangler.DemanglerUtil;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

public class PlatformThunksByName extends GhidraScript {

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = (args.length > 0 && !args[0].isEmpty()) ? args[0] : "platform-thunks.txt";

        FunctionManager fm = currentProgram.getFunctionManager();
        ReferenceManager rm = currentProgram.getReferenceManager();

        // platform namespaces main imports
        Pattern pat = Pattern.compile(
            "^(nn::)?(os|mem|init|vi|fs|time|diag|util|nifm|oe)::|_ZN2nn(2os|3mem|4init|2vi|2fs|4time|4diag|4util|4nifm|2oe)");

        List<Function> thunks = new ArrayList<Function>();
        FunctionIterator it = fm.getFunctions(true);
        while (it.hasNext()) {
            Function f = it.next();
            String n = f.getName();
            String dem = n;
            try {
                Object d = DemanglerUtil.demangle(currentProgram, n);
                if (d != null) dem = d.toString();
            } catch (Throwable ignored) {
            }
            if (pat.matcher(dem).find() || pat.matcher(n).find()) {
                thunks.add(f);
            }
        }

        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);

        PrintWriter w = new PrintWriter(outPath, "UTF-8");
        int withCallers = 0;
        try {
            w.println("Platform-namespace functions in main (matched by name)");
            w.println("program: " + currentProgram.getName());
            w.println("matched: " + thunks.size());
            w.println();

            for (Function f : thunks) {
                String dem = f.getName();
                try {
                    Object d = DemanglerUtil.demangle(currentProgram, f.getName());
                    if (d != null) dem = d.toString();
                } catch (Throwable ignored) {
                }
                long size = -1;
                try {
                    size = f.getBody().getNumAddresses();
                } catch (Throwable ignored) {
                }

                // only report thin wrappers (the imports); real code is covered elsewhere
                Set<Address> callers = new LinkedHashSet<Address>();
                for (Reference r : rm.getReferencesTo(f.getEntryPoint())) {
                    Address from = r.getFromAddress();
                    Function cf = fm.getFunctionContaining(from);
                    if (cf != null && !cf.getEntryPoint().equals(f.getEntryPoint())) {
                        callers.add(cf.getEntryPoint());
                    }
                }
                if (callers.isEmpty()) continue;
                withCallers++;

                w.println("==============================================================");
                w.println("IMPORT " + dem);
                w.println("  raw name  : " + f.getName());
                w.println("  entry     : " + f.getEntryPoint());
                w.println("  body size : " + size + " bytes");
                w.println("  callers   : " + callers.size());

                int shown = 0;
                for (Address ce : callers) {
                    Function cf = fm.getFunctionAt(ce);
                    if (cf == null) continue;
                    w.println("  ----------------------------------------------------------");
                    w.println("  CALLER " + cf.getEntryPoint() + "  " + cf.getName());
                    DecompileResults res = di.decompileFunction(cf, 120, monitor);
                    if (res != null && res.decompileCompleted()) {
                        String c = res.getDecompiledFunction().getC();
                        String[] lines = c.split("\n");
                        int emitted = 0;
                        for (int i = 0; i < lines.length && emitted < 40; i++) {
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
                    if (shown >= 3) break;
                }
                w.println();
            }
            w.println("imports with callers: " + withCallers + " of " + thunks.size());
        } finally {
            w.close();
            di.dispose();
        }
        println("PlatformThunksByName wrote " + outPath);
    }
}
