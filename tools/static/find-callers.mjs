// Find the CALLERS of nn::gfx::detail::DeviceImpl<4,8>::Initialize (0x710135d8d8).
//
// This scanner form is more robust than the ADRP one that failed (see NNGFX_LAYER.md §3): a BL
// instruction encodes its target directly as a signed 26-bit word offset, with no page/GOT
// indirection to get wrong. So a hit here is unambiguous.
import { readFileSync } from "node:fs";

const b = readFileSync("main.elf");
const FB = 0x100;
const IMG = 0x7100000000;
const foff = (va) => FB + (va - IMG);

const TEXT_START = 0x7100000000;
const TEXT_END = 0x7101415068;

function blTarget(pc, insn) {
  // BL: 100101 imm26
  if ((insn >>> 26) !== 0x25) return null;
  let imm = insn & 0x3ffffff;
  if (imm & (1 << 25)) imm -= 1 << 26; // sign-extend 26 bits
  return pc + imm * 4;
}

// Callers of a set of targets. Pass targets as argv hex.
const targets = process.argv.slice(2).map((s) => parseInt(s, 16));
if (targets.length === 0) {
  console.error("usage: node find-callers.mjs <hexaddr> [more...]");
  process.exit(2);
}
const want = new Map(targets.map((t) => [t + IMG, t]));

const callers = [];
for (let va = TEXT_START; va < TEXT_END; va += 4) {
  const insn = b.readUInt32LE(foff(va));
  if ((insn >>> 26) !== 0x25) continue;
  const t = blTarget(va, insn);
  if (t !== null && want.has(t)) callers.push({ from: va, to: want.get(t) });
}

console.log(`=== callers of ${targets.map((t) => "0x" + t.toString(16)).join(", ")} ===`);
console.log(`found ${callers.length}`);
for (const c of callers) {
  console.log(`   called from 0x${c.from.toString(16)}  (offset 0x${(c.from - IMG).toString(16)})`);
}

// Resolve the caller addresses to symbol names using the inventory, so the answer is readable.
let inv = "";
try { inv = readFileSync("inventory.txt", "utf8"); } catch {}
if (inv) {
  const funcs = [];
  for (const ln of inv.split("\n")) {
    const m = /^FUNCTION\s+([0-9a-f]+)\s+(\S+)/.exec(ln);
    if (m) funcs.push({ va: parseInt(m[1], 16), name: m[2] });
  }
  funcs.sort((a, c) => a.va - c.va);
  // Which FUNCTION contains each caller site?
  function ownerOf(va) {
    let lo = 0, hi = funcs.length - 1, best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (funcs[mid].va <= va) { best = funcs[mid]; lo = mid + 1; } else hi = mid - 1;
    }
    return best;
  }
  console.log("\n--- containing functions ---");
  for (const c of callers) {
    const o = ownerOf(c.from);
    const delta = o ? c.from - o.va : 0;
    console.log(`   0x${c.from.toString(16)}  +0x${delta.toString(16)} in ${o ? o.name : "(unknown)"}`);
  }
}
