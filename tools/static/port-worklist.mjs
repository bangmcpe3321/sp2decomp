// Generate the port implementation worklist.
//
// For each platform function the boot closure depends on, report:
//   - its module address,
//   - every boot-closure caller and call site (inverse call graph),
// so an implementer knows the exact argument-setup sites to satisfy rather than
// guessing at a signature.
//
// Signatures for nn::os are NOT available from the open-ead headers (nnsdk ships
// no include/nn/os/), so call sites are the authoritative contract.
import { readFileSync, writeFileSync } from "node:fs";

const nsoPath = process.argv[2] ?? "main.elf";
const invPath = process.argv[3] ?? "inventory.txt";
const outPath = process.argv[4] ?? "PORT_WORKLIST.md";

const b = readFileSync(nsoPath);
const IMAGE_BASE = 0x7100000000n;
const TEXT_FILE = 0x100;
const TEXT_SIZE = 0x1415068n;
const hex = (v) => "0x" + v.toString(16);
const inText = (abs) => abs >= IMAGE_BASE && abs < IMAGE_BASE + TEXT_SIZE;
const fo = (abs) => TEXT_FILE + Number(abs - IMAGE_BASE);
const u32 = (abs) => {
  const f = fo(abs);
  return f >= 0 && f + 4 <= b.length ? b.readUInt32LE(f) : null;
};

// --- symbols -------------------------------------------------------------
const syms = [];
for (const ln of readFileSync(invPath, "utf8").split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  const abs = BigInt(parseInt(p[1], 16));
  if (Number.isNaN(Number(abs))) continue;
  syms.push({ abs, name: p[2] });
}
syms.sort((a, c) => (a.abs < c.abs ? -1 : 1));
const nameAt = new Map(syms.map((s) => [s.abs, s.name]));

function demangle(m) {
  if (!m || !m.startsWith("_Z")) return m;
  let s = m.slice(2);
  while (s[0] === "K" || s[0] === "V" || s[0] === "R") s = s.slice(1);
  if (!s.startsWith("N")) return m;
  s = s.slice(1);
  const parts = [];
  for (;;) {
    if (s.startsWith("E")) break;
    const mm = /^(\d+)/.exec(s);
    if (!mm) break;
    const L = Number(mm[1]);
    parts.push(s.slice(mm[0].length, mm[0].length + L));
    s = s.slice(mm[0].length + L);
  }
  if (!parts.length) return m;
  const last = parts[parts.length - 1];
  const ctor = ["C1", "C2", "C3"].includes(last);
  const dtor = ["D0", "D1", "D2"].includes(last);
  const base = parts.slice(0, ctor || dtor ? -2 : -1).join("::");
  if (ctor) return base + "::" + base.split("::").pop();
  if (dtor) return base + "::~" + base.split("::").pop();
  return parts.join("::");
}

// --- call graph over the boot closure (same roots as boot-closure.mjs) ----
const ROOTS = [0x11f5ab4, 0x11f5b20, 0x11fca28, 0x11fcadc, 0x11fcb44, 0x11fcba4].map(
  (o) => IMAGE_BASE + BigInt(o),
);
const RET = 0xd65f03c0;
function nextSymAbs(abs) {
  let lo = 0, hi = syms.length - 1, res = IMAGE_BASE + TEXT_SIZE;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (syms[mid].abs > abs) { res = syms[mid].abs; hi = mid - 1; } else lo = mid + 1;
  }
  return res;
}
const endCache = new Map();
function bodyEnd(abs) {
  if (endCache.has(abs)) return endCache.get(abs);
  const cap = nextSymAbs(abs) < IMAGE_BASE + TEXT_SIZE ? nextSymAbs(abs) : IMAGE_BASE + TEXT_SIZE;
  let end = cap;
  for (let p = abs; p + 4n <= cap; p += 4n) {
    if (u32(p) === RET) { end = p + 4n; break; }
  }
  endCache.set(abs, end);
  return end;
}
function calleesOf(abs) {
  const end = bodyEnd(abs);
  const out = [];
  for (let p = abs; p + 4n <= end; p += 4n) {
    const w = u32(p);
    if (w === null) break;
    const op = (w & 0xfc000000) >>> 0;
    if (op === 0x94000000 || op === 0x14000000) {
      let imm = w & 0x03ffffff;
      if (imm & 0x02000000) imm -= 0x04000000;
      const t = p + BigInt(imm * 4);
      // A BL is always a call. An unconditional B is a tail call ONLY when it
      // lands on a symbol start; otherwise it is an intra-function branch and
      // must not be treated as a separate function.
      if (op === 0x14000000 && !nameAt.has(t)) continue;
      out.push({ at: p, to: t });
    }
  }
  return out;
}

// BFS the closure
const depth = new Map();
const queue = [];
for (const r of ROOTS) { depth.set(r, 0); queue.push(r); }
let qi = 0;
const MAX_DEPTH = 7, MAX_NODES = 8000;
while (qi < queue.length) {
  const cur = queue[qi++];
  const d = depth.get(cur);
  if (d >= MAX_DEPTH) continue;
  for (const c of calleesOf(cur)) {
    if (!inText(c.to)) continue;
    if (depth.has(c.to)) continue;
    if (depth.size >= MAX_NODES) break;
    depth.set(c.to, d + 1);
    queue.push(c.to);
  }
}
{
  const per = new Map();
  for (const d of depth.values()) per.set(d, (per.get(d) || 0) + 1);
  console.log("depth layers: " + [...per.keys()].sort((a, c) => a - c).map((d) => `${d}:${per.get(d)}`).join(" "));
  console.log("closure total: " + depth.size);
}

// inverse edges within the closure
const callersOf = new Map(); // callee abs -> [{from, at}]
for (const abs of depth.keys()) {
  for (const c of calleesOf(abs)) {
    if (!inText(c.to)) continue;
    if (!callersOf.has(c.to)) callersOf.set(c.to, []);
    callersOf.get(c.to).push({ from: abs, at: c.at });
  }
}

// --- select platform functions -------------------------------------------
// Namespaces that belong to the platform layer rather than the engine.
// Matched against the demangled name; an explicit prefix list avoids the brittle
// regex that previously dropped nv:: entries.
const PLATFORM_PREFIXES = [
  "nn::init::", "nn::os::", "nn::mem::", "nn::oe::", "nn::time::", "nn::diag::",
  "nn::util::", "nn::nifm::", "nn::fs::", "nn::vi::", "nn::gfx::", "nn::hid::",
  "nn::audio::", "nn::account::", "nn::applet::", "nn::socket::", "nn::nvn::",
  "nv::", "nvn",
];
const isPlatform = (name) => {
  const dm = demangle(name);
  return PLATFORM_PREFIXES.some((p) => dm.startsWith(p));
};

const platform = [];
for (const [abs, dep] of depth.entries()) {
  const n = nameAt.get(abs);
  if (!n || !isPlatform(n)) continue;
  const dm = demangle(n);
  platform.push({ abs, dep, name: n, dm, callers: callersOf.get(abs) ?? [] });
}
platform.sort((a, c) => a.dep - c.dep || a.dm.localeCompare(c.dm));

// --- group ---------------------------------------------------------------
const groupOf = (dm) => {
  if (/^nvn/.test(dm)) return "nvn";
  if (/^nv::/.test(dm)) return "nv";
  if (/^nn::mem::/.test(dm)) return "nn::mem";
  if (/^nn::os::/.test(dm)) return "nn::os";
  const m = /^(nn::[a-z0-9_]+)/.exec(dm);
  return m ? m[1] : "other";
};
const groups = new Map();
for (const p of platform) {
  const g = groupOf(p.dm);
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(p);
}

// implementation phase ordering
const PHASE = [
  ["nn::init", 1], ["nn::os", 1], ["nn::mem", 1],
  ["nn::oe", 2], ["nn::time", 2], ["nn::diag", 2], ["nn::util", 2], ["nn::nifm", 2],
  ["nn::fs", 3],
  ["nn::vi", 4], ["nv", 4], ["nvn", 4],
  ["nn::gfx", 5],
];
const phaseOf = (g) => (PHASE.find(([k]) => k === g) ?? [, 6])[1];

const out = [];
out.push("# Port worklist: boot to main menu");
out.push("");
out.push("Generated from the decoded call graph. Each entry is a platform function the");
out.push("boot closure actually calls, with every boot-closure call site, so the");
out.push("implementation can be written against observed usage rather than a guessed");
out.push("signature.");
out.push("");
out.push("> `open-ead/nnsdk` ships **no `include/nn/os/` headers**, so `nn::os` contracts");
out.push("> are not documented anywhere public. The call sites below are the");
out.push("> authoritative contract.");
out.push("");
out.push(`Closure: ${depth.size} functions. Platform functions called: ${platform.length}.`);
out.push("");

const byPhase = new Map();
for (const [g, items] of groups.entries()) {
  const ph = phaseOf(g);
  if (!byPhase.has(ph)) byPhase.set(ph, []);
  byPhase.get(ph).push([g, items]);
}

for (const ph of [...byPhase.keys()].sort((a, c) => a - c)) {
  const label = {
    1: "Phase 1 — memory and OS foundation (must work first; stubs here hang boot)",
    2: "Phase 2 — lifecycle, time, logging",
    3: "Phase 3 — filesystem (romfs becomes visible)",
    4: "Phase 4 — display and NVN bootstrap",
    5: "Phase 5 — nn::gfx",
    6: "Phase 6 — other",
  }[ph] ?? `Phase ${ph}`;
  out.push(`## ${label}`);
  out.push("");
  for (const [g, items] of byPhase.get(ph).sort((a, c) => c[1].length - a[1].length)) {
    out.push(`### \`${g}\` — ${items.length} function${items.length === 1 ? "" : "s"}`);
    out.push("");
    out.push("| Address | Function | Closure call sites |");
    out.push("|---|---|---|");
    for (const it of items) {
      const sites = it.callers
        .slice(0, 4)
        .map((c) => `\`${demangle(nameAt.get(c.from) ?? "?")}\``)
        .join("<br>");
      const more = it.callers.length > 4 ? `<br>+${it.callers.length - 4} more` : "";
      out.push(`| \`${hex(it.abs)}\` | \`${it.dm}\` | ${sites || "—"}${more} |`);
    }
    out.push("");
  }
}

out.push("## Notes");
out.push("");
out.push("- **Addresses are module-absolute** with image base `0x7100000000`.");
out.push("- **Call-site counts come from the boot closure only.** A function may have");
out.push("  more callers elsewhere in the binary; those are not on the boot path.");
out.push("- **Stub policy:** `nn::os`, `nn::mem` and `nn::init` must be real. A");
out.push("  `return 0` stub in the thread or allocator layer hangs boot silently rather");
out.push("  than failing loudly, because `Lp::Sys::RootTask` dispatches initialisation");
out.push("  through `WorkerThreadMgr` onto those primitives.");
out.push("- **`nn::nifm` should be stubbed, not implemented** — it is the network");
out.push("  interface manager and is reached even on the offline boot path.");

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath}`);
console.log(`closure=${depth.size}  platform functions=${platform.length}`);
for (const [g, items] of [...groups.entries()].sort((a, c) => c[1].length - a[1].length)) {
  console.log(`  ${String(items.length).padStart(3)}  ${g}  (phase ${phaseOf(g)})`);
}
