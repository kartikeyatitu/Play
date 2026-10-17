"use server";

import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import twilio from "twilio";
import { OAuth2Client } from "google-auth-library";
import { rateLimitDb } from "@/lib/rate-limit";
import crypto from "crypto";
import { setSessionCookie, getSession, revokeAllSessions } from "@/lib/auth";
import { parsePhone, phoneLookupKeys, toMsg91Mobile } from "@/lib/phone";
import { buildMsg91OtpRequest, describeMsg91Failure, isMsg91Success } from "@/lib/msg91";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

// Not exported: "use server" files may only export async functions.
const SMS_UNAVAILABLE_MESSAGE = "SMS login isn't available yet. Ask your academy admin for your one-tap login link.";
const INVALID_PHONE_MESSAGE = "Please enter a valid 10-digit mobile number (or +country code for numbers outside India).";

// ==========================================
// 1. PHONE OTP FLOW
// Channels, in order:
//   1. WhatsApp authentication template (copy-code button), when WHATSAPP_* auth env is configured.
//   2. SMS fallback: MSG91 for +91 numbers (DLT-registered template), Twilio for non-Indian numbers only
//      (raw Twilio SMS to India needs DLT and its international route randomises the sender).
//   Allowlisted test numbers skip sending entirely.
// Without any usable channel we say so honestly instead of pretending a code went out.
//
// Users stay stored/matched by today's keys (10 digits for Indian numbers, see src/lib/phone.ts);
// only the *sending* format is E.164 / "91XXXXXXXXXX".
// ==========================================
const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");

type OtpChannel = "whatsapp" | "sms";

/** Test numbers (demo / QA only): OTP_TEST_PHONES="9000000001,9000000002" + OTP_TEST_CODE="123456". Both must be set. */
function isTestPhone(cleanPhone: string): boolean {
  const code = process.env.OTP_TEST_CODE;
  const list = (process.env.OTP_TEST_PHONES || "").split(",").map((s) => s.replace(/\D/g, "").slice(-10)).filter(Boolean);
  return !!code && /^\d{4,8}$/.test(code) && list.includes(cleanPhone.slice(-10));
}

const msg91Configured = () => !!(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID);
const twilioConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
const whatsAppAuthConfigured = () =>
  !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_AUTH_TEMPLATE_NAME);
/** The SMS provider allowed for this number: MSG91 for India, Twilio for everyone else. */
const smsProviderFor = (isIndian: boolean): "msg91" | "twilio" | null =>
  isIndian ? (msg91Configured() ? "msg91" : null) : twilioConfigured() ? "twilio" : null;

/** Throws on failure (message is secret-free). */
async function sendViaMsg91(e164: string, otp: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) throw new Error("MSG91 is not configured");
  const req = buildMsg91OtpRequest({ authKey, templateId, mobile: toMsg91Mobile(e164), otp, expiryMinutes: 5 });
  let res: Response;
  try {
    res = await fetch(req.url, { ...req.init, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error("Could not reach MSG91");
  }
  const body: unknown = await res.json().catch(() => ({}));
  if (!isMsg91Success(res.status, body)) throw new Error(describeMsg91Failure(res.status, body, authKey));
}

/** Non-Indian numbers only. Throws on failure. */
async function sendViaTwilio(e164: string, otp: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  if (!(accountSid && authToken && twilioPhone)) throw new Error("Twilio is not configured");
  const client = twilio(accountSid, authToken);
  try {
    await client.messages.create({ body: `Your Triq login code is: ${otp}. Valid for 5 minutes.`, from: twilioPhone, to: e164 });
  } catch (e: any) {
    throw new Error(`Twilio send failed${e?.code ? ` (code ${e.code})` : ""}`);
  }
}

/**
 * WhatsApp authentication template with a copy-code button. Meta's format: the code goes in the
 * body parameter AND as the url-button (index 0) parameter.
 */
async function sendViaWhatsAppAuth(e164: string, otp: string): Promise<{ ok: boolean; error?: string }> {
  const template = process.env.WHATSAPP_AUTH_TEMPLATE_NAME;
  if (!template) return { ok: false, error: "WhatsApp auth template not configured" };
  return sendWhatsAppTemplate({
    to: e164,
    template,
    language: "en",
    bodyParams: [otp],
    buttonParams: [{ subType: "url", index: 0, params: [otp] }],
  });
}

async function sendViaSms(e164: string, isIndian: boolean, otp: string): Promise<void> {
  const provider = smsProviderFor(isIndian);
  if (provider === "msg91") return sendViaMsg91(e164, otp);
  if (provider === "twilio") return sendViaTwilio(e164, otp);
  throw new Error("No SMS provider for this number");
}

/** Matches today's storage: canonical key first, then the legacy "all digits typed" key. */
async function findUserByPhoneInput(phone: string) {
  for (const key of phoneLookupKeys(phone)) {
    const user = await db.user.findUnique({ where: { phone: key } });
    if (user) return user;
  }
  return null;
}

export async function sendOtp(phone: string) {
  const parsed = parsePhone(phone);
  const lookupKey = phoneLookupKeys(phone)[0];
  if (!parsed || !lookupKey) return { error: INVALID_PHONE_MESSAGE };

  // Per-phone throttle (persistent across serverless instances)
  const { allowed } = await rateLimitDb(`otp:${lookupKey}`, 3, 60_000);
  if (!allowed) return { error: "Too many OTP requests. Please wait 1 minute." };

  const user = await findUserByPhoneInput(phone);
  if (!user?.phone) return { error: "Account not found. Ask your Academy Admin to add you first!" };
  // Codes are stored under the user's stored phone so verification matches the same account.
  const cleanPhone = user.phone;

  const testMode = isTestPhone(cleanPhone);
  const whatsApp = whatsAppAuthConfigured();
  const smsProvider = smsProviderFor(parsed.isIndian);
  if (!testMode && !whatsApp && !smsProvider) {
    console.log(`\n⚠️ No OTP channel configured for ${parsed.isIndian ? "Indian" : "international"} numbers. Phone login unavailable.\n`);
    return { error: SMS_UNAVAILABLE_MESSAGE, smsUnavailable: true };
  }

  const otp = testMode ? String(process.env.OTP_TEST_CODE) : crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  // Older codes for this phone are superseded; the code itself is stored hashed.
  await db.verificationToken.deleteMany({ where: { phone: cleanPhone } });
  await db.verificationToken.create({ data: { phone: cleanPhone, token: hashOtp(otp), expiresAt } });

  if (testMode) return { success: true, smsSent: true, testMode: true };

  let channel: OtpChannel | null = null;
  if (whatsApp) {
    const wa = await sendViaWhatsAppAuth(parsed.e164, otp);
    if (wa.ok) channel = "whatsapp";
    else console.warn("OTP WhatsApp failed, falling back to SMS:", wa.error);
  }
  if (!channel) {
    if (!smsProvider) return { error: "Couldn't send the code on WhatsApp. Please try again in a minute." };
    try {
      await sendViaSms(parsed.e164, parsed.isIndian, otp);
      channel = "sms";
    } catch (error) {
      console.error("OTP SMS failed:", error instanceof Error ? error.message : "unknown error");
      return { error: "Failed to send SMS. Please try again in a minute." };
    }
  }

  // smsSent is kept for existing callers: it means "a code was sent" on either channel.
  return { success: true, smsSent: true, channel };
}

const MAX_OTP_ATTEMPTS = 5;

export async function verifyOtpAndLogin(phone: string, otp: string) {
  if (!phone || !otp) return { error: "Missing fields" };
  const lookupKey = phoneLookupKeys(phone)[0];
  if (!lookupKey) return { error: "Invalid or expired OTP." };
  const guess = String(otp).trim();

  // A 6-digit code has only 1M values, so unlimited guessing is feasible: limit per phone (persistent)
  // and cap wrong attempts per code below.
  const phoneLimit = await rateLimitDb(`otp-verify:${lookupKey}`, 10, 5 * 60_000);
  if (!phoneLimit.allowed) return { error: "Too many attempts. Please wait a few minutes and request a new code." };

  // sendOtp stores the code under the matched user's stored phone; resolve it the same way.
  const user = await findUserByPhoneInput(phone);
  const cleanPhone = user?.phone || lookupKey;

  const latest = await db.verificationToken.findFirst({
    where: { phone: cleanPhone, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest) return { error: "Invalid or expired OTP." };

  if (latest.attempts >= MAX_OTP_ATTEMPTS) {
    await db.verificationToken.deleteMany({ where: { phone: cleanPhone } });
    return { error: "Too many wrong attempts. Please request a new code." };
  }

  const a = Buffer.from(latest.token);
  const b = Buffer.from(hashOtp(guess));
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!matches) {
    await db.verificationToken.update({ where: { id: latest.id }, data: { attempts: { increment: 1 } } });
    return { error: "Invalid or expired OTP." };
  }

  // One-time use: delete every code for this phone before logging in.
  await db.verificationToken.deleteMany({ where: { phone: cleanPhone } });

  if (!user) return { error: "Account not found. Please ask your academy admin to add you as a coach first." };

  await setSession(user.id, user.role);
  return { success: true, role: user.role };
}


// ==========================================
// 2. GOOGLE SSO FLOW (MODERN B2B)
// ==========================================
const googleClient = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export async function loginWithGoogle(credential: string) {
  try {
    // Without a client ID we cannot verify the Google credential. Never fall back to
    // signing in as some existing admin (that would hand out another academy's account).
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      console.log("\n⚠️ Google SSO not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID missing).\n");
      return { error: "Google sign-in isn't configured yet. Please use email & password." };
    }

    // REAL GOOGLE VERIFICATION
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return { error: "Invalid Google Account." };
    if (payload.email_verified === false) return { error: "Please verify your Google email first." };

    const email = payload.email.toLowerCase();
    
    // Find or Create User
    let user = await db.user.findUnique({ where: { email } });

    if (!user) {
      // First time signing in! User has no organization yet.
      user = await db.user.create({
        data: {
          name: payload.name || "Academy Admin",
          email: email,
          role: "ADMIN",
          orgId: null
        }
      });
    }

    await setSession(user.id, user.role);
    return { success: true, role: user.role, hasOrg: !!user.orgId };

  } catch (error) {
    console.error("Google Auth Error:", error);
    return { error: "Authentication failed." };
  }
}


// ==========================================
// 3. LEGACY EMAIL & PASSWORD FLOW (FALLBACK)
// ==========================================
export async function registerWithEmail(name: string, email: string, phone: string, pass: string) {
  if (!name || name.trim().length < 2) return { error: "Please enter a valid name (at least 2 characters)." };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) return { error: "Please enter a valid email address." };
  if (!pass || pass.length < 6) return { error: "Password must be at least 6 characters long." };
  
  const cleanEmail = email.toLowerCase().trim();
  const cleanPhone = phone && phone.replace(/\D/g, '').length >= 10 ? phone.replace(/\D/g, '') : null;
  
  if (await db.user.findUnique({ where: { email: cleanEmail } })) {
    return { error: "Email already registered. Please sign in instead." };
  }
  if (cleanPhone && (await db.user.findUnique({ where: { phone: cleanPhone } }))) {
    return { error: "Phone number already registered. Please sign in or use another number." };
  }

  const password = await bcrypt.hash(pass, 10);
  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password,
      role: "ADMIN",
      orgId: null
    }
  });

  await setSession(user.id, user.role);
  return { success: true, role: user.role, hasOrg: false };
}

export async function loginWithEmail(email: string, pass: string) {
  if (!email || !pass) return { error: "Please provide both email and password." };
  const cleanEmail = email.toLowerCase().trim();

  const { allowed } = await rateLimitDb(`login:${cleanEmail}`, 5, 60_000);
  if (!allowed) return { error: "Too many login attempts. Please wait 1 minute." };

  const user = await db.user.findUnique({ where: { email: cleanEmail } });
  if (!user || !user.password) return { error: "Invalid email or password." };

  const isValid = await bcrypt.compare(pass, user.password);
  if (!isValid) return { error: "Invalid email or password." };

  await setSession(user.id, user.role);
  return { success: true, role: user.role, hasOrg: !!user.orgId };
}

// ==========================================
// HELPERS
// ==========================================
async function setSession(id: string, role: string) {
  await setSessionCookie(id, role);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("sportsos_session");
  redirect("/login");
}

/** Signs the current user out of every device (invalidates all existing session cookies). */
export async function logoutEverywhere() {
  const session = await getSession();
  if (session?.id) await revokeAllSessions(session.id);
  const cookieStore = await cookies();
  cookieStore.delete("sportsos_session");
  redirect("/login");
}
