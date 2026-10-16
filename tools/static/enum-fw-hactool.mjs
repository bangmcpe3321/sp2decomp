// Enumerate firmware NCAs using hactool --info, since the NCA header is encrypted and
// cannot be parsed directly from raw bytes.
//
// Output is written to a file so the caller can grep it rather than ingest it all.
import { readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const dir = process.argv[2];
const hactool = process.argv[3];
const keys = process.argv[4];
const outPath = process.argv[5] ?? "fw-nca-index.tsv";

const files = readdirSync(dir).filter((f) => f.endsWith(".nca"));
const rows = [];

for (const f of files) {
  const p = join(dir, f);
  let info = "";
  try {
    info = execFileSync(hactool, ["-t", "nca", "-k", keys, "--info", p], {
      encoding: "latin1",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    info = e.stdout ? String(e.stdout) : "";
  }
  const grab = (re) => {
    const m = re.exec(info);
    return m ? m[1].trim() : "";
  };
  rows.push({
    file: f,
    size: statSync(p).size,
    titleId: grab(/Title ID:\s+([0-9a-fA-F]{16})/),
    contentType: grab(/Content Type:\s+(\S+)/),
    distType: grab(/Distribution type:\s+(\S+)/),
    sdkVersion: grab(/SDK Version:\s+(\S+)/),
    contentSize: grab(/Content Size:\s+(\S+)/),
  });
}

// System titles live in the 0100000000000xxx range.
const isSystem = (t) => /^0100000000000[0-9a-f]{3}$/.test(t);

writeFileSync(
  outPath,
  "file\tsize\ttitleId\tcontentType\tdistType\tsdkVersion\tcontentSize\n" +
    rows
      .map((r) => [r.file, r.size, r.titleId, r.contentType, r.distType, r.sdkVersion, r.contentSize].join("\t"))
      .join("\n") +
    "\n",
);

const sys = rows.filter((r) => isSystem(r.titleId));
console.log(`NCAs: ${rows.length}   system-titled: ${sys.length}`);
console.log(`wrote ${outPath}`);

// Distinct SDK versions present, which tells us whether the pack is homogeneous.
const vers = new Map();
for (const r of rows) vers.set(r.sdkVersion, (vers.get(r.sdkVersion) ?? 0) + 1);
console.log("\ndistinct SDK versions in the pack:");
for (const [v, c] of [...vers.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(4)}  ${v}`);

console.log("\nsystem titles (0100000000000xxx):");
for (const r of sys.sort((a, b) => a.titleId.localeCompare(b.titleId))) {
  console.log(`  ${r.titleId}  ${String(Math.round(r.size / 1024)).padStart(8)} KB  ${r.contentType.padEnd(10)}`);
}

console.log("\nlargest 12 overall:");
for (const r of [...rows].sort((a, b) => b.size - a.size).slice(0, 12)) {
  console.log(`  ${r.titleId}  ${String(Math.round(r.size / 1024 / 1024)).padStart(5)} MB  ${r.contentType.padEnd(10)} ${r.distType}`);
}
