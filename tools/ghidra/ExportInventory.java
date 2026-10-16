// Ghidra headless post-script: inventory functions, symbols, memory blocks and
// defined strings for the reconstructed Switch NSO.
//@category REA-Export

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.data.DataUtilities;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.DataIterator;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import ghidra.program.model.mem.MemoryBlock;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolIterator;
import java.io.PrintWriter;

public class ExportInventory extends GhidraScript {

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = (args.length > 0) ? args[0] : "inventory.txt";
        PrintWriter w = new PrintWriter(outPath, "UTF-8");
        try {
            w.println("PROGRAM\t" + currentProgram.getName());
            w.println("LANGUAGE\t" + currentProgram.getLanguageID());
            w.println("COMPILER\t" + currentProgram.getCompilerSpec().getCompilerSpecID());
            w.println("IMAGEBASE\t" + currentProgram.getImageBase());
            w.println("MINADDR\t" + currentProgram.getMinAddress());
            w.println("MAXADDR\t" + currentProgram.getMaxAddress());

            int blockCount = 0;
            w.println("SECTION\tNAME\tSTART\tEND\tSIZE\tR\tW\tX\tINITIALIZED");
            for (MemoryBlock b : currentProgram.getMemory().getBlocks()) {
                w.println("SECTION\t" + b.getName()
                        + "\t" + b.getStart()
                        + "\t" + b.getEnd()
                        + "\t" + b.getSize()
                        + "\t" + b.isRead()
                        + "\t" + b.isWrite()
                        + "\t" + b.isExecute()
                        + "\t" + b.isInitialized());
                blockCount++;
            }

            int fnCount = 0;
            FunctionIterator fns = currentProgram.getFunctionManager().getFunctions(true);
            while (fns.hasNext()) {
                Function f = fns.next();
                String sig = "";
                try {
                    sig = f.getPrototypeString(false, false);
                } catch (Throwable t) {
                    sig = "<no signature>";
                }
                sig = sig.replace('\t', ' ').replace('\n', ' ').replace('\r', ' ');
                w.println("FUNCTION\t" + f.getEntryPoint()
                        + "\t" + f.getName()
                        + "\t" + f.getBody().getNumAddresses()
                        + "\t" + (f.isThunk() ? "thunk" : "normal")
                        + "\t" + (f.isExternal() ? "external" : "internal")
                        + "\t" + sig);
                fnCount++;
            }

            int symCount = 0;
            SymbolIterator syms = currentProgram.getSymbolTable().getAllSymbols(true);
            while (syms.hasNext()) {
                Symbol s = syms.next();
                String nm = s.getName();
                if (nm == null || nm.isEmpty()) continue;
                w.println("SYMBOL\t" + s.getAddress()
                        + "\t" + s.getSymbolType()
                        + "\t" + nm.replace('\t', ' '));
                symCount++;
            }

            int strCount = 0;
            DataIterator data = currentProgram.getListing().getDefinedData(true);
            while (data.hasNext()) {
                Data d = data.next();
                // Ghidra 12 has no DataUtilities.isStringData; test the value directly.
                Object v = d.getValue();
                if (!(v instanceof String)) continue;
                String sv = (String) v;
                if (sv.length() < 4) continue;
                String flat = sv.replace('\t', ' ').replace('\n', ' ').replace('\r', ' ');
                w.println("STRING\t" + d.getAddress()
                        + "\t" + d.getLength()
                        + "\t" + flat);
                strCount++;
            }

            w.println("SUMMARY\tfunctions=" + fnCount
                    + "\tsymbols=" + symCount
                    + "\tstrings=" + strCount
                    + "\tblocks=" + blockCount);
        } finally {
            w.close();
        }
        println("ExportInventory wrote " + outPath);
    }
}
