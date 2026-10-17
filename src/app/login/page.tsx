"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendOtp, verifyOtpAndLogin, registerWithEmail, loginWithEmail, loginWithGoogle } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Mail, Phone } from "lucide-react";
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { SportMotif } from "@/components/sport/SportMotif";
import type { SportKind } from "@/components/sport/sport-kind";

/** Login hero: six original sport scenes, each plays twice then rests. Phones show the first three. */
const HERO_SPORTS: SportKind[] = ["badminton", "cricket", "football", "tennis", "swimming", "basketball"];

export default function LoginPage() {
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
            setMessage("OTP sent via SMS!");
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

  const content = (
    <div className="min-h-screen bg-canvas text-ink font-sans flex flex-col lg:flex-row">
      {/* Hero */}
      <section className="relative overflow-hidden lg:w-[54%] lg:min-h-screen border-b lg:border-b-0 lg:border-r border-line/60 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 lg:px-14 lg:py-14 flex flex-col lg:justify-between">
        <span
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl opacity-60"
          style={{ background: "color-mix(in srgb, var(--brand) 16%, transparent)" }}
          aria-hidden
        />
        <div className="relative rise-in">
          <p className="font-heading text-[40px] lg:text-[88px] font-black leading-[0.85] tracking-tight">
            TRIQ<span className="brand-text">.</span>
          </p>
          <p className="mt-1.5 lg:mt-5 max-w-md text-[13px] lg:text-lg text-ink-muted">
            Attendance, fees, payroll and parent updates for your sports academy, in one place.
          </p>
        </div>
        <div className="relative mt-3 lg:mt-0 grid grid-cols-3 gap-2 lg:gap-3" aria-hidden>
          {HERO_SPORTS.map((s, i) => (
            <div
              key={s}
              className={`rise-in rounded-2xl lg:border lg:border-line/60 lg:bg-surface/30 lg:p-3 ${i >= 3 ? "hidden lg:block" : ""}`}
              style={{ "--i": i + 2 } as React.CSSProperties}
            >
              <SportMotif sport={s} loops={2} className="w-full h-auto max-h-12 lg:max-h-none" />
            </div>
          ))}
        </div>
        <p className="relative hidden lg:block text-xs text-ink-subtle">Built for badminton, cricket, football, tennis, swimming, basketball and more.</p>
      </section>

      <section className="flex-1 flex items-start lg:items-center justify-center p-4 lg:p-10">
      <div className="w-full max-w-sm space-y-6 sm:space-y-7 bg-surface/50 p-5 sm:p-8 rounded-3xl border border-line/60 shadow-[0_24px_60px_-30px_rgb(var(--shadow-rgb)/0.6)] relative">

        <div className="space-y-1 relative z-10">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">
            {mode === "SIGN_IN" ? "Welcome back" : "Start your academy"}
          </h1>
          <p className="text-ink-muted text-sm">
            {mode === "SIGN_IN" ? "Sign in to your workspace" : "Create a new Academy Workspace"}
          </p>
        </div>

        {step === 1 && (
          <div className="flex bg-canvas p-1 rounded-xl border border-line">
            <button type="button" onClick={() => { setMode("SIGN_IN"); resetState(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === "SIGN_IN" ? "bg-zinc-800 text-ink shadow" : "text-ink-subtle hover:text-zinc-300"}`}>
              Sign In
            </button>
            <button type="button" onClick={() => { setMode("REGISTER"); setMethod("EMAIL"); resetState(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === "REGISTER" ? "bg-zinc-800 text-ink shadow" : "text-ink-subtle hover:text-zinc-300"}`}>
              Register
            </button>
          </div>
        )}

        {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm text-center font-medium">{error}</div>}
        {message && <div className="bg-lime-500/10 border border-lime-500/20 text-volt p-3 rounded-xl text-sm text-center font-medium">{message}</div>}

        {step === 1 ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* GOOGLE SSO BUTTON */}
            {(method === "EMAIL" || mode === "REGISTER") && (
              <div className="flex flex-col items-center justify-center border-b border-line/50 pb-6">
                {googleClientId ? (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("Google Login Failed")}
                    theme="filled_black"
                    shape="circle"
                    width="100%"
                    text={mode === "REGISTER" ? "signup_with" : "signin_with"}
                  />
                ) : process.env.NODE_ENV !== "production" ? (
                  <button 
                    type="button" 
                    onClick={() => handleGoogleSuccess({})}
                    disabled={loading}
                    className="w-full bg-[#fff] text-[#000] hover:bg-gray-100 flex items-center justify-center py-2.5 rounded-full font-medium text-sm transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google (Mock Mode)
                  </button>
                ) : null}
                <div className="text-xs text-zinc-600 font-bold uppercase tracking-widest mt-6">Or use email</div>
              </div>
            )}

            <form onSubmit={handleAction} className="space-y-4">
              
              {mode === "REGISTER" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider pl-1">Your Name</label>
                  <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. John Doe" className="bg-surface border-line text-ink h-12" />
                </div>
              )}

              {method === "EMAIL" || mode === "REGISTER" ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider pl-1">Email Address</label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@academy.com" className="bg-surface border-line text-ink h-12" />
                  </div>
                  {mode === "REGISTER" && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider pl-1">Phone Number</label>
                      <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="e.g. 9999999999" className="bg-surface border-line text-ink h-12" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider pl-1">Password</label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} className="bg-surface border-line text-ink h-12" />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider pl-1">Phone Number</label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="e.g. 9999999999" className="bg-surface border-line text-ink h-12" />
                  <p className="text-[11px] text-ink-subtle pl-1">Coach or parent? Your academy admin can send you a one-tap login link on WhatsApp.</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="press w-full h-12 text-base bg-volt text-volt-fg hover:bg-lime-500 font-bold mt-4">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === "REGISTER" ? "Create Account" : (method === "EMAIL" ? "Sign In" : "Send OTP"))}
              </Button>

              {mode === "SIGN_IN" && (
                <div className="pt-4 flex items-center justify-center">
                  <button type="button" onClick={() => { setMethod(method === "EMAIL" ? "PHONE" : "EMAIL"); resetState(); }} className="text-xs text-ink-muted hover:text-ink flex items-center transition-colors">
                    {method === "EMAIL" ? <><Phone className="w-3 h-3 mr-1.5" /> Sign in with Phone Number</> : <><Mail className="w-3 h-3 mr-1.5" /> Sign in with Email / Password</>}
                  </button>
                </div>
              )}
            </form>
          </div>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider pl-1">OTP Code</label>
              <Input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="••••••" maxLength={6} required className="bg-surface border-line text-ink h-14 text-2xl tracking-[0.5em] text-center font-mono focus-visible:ring-volt" />
            </div>
            <Button type="submit" disabled={loading || otp.length < 6} className="press w-full h-12 text-base bg-volt text-volt-fg hover:bg-lime-500 font-bold mt-4">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Login"}
            </Button>
            <button type="button" onClick={() => { setStep(1); setOtp(""); setError(null); setMessage(null); }} className="w-full flex items-center justify-center text-xs font-medium text-ink-subtle hover:text-zinc-300 py-2 mt-2 transition-colors">
              <ArrowLeft className="w-3 h-3 mr-1.5" /> Change Phone Number
            </button>
          </form>
        )}
      </div>
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
