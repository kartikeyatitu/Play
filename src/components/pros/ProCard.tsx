import Link from "next/link";
import type { ProListing } from "@/lib/pros/listing";
import { DELIVERY_MODE_LABELS, PRO_TYPE_LABELS } from "@/lib/pros/types";
import { Panel, Tag, VerificationBadge } from "./ui";

export function ProCard({ pro }: { pro: ProListing }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/pros/${pro.profileId}`} className="font-semibold text-ink hover:underline">
            {pro.name}
          </Link>
          <p className="text-sm text-ink-muted">
            {PRO_TYPE_LABELS[pro.type]}
            {pro.city ? ` · ${pro.city}` : ""}
            {pro.yearsExperience != null ? ` · ${pro.yearsExperience} yrs` : ""}
          </p>
          {pro.headline ? <p className="mt-1 text-sm text-ink">{pro.headline}</p> : null}
        </div>
        <VerificationBadge state={pro.verification} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {pro.modes.map((m) => (
          <Tag key={m}>{DELIVERY_MODE_LABELS[m]}</Tag>
        ))}
        {pro.languages.slice(0, 4).map((l) => (
          <Tag key={l}>{l}</Tag>
        ))}
        {pro.sports.slice(0, 4).map((s) => (
          <Tag key={s}>{s}</Tag>
        ))}
      </div>
    </Panel>
  );
}
