// Which nn::gfx code references the NVN procedure globals?
//
// NVN is reached through PTR_pfnc_nvn*_7102xxxxxx globals. Instead of decompiling 289 nn::gfx
// functions one at a time (Ghidra's script args are whitespace-split, so only the first address
// arrives -- a limitation recorded earlier in this project), decode the binary's own AArch64
// ADRP+ADD pairs and find every site that materialises an address in the NVN global region.
//
// That gives the call sites DIRECTLY, from the machine code, with no per-function decompile.
import { readFileSync } from "node:fs";

const b = readFileSync("main.elf");
const FB = 0x100;
const IMG = 0x7100000000;
const foff = (va) => FB + (va - IMG);

// Section bounds from the NSO layout.
const TEXT_START = 0x7100000000;
const TEXT_END = 0x7101415068;

// The NVN procedure globals cluster in .rwdata. Bounds taken from the addresses the
// nvnLoadCProcs decompile shows (0x7102fc8800 .. 0x7102fc8bxx); widened a little so a global
// whose address the decompile did not print is still caught.
const NVN_LO = 0x7102fc8000;
const NVN_HI = 0x7102fd0000;

// --- AArch64 ADRP / ADD decoding ----------------------------------------------------
function adrpTarget(pc, insn) {
    // ADRP: op=1, immlo[30:29], 10000[28:24], immhi[23:5], Rd[4:0]
    if (((insn >>> 24) & 0x9f) !== 0x90) return null;
    const rd = insn & 0x1f;
    const immlo = (insn >>> 29) & 0x3;
    const immhi = (insn >>> 5) & 0x7ffff;
    let imm = (immhi << 2) | immlo;
    if (imm & (1 << 20)) imm -= 1 << 21; // sign-extend 21 bits
    // Mask with a Number, not a BigInt: pc exceeds 32 bits so ~0xfffn would coerce it.
    const pageBase = pc - (pc % 0x1000);
    const page = pageBase + imm * 0x1000;
    return { rd, page };
}

function addImm(insn) {
    // ADD (immediate), 64-bit: sf=1, op=0, S=0, 100010, sh, imm12, Rn, Rd
    if (((insn >>> 23) & 0x1ff) !== 0x122) return null;
    const sh = (insn >>> 22) & 1;
    const imm12 = (insn >>> 10) & 0xfff;
    const rn = (insn >>> 5) & 0x1f;
    const rd = insn & 0x1f;
    const off = sh ? imm12 << 12 : imm12;
    return { rn, rd, off };
}

// --- scan ---------------------------------------------------------------------------
const hits = []; // { va, target }
let adrp = null;
let prevVa = 0;

for (let va = TEXT_START; va < TEXT_END; va += 4) {
    const insn = b.readUInt32LE(foff(va));

    const a = adrpTarget(va, insn);
    if (a !== null) {
        adrp = { rd: a.rd, page: a.page, va };
        prevVa = va;
        continue;
    }
    const add = addImm(insn);
    if (add !== null && adrp !== null && add.rn === adrp.rd) {
        const target = adrp.page + add.off;
        if (target >= NVN_LO && target < NVN_HI) {
            hits.push({ va, target, site: prevVa });
        }
        adrp = null;
        continue;
    }
    // Only keep the ADRP live for one following instruction pair.
    if (va - prevVa > 8) adrp = null;
}

console.log(`=== ADRP+ADD sites referencing the NVN global region ===`);
console.log(`region scanned: 0x${NVN_LO.toString(16)} .. 0x${NVN_HI.toString(16)}`);
console.log(`sites found   : ${hits.length}`);

// Which .text regions do they cluster in? The code section is 0x1415068 bytes; bucket into
// 64 KB windows and show the densest, which is where the graphics code lives.
const buckets = new Map();
for (const h of hits) {
    const k = h.va & ~0xffff;
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
}
console.log(`\n=== densest 64 KB windows ===`);
const sorted = [...buckets.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 12);
for (const [k, n] of sorted) {
    console.log(`   0x${k.toString(16)}   ${n} sites`);
}

// Is the nn::gfx code range (0x7100dda290 .. ~0x7100de2000) among them?
const GFX_LO = 0x7100dda000;
const GFX_HI = 0x7100de3000;
const inGfx = hits.filter((h) => h.va >= GFX_LO && h.va < GFX_HI);
console.log(`\nnn::gfx range 0x${GFX_LO.toString(16)}..0x${GFX_HI.toString(16)}: ${inGfx.length} sites`);

// Distinct target globals referenced from anywhere -- the NVN subset the whole binary touches.
const targets = new Set(hits.map((h) => h.target));
console.log(`distinct NVN globals referenced binary-wide: ${targets.size}`);
