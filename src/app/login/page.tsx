"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendOtp, verifyOtpAndLogin, registerWithEmail, loginWithEmail, loginWithGoogle } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Mail, Phone } from "lucide-react";
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { TriqWordmark } from "@/components/ui/triq-logo";
import { Bar, Ring } from "@/components/ui/meter";
import { PaidBadge } from "@/components/ui/status-mark";
import { SportGlyph } from "@/components/sport/SportGlyph";

export default function LoginPage() {
  // Google's button has its own light/dark artwork; match the app theme.
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.getAttribute("data-theme") === "dark"), []);

  const [mode, setMode] = useState<"SIGN_IN" | "REGISTER">("SIGN_IN");
  const [method, setMethod] = useState<"EMAIL" | "PHONE">("EMAIL");
  const [step, setStep] = useState<1 | 2>(1);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { verifyOtpAndLogin } = await import('@/app/actions/auth');
      const res = await verifyOtpAndLogin(phone, otp);
      if (res?.error) setError(res.error);
      else if (res?.success) {
        if(res.role==="ADMIN") window.location.href = "/org";
        else if(res.role==="COACH") window.location.href = "/coach";
        else if(res.role==="STAFF") window.location.href = "/staff";
        else window.location.href = "/parent";
      }
    } catch (err) {
      setError("Failed to verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  
  const router = useRouter();

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  function resetState() {
    setStep(1);
    setError(null);
    setMessage(null);
  }

  async function handleGoogleSuccess(credentialResponse: any) {
    setLoading(true);
    setError(null);
    try {
      const res = await loginWithGoogle(credentialResponse.credential || "MOCK_CREDENTIAL");
      if (res?.error) setError(res.error);
      else if (res?.success) {
        if (res.role === "ADMIN") router.push(res.hasOrg ? "/org" : "/onboarding");
        else if (res.role === "COACH") router.push("/coach");
        else if (res.role === "STAFF") router.push("/staff");
        else router.push("/parent");
      }
    } catch (err) {
      setError("Google authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      if (mode === "REGISTER") {
        if (method === "EMAIL") {
          const res = await registerWithEmail(name, email, phone, password);
          if (res?.error) setError(res.error);
          else if (res?.success) router.push("/onboarding");
        }
      } else {
        if (method === "EMAIL") {
          const res = await loginWithEmail(email, password);
          if (res?.error) setError(res.error);
          else if (res?.success) {
            if (res.role === "ADMIN") router.push(res.hasOrg ? "/org" : "/onboarding");
            else if (res.role === "COACH") router.push("/coach");
        else if (res.role === "STAFF") router.push("/staff");
            else router.push("/parent");
          }
        } else if (method === "PHONE") {
          const res = await sendOtp(phone);
          if (res?.error) setError(res.error);
          else if (res?.smsSent) {
            setMessage(res.channel === "whatsapp" ? "OTP sent on WhatsApp!" : "OTP sent via SMS!");
            setStep(2);
          }
        }
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  const label = "block text-[13px] font-medium text-ink-muted";
  const field = "bg-surface border-line text-ink h-11 rounded-lg placeholder:text-ink-subtle/70 focus-visible:ring-volt/30";
  const submitCls = "press w-full h-11 rounded-lg text-sm font-medium bg-volt text-volt-fg hover:bg-lime-500";

  const content = (
    <div className="min-h-screen bg-canvas text-ink font-sans flex flex-col lg:flex-row">
      {/* Product side (desktop only) */}
      <aside className="relative hidden lg:flex lg:w-[52%] xl:w-[55%] min-h-screen flex-col justify-between overflow-hidden border-r border-line bg-surface-2 px-14 py-12">
        <span
          className="bg-grid pointer-events-none absolute inset-0"
          style={{ maskImage: "radial-gradient(70% 60% at 60% 55%, #000 30%, transparent 100%)", WebkitMaskImage: "radial-gradient(70% 60% at 60% 55%, #000 30%, transparent 100%)" }}
          aria-hidden
        />
        <TriqWordmark className="relative" />
        <div className="relative max-w-[520px]">
          <h2 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">
            Run your academy
            <br />
            from one screen.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">
            Attendance, fees, payroll and parent updates for sports academies, in one place.
          </p>
          <ProductPreview />
        </div>
        <p className="relative text-[13px] text-ink-subtle">Built for badminton, cricket, football, tennis and swimming academies.</p>
      </aside>

      {/* Form side */}
      <section className="flex-1 flex flex-col items-center justify-start lg:justify-center px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10 lg:p-10">
        <div className="w-full max-w-[400px] lg:hidden mb-8">
          <TriqWordmark />
          <p className="mt-3 text-sm text-ink-muted">Attendance, fees, payroll and parent updates for your sports academy.</p>
        </div>

        <div className="w-full max-w-[400px] space-y-6 rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-[0_1px_2px_rgb(var(--shadow-rgb)/0.04),0_12px_32px_-16px_rgb(var(--shadow-rgb)/0.12)]">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">
              {mode === "SIGN_IN" ? "Sign in to Triq" : "Create your academy"}
            </h1>
            <p className="text-ink-muted text-sm">
              {mode === "SIGN_IN" ? "Welcome back. Pick up where you left off." : "Set up your academy workspace in a few minutes."}
            </p>
          </div>

          {step === 1 && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 border border-line">
              <button type="button" onClick={() => { setMode("SIGN_IN"); resetState(); }}
                className={`h-9 text-sm font-medium rounded-md transition-colors ${mode === "SIGN_IN" ? "bg-surface text-ink shadow-[0_1px_2px_rgb(var(--shadow-rgb)/0.08)] border border-line" : "text-ink-muted hover:text-ink"}`}>
                Sign In
              </button>
              <button type="button" onClick={() => { setMode("REGISTER"); setMethod("EMAIL"); resetState(); }}
                className={`h-9 text-sm font-medium rounded-md transition-colors ${mode === "REGISTER" ? "bg-surface text-ink shadow-[0_1px_2px_rgb(var(--shadow-rgb)/0.08)] border border-line" : "text-ink-muted hover:text-ink"}`}>
                Register
              </button>
            </div>
          )}

          {error && <div className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-400" role="alert">{error}</div>}
          {message && <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2.5 text-sm text-emerald-400" role="status">{message}</div>}

          {step === 1 ? (
            <div className="space-y-5 animate-in fade-in duration-200">

              {/* GOOGLE SSO BUTTON */}
              {(method === "EMAIL" || mode === "REGISTER") && (
                <div className="space-y-5">
                  {googleClientId ? (
                    <div className="flex justify-center">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError("Google Login Failed")}
                        theme={dark ? "filled_black" : "outline"}
                        shape="rectangular"
                        width="336"
                        text={mode === "REGISTER" ? "signup_with" : "signin_with"}
                      />
                    </div>
                  ) : process.env.NODE_ENV !== "production" ? (
                    <button
                      type="button"
                      onClick={() => handleGoogleSuccess({})}
                      disabled={loading}
                      className="press w-full h-11 rounded-lg border border-line bg-surface text-ink hover:bg-surface-2 flex items-center justify-center text-sm font-medium"
                    >
                      <svg className="w-[18px] h-[18px] mr-2.5" viewBox="0 0 24 24" aria-hidden>
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Continue with Google (Mock Mode)
                    </button>
                  ) : null}
                  <div className="flex items-center gap-3 text-[12px] text-ink-subtle" aria-hidden>
                    <span className="h-px flex-1 bg-line" />
                    or with email
                    <span className="h-px flex-1 bg-line" />
                  </div>
                </div>
              )}

              <form onSubmit={handleAction} className="space-y-4">

                {mode === "REGISTER" && (
                  <div className="space-y-1.5">
                    <label className={label} htmlFor="login-name">Your name</label>
                    <Input id="login-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Rohan Mehta" className={field} />
                  </div>
                )}

                {method === "EMAIL" || mode === "REGISTER" ? (
                  <>
                    <div className="space-y-1.5">
                      <label className={label} htmlFor="login-email">Email</label>
                      <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@academy.com" className={field} />
                    </div>
                    {mode === "REGISTER" && (
                      <div className="space-y-1.5">
                        <label className={label} htmlFor="login-reg-phone">Phone number</label>
                        <Input id="login-reg-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="10-digit mobile number" className={field} />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className={label} htmlFor="login-password">Password</label>
                      <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="At least 6 characters" minLength={6} className={field} />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label className={label} htmlFor="login-phone">Mobile number</label>
                    <Input id="login-phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="10-digit mobile number" className={field} />
                    <p className="text-[12px] text-ink-subtle">Coach or parent? Your academy admin can send you a one-tap login link on WhatsApp.</p>
                  </div>
                )}

                <Button type="submit" disabled={loading} className={`${submitCls} mt-2`}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === "REGISTER" ? "Create Account" : (method === "EMAIL" ? "Sign In" : "Send OTP"))}
                </Button>

                {mode === "SIGN_IN" && (
                  <div className="pt-1 flex items-center justify-center">
                    <button type="button" onClick={() => { setMethod(method === "EMAIL" ? "PHONE" : "EMAIL"); resetState(); }} className="h-9 px-2 text-[13px] font-medium text-ink-muted hover:text-ink flex items-center transition-colors">
                      {method === "EMAIL" ? <><Phone className="w-3.5 h-3.5 mr-1.5" /> Sign in with Phone Number</> : <><Mail className="w-3.5 h-3.5 mr-1.5" /> Sign in with Email / Password</>}
                    </button>
                  </div>
                )}
              </form>
            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <label className={label} htmlFor="login-otp">6-digit code sent to {phone || "your phone"}</label>
                <Input id="login-otp" type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" maxLength={6} required className={`${field} h-12 text-xl tracking-[0.4em] text-center tabular-nums`} />
              </div>
              <Button type="submit" disabled={loading || otp.length < 6} className={`${submitCls} mt-2`}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Login"}
              </Button>
              <button type="button" onClick={() => { setStep(1); setOtp(""); setError(null); setMessage(null); }} className="w-full h-9 flex items-center justify-center text-[13px] font-medium text-ink-muted hover:text-ink transition-colors">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Change Phone Number
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 max-w-[400px] text-center text-[12px] text-ink-subtle">
          By continuing you agree to the <a href="/terms" className="underline underline-offset-2 hover:text-ink">Terms</a> and <a href="/privacy" className="underline underline-offset-2 hover:text-ink">Privacy Policy</a>.
        </p>
      </section>
    </div>
  );

  if (!googleClientId) return content;

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {content}
    </GoogleOAuthProvider>
  );
}

/**
 * Desktop-only preview of the product, built from the same primitives as the app
 * (cards, tabular numbers, a ring, a bar, a Paid badge). Illustrative figures.
 */
function ProductPreview() {
  return (
    <div className="mt-10 space-y-3 select-none" aria-hidden>
      <div className="rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(var(--shadow-rgb)/0.04),0_16px_40px_-24px_rgb(var(--shadow-rgb)/0.18)]">
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-[13px] font-medium text-ink">Today</span>
          <span className="text-[12px] text-ink-subtle">Saturday, 17 October</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line">
          <div className="p-5">
            <p className="text-[12px] font-medium text-ink-muted">Collected today</p>
            <p className="num mt-2 text-[26px] font-semibold leading-none text-ink">₹18,400</p>
            <p className="mt-2 text-[12px] text-ink-subtle">6 payments</p>
          </div>
          <div className="p-5">
            <p className="text-[12px] font-medium text-ink-muted">Pending dues</p>
            <p className="num mt-2 text-[26px] font-semibold leading-none text-ink">₹42,500</p>
            <Bar value={78} tone="success" className="mt-3" />
            <p className="mt-2 text-[12px] text-ink-subtle">October: 78% collected</p>
          </div>
          <div className="p-5 flex items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-medium text-ink-muted">Attendance</p>
              <p className="num mt-2 text-[26px] font-semibold leading-none text-ink">92%</p>
              <p className="mt-2 text-[12px] text-ink-subtle">46 of 50 present</p>
            </div>
            <Ring value={92} tone="success" size={40} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1.25fr_1fr] gap-3">
        <div className="rounded-xl border border-line bg-surface divide-y divide-line">
          {[
            { name: "U-14 Cricket", time: "5:00 PM", sport: "cricket" as const, status: "24/26 present" },
            { name: "Advanced Badminton", time: "6:30 PM", sport: "badminton" as const, status: "Not marked" },
          ].map((s) => (
            <div key={s.name} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted">
                <SportGlyph sport={s.sport} className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{s.name}</span>
                <span className="block text-[12px] text-ink-subtle tabular-nums">{s.time} · {s.status}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-muted">RV</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-ink">Rahul Verma</span>
              <span className="block text-[12px] text-ink-subtle">Head coach</span>
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="num text-base font-semibold text-ink">₹28,000</span>
            <PaidBadge>Paid</PaidBadge>
          </div>
        </div>
      </div>
    </div>
  );
}
