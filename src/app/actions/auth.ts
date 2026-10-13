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

// Not exported: "use server" files may only export async functions.
const SMS_UNAVAILABLE_MESSAGE = "SMS login isn't available yet. Ask your academy admin for your one-tap login link.";

// ==========================================
// 1. PHONE OTP FLOW
// Providers (first configured wins): MSG91 → Twilio → allowlisted test numbers.
// Without any of them we say so honestly instead of pretending an SMS went out.
// ==========================================
const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");

/** Test numbers (demo / QA only): OTP_TEST_PHONES="9000000001,9000000002" + OTP_TEST_CODE="123456". Both must be set. */
function isTestPhone(cleanPhone: string): boolean {
  const code = process.env.OTP_TEST_CODE;
  const list = (process.env.OTP_TEST_PHONES || "").split(",").map((s) => s.replace(/\D/g, "").slice(-10)).filter(Boolean);
  return !!code && /^\d{4,8}$/.test(code) && list.includes(cleanPhone.slice(-10));
}

async function sendViaMsg91(cleanPhone: string, otp: string): Promise<boolean> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) return false;
  const mobile = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(templateId)}&mobile=${mobile}&authkey=${encodeURIComponent(authKey)}&otp=${otp}&otp_expiry=5`;
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body?.type === "error") throw new Error(`MSG91 error: ${JSON.stringify(body)}`);
  return true;
}

async function sendViaTwilio(cleanPhone: string, otp: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  if (!(accountSid && authToken && twilioPhone)) return false;
  const client = twilio(accountSid, authToken);
  const formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
  await client.messages.create({ body: `Your Triq login code is: ${otp}. Valid for 5 minutes.`, from: twilioPhone, to: formattedPhone });
  return true;
}

export async function sendOtp(phone: string) {
  if (!phone || phone.replace(/\D/g, '').length < 10) return { error: "Please enter a valid 10-digit phone number." };
  const cleanPhone = phone.replace(/\D/g, '');

  // Per-phone throttle (persistent across serverless instances)
  const { allowed } = await rateLimitDb(`otp:${cleanPhone}`, 3, 60_000);
  if (!allowed) return { error: "Too many OTP requests. Please wait 1 minute." };

  const user = await db.user.findUnique({ where: { phone: cleanPhone } });
  if (!user) return { error: "Account not found. Ask your Academy Admin to add you first!" };

  const testMode = isTestPhone(cleanPhone);
  const smsConfigured = !!(
    (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) ||
    (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
  );
  if (!testMode && !smsConfigured) {
    console.log(`\n⚠️ No SMS provider configured. SMS login unavailable for ${cleanPhone}.\n`);
    return { error: SMS_UNAVAILABLE_MESSAGE, smsUnavailable: true };
  }

  const otp = testMode ? String(process.env.OTP_TEST_CODE) : crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  // Older codes for this phone are superseded; the code itself is stored hashed.
  await db.verificationToken.deleteMany({ where: { phone: cleanPhone } });
  await db.verificationToken.create({ data: { phone: cleanPhone, token: hashOtp(otp), expiresAt } });

  if (testMode) return { success: true, smsSent: true, testMode: true };

  try {
    const sent = (await sendViaMsg91(cleanPhone, otp)) || (await sendViaTwilio(cleanPhone, otp));
    if (!sent) return { error: SMS_UNAVAILABLE_MESSAGE, smsUnavailable: true };
  } catch (error) {
    console.error("OTP SMS failed:", error);
    return { error: "Failed to send SMS. Please try again in a minute." };
  }

  return { success: true, smsSent: true };
}

const MAX_OTP_ATTEMPTS = 5;

export async function verifyOtpAndLogin(phone: string, otp: string) {
  if (!phone || !otp) return { error: "Missing fields" };
  const cleanPhone = phone.replace(/\D/g, '');
  const guess = String(otp).trim();

  // A 6-digit code has only 1M values, so unlimited guessing is feasible: limit per phone (persistent)
  // and cap wrong attempts per code below.
  const phoneLimit = await rateLimitDb(`otp-verify:${cleanPhone}`, 10, 5 * 60_000);
  if (!phoneLimit.allowed) return { error: "Too many attempts. Please wait a few minutes and request a new code." };

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

  const user = await db.user.findUnique({ where: { phone: cleanPhone } });
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
