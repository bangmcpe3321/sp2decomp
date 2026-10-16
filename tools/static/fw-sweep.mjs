// Find which firmware module actually contains the platform layer.
//
// Method: for each Program NCA, extract the ExeFS, decompress the NSO, and look for the
// marker strings for nn::os / nn::mem / nn::init. The module that carries the real
// implementations must name them (they are statically linked, so their symbols and
// assertion strings are present).
//
// This is deliberately staged and writes a summary, because a full sweep is expensive.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const FW = "C:/Users/Hexa/Documents/nintendo/fw";
const HACTOOL = `${FW}/hactool/hactool.exe`;
const KEYS = "C:/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/prod.keys";
const INDEX = "fw-nca-index.tsv";
const WORK = `${FW}/sweep`;
mkdirSync(WORK, { recursive: true });

// Platform markers. A module with the real implementations will contain these.
const MARKERS = [
  "_ZN2nn2os",
  "_ZN2nn3mem17StandardAllocator",
  "_ZN2nn4init19InitializeAllocator",
  "_ZN2nn2vi",
  "InitializeMutex",
  "QueryMemoryInfo",
];

const rows = readFileSync(INDEX, "utf8")
  .split("\n")
  .slice(1)
  .map((l) => l.split("\t"))
  .filter((p) => p[3] === "Program" && Number(p[1]) > 200 * 1024)
  .sort((a, b) => Number(a[1]) - Number(b[1])); // smallest first: cheaper to sweep

const limit = Number(process.argv[2] ?? 40);
const results = [];

console.log(`Program NCAs over 200 KB: ${rows.length}; sweeping ${Math.min(limit, rows.length)}\n`);

for (const [file, size, titleId, , , sdkVersion] of rows.slice(0, limit)) {
  const tag = titleId.replace(/^0100/, "");
  const outDir = join(WORK, tag);
  mkdirSync(outDir, { recursive: true });
  const nsoPath = join(outDir, "main");
  const decPath = join(outDir, "main.decompressed");

  let status = "?";
  let hits = {};
  try {
    if (!existsSync(nsoPath)) {
      execFileSync(HACTOOL, ["-t", "nca", "-k", KEYS, "--exefsdir", outDir, "--disablekeywarns", join(FW, "extracted", file)], {
        stdio: ["ignore", "ignore", "ignore"],
        timeout: 120000,
      });
    }
    // ExeFS may name the module something other than "main"
    const entries = readdirSync(outDir).filter((f) => !f.includes("."));
    const modName = entries[0];
    if (!modName) { status = "no-exefs"; results.push({ titleId, sdkVersion, size, status, hits }); continue; }

    const rawPath = join(outDir, modName);
    if (!existsSync(decPath)) {
      execFileSync(HACTOOL, ["-t", "nso", "-k", KEYS, "--uncompressed", decPath, "--disablekeywarns", rawPath], {
        stdio: ["ignore", "ignore", "ignore"],
        timeout: 180000,
      });
    }
    const buf = readFileSync(decPath);
    const s = buf.toString("latin1");
    for (const m of MARKERS) hits[m] = s.split(m).length - 1;
    const total = Object.values(hits).reduce((a, b) => a + b, 0);
    status = total > 0 ? "HAS-PLATFORM" : "no-markers";
    if (total > 0) {
      console.log(`  HIT ${titleId} sdk=${sdkVersion} ${Math.round(Number(size) / 1024 / 1024)} MB`);
      for (const [k, v] of Object.entries(hits)) if (v) console.log(`        ${String(v).padStart(5)}  ${k}`);
    } else {
      console.log(`  -   ${titleId} sdk=${sdkVersion} ${Math.round(Number(size) / 1024 / 1024)} MB  (no markers)`);
    }
  } catch (e) {
    status = `error:${String(e.message).slice(0, 40)}`;
    console.log(`  !   ${titleId}  ${status}`);
  }
  results.push({ titleId, sdkVersion, size, status, hits });
}

writeFileSync("fw-sweep-results.json", JSON.stringify(results, null, 2));
const hits = results.filter((r) => r.status === "HAS-PLATFORM");
console.log(`\nmodules containing platform markers: ${hits.length}`);
for (const h of hits) console.log(`  ${h.titleId}  sdk=${h.sdkVersion}`);
console.log(`\nwrote fw-sweep-results.json`);
