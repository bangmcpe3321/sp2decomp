// Build the boot-closure ENGINE reference from decompiled bodies.
//
// Same shape as build-platform-reference.mjs but for the sead / Lp / nn engine
// functions that the boot closure depends on, sourced from engine-decompiled.txt
// and cross-referenced against boot-closure.txt for call relationships.
import { readFileSync, writeFileSync } from "node:fs";

const decompPath = process.argv[2] ?? "engine-decompiled.txt";
const closurePath = process.argv[3] ?? "boot-closure-fixed.txt";
const outPath = process.argv[4] ?? "ENGINE_REFERENCE.md";
const indexPath = process.argv[5] ?? "engine-addrs-index.txt";

// Full namespace-qualified names. Ghidra strips the namespace from its output
// (showing "create" instead of "sead::ExpHeap::create"), so the documented name
// comes from the address index instead.
const fullName = new Map();
for (const ln of readFileSync(indexPath, "utf8").split("\n")) {
  const m = /^(0x[0-9a-f]+)\s+(.+)$/.exec(ln.trim());
  if (m) fullName.set(m[1].toLowerCase(), m[2].trim());
}

// Strip BOM: PyGhidra writes one and it defeats ^0x matching on line 1.
const text = readFileSync(decompPath, "utf8").replace(/^\uFEFF/, "");
const lines = text.split("\n");

// --- parse per-function blocks (separated by '=' rules) -------------------
const blocks = [];
let cur = null;
let expectHeader = true;
for (const ln of lines) {
  if (/^=+\s*$/.test(ln)) {
    expectHeader = true;
    continue;
  }
  if (expectHeader) {
    const m = /^\s*0x([0-9a-f]+)\s+(.+?)\s*$/.exec(ln);
    if (m) {
      cur = { va: m[1], name: m[2].trim(), meta: {}, body: [] };
      blocks.push(cur);
      expectHeader = false;
      continue;
    }
  }
  if (!cur) continue;
  const mm = /^\s*(demangled|entry|body size)\s*:\s*(.+?)\s*$/.exec(ln);
  if (mm) {
    cur.meta[mm[1]] = mm[2].trim();
    continue;
  }
  cur.body.push(ln);
}

// --- closure metadata: depth and label per absolute VA --------------------
// boot-closure.txt groups by "DEPTH n" sections; capture that so the reference can
// report how far each function is from the boot roots.
const depthOf = new Map();
{
  let depth = null;
  for (const ln of readFileSync(closurePath, "utf8").split("\n")) {
    const dm = /^DEPTH (\d+)\s/.exec(ln);
    if (dm) {
      depth = Number(dm[1]);
      continue;
    }
    if (depth === null) continue;
    const m = /^\s+(0x[0-9a-f]+)\s+(\S.*?)(?:\s+\[.*)?$/.exec(ln);
    if (m) depthOf.set(m[1].toLowerCase(), depth);
  }
}

function observedSignature(block) {
  // Ghidra emits the return type on one line and the name/args on the next, so the
  // signature must be reassembled rather than matched on a single line.
  const raw = block.body.join("\n");
  const m = /\/\*\s*([^*]+?)\s*\*\/\s*([\s\S]{0,300}?\([\s\S]{0,400}?\))\s*\n\s*\{/.exec(raw);
  if (m) {
    const ret = m[1].trim();
    const decl = m[2].replace(/\s+/g, " ").trim();
    return `${ret} ${decl}`.slice(0, 300);
  }
  // fall back: any line containing a call-style declaration
  for (const ln of block.body) {
    const s = ln.trim();
    if (!s || s.startsWith("/*") || s.startsWith("*")) continue;
    if (/\w\s*\(/.test(s) && /\)\s*;?\s*$/.test(s)) return s.replace(/\s+/g, " ").slice(0, 300);
  }
  return "(signature not recovered)";
}

function roleOf(name) {
  if (/RTTI|RuntimeTypeInfo/.test(name)) return "RTTI hook";
  if (/checkDerivedRuntimeTypeInfo/.test(name)) return "RTTI hook";
  if (/initializeGraphicsSystem/.test(name)) return "graphics bring-up";
  if (/parallelInitThread|createParallelInitThread|runParallelInitThread|waitDoneParallel/.test(name)) return "parallel-init orchestration";
  if (/SysInit::Init|nninitStartup|InitializeAllocator/.test(name)) return "boot entry / memory foundation";
  if (/createWorker|enqueue|WorkerThreadMgr/.test(name)) return "worker-thread dispatch";
  if (/HeapGroup|ExpHeap|createHeap|createInstance/.test(name)) return "heap setup";
  if (/ThreadMgr|Thread::|DelegateThread/.test(name)) return "threading";
  if (/FileDevice|MainFileDevice/.test(name)) return "filesystem";
  if (/Graphics|DisplayBuffer|FrameBuffer|ForegroundBucket/.test(name)) return "graphics";
  if (/CalendarTime|DateTime|DateUtil/.test(name)) return "time";
  if (/Assert|dump|Log|Format/.test(name)) return "diagnostics / formatting";
  if (/GetCurrentHeap|findContainHeap|HeapMgr/.test(name)) return "heap query";
  if (/SafeString/.test(name)) return "string handling";
  return "—";
}

function characterise(block) {
  const bodyText = block.body.join("\n");
  const facts = [];
  const calls = new Set();
  for (const m of bodyText.matchAll(/\b([A-Za-z_][A-Za-z0-9_:]*)\s*\(/g)) {
    const f = m[1];
    if (["if", "while", "for", "switch", "return", "sizeof"].includes(f)) continue;
    calls.add(f);
  }
  if (calls.size) facts.push(`${calls.size} distinct call targets`);
  const indirect = (bodyText.match(/\(\*[^)]*\)\s*\(/g) || []).length;
  if (indirect) facts.push(`${indirect} indirect call site(s)`);
  if (/unreachable|WARNING/i.test(bodyText)) facts.push("decompiler warnings present");
  facts.push(`${block.body.filter((l) => l.trim()).length} body lines`);
  return facts.join("; ");
}

const out = [];
out.push("# Boot-closure engine reference");
out.push("");
out.push("Observed signatures and roles for the **sead / Lp / nn engine functions** the");
out.push("boot path depends on, taken from decompiled bodies rather than declarations.");
out.push("");
out.push("Companion to [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md), which covers the");
out.push("51 platform functions. Together they annotate the whole");
out.push("[BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md) closure with real code.");
out.push("");
out.push(`Source: Ghidra 12.1.2 via REA. Functions: ${blocks.length}.`);
out.push("");
out.push("---");
out.push("");

// group by depth band: depth 0-1 is the critical path, deeper is support
const bands = [
  { label: "Depth 0–1 — the critical path", test: (d) => d !== undefined && d <= 1 },
  { label: "Depth 2–3 — immediate support", test: (d) => d !== undefined && d >= 2 && d <= 3 },
  { label: "Depth 4+ — deeper dependencies", test: (d) => d !== undefined && d >= 4 },
  { label: "Unknown depth", test: (d) => d === undefined },
];

for (const band of bands) {
  const items = blocks.filter((b) => band.test(depthOf.get("0x" + b.va)));
  if (!items.length) continue;
  out.push(`## ${band.label} (${items.length} functions)`);
  out.push("");
  // sort by namespace for readability within the band
  items.sort((a, b) => a.name.localeCompare(b.name));
  for (const b of items) {
    const d = depthOf.get("0x" + b.va);
    const dispName = fullName.get("0x" + b.va.toLowerCase()) ?? b.name;
    out.push(`### \`${dispName}\``);
    out.push("");
    out.push(`- **Address**: \`0x${b.va}\`${d !== undefined ? `  ·  **depth ${d}**` : ""}`);
    out.push(`- **Body size**: ${b.meta["body size"] ?? "unknown"}`);
    out.push(`- **Role**: ${roleOf(dispName)}`);
    out.push("- **Observed signature**:");
    out.push("");
    out.push("```c");
    out.push(observedSignature(b));
    out.push("```");
    out.push("");
    out.push(`_${characterise(b)}_`);
    out.push("");
  }
  out.push("---");
  out.push("");
}

out.push("## Notes");
out.push("");
out.push("- Signatures are **observed**, not declared; argument naming and types are");
out.push("  Ghidra's inference from the body.");
out.push("- **Signature recovery is approximate for some functions.** Ghidra wraps the");
out.push("  return type and the name/argument list across lines, and for functions with");
out.push("  unusual prologues the reassembly can pick a body fragment instead. Entries");
out.push("  whose signature looks like a statement rather than a declaration should be");
out.push("  read from the raw pseudocode, which `tools/ghidra/ExtractDecompiled.py`");
out.push("  regenerates on demand.");
out.push("- **Names come from the address index, not Ghidra.** Ghidra prints the bare");
out.push("  member name (`create`); the namespace-qualified name (`sead::ExpHeap::create`)");
out.push("  is joined in from `engine-addrs-index.txt`.");
out.push("- Depth is distance from the six boot roots in the decoded call graph.");
out.push("  Depth 0–1 is what boot touches first — implement that band first.");
out.push("- Full pseudocode is reproducible with `tools/ghidra/ExtractDecompiled.py`");
out.push("  and is not committed, since it is Ghidra's rendering of Nintendo's code.");
out.push("- Together with [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) this covers");
out.push("  every named function in the boot closure (51 platform + 126 engine = 177).");

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath}`);
console.log(`blocks parsed: ${blocks.length}`);
const depths = new Map();
for (const b of blocks) {
  const d = depthOf.get("0x" + b.va);
  const k = d === undefined ? "unknown" : d <= 1 ? "0-1" : d <= 3 ? "2-3" : "4+";
  depths.set(k, (depths.get(k) || 0) + 1);
}
for (const [k, v] of [...depths.entries()].sort()) console.log(`  depth ${k}: ${v}`);
