import type { Metadata } from "next";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getBodyViewer, canPlan, canManageAllPlans } from "@/lib/body/access";
import { DRILLS, DRILL_AGE_GROUPS, DRILL_FOCUS, DRILL_SPORTS, filterDrills, sportKey, sportLabel } from "@/lib/body/drills";
import { archiveCustomDrill, createCustomDrill } from "@/app/actions/body";
import { BodyNav, BodyShell, Chip, NotEnabled, Notice, Panel, SectionTitle, ghostBtn, inputCls, labelCls, one, primaryBtn } from "@/components/body/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Drill library | TRIQ Body", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

type Row = {
  id: string;
  custom: boolean;
  sport: string;
  title: string;
  description: string | null;
  durationMin: number | null;
  equipment: string[];
  ageGroup: string | null;
  focus: string[];
  createdById?: string | null;
};

export default async function DrillLibrary({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const viewer = await getBodyViewer();
  const sport = sportKey(one(sp.sport)) ?? "";
  const focus = (DRILL_FOCUS as readonly string[]).includes(one(sp.focus)) ? one(sp.focus) : "";
  const age = (DRILL_AGE_GROUPS as readonly string[]).includes(one(sp.age)) ? one(sp.age) : "";
  const q = one(sp.q).slice(0, 60);
  const mayAdd = canPlan(viewer);

  // Academy drills only when the drillLibrary flag is on (the Drill table may not exist yet).
  const custom: Row[] =
    FEATURES.drillLibrary && viewer.orgId && mayAdd
      ? (
          await db.drill.findMany({
            where: { orgId: viewer.orgId, archivedAt: null },
            orderBy: { createdAt: "desc" },
            take: 300,
            select: { id: true, sport: true, title: true, description: true, durationMin: true, equipment: true, ageGroup: true, skillKeys: true, createdById: true },
          })
        ).map((d) => ({
          ...d,
          custom: true,
          focus: Array.isArray(d.skillKeys) ? (d.skillKeys as unknown[]).filter((x): x is string => typeof x === "string") : [],
        }))
      : [];
  const library: Row[] = DRILLS.map((d) => ({ ...d, id: d.key, custom: false }));
  const shown = filterDrills([...custom, ...library], { sport, focus, age, q });

  return (
    <BodyShell title="Drill library">
      <BodyNav current="drills" />
      <Notice error={one(sp.error)} saved={one(sp.saved) === "1"} />
      <p className="mt-4 text-sm text-ink-muted">
        {DRILLS.length} TRIQ drills across {DRILL_SPORTS.length} sports. Adjust intensity and numbers to the group in front of you.
      </p>

      <form className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="search">
        <select name="sport" defaultValue={sport} aria-label="Sport" className={inputCls}>
          <option value="">All sports</option>
          {DRILL_SPORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="focus" defaultValue={focus} aria-label="Focus" className={inputCls}>
          <option value="">Any focus</option>
          {DRILL_FOCUS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select name="age" defaultValue={age} aria-label="Suitable for" className={inputCls}>
          <option value="">Any age</option>
          {DRILL_AGE_GROUPS.filter((a) => a !== "All ages").map((a) => (
            <option key={a} value={a}>
              Suits {a}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={q} placeholder="Search" aria-label="Search drills" className={inputCls} />
        <button type="submit" className={`${ghostBtn} col-span-2 sm:col-span-4`}>
          Filter
        </button>
      </form>

      <ul className="mt-4 space-y-3">
        {shown.map((d) => (
          <li key={d.id}>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold">{d.title}</h3>
                <div className="flex flex-wrap gap-1">
                  {d.custom ? <Chip tone="accent">Academy</Chip> : null}
                  <Chip>{sportLabel(d.sport)}</Chip>
                  {d.durationMin ? <Chip>{d.durationMin} min</Chip> : null}
                  {d.ageGroup ? <Chip>{d.ageGroup}</Chip> : null}
                </div>
              </div>
              {d.description ? <p className="mt-2 text-sm">{d.description}</p> : null}
              <p className="mt-2 text-xs text-ink-subtle">
                {d.focus.length ? `Focus: ${d.focus.join(", ")}` : null}
                {d.focus.length && d.equipment.length ? " · " : null}
                {d.equipment.length ? `Equipment: ${d.equipment.join(", ")}` : null}
              </p>
              {d.custom && (canManageAllPlans(viewer) || d.createdById === viewer.userId) ? (
                <form action={archiveCustomDrill} className="mt-2">
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className={`${ghostBtn} min-h-9 text-xs`}>
                    Archive
                  </button>
                </form>
              ) : null}
            </Panel>
          </li>
        ))}
        {!shown.length ? <li className="text-sm text-ink-muted">No drills match these filters.</li> : null}
      </ul>

      {mayAdd ? (
        <>
          <SectionTitle>Add an academy drill</SectionTitle>
          {!FEATURES.drillLibrary ? (
            <NotEnabled what="Saving your academy's own drills is not switched on yet." />
          ) : (
            <Panel className="mt-3">
              <form action={createCustomDrill} className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 sm:col-span-2">
                  <span className={labelCls}>Title</span>
                  <input name="title" required maxLength={100} className={inputCls} />
                </label>
                <label className="block space-y-1">
                  <span className={labelCls}>Sport</span>
                  <select name="sport" required defaultValue={sport || "cricket"} className={inputCls}>
                    {DRILL_SPORTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className={labelCls}>Minutes</span>
                  <input name="durationMin" type="number" inputMode="numeric" min={1} max={180} defaultValue={10} required className={inputCls} />
                </label>
                <label className="block space-y-1">
                  <span className={labelCls}>Age group</span>
                  <select name="ageGroup" defaultValue="All ages" className={inputCls}>
                    {DRILL_AGE_GROUPS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className={labelCls}>Equipment (comma separated)</span>
                  <input name="equipment" maxLength={300} placeholder="Cones, balls" className={inputCls} />
                </label>
                <fieldset className="sm:col-span-2">
                  <legend className={labelCls}>Focus</legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {DRILL_FOCUS.map((f) => (
                      <label key={f} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-1 text-xs">
                        <input type="checkbox" name="focus" value={f} /> {f}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block space-y-1 sm:col-span-2">
                  <span className={labelCls}>How it works</span>
                  <textarea name="description" rows={3} maxLength={1000} className={inputCls} />
                </label>
                <div className="sm:col-span-2">
                  <button type="submit" className={`${primaryBtn} w-full sm:w-auto`}>
                    Add drill
                  </button>
                </div>
              </form>
            </Panel>
          )}
        </>
      ) : null}
    </BodyShell>
  );
}
