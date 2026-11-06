import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { credentialLabel } from "@/lib/credentials";
import { prosEnabled } from "@/lib/pros/flag";
import { MAX_USER_BIO, splitBio } from "@/lib/pros/meta";
import { proVerificationState } from "@/lib/pros/verification";
import {
  DELIVERY_MODES,
  DELIVERY_MODE_LABELS,
  HEALTH_CATEGORY_BY_TYPE,
  LANGUAGES,
  PRO_TYPES,
  PRO_TYPE_LABELS,
  REGISTRATION_BODIES,
  SPECIALISATIONS_BY_PRO,
  credentialTypeOfTitle,
  credentialTypesFor,
  isProType,
} from "@/lib/pros/types";
import {
  addProsCredential,
  addProsExperience,
  removeProsCredential,
  removeProsExperience,
  saveProsProfile,
} from "@/app/actions/pros";
import {
  Block,
  CheckGroup,
  Field,
  FlashMsg,
  Notice,
  Panel,
  Shell,
  Tag,
  VerificationBadge,
  dangerBtn,
  fieldCls,
  ghostBtn,
  primaryBtn,
} from "@/components/pros/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join TRIQ Connect | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProsJoinPage({ searchParams }: { searchParams: SP }) {
  if (!prosEnabled()) notFound();
  const session = await requireAuth();
  const sp = await searchParams;

  const [profile, experience, credentials, provider] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: session.id } }),
    db.professionalExperience.findMany({ where: { userId: session.id }, orderBy: { startYear: "desc" } }),
    db.professionalCredential.findMany({ where: { userId: session.id }, orderBy: { createdAt: "asc" } }),
    db.wellnessProvider.findUnique({ where: { userId: session.id } }),
  ]);
  const { bio, meta } = splitBio(profile?.bio);
  const chosen = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const type = isProType(chosen) ? chosen : meta?.type ?? null;
  const health = type ? HEALTH_CATEGORY_BY_TYPE[type] !== null : false;
  const providerForType = type && provider && provider.category === HEALTH_CATEGORY_BY_TYPE[type] ? provider : null;
  const verification =
    meta && type === meta.type ? proVerificationState({ type: meta.type, provider: providerForType, credentials }) : "NOT_VERIFIED";
  const listed = !!profile?.isPublic && (!health || !!providerForType?.isListed);

  return (
    <Shell
      eyebrow="TRIQ Connect"
      title="Your professional profile"
      actions={
        <>
          <Link href="/pros/dashboard" className={ghostBtn}>
            Dashboard
          </Link>
          {profile && meta ? (
            <Link href={`/pros/${profile.id}`} className={ghostBtn}>
              View listing
            </Link>
          ) : null}
        </>
      }
    >
      <FlashMsg error={sp.error} saved={sp.saved} />

      {meta && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <VerificationBadge state={verification} />
          <span>{listed ? "Listed in the directory" : "Not listed"}</span>
        </div>
      )}

      <Block title="1 · Your profession" hint="This decides which credentials Triq asks you for.">
        <div className="flex flex-wrap gap-2">
          {PRO_TYPES.map((t) => (
            <Link
              key={t}
              href={`/pros/join?type=${t}`}
              aria-current={t === type ? "true" : undefined}
              className={t === type ? primaryBtn : ghostBtn}
            >
              {PRO_TYPE_LABELS[t]}
            </Link>
          ))}
        </div>
        {meta && type && type !== meta.type && (
          <p className="mt-2 text-sm text-warn">Saving with a new profession sends your registration back for a fresh check.</p>
        )}
      </Block>

      {type && (
        <Block title="2 · Profile">
          <Panel>
            <form action={saveProsProfile} className="space-y-4">
              <input type="hidden" name="type" value={type} />
              <Field label="Headline" hint="One line, e.g. “Sport psychologist working with junior badminton players”">
                <input name="headline" maxLength={120} defaultValue={profile?.headline ?? ""} className={fieldCls} />
              </Field>
              <Field label="About you">
                <textarea name="bio" rows={4} maxLength={MAX_USER_BIO} defaultValue={bio} className={fieldCls} />
              </Field>
              <CheckGroup
                legend="Specialisations"
                name="specialisations"
                options={SPECIALISATIONS_BY_PRO[type].map((s) => ({ value: s, label: s }))}
                selected={meta?.type === type ? meta.specialisations : []}
              />
              <Field label="Sports you work with" hint="Comma separated, up to 10">
                <input name="sports" defaultValue={profile?.sports.join(", ") ?? ""} className={fieldCls} placeholder="Badminton, Cricket" />
              </Field>
              <CheckGroup
                legend="Languages"
                name="languages"
                options={LANGUAGES.map((l) => ({ value: l, label: l }))}
                selected={meta?.languages ?? ["English"]}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="City">
                  <input name="city" maxLength={80} defaultValue={profile?.city ?? ""} className={fieldCls} />
                </Field>
                <Field label="Years of experience">
                  <input name="yearsExperience" inputMode="numeric" pattern="\d{1,2}" defaultValue={profile?.yearsExperience ?? ""} className={fieldCls} />
                </Field>
              </div>
              <CheckGroup
                legend="Sessions"
                name="modes"
                options={DELIVERY_MODES.map((m) => ({ value: m, label: DELIVERY_MODE_LABELS[m] }))}
                selected={meta?.modes ?? []}
              />

              {health && (
                <div className="space-y-4 rounded-lg border border-line p-3">
                  <p className="text-sm text-ink-muted">
                    Registration details are only seen by Triq ops for checking. They are never shown on your public listing.
                  </p>
                  <Field label="Registration body">
                    <input
                      name="registrationBody"
                      list="reg-bodies"
                      maxLength={120}
                      defaultValue={providerForType?.registrationBody ?? ""}
                      className={fieldCls}
                    />
                    <datalist id="reg-bodies">
                      {REGISTRATION_BODIES[type].map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Registration number">
                    <input name="registrationNumber" maxLength={60} defaultValue={providerForType?.registrationNumber ?? ""} className={fieldCls} />
                  </Field>
                  {providerForType && (
                    <p className="text-xs text-ink-subtle">
                      Registration check: {credentialLabel(providerForType.credentialStatus)}
                      {providerForType.credentialStatus === "REJECTED" && providerForType.credentialRejectReason
                        ? ` — ${providerForType.credentialRejectReason}`
                        : ""}
                    </p>
                  )}
                </div>
              )}

              <fieldset className="space-y-2">
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" name="listed" defaultChecked={listed} className="mt-1" />
                  <span>
                    List me in the TRIQ Connect directory. Your name, profession, city, sports, languages and this profile become public
                    (your Careers profile becomes public too). You are shown as &ldquo;Not yet verified&rdquo; until Triq checks your
                    credentials.
                  </span>
                </label>
                {health && (
                  <label className="flex items-start gap-2 text-sm text-ink">
                    <input type="checkbox" name="acceptingRequests" defaultChecked={providerForType?.acceptingRequests ?? true} className="mt-1" />
                    <span>Accept session requests (only once you are verified).</span>
                  </label>
                )}
              </fieldset>
              <button className={primaryBtn}>Save profile</button>
            </form>
          </Panel>
        </Block>
      )}

      {meta && (
        <>
          <Block title="3 · Experience">
            <div className="space-y-2">
              {experience.map((e) => (
                <Panel key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ink">
                    {e.title} · {e.organization}{" "}
                    <span className="text-ink-subtle">
                      ({e.startYear}–{e.endYear ?? "now"})
                    </span>
                  </p>
                  <form action={removeProsExperience}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className={dangerBtn}>Remove</button>
                  </form>
                </Panel>
              ))}
              <Panel>
                <form action={addProsExperience} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Role">
                    <input name="title" required maxLength={120} className={fieldCls} />
                  </Field>
                  <Field label="Organisation">
                    <input name="organization" required maxLength={120} className={fieldCls} />
                  </Field>
                  <Field label="From (year)">
                    <input name="startYear" required inputMode="numeric" pattern="\d{4}" className={fieldCls} />
                  </Field>
                  <Field label="To (year, blank if current)">
                    <input name="endYear" inputMode="numeric" pattern="\d{4}" className={fieldCls} />
                  </Field>
                  <div className="sm:col-span-2">
                    <button className={ghostBtn}>Add role</button>
                  </div>
                </form>
              </Panel>
            </div>
          </Block>

          <Block
            title="4 · Credentials"
            hint="Add a link to each document (for example a shared drive link). Triq ops checks it with the issuer before marking you verified."
          >
            <Panel>
              <ul className="space-y-1 text-sm">
                {credentialTypesFor(meta.type).map((ct) => {
                  const mine = credentials.filter((c) => credentialTypeOfTitle(meta.type, c.title)?.id === ct.id);
                  return (
                    <li key={ct.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-ink">{ct.label}</span>
                      {ct.required ? <Tag>Required</Tag> : <Tag>Optional</Tag>}
                      <span className="text-ink-subtle">{mine.length ? mine.map((c) => credentialLabel(c.status)).join(", ") : "Not added"}</span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
            <div className="mt-3 space-y-2">
              {credentials.map((c) => (
                <Panel key={c.id} className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <p className="text-ink">
                      {c.title}
                      {c.issuer ? ` · ${c.issuer}` : ""}
                      {c.issuedYear ? ` (${c.issuedYear})` : ""}
                    </p>
                    <p className="text-ink-subtle">
                      {credentialLabel(c.status)}
                      {c.status === "REJECTED" && c.rejectReason ? ` — ${c.rejectReason}` : ""}
                    </p>
                  </div>
                  <form action={removeProsCredential}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className={dangerBtn}>Remove</button>
                  </form>
                </Panel>
              ))}
              <Panel>
                <form action={addProsCredential} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="What is it?">
                    <select name="credentialType" required className={fieldCls} defaultValue="">
                      <option value="" disabled>
                        Choose
                      </option>
                      {credentialTypesFor(meta.type).map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.label}
                          {ct.required ? " (required)" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Title" hint="e.g. MSc Sport and Exercise Psychology">
                    <input name="title" required maxLength={120} className={fieldCls} />
                  </Field>
                  <Field label="Issued by">
                    <input name="issuer" maxLength={160} className={fieldCls} />
                  </Field>
                  <Field label="Year">
                    <input name="issuedYear" inputMode="numeric" pattern="\d{4}" className={fieldCls} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Evidence link (https)">
                      <input name="evidenceUrl" type="url" required className={fieldCls} placeholder="https://" />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <button className={ghostBtn}>Submit for checking</button>
                  </div>
                </form>
              </Panel>
            </div>
          </Block>
        </>
      )}

      {!type && <Notice>Choose your profession to start.</Notice>}
    </Shell>
  );
}
