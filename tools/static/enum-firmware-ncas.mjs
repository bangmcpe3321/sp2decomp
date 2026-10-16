// Enumerate firmware NCAs by reading their cleartext NCA headers.
//
// The NCA header is not encrypted, so title id / content type / size can be read without
// keys. That lets us locate nnSdk (and the other sysmodules) before doing any work.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "C:/Users/Hexa/Documents/nintendo/fw/extracted";

// NCA3 header layout (offset : field)
//   0x000 magic "NCA3"
//   0x200 content size (u64)
//   0x210 title id (u64)
//   0x220 sdk version (4 x u8)  -- in the "NCA header" per switchbrew
//   0x230 content type (u8)     -- 0 Program, 1 Meta, 2 Control, 3 Manual, 4 Data, 5 PublicData
const CTYPE = { 0: "Program", 1: "Meta", 2: "Control", 3: "Manual", 4: "Data", 5: "PublicData" };

// Known Switch system title ids (the low half identifies the module). Populated from
// public documentation of the System partition.
const KNOWN = {
  "0100000000000000": "fs (filesystem)",
  "0100000000000001": "loader",
  "0100000000000002": "ncm",
  "0100000000000003": "pm",
  "0100000000000004": "sm",
  "0100000000000005": "boot",
  "0100000000000006": "usb",
  "0100000000000007": "tma",
  "0100000000000008": "boot2",
  "0100000000000009": "settings",
  "010000000000000a": "bus",
  "010000000000000b": "bluetooth",
  "010000000000000c": "bcat",
  "010000000000000d": "erpt",
  "010000000000000e": "es",
  "010000000000000f": "creport",
  "0100000000000010": "ro",
  "0100000000000011": "am",
  "0100000000000012": "migration",
  "0100000000000013": "capsrv",
  "0100000000000014": "fatal",
  "0100000000000015": "htcs",
  "0100000000000016": "pctl",
  "0100000000000017": "aoc",
  "0100000000000018": "spl",
  "0100000000000019": "ts",
  "010000000000001a": "logmanager",
  "010000000000001b": "ssl",
  "010000000000001c": "nim",
  "010000000000001d": "pdm",
  "010000000000001e": "grc",
  "010000000000001f": "home",
  "0100000000000020": "eupld",
  "0100000000000021": "friends",
  "0100000000000022": "account",
  "0100000000000023": "sdb",
  "0100000000000024": "mig",
  "0100000000000025": "jpegdec",
  "0100000000000026": "olsc",
  "0100000000000027": "avm",
  "0100000000000028": "pcv",
  "0100000000000029": "nvnflinger",
  "010000000000002a": "lbl",
  "010000000000002b": "bsdcfg",
  "010000000000002c": "olsc2",
  "010000000000002d": "pcv2",
  "010000000000002e": "ns",
  "010000000000002f": "nifm",
  "0100000000000030": "socket",
  "0100000000000031": "spl2",
  "0100000000000032": "htc",
  "0100000000000033": "vi",
  "0100000000000034": "nvservices",
  "0100000000000035": "mm",
  "0100000000000036": "pm2",
  "0100000000000037": "pgl",
  "0100000000000038": "usb2",
  "0100000000000039": "mig2",
  "010000000000003a": "pdm2",
  "010000000000003b": "eupld2",
  "010000000000003c": "es2",
  "010000000000003d": "pctl2",
  "010000000000003e": "aoc2",
  "010000000000003f": "spl3",
  "0100000000000040": "lv1",
  "0100000000000041": "nvdrv",
  "0100000000000042": "olsc3",
};

const rows = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".nca")) continue;
  const p = join(dir, f);
  const buf = readFileSync(p);
  if (buf.toString("latin1", 0, 4) !== "NCA3") continue;
  const contentSize = Number(buf.readBigUInt64LE(0x200));
  const titleId = buf.readBigUInt64LE(0x210).toString(16).padStart(16, "0");
  const ctype = buf[0x230];
  rows.push({
    file: f,
    size: statSync(p).size,
    contentSize,
    titleId,
    ctype: CTYPE[ctype] ?? `0x${ctype.toString(16)}`,
    known: KNOWN[titleId] ?? "",
  });
}

console.log(`NCAs parsed: ${rows.length}\n`);

// Anything whose title id is a system-title range (0100000000000xxx) is a sysmodule.
const sys = rows.filter((r) => /^0100000000000[0-9a-f]{3}$/.test(r.titleId));
console.log(`=== system titles (0100000000000xxx): ${sys.length} ===`);
for (const r of sys.sort((a, b) => a.titleId.localeCompare(b.titleId))) {
  console.log(`  ${r.titleId}  ${String(Math.round(r.size / 1024)).padStart(7)} KB  ${r.ctype.padEnd(10)} ${r.known || "(unnamed)"}`);
}

// Large non-system program/data NCAs are candidates for the SDK-bearing ones.
console.log(`\n=== largest 15 by file size ===`);
for (const r of rows.sort((a, b) => b.size - a.size).slice(0, 15)) {
  console.log(`  ${r.titleId}  ${String(Math.round(r.size / 1024 / 1024)).padStart(5)} MB  ${r.ctype.padEnd(10)} ${r.known}`);
}

// Look specifically for an SDK-ish module by size parity with the game's `sdk` (2.89 MB).
console.log(`\n=== NCAs sized 2-4 MB (comparable to the game's sdk module) ===`);
for (const r of rows.filter((r) => r.size > 2 * 1024 * 1024 && r.size < 5 * 1024 * 1024)) {
  console.log(`  ${r.titleId}  ${String(Math.round(r.size / 1024)).padStart(7)} KB  ${r.ctype.padEnd(10)} ${r.known}`);
}
