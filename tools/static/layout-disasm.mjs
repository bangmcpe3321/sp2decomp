// Disassemble chosen functions directly from the module, with full ARM64
// decoding for the instructions that reveal structure layout:
//   STP/LDP with offsets  -> member stores/loads at known offsets
//   ADD/SUB immediate     -> stack frame size
//   MOVZ/MOVK             -> size constants (e.g. sizeof)
//   BL                    -> callees
//
// Whole-program analysis stalls on this binary, so this reads the bytes itself.
import { readFileSync, writeFileSync } from "node:fs";

const nsoPath = process.argv[2] ?? "main.elf";
const outPath = process.argv[3] ?? "layout-disasm.txt";
const targets = process.argv.slice(4).map((s) => parseInt(s, 16));

const b = readFileSync(nsoPath);
const IMAGE_BASE = 0x7100000000n;
const TEXT_FILE = 0x100;
const TEXT_SIZE = 0x1415068;
const hex = (v) => "0x" + v.toString(16);

const fileOf = (absVa) => TEXT_FILE + Number(BigInt(absVa) - IMAGE_BASE);

// --- helpers -------------------------------------------------------------
function u32At(absVa) {
  const fo = fileOf(absVa);
  if (fo < 0 || fo + 4 > b.length) return null;
  return b.readUInt32LE(fo);
}

// end of function: next RET (0xd65f03c0) within a bounded window
function findEnd(absVa, cap = 0x2000) {
  for (let p = absVa; p < absVa + cap; p += 4) {
    const w = u32At(p);
    if (w === null) break;
    if (w === 0xd65f03c0) return p + 4;
  }
  return absVa + cap;
}

const regName = (n) => {
  const x = ["x0","x1","x2","x3","x4","x5","x6","x7","x8","x9","x10","x11","x12","x13","x14","x15","x16","x17","x18","x19","x20","x21","x22","x23","x24","x25","x26","x27","x28","x29","x30"];
  return n < 31 ? x[n] : "sp";
};

const signExtend = (v, bits) => {
  const m = 1 << (bits - 1);
  return (v & (m - 1)) - (v & m);
};

// decode a subset of ARM64 that exposes layout-relevant information
function decode(w, absVa) {
  // STP (64-bit, signed offset, pre/post-index): 10 101 0 0 1 0 imm7 Rt2 Rn Rt
  // opc=10 for 64-bit STP
  if ((w & 0xffc00000) >>> 0 === 0xa9000000) {
    const imm7 = signExtend((w >>> 15) & 0x7f, 7);
    const rt2 = (w >>> 10) & 0x1f;
    const rn = (w >>> 5) & 0x1f;
    const rt = w & 0x1f;
    const kind = (w >>> 22) & 0x3; // 01=post, 10=offset, 11=pre
    const suffix = kind === 1 ? "!" : kind === 3 ? "!" : "";
    return `stp ${regName(rt)}, ${regName(rt2)}, [${regName(rn)}, #${imm7 * 8}]${suffix}`;
  }
  // LDP
  if ((w & 0xffc00000) >>> 0 === 0xa9400000) {
    const imm7 = signExtend((w >>> 15) & 0x7f, 7);
    const rt2 = (w >>> 10) & 0x1f;
    const rn = (w >>> 5) & 0x1f;
    const rt = w & 0x1f;
    const kind = (w >>> 22) & 0x3;
    const suffix = kind === 1 ? "!" : kind === 3 ? "!" : "";
    return `ldp ${regName(rt)}, ${regName(rt2)}, [${regName(rn)}, #${imm7 * 8}]${suffix}`;
  }
  // STR (unsigned offset, 64-bit): 11 111 0 01 01 imm12 Rn Rt
  if ((w & 0xffc00000) >>> 0 === 0xf9000000) {
    const imm12 = (w >>> 10) & 0xfff;
    const rn = (w >>> 5) & 0x1f;
    const rt = w & 0x1f;
    return `str ${regName(rt)}, [${regName(rn)}, #${imm12 * 8}]`;
  }
  // LDR (unsigned offset, 64-bit)
  if ((w & 0xffc00000) >>> 0 === 0xf9400000) {
    const imm12 = (w >>> 10) & 0xfff;
    const rn = (w >>> 5) & 0x1f;
    const rt = w & 0x1f;
    return `ldr ${regName(rt)}, [${regName(rn)}, #${imm12 * 8}]`;
  }
  // STR (32-bit): 10 111 0 01 00 imm12 Rn Rt
  if ((w & 0xffc00000) >>> 0 === 0xb9000000) {
    const imm12 = (w >>> 10) & 0xfff;
    const rn = (w >>> 5) & 0x1f;
    const rt = w & 0x1f;
    return `str w${rt}, [${regName(rn)}, #${imm12 * 4}]`;
  }
  // LDR (32-bit)
  if ((w & 0xffc00000) >>> 0 === 0xb9400000) {
    const imm12 = (w >>> 10) & 0xfff;
    const rn = (w >>> 5) & 0x1f;
    const rt = w & 0x1f;
    return `ldr w${rt}, [${regName(rn)}, #${imm12 * 4}]`;
  }
  // STRB
  if ((w & 0xffc00000) >>> 0 === 0x39000000) {
    const imm12 = (w >>> 10) & 0xfff;
    const rn = (w >>> 5) & 0x1f;
    const rt = w & 0x1f;
    return `strb w${rt}, [${regName(rn)}, #${imm12}]`;
  }
  // MOVZ (64-bit): 1 10 100101 hw imm16 Rd
  if ((w & 0xff800000) >>> 0 === 0xd2800000) {
    const hw = (w >>> 21) & 0x3;
    const imm16 = (w >>> 5) & 0xffff;
    const rd = w & 0x1f;
    const val = BigInt(imm16) << BigInt(hw * 16);
    return `movz ${regName(rd)}, #${hex(val)}`;
  }
  // MOVK
  if ((w & 0xff800000) >>> 0 === 0xf2800000) {
    const hw = (w >>> 21) & 0x3;
    const imm16 = (w >>> 5) & 0xffff;
    const rd = w & 0x1f;
    return `movk ${regName(rd)}, #0x${imm16.toString(16)}, lsl #${hw * 16}`;
  }
  // ADD immediate (64-bit): 1 00 10001 0 sh imm12 Rn Rd
  if ((w & 0xff000000) >>> 0 === 0x91000000) {
    const sh = (w >>> 22) & 1;
    const imm12 = (w >>> 10) & 0xfff;
    const rn = (w >>> 5) & 0x1f;
    const rd = w & 0x1f;
    return `add ${regName(rd)}, ${regName(rn)}, #0x${imm12.toString(16)}${sh ? ", lsl #12" : ""}`;
  }
  // SUB immediate (64-bit)
  if ((w & 0xff000000) >>> 0 === 0xd1000000) {
    const sh = (w >>> 22) & 1;
    const imm12 = (w >>> 10) & 0xfff;
    const rn = (w >>> 5) & 0x1f;
    const rd = w & 0x1f;
    return `sub ${regName(rd)}, ${regName(rn)}, #0x${imm12.toString(16)}${sh ? ", lsl #12" : ""}`;
  }
  // MOV (register) alias: ORR Rd, XZR, Rm
  if ((w & 0xffe0ffe0) >>> 0 === 0xaa0003e0) {
    const rm = (w >>> 16) & 0x1f;
    const rd = w & 0x1f;
    return `mov ${regName(rd)}, ${regName(rm)}`;
  }
  // BL
  if ((w & 0xfc000000) >>> 0 === 0x94000000) {
    let imm = w & 0x03ffffff;
    if (imm & 0x02000000) imm -= 0x04000000;
    return `bl ${hex(BigInt(absVa) + BigInt(imm * 4))}`;
  }
  // B
  if ((w & 0xfc000000) >>> 0 === 0x14000000) {
    let imm = w & 0x03ffffff;
    if (imm & 0x02000000) imm -= 0x04000000;
    return `b ${hex(BigInt(absVa) + BigInt(imm * 4))}`;
  }
  if (w === 0xd65f03c0) return "ret";
  if (w === 0xd503201f) return "nop";
  // STUR/LDUR (unscaled) 64-bit: 11 111 0 00 00 imm9 Rn Rt
  if ((w & 0xffe00000) >>> 0 === 0xf8000000) {
    const imm9 = signExtend((w >>> 12) & 0x1ff, 9);
    const rn = (w >>> 5) & 0x1f;
    const rt = w & 0x1f;
    return `stur ${regName(rt)}, [${regName(rn)}, #${imm9}]`;
  }
  if ((w & 0xffe00000) >>> 0 === 0xf8400000) {
    const imm9 = signExtend((w >>> 12) & 0x1ff, 9);
    const rn = (w >>> 5) & 0x1f;
    const rt = w & 0x1f;
    return `ldur ${regName(rt)}, [${regName(rn)}, #${imm9}]`;
  }
  return null;
}

const out = [];
out.push(`layout disassembly  source=${nsoPath}`);
out.push("");
for (const t of targets) {
  const end = findEnd(t);
  out.push("=".repeat(78));
  out.push(`${hex(t)}  (${end - t} bytes)`);
  out.push("");
  const memberAccess = [];
  for (let p = t; p < end; p += 4) {
    const w = u32At(p);
    if (w === null) break;
    const d = decode(w, p);
    if (d === null) continue;
    out.push(`  ${hex(p)}  ${w.toString(16).padStart(8, "0")}  ${d}`);
    const m = /\[(x\d+|sp), #(\d+)\]/.exec(d);
    if (m && d.startsWith("str") === false && m[2] !== "0") {
      memberAccess.push({ at: p, off: Number(m[2]), reg: m[1], ins: d });
    }
  }
  out.push("");
  out.push(`  member-ish accesses (offset != 0): ${memberAccess.length}`);
  const offs = [...new Set(memberAccess.map((m) => m.off))].sort((a, c) => a - c);
  out.push(`  distinct offsets: ${offs.slice(0, 60).join(", ")}${offs.length > 60 ? " ..." : ""}`);
  out.push("");
}
writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath}`);
for (const t of targets) console.log(`  ${hex(t)} end=${hex(findEnd(t))} size=${findEnd(t) - t}`);
