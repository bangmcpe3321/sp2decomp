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
// Ghidra splits the return type and the name/argument list across lines, so a
// single-line match fails; reassemble from the comment block onwards. These
// functions are mostly 13-byte import thunks, so the recovered declaration is the
// whole value of the entry.
function observedSignature(block) {
  const raw = block.body.join("\n");
  const m = /\/\*\s*([^*]+?)\s*\*\/\s*([\s\S]{0,300}?\([\s\S]{0,400}?\))\s*\n\s*\{/.exec(raw);
  if (m) {
    const ret = m[1].trim();
    const decl = m[2].replace(/\s+/g, " ").trim();
    return `${ret} ${decl}`.slice(0, 300);
  }
  // thunks may not have the comment block; take the first call-style declaration
  for (const ln of block.body) {
    const s = ln.trim();
    if (!s || s.startsWith("/*") || s.startsWith("*") || s === "{") continue;
    if (/\([^)]*\)\s*;?\s*$/.test(s) && !/^[{}]/.test(s)) return s.replace(/\s+/g, " ").slice(0, 300);
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
out.push("### Read the signatures with care");
out.push("");
out.push("**A thunk's signature is not the SDK's signature.** These functions are 13-byte");
out.push("import stubs that forward through a pointer, and the stub itself declares no");
out.push("parameters. Ghidra therefore renders many of them as `f(void)` — for example");
out.push("`void nn::os::GetTlsValue(void)` — even though the real SDK function takes");
out.push("arguments.");
out.push("");
out.push("**The real ABI is in the pointer type, not the stub.** A stub looks like:");
out.push("");
out.push("```c");
out.push("void nn::os::GetSystemTick(void)");
out.push("{");
out.push("  (*(code *)PTR_GetSystemTick_7102f9a700)();");
out.push("}");
out.push("```");
out.push("");
out.push("The actual parameter list belongs to `PTR_GetSystemTick_*`. To recover a true");
out.push("signature, read the pointer's declared type at that address in the analysis, or");
out.push("inspect a **call site** in a caller function, where arguments are actually");
out.push("passed. `PORT_WORKLIST.md` lists those callers for every entry.");
out.push("");
out.push("Signatures rendered with named parameters — for instance");
out.push("`nn::init::InitializeAllocator(ulong param_1)` or");
out.push("`nn::mem::StandardAllocator::StandardAllocator(StandardAllocator *this)` — came");
out.push("from functions that do have real bodies, and those are trustworthy.");
out.push("");
out.push("### Other caveats");
out.push("");
out.push("- Signatures are **observed** from the decompiled body, not declared in a");
out.push("  header. Naming may differ from the original SDK declaration; the ABI should");
out.push("  not.");
out.push("- Full pseudocode for every function is reproducible with");
out.push("  `tools/ghidra/ExtractDecompiled.py`; it is not committed here.");
out.push("- Functions marked **platform service (stub candidate)** should be stubbed");
out.push("  rather than implemented for the offline boot milestone.");
out.push("- **The platform layer is not implemented in `main`.** These 51 are imports; the");
out.push("  real implementations live in the `sdk` module (confirmed present there for");
out.push("  `nn::os` and `nn::mem::StandardAllocator`). See the finding in");
out.push("  [DECOMPILED_BODIES.md](DECOMPILED_BODIES.md) and analyse `sdk` before writing");
out.push("  any of this from scratch.");

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath}`);
console.log(`blocks parsed: ${blocks.length}`);
console.log(`worklist entries matched: ${[...worklist.keys()].filter((k) => blocks.some((b) => "0x" + b.va === k)).length}`);
