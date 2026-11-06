import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPassport } from "@/app/actions/passport";
import { PassportView } from "@/components/athlete/PassportView";

// The title never carries the athlete's name (tabs, history and link previews), and the page is never indexed.
export const metadata: Metadata = {
  title: "Athlete passport · TRIQ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BACK: Record<string, string> = { PARENT: "/parent", COACH: "/coach", STAFF: "/org" };

export default async function AthletePassportPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const session = await getSession();
  if (!session?.id) redirect("/login");

  // Refused and missing athletes look the same: a plain 404 with no name.
  const res = await getPassport(studentId);
  if (!res.ok) notFound();

  return (
    <main className="min-h-screen bg-canvas px-4 pb-16 pt-4 text-ink sm:px-6">
      <div className="mx-auto mb-3 flex w-full max-w-3xl items-center justify-between gap-3">
        <Link href={BACK[res.relation] ?? "/"} className="text-sm text-ink-muted hover:text-ink">
          ← Back
        </Link>
        {res.relation !== "PARENT" && (
          <Link href={`/student/${res.passport.athlete.id}`} className="text-sm text-ink-muted hover:text-ink">
            Student record →
          </Link>
        )}
      </div>
      <PassportView passport={res.passport} />
    </main>
  );
}
