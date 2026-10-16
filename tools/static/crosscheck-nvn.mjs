// Cross-check the ADRP+ADD scan against a name-based extraction, and produce the definitive
// answer: which NVN globals does the WHOLE binary reference, versus the bring-up path?
import { readFileSync } from "node:fs";

const b = readFileSync("main.elf");
const FB = 0x100;
const IMG = 0x7100000000;
const foff = (va) => FB + (va - IMG);

// --- the definitive global list, from the resolver body ------------------------------
// nvnLoadCProcs assigns each PTR_pfnc_<name>_7102xxxxxx global, so the body gives BOTH the
// name and the global's address. That is a name<->address map for the entire NVN surface.
const body = readFileSync("loadc.txt", "utf8");
const globalToName = new Map();
for (const m of body.matchAll(/PTR_pfnc_(nvn[A-Za-z0-9_]+)_(7102[0-9a-f]{6})/g)) {
  globalToName.set(parseInt(m[2], 16), m[1]);
}
console.log(`resolver assigns ${globalToName.size} NVN globals`);

const gAddrs = [...globalToName.keys()].sort((a, c) => a - c);
console.log(`global address range: 0x${gAddrs[0].toString(16)} .. 0x${gAddrs[gAddrs.length - 1].toString(16)}`);
console.log(`  span: ${(((gAddrs[gAddrs.length - 1] - gAddrs[0]) / 1024)).toFixed(1)} KB`);

const LO = 0x7102fc8000;
const HI = 0x7102fd0000;
const outside = gAddrs.filter((a) => a < LO || a >= HI);
console.log(`globals OUTSIDE the scanned region 0x${LO.toString(16)}..0x${HI.toString(16)}: ${outside.length}`);
for (const a of outside.slice(0, 8)) console.log(`   0x${a.toString(16)}  ${globalToName.get(a)}`);

// --- decode ADRP+ADD across .text and map hits to names ------------------------------
function adrpTarget(pc, insn) {
  if (((insn >>> 24) & 0x9f) !== 0x90) return null;
  const rd = insn & 0x1f;
  const immlo = (insn >>> 29) & 0x3;
  const immhi = (insn >>> 5) & 0x7ffff;
  let imm = (immhi << 2) | immlo;
  if (imm & (1 << 20)) imm -= 1 << 21;
  return { rd, page: pc - (pc % 0x1000) + imm * 0x1000 };
}
function addImm(insn) {
  if (((insn >>> 23) & 0x1ff) !== 0x122) return null;
  const sh = (insn >>> 22) & 1;
  const imm12 = (insn >>> 10) & 0xfff;
  return { rn: (insn >>> 5) & 0x1f, off: sh ? imm12 << 12 : imm12 };
}

// LDR (immediate, unsigned offset, 64-bit): size=11, 111, opc=01, 01, imm12, Rn, Rt
//   e.g. 0xf9400108 -> ldr x8, [x8]
// THIS is the real access pattern, not ADRP+ADD. The site dump showed
//   adrp x8, 0x7102fc8000 ; ldr x8, [x8] ; ...
// so the global is reached by loading through a GOT-style pointer. An earlier version of this
// scan looked only for ADRP+ADD and therefore found ZERO of the 453 globals -- a wrong
// assumption about the instruction sequence, caught by dumping real instructions at a site
// whose page matched.
function ldrImm64(insn) {
  if (((insn >>> 22) & 0x3ff) !== 0x3e5) return null; // size=11, 111, opc=01, 01
  const imm12 = (insn >>> 10) & 0xfff;
  return { rn: (insn >>> 5) & 0x1f, off: imm12 * 8 }; // 64-bit scale
}

const TEXT_START = 0x7100000000;
const TEXT_END = 0x7101415068;

const siteByName = new Map(); // name -> [site va]
let adrp = null;
let prevVa = 0;

for (let va = TEXT_START; va < TEXT_END; va += 4) {
  const insn = b.readUInt32LE(foff(va));
  const a = adrpTarget(va, insn);
  if (a !== null) { adrp = { rd: a.rd, page: a.page }; prevVa = va; continue; }
  // Both forms are accepted: LDR (the observed GOT-style access) and ADD (direct).
  const ld = ldrImm64(insn);
  const ad = addImm(insn);
  const use = (ld !== null && adrp !== null && ld.rn === adrp.rd) ? ld
            : (ad !== null && adrp !== null && ad.rn === adrp.rd) ? ad
            : null;
  if (use !== null) {
    const target = adrp.page + use.off;
    const name = globalToName.get(target - IMG);
    if (name) {
      if (!siteByName.has(name)) siteByName.set(name, []);
      siteByName.get(name).push(va);
    }
    adrp = null;
    continue;
  }
  if (va - prevVa > 8) adrp = null;
}

console.log(`\n=== NVN globals REFERENCED by code anywhere in the binary ===`);
console.log(`distinct: ${siteByName.size} of ${globalToName.size}`);

// The bring-up subset, established in NVN_BOOT_SUBSET.md from the referenced globals in the
// three bring-up bodies.
const BRINGUP = new Set([
  "nvnDeviceSetWindowOriginMode", "nvnDeviceGetInteger",
  "nvnMemoryPoolBuilderSetDefaults", "nvnMemoryPoolBuilderSetDevice",
  "nvnMemoryPoolBuilderSetFlags", "nvnMemoryPoolBuilderSetStorage",
  "nvnMemoryPoolInitialize", "nvnSamplerPoolInitialize", "nvnTexturePoolInitialize",
  "nvnDeviceBuilderSetDefaults", "nvnDeviceBuilderSetFlags", "nvnDeviceInstallDebugCallback",
  "nvnQueueBuilderSetDefaults", "nvnQueueBuilderSetFlags", "nvnQueueBuilderSetDevice",
  "nvnQueueBuilderSetComputeMemorySize", "nvnQueueBuilderSetCommandMemorySize",
  "nvnQueueBuilderSetControlMemorySize", "nvnQueueBuilderGetQueueMemorySize",
  "nvnQueueBuilderSetQueueMemory", "nvnQueueInitialize", "nvnCommandBufferInitialize",
  "nvnCommandBufferSetMemoryCallback", "nvnCommandBufferSetMemoryCallbackData",
  "nvnBufferBuilderSetDevice", "nvnBufferBuilderSetDefaults", "nvnBufferBuilderSetStorage",
  "nvnBufferInitialize", "nvnBufferMap", "nvnSyncInitialize",
]);

const onlyBringup = [...siteByName.keys()].filter((n) => BRINGUP.has(n));
const beyondBringup = [...siteByName.keys()].filter((n) => !BRINGUP.has(n));

console.log(`  of which in the bring-up subset : ${onlyBringup.length}`);
console.log(`  BEYOND bring-up                 : ${beyondBringup.length}`);
console.log(`\n--- referenced BEYOND the bring-up subset ---`);
for (const n of beyondBringup.sort()) {
  console.log(`   ${n.padEnd(44)} ${siteByName.get(n).length} site(s)`);
}

// Do any bring-up names appear NOT to be referenced? (would mean the scan missed them)
const missing = [...BRINGUP].filter((n) => !siteByName.has(n));
console.log(`\nbring-up names the ADRP scan did NOT see: ${missing.length}`);
for (const n of missing) console.log(`   ${n}`);
