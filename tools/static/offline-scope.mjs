// Separate the offline-playable systems from the online-only ones, so an
// offline port can scope out what it must stub, replace, or drop.
import { readFileSync, writeFileSync } from "node:fs";

const inPath = process.argv[2] ?? "inventory.txt";
const outPath = process.argv[3] ?? "offline-scope.txt";
const text = readFileSync(inPath, "utf8");

const funcs = [];
for (const ln of text.split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  funcs.push({ va: p[1], name: p[2] });
}

function demangle(m) {
  if (!m.startsWith("_Z")) return m;
  let s = m.slice(2);
  while ("KV R".includes(s[0]) && (s[0] === "K" || s[0] === "V" || s[0] === "R")) s = s.slice(1);
  if (!s.startsWith("N")) return m;
  s = s.slice(1);
  const parts = [];
  for (;;) {
    if (s.startsWith("E")) break;
    const mm = /^(\d+)/.exec(s);
    if (!mm) break;
    const len = Number(mm[1]);
    parts.push(s.slice(mm[0].length, mm[0].length + len));
    s = s.slice(mm[0].length + len);
  }
  if (!parts.length) return m;
  const last = parts[parts.length - 1];
  const ctor = last === "C1" || last === "C2" || last === "C3";
  const dtor = last === "D0" || last === "D1" || last === "D2";
  const base = parts.slice(0, ctor || dtor ? -2 : -1).join("::");
  if (ctor) return base + "::" + base.split("::").pop();
  if (dtor) return base + "::~" + base.split("::").pop();
  return parts.join("::");
}

// --- classification -------------------------------------------------------
// ONLINE: required for networked play; must be stubbed/replaced/dropped.
const ONLINE_RULES = [
  [/^nn::nex\b/, "Nintendo online service (matchmaking, rankings, protocols)"],
  [/^nn::pia\b/, "P2P session layer (Nintendo infrastructure)"],
  [/^nn::ldn\b/, "local wireless networking"],
  [/^nn::friends\b/, "friend list service"],
  [/^nn::account\b/, "Nintendo Account"],
  [/^nn::bcat\b/, "background content delivery"],
  [/^nn::web\b/, "web view (online content)"],
  [/^nn::nifm\b/, "network interface manager"],
  [/^nn::socket\b/, "BSD socket layer"],
  [/^nn::ssl\b/, "TLS"],
  [/^Cnet\b/, "network transport"],
  [/^Match\b/, "matchmaking"],
  [/^Lobby\b/, "online lobby"],
  [/^Lp::Net\b/, "game network layer"],
  [/^Shop\b/, "online shop"],
  [/^Game::PlayerNetControl\b/, "networked player synchronisation"],
  [/^Game::MissilePositionOnline\b/, "online missile position sync"],
  [/^Game::PageHandlerVersus\b/, "versus match UI (online)"],
  [/^Game::PageHandlerCoop\b/, "Salmon Run match UI (online)"],
  [/^Game::SeqMgr.*(Versus|Coop|Match)\b/, "online match sequence"],
  [/^DbgViewLeagueWeb\b/, "league web debug view"],
  [/^DbgInputLeagueServer\b/, "league server debug input"],
];

// OFFLINE: single-player / local content that must keep working.
const OFFLINE_RULES = [
  [/^Game::SeqMgrMission\b/, "single-player mission (Octo Canyon) sequence"],
  [/^Game::PageHandlerMission\b/, "single-player mission UI"],
  [/^Game::SeqMgrWorld\b/, "world/hub sequence (offline)"],
  [/^Game::PageHandlerPlaza\b/, "hub plaza UI (offline)"],
  [/^Game::Player\b/, "player"],
  [/^Game::PlayerInkAction\b/, "ink mechanics"],
  [/^Game::BulletMgr\b/, "projectiles"],
  [/^Game::Enemy/, "enemy AI (single-player + Salmon Run)"],
  [/^Game::Utl\b/, "gameplay utilities"],
  [/^Game::DbgSetting\b/, "debug/options (offline)"],
  [/^MiniGame\b/, "local minigames"],
];

const buckets = {
  online: [],
  offline: [],
  platformKeep: [],
  engine: [],
  ui: [],
  unknown: [],
};

const classify = (dm) => {
  for (const [re, why] of ONLINE_RULES) if (re.test(dm)) return { bucket: "online", why };
  for (const [re, why] of OFFLINE_RULES) if (re.test(dm)) return { bucket: "offline", why };
  if (/^nn::(gfx|g3d|ui2d|atk|vfx|font|fontll|audio|hid|fs|os|util|mem|time|capsrv|crypto|codec|diag|err|oe|applet|prepo|nfp|sf)\b/.test(dm)) {
    return { bucket: "platformKeep", why: "platform API to reimplement on PC" };
  }
  if (/^(sead|agl|xlink2|pead|enl)\b/.test(dm)) return { bucket: "engine", why: "engine/middleware" };
  if (/^(Lp::(Sys|Utl|UI)|Cui|eui|aal|gsys|Cmn|UICheck|UI)/.test(dm)) return { bucket: "ui", why: "framework/UI" };
  return { bucket: "unknown", why: "" };
};

const whyByRule = new Map();
for (const f of funcs) {
  const dm = demangle(f.name);
  const { bucket, why } = classify(dm);
  buckets[bucket].push({ va: f.va, dm });
  if (why) {
    const k = bucket + "|" + why;
    whyByRule.set(k, (whyByRule.get(k) || 0) + 1);
  }
}

const out = [];
out.push("Offline-only port scope for Splatoon 2 main");
out.push(`total functions: ${funcs.length}`);
out.push("");
out.push("=== bucket totals ===");
let sum = 0;
for (const [k, v] of Object.entries(buckets)) {
  out.push(`  ${k.padEnd(14)} ${String(v.length).padStart(7)}`);
  sum += v.length;
}
out.push(`  ${"TOTAL".padEnd(14)} ${String(sum).padStart(7)}`);
out.push("");
out.push("=== ONLINE-only surface to stub, replace or drop ===");
for (const [k, c] of [...whyByRule.entries()].filter(([k]) => k.startsWith("online|")).sort((a, b) => b[1] - a[1])) {
  out.push(`  ${String(c).padStart(6)}  ${k.split("|")[1]}`);
}
out.push("");
out.push("=== OFFLINE surface that must keep working ===");
for (const [k, c] of [...whyByRule.entries()].filter(([k]) => k.startsWith("offline|")).sort((a, b) => b[1] - a[1])) {
  out.push(`  ${String(c).padStart(6)}  ${k.split("|")[1]}`);
}
out.push("");
out.push(`=== removable (online) share of codebase: ${(buckets.online.length / funcs.length * 100).toFixed(1)}% ===`);

// Online namespaces worth documenting so they can be cut cleanly
out.push("");
out.push("=== online symbol namespaces (top 40 by count) ===");
const onNs = new Map();
for (const r of buckets.online) {
  const k = r.dm.split("::").slice(0, 2).join("::");
  onNs.set(k, (onNs.get(k) || 0) + 1);
}
for (const [k, c] of [...onNs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  out.push(`  ${String(c).padStart(6)}  ${k}`);
}

writeFileSync(outPath, out.join("\n") + "\n");
console.log(out.slice(0, 30).join("\n"));
console.log(`\nwrote ${outPath}`);
