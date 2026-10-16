import { readFileSync } from "node:fs";
// Show the section layout for candidate firmware modules, so the right one can be
// picked for ExeFS extraction. hactool's --info lists section offsets, sizes and
// (after decryption) the content type of each section.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const hn = process.argv[2];        // e.g. "0100000000001001"
const dir = "C:/Users/Hexa/Documents/nintendo/fw/extracted";
const hactool = "C:/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/hactool.exe";
const keys = "C:/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/prod.keys";

// read the index produced earlier to map title id -> file.
// A title id has BOTH a Meta and a Program NCA; we want the Program.
const idx = readFileSync("fw-nca-index.tsv", "utf8").split("\n").slice(1);
const row = idx
  .map((l) => l.split("\t"))
  .find((p) => p[2] === hn && p[3] === "Program");
if (!row) {
  console.log(`title id ${hn} with content type Program not found in the index`);
  const alts = idx.map((l) => l.split("\t")).filter((p) => p[2] === hn);
  for (const a of alts) console.log(`  present: ${a[3]}  ${Math.round(Number(a[1]) / 1024)} KB  ${a[0]}`);
  process.exit(1);
}
const [file, size, titleId, ctype] = row;
console.log(`title ${titleId}  ${ctype}  ${Math.round(Number(size) / 1024)} KB  ${file}`);

let info = "";
try {
  info = execFileSync(hactool, ["-t", "nca", "-k", keys, "--info", "--disablekeywarns", join(dir, file)], {
    encoding: "latin1",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (e) {
  info = e.stdout ? String(e.stdout) : "";
}
const lines = info.split("\n").filter((l) => !l.startsWith("[WARN]"));
// print from "Sections:" onward, but only the compact per-section summary
const start = lines.findIndex((l) => l.includes("Sections:"));
console.log("\n" + lines.slice(start, start + 30).join("\n"));
