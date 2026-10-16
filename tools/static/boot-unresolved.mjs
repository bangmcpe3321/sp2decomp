// Close the gap on symbol-less callees in the boot closure.
//
// The boot closure contains functions with no symbol in the module's symbol
// table. Two distinct cases produce this, and they need different handling:
//
//   A. Genuinely local/static functions (compiler labels, lambdas, thunks) that
//      the binary never exported. These are real work.
//   B. Callees that resolve outside .text -- imports reaching the EXTERNAL block
//      (nn:: platform functions). These are not new work; they are the platform
//      surface already enumerated.
//
// This script separates the two and, for case A, reports the containing symbol
// and the offset so each can be attributed.
import { readFileSync, writeFileSync } from "node:fs";

const nsoPath = process.argv[2] ?? "main.elf";
const invPath = process.argv[3] ?? "inventory.txt";
const closurePath = process.argv[4] ?? "boot-closure.txt";
const outPath = process.argv[5] ?? "boot-unresolved.txt";

const b = readFileSync(nsoPath);
const IMAGE_BASE = 0x7100000000;
const TEXT_FILE = 0x100;
const TEXT_SIZE = 0x1415068;
const ACTUAL_TEXT_END = TEXT_SIZE;
const vaToFile = (va) => TEXT_FILE + va;
const inText = (va) => va >= 0 && va < ACTUAL_TEXT_END;
const hexs = (va) => "0x" + (IMAGE_BASE + va).toString(16);

// ---- symbols ------------------------------------------------------------
const syms = [];
for (const ln of readFileSync(invPath, "utf8").split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  const abs = parseInt(p[1], 16);
  if (Number.isNaN(abs)) continue;
  const va = abs - IMAGE_BASE;
  if (!inText(va)) continue;
  syms.push({ va, name: p[2] });
}
syms.sort((a, b) => a.va - b.va);
const symVas = syms.map((s) => s.va);
const nameMap = new Map(syms.map((s) => [s.va, s.name]));

function demangle(m) {
  if (!m) return m;
  if (!m.startsWith("_Z")) return m;
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

// nearest preceding symbol (containing function)
function containing(va) {
  let lo = 0, hi = symVas.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (symVas[mid] <= va) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (idx < 0) return null;
  return { va: symVas[idx], name: nameMap.get(symVas[idx]) };
}

const RET = 0xd65f03c0;
function nextSym(va) {
  let lo = 0, hi = symVas.length - 1, res = ACTUAL_TEXT_END;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (symVas[mid] > va) { res = symVas[mid]; hi = mid - 1; } else lo = mid + 1;
  }
  return res;
}
function bodyEnd(va) {
  const cap = Math.min(nextSym(va), ACTUAL_TEXT_END);
  for (let p = va; p + 4 <= cap; p += 4) {
    const fo = vaToFile(p);
    if (fo + 4 > b.length) break;
    if (b.readUInt32LE(fo) === RET) return p + 4;
  }
  return cap;
}
function decodeBranch(word, va) {
  const op = (word & 0xfc000000) >>> 0;
  if (op === 0x94000000) {
    let imm = word & 0x03ffffff;
    if (imm & 0x02000000) imm -= 0x04000000;
    return { kind: "bl", target: va + imm * 4 };
  }
  if (op === 0x14000000) {
    let imm = word & 0x03ffffff;
    if (imm & 0x02000000) imm -= 0x04000000;
    return { kind: "b", target: va + imm * 4 };
  }
  if ((word & 0xfffffc1f) >>> 0 === 0xd63f0000) return { kind: "blr", target: null };
  return null;
}
function calleesOf(va) {
  const end = bodyEnd(va);
  const out = [];
  for (let p = va; p + 4 <= end; p += 4) {
    const fo = vaToFile(p);
    if (fo + 4 > b.length) break;
    const dec = decodeBranch(b.readUInt32LE(fo), p);
    if (!dec || dec.kind === "blr") continue;
    if (inText(dec.target) && dec.target !== va) out.push(dec.target);
  }
  return out;
}

// ---- rebuild the closure (same roots/BFS as boot-closure.mjs) ----------
const ROOTS = [0x11f5ab4, 0x11f5b20, 0x11fca28, 0x11fcadc, 0x11fcb44, 0x11fcba4];
const MAX_DEPTH = 7, MAX_NODES = 8000;
const depth = new Map();
const parent = new Map();
const queue = [];
for (const r of ROOTS) { depth.set(r, 0); queue.push(r); }
let qi = 0;
while (qi < queue.length) {
  const cur = queue[qi++];
  const d = depth.get(cur);
  if (d >= MAX_DEPTH) continue;
  for (const c of calleesOf(cur)) {
    if (depth.has(c)) continue;
    if (depth.size >= MAX_NODES) break;
    depth.set(c, d + 1);
    parent.set(c, cur);
    queue.push(c);
  }
}

// ---- collect symbol-less callees ---------------------------------------
const unresolved = new Map(); // va -> {callers:Set, count}
for (const va of depth.keys()) {
  for (const c of calleesOf(va)) {
    if (nameMap.has(c)) continue;
    if (!unresolved.has(c)) unresolved.set(c, { callers: new Set(), count: 0 });
    const e = unresolved.get(c);
    e.callers.add(va);
    e.count++;
  }
}

// ---- classify -----------------------------------------------------------
const out = [];
out.push("Symbol-less callees in the boot closure");
out.push(`closure nodes: ${depth.size}   symbol-less callees: ${unresolved.size}`);
out.push("");

const insideText = [];
for (const [va, e] of unresolved.entries()) {
  if (inText(va)) insideText.push([va, e]);
}
insideText.sort((a, b) => b[1].count - a[1].count);

out.push(`Case A -- targets inside .text but with no symbol (${insideText.length})`);
out.push("These are local/static functions: real work not captured by the symbol table.");
out.push("");
for (const [va, e] of insideText) {
  const cont = containing(va);
  const where = cont ? `inside ${demangle(cont.name)} +0x${(va - cont.va).toString(16)}` : "before first symbol";
  const size = bodyEnd(va) - va;
  const sub = calleesOf(va).length;
  out.push(`  ${hexs(va)}  size ${size}B  ${sub} calls  called ${e.count}x`);
  out.push(`      ${where}`);
}

out.push("");
out.push("Attribution of case A by containing namespace:");
const byNs = new Map();
for (const [va] of insideText) {
  const cont = containing(va);
  const ns = cont ? demangle(cont.name).split("::").slice(0, 2).join("::") : "<none>";
  byNs.set(ns, (byNs.get(ns) || 0) + 1);
}
for (const [k, c] of [...byNs.entries()].sort((a, b) => b[1] - a[1])) {
  out.push(`  ${String(c).padStart(4)}  ${k}`);
}

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath}`);
console.log(`closure nodes: ${depth.size}`);
console.log(`symbol-less callees: ${unresolved.size}`);
console.log(`  inside .text (case A): ${insideText.length}`);
console.log(`  outside .text: ${unresolved.size - insideText.length}`);
