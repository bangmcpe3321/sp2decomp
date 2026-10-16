// Print the full decompiled body of a function by address, with blank lines collapsed.
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "main-decompiled.txt";
const want = (process.argv[3] ?? "0x71011f5ab4").toLowerCase();

const t = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
for (const b of t.split(/^=+\s*$/m)) {
  const m = /^\s*0x([0-9a-f]+)\s+/m.exec(b);
  if (!m || "0x" + m[1] !== want) continue;
  const lines = b.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() !== "");
  console.log(lines.join("\n"));
}
