#!/usr/bin/env tsx
// Lightweight unit asserts for the pay-link helper. Runs without a DB.
// Invoke: npx tsx scripts/check-pay-link.ts

import { buildUpiLink, isValidUpiId } from "../src/lib/fees";
import { buildReminderMessage, type PayOption } from "../src/lib/pay-link";

let passed = 0;
let failed = 0;

function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}${detail ? `: ${detail}` : ""}`);
  }
}

// 1. UPI id validation
assert("isValidUpiId accepts 'academy@okicici'", isValidUpiId("academy@okicici"));
assert("isValidUpiId rejects 'not a upi'", !isValidUpiId("not a upi"));

// 2. UPI link format
const link = buildUpiLink({ upiId: "academy@okicici", payeeName: "Triq Sports", amount: 2500, note: "Rohan fee 2026-10" });
assert("UPI link starts with upi://pay?", link.startsWith("upi://pay?"), link);
assert("UPI link contains pa=academy%40okicici", link.includes("pa=academy%40okicici"), link);
assert("UPI link encodes amount am=2500", /\bam=2500\b/.test(link), link);
assert("UPI link sets currency cu=INR", /\bcu=INR\b/.test(link), link);
assert("UPI link encodes payee name", /pn=Triq(\+|%20)Sports/.test(link), link);

// 3. Reminder message: UPI case embeds link + mentions UPI
const upiOpt: PayOption = { kind: "upi", upi: "academy@okicici", amount: 2500, payee: "Triq Academy", note: "Rohan Oct" };
const upiMsg = buildReminderMessage({
  parentName: "Priya",
  studentName: "Rohan",
  amount: 2500,
  month: "2026-10",
  academyName: "Triq Academy",
  pay: upiOpt,
});
assert("UPI reminder embeds upi:// link", upiMsg.text.includes("upi://pay"), upiMsg.text);
assert("UPI reminder names the student", upiMsg.text.includes("Rohan"), upiMsg.text);
assert("UPI reminder names the parent", upiMsg.text.startsWith("Namaste Priya"), upiMsg.text);
assert("UPI reminder returns a URL field", typeof upiMsg.url === "string" && upiMsg.url!.startsWith("upi://pay"), String(upiMsg.url));
assert("UPI reminder returns a QR fallback URL", typeof upiMsg.qrUrl === "string" && upiMsg.qrUrl!.includes("qrserver.com"), String(upiMsg.qrUrl));

// 4. Reminder message: Razorpay case uses the given URL verbatim
const rzpOpt: PayOption = { kind: "razorpay", url: "https://rzp.io/l/abc123" };
const rzpMsg = buildReminderMessage({
  parentName: null,
  studentName: "Rohan",
  amount: 2500,
  month: "2026-10",
  academyName: "Triq Academy",
  pay: rzpOpt,
});
assert("Razorpay reminder embeds the given link", rzpMsg.text.includes("https://rzp.io/l/abc123"), rzpMsg.text);
assert("Razorpay reminder returns url=that link", rzpMsg.url === "https://rzp.io/l/abc123");
assert("Razorpay reminder has no UPI link", !rzpMsg.text.includes("upi://"), rzpMsg.text);
assert("Reminder without parent name opens 'Namaste,'", rzpMsg.text.startsWith("Namaste,"), rzpMsg.text);

// 5. "none" fallback
const noneMsg = buildReminderMessage({
  parentName: "Priya",
  studentName: "Rohan",
  amount: 2500,
  month: "2026-10",
  academyName: "Triq Academy",
  pay: { kind: "none" },
});
assert("'none' reminder names cash/bank", /cash|bank/.test(noneMsg.text), noneMsg.text);
assert("'none' reminder has no payment link", !noneMsg.text.includes("http") && !noneMsg.text.includes("upi://"));

// 6. Razorpay fallback to UPI when razorpay missing but upi set (simulate payOptionForFee's decision).
// `payOptionForFee` itself needs a DB session; here we check the branch logic: given org without
// razorpayKeyId but with a valid upiId, the "upi" branch is what we'd pick.
const org = { razorpayKeyId: null as string | null, upiId: "academy@okicici" };
const picks = org.razorpayKeyId ? "razorpay" : (isValidUpiId(org.upiId) ? "upi" : "none");
assert("Fallback: no razorpayKeyId + valid upi → 'upi' branch", picks === "upi");

if (failed > 0) {
  console.error(`\n${failed} check(s) failed out of ${passed + failed}.`);
  process.exit(1);
}
console.log(`\nAll ${passed} checks passed.`);
