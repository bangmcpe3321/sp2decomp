// Find a class's vtable by content rather than by tracing the constructor.
//
// Given one known virtual function's address, locate the relocated slot that
// points at it, walk outwards to the full run of consecutive relocated slots, and
// report the resulting virtual order. This needs no RTTI and no ADRP tracing.
import { readFileSync, writeFileSync } from "node:fs";

const nsoPath = process.argv[2] ?? "main.elf";
const invPath = process.argv[3] ?? "inventory.txt";
const outPath = process.argv[4] ?? "vt-by-content.txt";
// known Pane virtuals, from the symbol table (relative VAs)
const anchorRels = (process.argv[5] ?? "0x15f64,0x15fac,0x16130,0x167bc,0x16870,0x16b14")
  .split(",")
  .map((s) => parseInt(s, 16));

const IMAGE_BASE = 0x7100000000;
const FILE_BASE = 0x100;
const TEXT_SIZE = 0x1415068;
const hex = (v) => "0x" + v.toString(16);

const buf = readFileSync(nsoPath);
const fo = (rel) => FILE_BASE + rel;
const rd64 = (rel) => {
  const f = fo(rel);
  return f >= 0 && f + 8 <= buf.length ? buf.readBigUInt64LE(f) : null;
};

const nameAtRel = new Map();
for (const ln of readFileSync(invPath, "utf8").split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  const abs = parseInt(p[1], 16);
  if (!Number.isNaN(abs)) nameAtRel.set(abs - IMAGE_BASE, p[2]);
}

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

// --- build slot -> target map (relative VAs) -----------------------------
const RELA_START = 0x1416048;
const RELA_END = 0x19ec6a7;
const slotToTarget = new Map();
for (let rel = RELA_START; rel + 24 <= RELA_END; rel += 24) {
  const offRaw = rd64(rel);
  if (offRaw === null) break;
  const info = Number(rd64(rel + 8) & 0xffffffffn);
  const addend = Number(buf.readBigInt64LE(fo(rel + 16)));
  if (info !== 1027) continue;
  slotToTarget.set(Number(offRaw), addend);
}

const out = [];
out.push("Vtable discovery by content");
out.push(`relocated slots mapped: ${slotToTarget.size}`);
out.push("");
out.push(`anchor virtuals (relative VA): ${anchorRels.map(hex).join(", ")}`);
out.push("");

// --- invert: target -> [slots] -------------------------------------------
const targetToSlots = new Map();
for (const [slot, target] of slotToTarget) {
  if (!targetToSlots.has(target)) targetToSlots.set(target, []);
  targetToSlots.get(target).push(slot);
}

// For each anchor, walk left and right while slots stay contiguous (8 apart).
const runs = [];
for (const a of anchorRels) {
  const slots = targetToSlots.get(a) ?? [];
  for (const s of slots) {
    let start = s;
    while (slotToTarget.has(start - 8)) start -= 8;
    let end = s;
    while (slotToTarget.has(end + 8)) end += 8;
    runs.push({ anchor: a, start, end, len: (end - start) / 8 + 1 });
  }
}

// dedupe, longest first
const seen = new Set();
const uniq = [];
for (const r of runs.sort((x, y) => y.len - x.len)) {
  const k = `${r.start}:${r.end}`;
  if (seen.has(k)) continue;
  seen.add(k);
  uniq.push(r);
}

out.push(`distinct candidate runs: ${uniq.length}`);
for (const r of uniq.slice(0, 5)) {
  out.push(`  run ${hex(r.start)}..${hex(r.end)}  entries=${r.len}  (contains anchor ${hex(r.anchor)})`);
}
out.push("");

// choose the run whose entries are mostly members of the target class.
// Anchoring alone is not enough: derived classes inherit the base's virtuals, so
// many runs contain the anchors. The base vtable is the one whose entries are
// predominantly declared by that class.
const CLASS_RE = /_ZN2nn4ui2d4Pane|_ZNK2nn4ui2d4Pane|_ZTVN2nn4ui2d4Pane/;
function classFraction(r) {
  let total = 0, own = 0;
  for (let s = r.start; s <= r.end; s += 8) {
    total++;
    const n = nameAtRel.get(slotToTarget.get(s));
    if (n && CLASS_RE.test(n)) own++;
  }
  return total ? own / total : 0;
}
function anchorsIn(r) {
  let n = 0;
  for (const a of anchorRels) {
    for (let s = r.start; s <= r.end; s += 8) if (slotToTarget.get(s) === a) { n++; break; }
  }
  return n;
}
out.push("candidates scored by fraction of entries declared by nn::ui2d::Pane:");
const scored = uniq
  .map((r) => ({ ...r, frac: classFraction(r), anchors: anchorsIn(r) }))
  .sort((a, b) => b.frac - a.frac || b.anchors - a.anchors || b.len - a.len);
for (const r of scored.slice(0, 6)) {
  out.push(`  ${hex(r.start)}..${hex(r.end)}  entries=${r.len}  pane-fraction=${(r.frac * 100).toFixed(0)}%  anchors=${r.anchors}`);
}
out.push("");
uniq.sort((x, y) => classFraction(y) - classFraction(x) || anchorsIn(y) - anchorsIn(x) || y.len - x.len);
const best = uniq[0];
if (!best) {
  out.push("no run found.");
} else {
  const n = anchorsIn(best);
  out.push(`SELECTED run ${hex(best.start)}..${hex(best.end)}  entries=${best.len}  anchors matched=${n}/${anchorRels.length}`);
  out.push("");
  out.push("| index | slot (rel) | target (rel) | target (abs) | symbol |");
  out.push("|---:|---|---|---|---|");
  let i = 0;
  for (let s = best.start; s <= best.end; s += 8, i++) {
    const t = slotToTarget.get(s);
    out.push(`| ${i} | ${hex(s)} | ${hex(t)} | ${hex(IMAGE_BASE + t)} | ${nameAtRel.get(t) ? demangle(nameAtRel.get(t)) : "<no symbol>"} |`);
  }
  out.push("");
  const namedCount = [...Array((best.end - best.start) / 8 + 1).keys()]
    .map((k) => best.start + k * 8)
    .filter((s) => nameAtRel.has(slotToTarget.get(s))).length;
  out.push(`entries with a symbol: ${namedCount} / ${(best.end - best.start) / 8 + 1}`);
}

writeFileSync(outPath, out.join("\n") + "\n");
console.log(out.join("\n"));
