import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Triq",
  description: "Terms of Service governing the use of Triq Sports Academy OS.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8 bg-zinc-900/60 p-6 sm:p-10 rounded-2xl border border-zinc-800">
        <header className="border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center text-xs">T</span>
            <span className="text-xl font-bold tracking-tight text-zinc-100">Triq</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 mt-4">Terms of Service</h1>
          <p className="text-xs text-zinc-400 mt-1">Effective Date: October 2026</p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">1. Agreement to Terms</h2>
          <p>
            By accessing or using the Triq platform (&quot;Service&quot;) available via web or mobile application, you agree to be bound by these Terms. If you represent a sports academy, club, or coaching business, you affirm you hold the authority to bind such entity.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">2. Software as a Service (SaaS)</h2>
          <p>
            Triq provides software tools for academy scheduling, attendance tracking, and parent communication. Triq is not an athletic trainer, sports club, or guarantor of physical safety on the sporting ground. Physical sports activities are carried out solely under the supervision and discretion of the registered academy and coaches.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">3. Fee Collections & Payments</h2>
          <p>
            Coaching fees and subscription dues between parents and academies are settled directly via peer-to-peer or peer-to-merchant Unified Payments Interface (UPI). Triq provides the tracking ledger and direct deep-linking software; Triq does not hold escrow funds or intermediate the banking transfer.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">4. User Conduct & Accounts</h2>
          <p>
            Users agree not to input fraudulent student records, impersonate coaches, or misuse the messaging/reminder features for unsolicited commercial communication. We reserve the right to suspend accounts violating these standards.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">5. Limitation of Liability</h2>
          <p>
            In no event shall Triq or its developers be liable for direct, indirect, incidental, or consequential damages resulting from sports injuries sustained during athletic practice, ground disputes, or unauthorized third-party access to individual mobile devices.
          </p>
        </section>

        <footer className="pt-6 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
          <a href="/home" className="hover:text-zinc-300">← Back to Home</a>
          <a href="/privacy" className="text-emerald-400 hover:underline">View Privacy Policy</a>
        </footer>
      </div>
    </div>
  );
}
