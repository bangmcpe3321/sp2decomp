// Verify a translated markdown file against its English source: structural parity,
// link targets preserved, and strict UTF-8 validity.
import { readFileSync } from "node:fs";

const [enPath, viPath] = process.argv.slice(2);
const en = readFileSync(enPath, "utf8");
const viBuf = readFileSync(viPath);

// strict UTF-8 check
let valid = true;
try { new TextDecoder("utf-8", { fatal: true }).decode(viBuf); } catch { valid = false; }
const bom = viBuf.length >= 3 && viBuf[0] === 0xef && viBuf[1] === 0xbb && viBuf[2] === 0xbf;
const vi = viBuf.toString("utf8");

const count = (s, re) => (s.match(re) || []).length;
const metrics = [
  ["table rows", /^[|]/gm],
  ["code fences", /```/g],
  ["h1", /^# /gm],
  ["h2/h3", /^#{2,3} /gm],
  ["markdown links", /\]\(/g],
  ["numbered items", /^\d+\. /gm],
  ["bullet items", /^- /gm],
  ["blockquotes", /^> /gm],
  ["bold spans", /\*\*/g],
];

console.log(`${enPath}  vs  ${viPath}`);
console.log("strict UTF-8 valid:", valid, "| BOM:", bom);
console.log("");
console.log("metric              en     vi");
for (const [label, re] of metrics) {
  const a = count(en, re), b = count(vi, re);
  console.log(`${label.padEnd(18)} ${String(a).padStart(4)}  ${String(b).padStart(5)}${a === b ? "" : "   <-- DIFFERS"}`);
}

// any link target present in the English source should survive
const linkTargets = [...new Set([...en.matchAll(/\]\(([^)#][^)]*)\)/g)].map((m) => m[1]))];
console.log("\nlink targets from source:");
for (const t of linkTargets) {
  console.log(`  ${vi.includes(t) ? "OK  " : "MISS"} ${t}`);
}

// heading count by level, to catch a dropped section
const heads = (s) => (s.match(/^#{1,6} .+$/gm) || []).map((h) => h.replace(/^(#+)\s*/, "$1 ").trim());
const he = heads(en), hv = heads(vi);
console.log(`\nheading count: en=${he.length} vi=${hv.length}`);
if (he.length !== hv.length) {
  console.log("  English headings:");
  for (const h of he) console.log("   ", h);
  console.log("  Vietnamese headings:");
  for (const h of hv) console.log("   ", h);
}

// Vietnamese diacritics should be present (proves it is not a copy of English)
console.log(`\ncontains Vietnamese diacritics: ${/[ăâđêôơưạảấầẩẫậắằẳẵặ]/i.test(vi)}`);
