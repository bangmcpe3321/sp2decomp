// Identify the boot sequence surface for the "boot to main menu" milestone.
//
// MOD0 (per SwitchBrew) contains NO entry point -- it holds DynamicOffset,
// BssStart/End, ExceptionInfo start/end and ModuleOffset. Booting is therefore
// driven by the .dynamic section's DT_INIT / DT_INIT_ARRAY plus the nn::oe
// application lifecycle. This script reads those structures directly.
import { readFileSync, writeFileSync } from "node:fs";

const nsoPath = process.argv[2] ?? "main.elf";
const invPath = process.argv[3] ?? "inventory.txt";
const outPath = process.argv[4] ?? "boot-chain.txt";

const b = readFileSync(nsoPath);
const out = [];
const log = (s) => { out.push(s); console.log(s); };

// Flat image: .text content at 0x100, .rodata content at 0x1416100.
const TEXT_FILE = 0x100;
const RODATA_FILE = 0x1416100;
const fileToVa = (fo) => {
  // .text spans file [0x100, 0x1415168); everything above is at VA = file - 0x100
  return fo - 0x100;
};

const u32 = (o) => b.readUInt32LE(o);
const s32 = (o) => b.readInt32LE(o);

// ---- MOD0 ---------------------------------------------------------------
log("=== MOD0 / ModuleHeader (SwitchBrew field names) ===");
const M = TEXT_FILE + 0x8;
log(`  Signature            : ${JSON.stringify(b.toString("latin1", M, M + 4))}`);
const F = {
  DynamicOffset: u32(M + 0x4),
  BssStartOffset: u32(M + 0x8),
  BssEndOffset: u32(M + 0xc),
  ExceptionInfoStartOffset: u32(M + 0x10),
  ExceptionInfoEndOffset: u32(M + 0x14),
  ModuleOffset: u32(M + 0x18),
};
for (const [k, v] of Object.entries(F)) log(`  ${k.padEnd(26)}: 0x${v.toString(16)}`);
log("  NOTE: per the MOD spec there is no entry point here; the module is entered");
log("        through the dynamic section and the runtime loader.");

// ---- .dynamic -----------------------------------------------------------
// The compatibility loader placed .dynamic at VA 0x2f9a470 in an analysis load
// (file 0x2f9a570 in this flat image).
const DYN_FILE = 0x2f9a470 + 0x100;
const DYN_TAGS = {
  0: "DT_NULL", 1: "DT_NEEDED", 2: "DT_PLTRELSZ", 3: "DT_PLTGOT", 4: "DT_HASH",
  5: "DT_STRTAB", 6: "DT_SYMTAB", 7: "DT_RELA", 8: "DT_RELASZ", 9: "DT_RELAENT",
  10: "DT_STRSZ", 11: "DT_SYMENT", 12: "DT_INIT", 13: "DT_FINI",
  14: "DT_SONAME", 15: "DT_RPATH", 16: "DT_SYMBOLIC", 17: "DT_REL", 18: "DT_RELSZ",
  19: "DT_RELENT", 20: "DT_PLTREL", 21: "DT_DEBUG", 22: "DT_TEXTREL",
  23: "DT_JMPREL", 24: "DT_BIND_NOW", 25: "DT_INIT_ARRAY", 26: "DT_FINI_ARRAY",
  27: "DT_INIT_ARRAYSZ", 28: "DT_FINI_ARRAYSZ", 29: "DT_RUNPATH",
  30: "DT_FLAGS", 32: "DT_PREINIT_ARRAY", 33: "DT_PREINIT_ARRAYSZ",
};
log("\n=== .dynamic (boot-relevant tags) ===");
const seen = {};
for (let i = 0; i < 64; i++) {
  const o = DYN_FILE + i * 16;
  if (o + 16 > b.length) break;
  const tag = b.readBigInt64LE(o);
  const val = b.readBigUInt64LE(o + 8);
  const t = Number(tag);
  const name = DYN_TAGS[t] ?? `tag_${t}`;
  if (t === 0) { log("  DT_NULL (end)"); break; }
  if ([12, 13, 25, 26, 27, 28, 32, 33, 5, 6, 7, 23].includes(t)) {
    log(`  ${name.padEnd(18)} = 0x${val.toString(16)}`);
    seen[name] = val;
  }
}

// ---- .init_array --------------------------------------------------------
log("\n=== .init_array (module constructors, run at boot) ===");
const IA_FILE = 0x2fd7f90 + 0x100;
const IA_SIZE = 0x3220;
const initFns = [];
for (let off = 0; off < IA_SIZE; off += 8) {
  const o = IA_FILE + off;
  if (o + 8 > b.length) break;
  const v = b.readBigUInt64LE(o);
  if (v === 0n) continue;
  initFns.push(Number(v));
}
log(`  entries: ${initFns.length}`);
log(`  first 20 VAs: ${initFns.slice(0, 20).map((v) => "0x" + v.toString(16)).join(", ")}`);

// ---- symbol inventory ---------------------------------------------------
const syms = [];
for (const ln of readFileSync(invPath, "utf8").split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  const va = parseInt(p[1], 16);
  if (!Number.isNaN(va)) syms.push({ va, name: p[2] });
}
const byVa = new Map(syms.map((s) => [s.va, s.name]));

function demangle(m) {
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
  return parts.length ? parts.join("::") : m;
}

const dem = syms.map((s) => ({ va: s.va, name: s.name, dm: demangle(s.name) }));

log("\n=== .init_array entries with known symbols ===");
let named = 0;
for (const va of initFns) {
  const n = byVa.get(va);
  if (n) { named++; if (named <= 40) log(`  0x${va.toString(16)}  ${demangle(n)}`); }
}
log(`  ${named} of ${initFns.length} init_array entries resolve to a named symbol`);

// ---- boot-critical SDK surface -----------------------------------------
log("\n=== boot-critical SDK surface (module init / lifecycle) ===");
const GROUPS = [
  ["Process/application lifecycle", /^(nn::oe|nn::ro|nn::applet|nn::os)::/],
  ["Filesystem / romfs", /^(nn::fs|nn::nnmusl|__nnmusl)::?/],
  ["Graphics device", /^nn::(gfx|vi|nvn)::/],
  ["Renderer 3D/2D", /^nn::(g3d|ui2d)::/],
  ["UI toolkit (menus)", /^nn::atk::/],
  ["Font (menu text)", /^nn::(font|fontll)::/],
  ["Audio", /^(nn::audio|pead|xlink2)::/],
  ["Input", /^nn::hid::/],
  ["Memory/heap", /^(nn::mem|sead)::/],
  ["Game boot/app framework", /^(Lp::Sys|Lp::UI|gsys|Boot)::/],
];
for (const [label, re] of GROUPS) {
  const hits = dem.filter((d) => re.test(d.dm));
  const init = hits.filter((d) => /Initialize|Initialize\b|Init$|Init[A-Z]|Create|Mount|Open|Setup|Start|BeginFrame|Alloc/i.test(d.dm));
  log(`\n## ${label}: ${hits.length} functions (${init.length} init-like)`);
  for (const h of init.slice(0, 18)) log(`   0x${h.va.toString(16)}  ${h.dm}`);
}

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`\nwrote ${outPath}`);
