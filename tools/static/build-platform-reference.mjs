// Build an implementation reference from the decompiled platform functions.
//
// For each function: the observed C signature (which IS the contract, since
// open-ead/nnsdk ships no include/nn/os/), its size, its boot-closure callers, and
// a short characterisation of the body so an implementer knows what it must do.
import { readFileSync, writeFileSync } from "node:fs";

const decompPath = process.argv[2] ?? "platform-decompiled.txt";
const worklistPath = process.argv[3] ?? "PORT_WORKLIST.md";
const closurePath = process.argv[4] ?? "boot-closure.txt";
const outPath = process.argv[5] ?? "PLATFORM_REFERENCE.md";

// Strip a UTF-8 BOM if present: PyGhidra writes one, and it defeats a ^0x match on
// the first line of the file.
const text = readFileSync(decompPath, "utf8").replace(/^\uFEFF/, "");
const lines = text.split("\n");

// ---- split the decompiled output into per-function blocks ---------------
// Blocks are separated by a line of '=' characters; each block's first line is
// "<address>  <name>".
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

// ---- worklist names + callers -------------------------------------------
const worklist = new Map(); // va -> name
const callers = new Map(); // va -> Set of caller names
for (const ln of readFileSync(worklistPath, "utf8").split("\n")) {
  const m = /^\|\s*`(0x[0-9a-f]+)`\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|$/.exec(ln);
  if (!m) continue;
  const va = m[1];
  worklist.set(va, m[2]);
  const cs = m[3]
    .split("<br>")
    .map((s) => s.replace(/`/g, "").trim())
    .filter((s) => s && !s.startsWith("+") && s !== "—");
  callers.set(va, new Set(cs));
}

// ---- slot an operational role onto each function -------------------------
function classify(name, sig, bodyText) {
  const n = name;
  if (/GetRuntimeTypeInfo/.test(n)) return "RTTI helper";
  if (/Create|Initialize|Init$|Construct/.test(n) && !/Is/.test(n)) return "initialiser";
  if (/^nn::os::CreateThread|Thread$/.test(n)) return "thread primitive";
  if (/Mutex|Lock/.test(n)) return "lock primitive";
  if (/Semaphore/.test(n)) return "semaphore primitive";
  if (/MessageQueue/.test(n)) return "message queue primitive";
  if (/Tls/.test(n)) return "TLS slot management";
  if (/Allocate|Free|Heap|Allocator/.test(n)) return "allocator";
  if (/Mount|Open|Rom/.test(n)) return "filesystem / romfs";
  if (/Display|Layer|Vsync|Window|Scaling/.test(n)) return "display / video interface";
  if (/nvn|NVN/.test(n)) return "NVN bootstrap";
  if (/Log|Printf|Diag/.test(n)) return "logging";
  if (/Clock|Calendar|Time|Tick/.test(n)) return "time";
  if (/Performance|nifm/.test(n)) return "platform service (stub candidate)";
  if (/Get|Is|Query|Convert|Change|Set|Sleep|Unlock|Wait/.test(n)) return "query / control";
  if (/^\s*undefined.*\(/.test(sig)) return "unknown";
  return "—";
}

// ---- pull the observed signature -----------------------------------------
function observedSignature(block) {
  // Ghidra's simplest form is the first line matching <type> <name>(...)
  for (const ln of block.body) {
    const s = ln.trim();
    if (!s || s.startsWith("/*") || s.startsWith("*")) continue;
    if (/^\w[\w \*&:<>]*\s+\w+\s*\(.*\)\s*$/.test(s) && s.includes("(")) {
      return s.replace(/\s+/g, " ").trim();
    }
  }
  return "(signature not recovered)";
}

// ---- body characterisation ------------------------------------------------
function characterise(block) {
  const bodyText = block.body.join("\n");
  const facts = [];
  const calls = new Set();
  for (const m of bodyText.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const f = m[1];
    if (["if", "while", "for", "switch", "return", "sizeof", "defined"].includes(f)) continue;
    calls.add(f);
  }
  if (calls.size) facts.push(`${calls.size} distinct call targets`);
  const indirect = (bodyText.match(/\(\*[^)]*\)\s*\(/g) || []).length;
  if (indirect) facts.push(`${indirect} indirect call site(s)`);
  if (/WARNING|unreachable|Unresolved/i.test(bodyText)) facts.push("contains decompiler warnings");
  const lines = block.body.filter((l) => l.trim()).length;
  facts.push(`${lines} body lines`);
  return facts.join("; ");
}

// ---- emit ----------------------------------------------------------------
const out = [];
out.push("# Platform implementation reference");
out.push("");
out.push("Observed contracts for the 51 platform functions in");
out.push("[PORT_WORKLIST.md](PORT_WORKLIST.md), taken from the decompiled binary rather");
out.push("than from a header.");
out.push("");
out.push("**Why this matters:** `open-ead/nnsdk` ships no `include/nn/os/` headers, so");
out.push("`nn::os` signatures are documented nowhere public. These signatures are read");
out.push("off the shipped code, which makes them the authoritative contract.");
out.push("");
out.push(`Source: \`${decompPath}\` (Ghidra 12.1.2 via REA provider).`);
out.push(`Functions: ${blocks.length}.`);
out.push("");
out.push("---");
out.push("");

// group by namespace
const groups = new Map();
for (const b of blocks) {
  const nm = worklist.get("0x" + b.va) ?? b.name;
  const ns = /^nv/.test(nm) ? "nv / nvn" : nm.split("::").slice(0, 2).join("::");
  if (!groups.has(ns)) groups.set(ns, []);
  groups.get(ns).push({ ...b, displayName: nm });
}

const PHASE = {
  "nn::init": 1, "nn::os": 1, "nn::mem": 1,
  "nn::oe": 2, "nn::time": 2, "nn::diag": 2, "nn::util": 2, "nn::nifm": 2,
  "nn::fs": 3,
  "nn::vi": 4, "nv / nvn": 4, "nv::": 4, nvn: 4,
  "nn::gfx": 5, "nn::g3d": 5,
};
for (const [ns, items] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const phase = PHASE[ns] ?? 6;
  out.push(`## Phase ${phase}: \`${ns}\` — ${items.length} function${items.length === 1 ? "" : "s"}`);
  out.push("");
  for (const b of items) {
    const va = "0x" + b.va;
    const cs = callers.get(va) ?? new Set();
    out.push(`### \`${b.displayName}\``);
    out.push("");
    out.push(`- **Address**: \`${va}\``);
    out.push(`- **Body size**: ${b.meta["body size"] ?? "unknown"}`);
    out.push(`- **Role**: ${classify(b.displayName, observedSignature(b), b.body.join("\n"))}`);
    out.push(`- **Boot-closure callers**: ${cs.size ? [...cs].join(", ") : "—"}`);
    out.push(`- **Observed signature**:`);
    out.push("");
    out.push("```c");
    out.push(observedSignature(b));
    out.push("```");
    out.push("");
    out.push(`_Body: ${characterise(b)}_`);
    out.push("");
  }
  out.push("---");
  out.push("");
}

out.push("## Notes");
out.push("");
out.push("- Signatures are **observed** from the decompiled body, not declared in a");
out.push("  header. Argument counts and types come from Ghidra's inference and may");
out.push("  differ from the original SDK declaration in naming, not in ABI.");
out.push("- Full pseudocode for every function is reproducible with");
out.push("  `tools/ghidra/ExtractDecompiled.py`; it is not committed here.");
out.push("- Functions marked **platform service (stub candidate)** should be stubbed");
out.push("  rather than implemented for the offline boot milestone.");

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath}`);
console.log(`blocks parsed: ${blocks.length}`);
console.log(`worklist entries matched: ${[...worklist.keys()].filter((k) => blocks.some((b) => "0x" + b.va === k)).length}`);
