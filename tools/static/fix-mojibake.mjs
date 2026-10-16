// Repair a corrupted em-dash byte sequence, without touching legal UTF-8.
//
// Background: an earlier PowerShell pass read the file as Windows-1252 and wrote
// it back as UTF-8. A literal em-dash (E2 80 94) had its trailing byte 0x94
// reinterpreted as U+201D (right double quote), which re-encodes as E2 80 9D.
// The result is the three-byte sequence E2 80 9D where E2 80 94 was intended.
//
// This is a targeted byte fix rather than a text replacement, because a naive
// search for lone 0x97 bytes would also match LEGAL continuation bytes inside
// Vietnamese diacritics (e.g. U+1EA1 'a' with dot below = E1 BA A1).
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2];
const apply = process.argv.includes("--apply");
const buf = readFileSync(path);

// Find every lone 0x97 that is NOT a legal UTF-8 continuation byte.
// A byte is a legal continuation only if it is preceded by a lead byte whose
// sequence length covers it. Checking "the previous byte is ASCII" is the simple,
// safe test: an em-dash that got encoded through a legacy codepage lands as a
// single 0x97 surrounded by ASCII, whereas a real continuation byte always has a
// non-ASCII lead byte immediately before it.
const target = 0x97;
const replacement = [0xe2, 0x80, 0x94]; // U+2014 EM DASH
const hits = [];
for (let i = 0; i < buf.length; i++) {
  if (buf[i] !== target) continue;
  const prev = i > 0 ? buf[i - 1] : 0;
  const prevIsAscii = prev < 0x80;
  if (prevIsAscii) hits.push(i);
}

console.log(`file: ${path}`);
console.log(`lone 0x97 bytes with ASCII neighbour (corrupted em-dashes): ${hits.length}`);
for (const off of hits.slice(0, 20)) {
  const from = Math.max(0, off - 30);
  const to = Math.min(buf.length, off + 30);
  console.log(`  off ${String(off).padStart(6)}  ...${buf.subarray(from, to).toString("latin1").replace(/\n/g, "\\n")}...`);
}

// also report truly invalid positions for comparison
const strict = new TextDecoder("utf-8", { fatal: true });
let currentlyValid = true;
try { strict.decode(buf); } catch { currentlyValid = false; }
console.log(`\ncurrently valid UTF-8: ${currentlyValid}`);

if (apply && hits.length) {
  // Rebuild with the replacement, since the byte count changes.
  const pieces = [];
  let last = 0;
  for (const off of hits) {
    pieces.push(buf.subarray(last, off));
    pieces.push(Buffer.from(replacement));
    last = off + 1;
  }
  pieces.push(buf.subarray(last));
  const out = Buffer.concat(pieces);
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(out);
  } catch (e) {
    console.error(`REFUSING to write: repaired buffer still invalid (${e.message})`);
    process.exit(1);
  }
  writeFileSync(path, out);
  console.log(`\napplied ${hits.length} replacements; ${buf.length} -> ${out.length} bytes; revalidated as UTF-8`);
} else if (!apply) {
  console.log(`\n(dry run — pass --apply to write)`);
}
