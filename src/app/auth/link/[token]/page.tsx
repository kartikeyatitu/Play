import Link from "next/link";
import { inspectLoginLink, redeemLoginLink } from "@/app/actions/login-links";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Triq", robots: { index: false, follow: false } };

/**
 * One-tap login link landing page.
 * Opening the link does NOT consume it (WhatsApp/Telegram link previews fetch URLs);
 * the user taps "Continue" which submits a server action that marks the token used
 * and sets the session cookie.
 */
export default async function LoginLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await inspectLoginLink(token);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 text-zinc-50">
      <div className="w-full max-w-sm bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 space-y-6 text-center">
        <h1 className="text-3xl font-black italic tracking-tight text-lime-400">TRIQ</h1>
        {info.valid ? (
          <>
            <div className="space-y-1">
              <p className="text-lg font-semibold">Hi {info.name} 👋</p>
              <p className="text-sm text-zinc-400">
                Sign in{info.academyName ? <> to <span className="text-zinc-200">{info.academyName}</span></> : null} as{" "}
                {info.role === "COACH" ? "coach" : info.role === "PARENT" ? "parent" : "admin"}.
              </p>
            </div>
            <form action={redeemLoginLink}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-lime-400 text-zinc-950 font-bold hover:bg-lime-500 transition-colors"
              >
                Continue
              </button>
            </form>
            <p className="text-[11px] text-zinc-500">This link works once and expires 7 days after it was sent.</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">
              {info.reason === "used" ? "This link has already been used" : info.reason === "expired" ? "This link has expired" : "This link isn't valid"}
            </p>
            <p className="text-sm text-zinc-400">Ask your academy admin to send you a new login link on WhatsApp.</p>
            <Link href="/login" className="inline-block text-sm text-lime-400 hover:underline">Go to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
