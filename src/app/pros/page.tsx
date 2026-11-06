import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prosEnabled } from "@/lib/pros/flag";
import { loadDirectory } from "@/lib/pros/data";
import { facetValues, filterListings, parseDirectoryFilters } from "@/lib/pros/listing";
import { LANGUAGES, PRO_TYPES, PRO_TYPE_LABELS } from "@/lib/pros/types";
import { ProCard } from "@/components/pros/ProCard";
import { Block, Notice, Shell, fieldCls, ghostBtn, labelCls, primaryBtn } from "@/components/pros/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Find a sports professional | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProsDirectoryPage({ searchParams }: { searchParams: SP }) {
  if (!prosEnabled()) notFound();
  const filters = parseDirectoryFilters(await searchParams);
  const all = await loadDirectory();
  const { sports, cities } = facetValues(all);
  const results = filterListings(all, filters);

  return (
    <Shell
      eyebrow="TRIQ Connect"
      title="Find a sports professional"
      actions={
        <>
          <Link href="/pros/dashboard" className={ghostBtn}>
            My requests
          </Link>
          <Link href="/pros/join" className={ghostBtn}>
            I am a professional
          </Link>
        </>
      }
    >
      <p className="mt-3 max-w-2xl text-sm text-ink-muted">
        Psychologists, counsellors, physiotherapists, nutritionists, sport scientists and strength coaches who chose to be listed.
        &ldquo;Verified&rdquo; means Triq checked their credentials with the issuer; everyone else is shown as &ldquo;Not yet verified&rdquo;.
      </p>

      <form method="get" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Filter professionals">
        <label className="space-y-1">
          <span className={labelCls}>Type</span>
          <select name="type" defaultValue={filters.type ?? ""} className={fieldCls}>
            <option value="">Any</option>
            {PRO_TYPES.map((t) => (
              <option key={t} value={t}>
                {PRO_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Sport</span>
          <select name="sport" defaultValue={filters.sport ?? ""} className={fieldCls}>
            <option value="">Any</option>
            {sports.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>City</span>
          <select name="city" defaultValue={filters.city ?? ""} className={fieldCls}>
            <option value="">Any</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Language</span>
          <select name="language" defaultValue={filters.language ?? ""} className={fieldCls}>
            <option value="">Any</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <label className="inline-flex items-center gap-2 pb-2 text-sm text-ink">
            <input type="checkbox" name="online" value="1" defaultChecked={filters.online} />
            Online
          </label>
          <button className={primaryBtn}>Apply</button>
        </div>
      </form>

      <Block title={`${results.length} ${results.length === 1 ? "professional" : "professionals"}`}>
        {results.length === 0 ? (
          <Notice>
            No one matches these filters yet.{" "}
            <Link href="/pros" className="underline">
              Clear filters
            </Link>
          </Notice>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {results.map((p) => (
              <ProCard key={p.profileId} pro={p} />
            ))}
          </div>
        )}
      </Block>

      <p className="mt-10 text-xs text-ink-subtle">
        Triq does not provide medical, psychological or emergency care. If someone is in danger, call 112.
      </p>
    </Shell>
  );
}
