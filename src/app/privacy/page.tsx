import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Triq",
  description: "Privacy Policy and Data Protection declaration for Triq Sports Academy OS.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8 bg-zinc-900/60 p-6 sm:p-10 rounded-2xl border border-zinc-800">
        <header className="border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center text-xs">T</span>
            <span className="text-xl font-bold tracking-tight text-zinc-100">Triq</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 mt-4">Privacy Policy</h1>
          <p className="text-xs text-zinc-400 mt-1">Last Updated: October 2026 · Compliant with Digital Personal Data Protection (DPDP) Act 2023 & Google Play Developer Policy</p>
        </header>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">1. Overview & Commitment</h2>
          <p>
            Triq (&quot;we&quot;, &quot;us&quot;, &quot;platform&quot;) provides sports academy management, coach scheduling, and fee coordination software. We are strictly committed to safeguarding the privacy of sports academy owners, coaches, parents, and players.
          </p>
          <p>
            We do <strong className="text-zinc-100">not sell, rent, or trade personal data</strong> to advertisers, third-party data brokers, or commercial marketing agencies.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">2. Information We Collect</h2>
          <p>We collect only the essential information needed to operate sports coaching and academy management:</p>
          <ul className="list-disc pl-5 space-y-2 text-zinc-400">
            <li><strong className="text-zinc-200">Account & Contact Info:</strong> Name, 10-digit Indian mobile number, email address, role (Admin, Coach, Parent).</li>
            <li><strong className="text-zinc-200">Student & Player Profiles:</strong> Student name, date of birth, blood group, emergency medical alerts, and batch enrollment (provided strictly with parent/guardian consent).</li>
            <li><strong className="text-zinc-200">Coaching & Attendance Records:</strong> Daily training attendance logs, skill ratings, match schedules, and performance progress.</li>
            <li><strong className="text-zinc-200">Fee & Transaction Metadata:</strong> Monthly fee status, payment reference numbers (UTR), and receipts. Note: Payment transactions are conducted directly via Unified Payments Interface (UPI) into the academy&apos;s bank account. Triq does not store bank account passwords, UPI PINs, or debit/credit card numbers.</li>
          </ul>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">3. Child & Minor Data Safety</h2>
          <p>
            Information concerning children under 18 years of age is provided exclusively by adult guardians (parents) or authorized academy administrators under guardian mandate. Such data is utilized solely for sports coaching roster management, emergency medical safety pitch-side, and parental progress updates.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">4. Data Security & Storage</h2>
          <p>
            Data is securely stored in enterprise-grade encrypted cloud infrastructure with strict tenant-level isolation, encrypted cookies (HMAC-SHA256), and role-based access restrictions ensuring no academy or user can access records outside their verified domain.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">5. Account & Data Deletion Rights</h2>
          <p>
            Users have the full right to review, update, or permanently delete their personal information at any time. To request complete deletion of your account and related records, visit our dedicated self-serve portal at{" "}
            <a href="/delete-account" className="text-emerald-400 hover:underline">triqsports.vercel.app/delete-account</a> or email <span className="text-zinc-200">privacy@triq.app</span>.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-100">6. Contact & Grievance Redressal</h2>
          <p>For any privacy queries, grievance escalation, or legal notices, contact our Grievance Officer at:</p>
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
            <p className="font-semibold text-zinc-200">Triq Grievance Redressal</p>
            <p className="text-zinc-400">Email: <a href="mailto:privacy@triq.app" className="text-emerald-400">privacy@triq.app</a></p>
            <p className="text-zinc-400">Location: Gurgaon, Haryana, India</p>
          </div>
        </section>

        <footer className="pt-6 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
          <a href="/home" className="hover:text-zinc-300">← Back to Home</a>
          <span>© {new Date().getFullYear()} Triq. All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
}
