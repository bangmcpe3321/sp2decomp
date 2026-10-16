// Add a language switcher line to a markdown file, written with an explicit UTF-8
// encoder. Using Node rather than PowerShell text I/O avoids the codepage damage
// that previously corrupted PORT_WORKLIST.md.
import { readFileSync, writeFileSync } from "node:fs";

const [, , path, heading, switcher] = process.argv;
if (!path || !heading || !switcher) {
  console.error("usage: node add-switcher.mjs <file> <h1-text> <switcher-line>");
  process.exit(2);
}

let text = readFileSync(path, "utf8");
const lines = text.split("\n");

if (text.includes(switcher)) {
  console.log(`${path}: switcher already present, nothing to do`);
  process.exit(0);
}

// find the h1 line and insert the switcher two lines below it
const h1 = lines.findIndex((l) => l.startsWith("# "));
if (h1 === -1) {
  console.error(`${path}: no h1 found`);
  process.exit(1);
}

// insert after h1 + one blank line
const insertAt = h1 + 2;
lines.splice(insertAt, 0, switcher, "");
writeFileSync(path, lines.join("\n"), { encoding: "utf8" });

// verify
const back = readFileSync(path);
try {
  new TextDecoder("utf-8", { fatal: true }).decode(back);
  console.log(`${path}: switcher inserted after line ${insertAt}, still valid UTF-8`);
} catch (e) {
  console.error(`${path}: FAILED validation after edit: ${e.message}`);
  process.exit(1);
}
