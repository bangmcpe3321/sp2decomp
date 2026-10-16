// Test whether nn::os is actually implemented in sdk, independently of symbols.
//
// nn::os::GetSystemTick reads the ARM64 virtual counter:  MRS Xt, CNTVCT_EL0.
// That encoding is a precise, symbol-free behavioural marker. If sdk implements
// nn::os, it must contain CNTVCT_EL0 reads; if sdk only *calls* nn::os, it will not.
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "sdk.elf";
const b = readFileSync(path);

const TEXT_OFF = 0x1000; // converted ELF: .text content at file 0x1000
const TEXT_SIZE = 0x2ce04c;
const text = b.subarray(TEXT_OFF, TEXT_OFF + TEXT_SIZE);

// ARM64 system-register moves: 1101 0101 00 L 1 op0 op1 CRn CRm op2 Rt
// CNTVCT_EL0 = op0=3, op1=3, CRn=14, CRm=0, op2=2
const CNTVCT_EL0 = 0xd53be040;
const CNTFRQ_EL0 = 0xd53be000;
const CNTPCT_EL0 = 0xd53be020;
const MRS_MASK = 0xffffffe0;

let cntvct = 0, cntfrq = 0, cntpct = 0, mrsTotal = 0;
for (let i = 0; i + 4 <= text.length; i += 4) {
  const w = text.readUInt32LE(i);
  if ((w & 0xfff00000) >>> 0 === 0xd5300000 || (w & 0xffff0000) >>> 0 === 0xd53b0000) mrsTotal++;
  if ((w & MRS_MASK) >>> 0 === CNTVCT_EL0) cntvct++;
  if ((w & MRS_MASK) >>> 0 === CNTFRQ_EL0) cntfrq++;
  if ((w & MRS_MASK) >>> 0 === CNTPCT_EL0) cntpct++;
}

console.log(`file: ${path}`);
console.log(`.text words scanned: ${text.length / 4}`);
console.log(`MRS (system register) instructions total : ${mrsTotal}`);
console.log(`  MRS CNTVCT_EL0 (virtual counter)        : ${cntvct}`);
console.log(`  MRS CNTPCT_EL0 (physical counter)       : ${cntpct}`);
console.log(`  MRS CNTFRQ_EL0 (counter frequency)      : ${cntfrq}`);

console.log("");
if (cntvct + cntpct + cntfrq > 0) {
  console.log("VERDICT: sdk DOES read the ARM64 system counters, so time-keeping code");
  console.log("         is compiled into this module.");
} else {
  console.log("VERDICT: sdk contains NO system-counter reads. Either nn::os is not");
  console.log("         implemented here, or it does not read the counter directly.");
}

// Also check for the MPIDR read used by core-id queries, and for
// SVC (supervisor call) which any real OS wrapper must use.
let mpidr = 0, svc = 0;
for (let i = 0; i + 4 <= text.length; i += 4) {
  const w = text.readUInt32LE(i);
  if ((w & MRS_MASK) >>> 0 === 0xd53bd040) mpidr++;          // MRS Xt, MPIDR_EL1
  if ((w & 0xffe0001f) >>> 0 === 0xd4000001) svc++;          // SVC #imm
}
console.log("");
console.log(`MRS MPIDR_EL1 (core id)  : ${mpidr}`);
console.log(`SVC (syscall) instructions: ${svc}`);
