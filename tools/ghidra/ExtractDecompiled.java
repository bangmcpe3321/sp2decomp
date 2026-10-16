// Decompile a list of functions and write their pseudocode to a file.
//
// Java is required: Ghidra 12's headless analyzer has no Jython, and PyGhidra cannot
// install on this host (bundled jpype wheels are cp310/cp311, host Python is 3.14).
//@category REA-Export

import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionManager;
import ghidra.app.util.demangler.DemanglerUtil;
import java.io.PrintWriter;

public class ExtractDecompiled extends GhidraScript {

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = (args.length > 0 && !args[0].isEmpty()) ? args[0] : "decompiled.txt";
        String addrList = (args.length > 1) ? args[1] : "";
        String[] parts = addrList.isEmpty() ? new String[0] : addrList.split(",");

        FunctionManager fm = currentProgram.getFunctionManager();
        Address imageBase = currentProgram.getImageBase();

        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);

        PrintWriter w = new PrintWriter(outPath, "UTF-8");
        int done = 0;
        try {
            w.println("Decompiled functions from " + currentProgram.getName());
            w.println("language: " + currentProgram.getLanguageID());
            w.println("image base: " + imageBase);
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
                // addresses in the sdk report are memory addresses (base 0)
                Address a = imageBase.add(off);
                Function f = fm.getFunctionContaining(a);
                w.println("==============================================================");
                if (f == null) {
                    w.println("0x" + Long.toHexString(off) + "  NO FUNCTION CONTAINING THIS ADDRESS");
                    w.println();
                    continue;
                }
                done++;
                w.println("0x" + Long.toHexString(off) + "  " + f.getName());
                String dem = f.getName();
                try {
                    Object d = DemanglerUtil.demangle(currentProgram, f.getName());
                    if (d != null) dem = d.toString();
                } catch (Throwable ignored) {
                }
                w.println("  demangled : " + dem);
                w.println("  entry     : " + f.getEntryPoint());
                try {
                    w.println("  body size : " + f.getBody().getNumAddresses() + " bytes");
                } catch (Throwable ignored) {
                }
                w.println("--------------------------------------------------------------");
                DecompileResults res = di.decompileFunction(f, 120, monitor);
                if (res != null && res.decompileCompleted()) {
                    w.println(res.getDecompiledFunction().getC());
                } else {
                    w.println("<decompilation failed: "
                            + (res != null ? res.getErrorMessage() : "no result") + ">");
                }
                w.println();
            }
            w.println("functions decompiled: " + done + " of " + parts.length + " requested");
        } finally {
            w.close();
            di.dispose();
        }
        println("ExtractDecompiled wrote " + outPath + " (" + done + " functions)");
    }
}
