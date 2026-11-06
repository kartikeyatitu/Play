import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getBodyViewer, visibleStudentsWhere } from "@/lib/body/access";
import { BodyNav, BodyShell, NotEnabled, Panel, inputCls, one } from "@/components/body/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Athletes | TRIQ Body", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function BodyAthletes({ searchParams }: { searchParams: SP }) {
  const viewer = await getBodyViewer();
  const q = one((await searchParams).q).slice(0, 60);
  const where = visibleStudentsWhere(viewer);
  // Reads the existing Student table only (no wave 2 tables).
  const students = where
    ? await db.student.findMany({
        where: { ...where, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 200,
      })
    : [];

  return (
    <BodyShell title={viewer.appRole === "PARENT" ? "Your children" : "Athletes"}>
      <BodyNav current="athletes" />
      {!FEATURES.fitnessTests ? <NotEnabled what="Fitness test results can't be recorded or viewed yet." /> : null}
      {viewer.appRole !== "PARENT" ? (
        <form className="mt-4" role="search">
          <input name="q" defaultValue={q} placeholder="Search by name" aria-label="Search athletes" className={inputCls} />
        </form>
      ) : null}
      {!where ? (
        <p className="mt-6 text-sm text-ink-muted">You don't have access to athlete records in this academy.</p>
      ) : students.length ? (
        <ul className="mt-4 space-y-2">
          {students.map((s) => (
            <li key={s.id}>
              <Link href={`/body/athlete/${s.id}`} className="block">
                <Panel className="flex items-center justify-between hover:bg-surface-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-ink-subtle">→</span>
                </Panel>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-ink-muted">No athletes found.</p>
      )}
    </BodyShell>
  );
}
