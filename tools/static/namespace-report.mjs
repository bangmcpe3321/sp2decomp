// Full namespace decomposition of the module symbol table plus notable findings.
import { readFileSync } from "node:fs";

const text = readFileSync(process.argv[2] ?? "inventory.txt", "utf8");
const funcs = [];
const syms = [];
for (const ln of text.split("\n")) {
  if (ln.startsWith("FUNCTION\t")) {
    const p = ln.split("\t");
    funcs.push({ va: p[1], name: p[2] });
  } else if (ln.startsWith("SYMBOL\t")) {
    const p = ln.split("\t");
    syms.push({ va: p[1], type: p[2], name: p[3] });
  }
}

const nsOf = (n) => {
  const m = /^_ZN(\d+)/.exec(n);
  if (m) return n.slice(m[0].length, m[0].length + Number(m[1]));
  if (n.startsWith("_Z")) return "<it-mangled-other>";
  return "<plain-C>";
};

const counts = new Map();
for (const f of funcs) {
  const ns = nsOf(f.name);
  counts.set(ns, (counts.get(ns) || 0) + 1);
}
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log(`total functions: ${funcs.length}`);
console.log(`distinct top-level namespaces: ${sorted.length}`);
console.log("\n=== ALL namespaces with >=25 functions ===");
let cumulative = 0;
for (const [ns, c] of sorted) {
  if (c < 25) break;
  cumulative += c;
  console.log(`  ${String(c).padStart(7)}  ${ns}`);
}
console.log(`  (namespaces shown account for ${cumulative} of ${funcs.length} functions)`);

const tail = sorted.filter(([, c]) => c < 25);
console.log(`\n  plus ${tail.length} smaller namespaces totalling ${tail.reduce((a, b) => a + b[1], 0)} functions`);

// Notable: internal test/debug namespaces surviving in the retail binary
console.log("\n=== internal test / viewer / debug namespaces present in the retail build ===");
const interesting = sorted.filter(([ns]) => /Test|Viewer|Dbg|Debug|Editor|Prof|Dev/i.test(ns));
for (const [ns, c] of interesting) console.log(`  ${String(c).padStart(6)}  ${ns}`);

// Third-party / middleware libraries visible by name
console.log("\n=== middleware and non-Nintendo libraries (by symbol name) ===");
const libs = [
  ["wslay (WebSocket)", /wslay/i],
  ["mbedtls / TLS", /mbedtls|ssl_|_ssl/i],
  ["zlib", /^inflate|^deflate|^crc32|zlib/i],
  ["zstd", /ZSTD_/],
  ["opus / audio codec", /opus_|_opus/i],
  ["libcurl", /curl_/i],
  ["cri (CriWare)", /cri_|CriAtom|CriMana/i],
  ["xlink2", /xlink2/i],
  ["musl libc", /__nnmusl|musl/i],
  ["libc++", /_ZNSt3__|__cxx/i],
  ["boost", /_ZN5boost/i],
  ["sdl", /SDL_/],
];
for (const [label, re] of libs) {
  const hits = funcs.filter((f) => re.test(f.name)).length;
  const symHits = syms.filter((s) => re.test(s.name)).length;
  console.log(`  ${label.padEnd(22)} funcs=${String(hits).padStart(6)}  symbols=${String(symHits).padStart(6)}`);
}
