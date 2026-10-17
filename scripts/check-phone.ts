// Self-check (no network, no DB): npx tsx scripts/check-phone.ts
// Covers phone normalisation, the storage/lookup keys, the MSG91 request builder/response check
// and the WhatsApp auth-template payload.
import assert from "node:assert/strict";
import { normalizePhone, parsePhone, phoneLookupKeys, phoneStorageKey, toMsg91Mobile, toWaMeNumber } from "../src/lib/phone";
import { buildMsg91OtpRequest, describeMsg91Failure, isMsg91Success } from "../src/lib/msg91";
import { buildWhatsAppTemplatePayload, generateWhatsAppLink } from "../src/lib/whatsapp";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}

check("normalizePhone: Indian formats → +91", () => {
  for (const input of ["9876543210", "98765 43210", "098765-43210", "919876543210", "+91 98765 43210", "+919876543210", "0091 9876543210"]) {
    assert.equal(normalizePhone(input), "+919876543210", input);
  }
});

check("normalizePhone: explicit international numbers are kept, never prefixed with 91", () => {
  assert.equal(normalizePhone("+44 7700 900123"), "+447700900123");
  assert.equal(normalizePhone("0044 7700 900123"), "+447700900123");
  assert.equal(normalizePhone("+1 (415) 555-0100"), "+14155550100");
  assert.equal(normalizePhone("+971 50 123 4567"), "+971501234567");
  assert.equal(normalizePhone("447700900123"), "+447700900123"); // bare digits with country code (old behaviour)
  assert.equal(parsePhone("+44 7700 900123")?.isIndian, false);
});

check("normalizePhone: rejects junk", () => {
  for (const input of ["", "abc", "12345", "+91 12345", "+0 123456789", "+1234567890123456", null, undefined]) {
    assert.equal(normalizePhone(input), null, String(input));
  }
});

check("storage/lookup keys keep today's matching (10-digit Indian)", () => {
  assert.equal(phoneStorageKey("+91 98765 43210"), "9876543210");
  assert.equal(phoneStorageKey("9876543210"), "9876543210");
  assert.equal(phoneStorageKey("+44 7700 900123"), "447700900123");
  assert.deepEqual(phoneLookupKeys("9876543210"), ["9876543210"]);
  assert.deepEqual(phoneLookupKeys("+91 98765 43210"), ["9876543210", "919876543210"]);
  assert.deepEqual(phoneLookupKeys("+44 7700 900123"), ["447700900123"]);
});

check("sending formats", () => {
  assert.equal(toMsg91Mobile("+919876543210"), "919876543210");
  assert.equal(toWaMeNumber("9123456789"), "919123456789"); // Indian number starting with 91 keeps its country code
  assert.equal(toWaMeNumber("+44 7700 900123"), "447700900123");
  assert.equal(generateWhatsAppLink("+44 7700 900123", "hi"), "https://wa.me/447700900123?text=hi");
  assert.equal(generateWhatsAppLink("9876543210", "hi"), "https://wa.me/919876543210?text=hi");
});

check("MSG91 request: authkey in header only, v5 params in query", () => {
  const req = buildMsg91OtpRequest({ authKey: "SECRET-KEY-123", templateId: "tmpl_1", mobile: "919876543210", otp: "482913" });
  const url = new URL(req.url);
  assert.equal(`${url.origin}${url.pathname}`, "https://control.msg91.com/api/v5/otp");
  assert.equal(url.searchParams.get("template_id"), "tmpl_1");
  assert.equal(url.searchParams.get("mobile"), "919876543210");
  assert.equal(url.searchParams.get("otp"), "482913");
  assert.equal(url.searchParams.get("otp_expiry"), "5");
  assert.equal(url.searchParams.get("realTimeResponse"), "1");
  assert.equal(url.searchParams.has("authkey"), false);
  assert.ok(!req.url.includes("SECRET-KEY-123"));
  assert.equal(req.init.method, "POST");
  assert.equal(req.init.headers.authkey, "SECRET-KEY-123");
});

check("MSG91 response check", () => {
  assert.equal(isMsg91Success(200, { type: "success", request_id: "abc" }), true);
  assert.equal(isMsg91Success(200, {}), true);
  assert.equal(isMsg91Success(200, { type: "error", message: "Invalid template" }), false);
  assert.equal(isMsg91Success(200, { type: "success", code: "418" }), false);
  assert.equal(isMsg91Success(200, { code: "invalid_auth" }), false);
  assert.equal(isMsg91Success(401, { type: "success" }), false);
  assert.equal(isMsg91Success(500, null), false);
  const msg = describeMsg91Failure(401, { message: "authkey SECRET-KEY-123 is invalid", code: "401" }, "SECRET-KEY-123");
  assert.ok(!msg.includes("SECRET-KEY-123"), msg);
});

check("WhatsApp auth template payload (copy-code)", () => {
  const p = buildWhatsAppTemplatePayload("+919876543210", {
    template: "triq_login_code",
    language: "en",
    bodyParams: ["482913"],
    buttonParams: [{ subType: "url", index: 0, params: ["482913"] }],
  });
  assert.deepEqual(p, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "919876543210",
    type: "template",
    template: {
      name: "triq_login_code",
      language: { code: "en" },
      components: [
        { type: "body", parameters: [{ type: "text", text: "482913" }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "482913" }] },
      ],
    },
  });
});

console.log(`\nAll ${passed} checks passed.`);
