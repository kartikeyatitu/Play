// TRIQ Connect server-side reads. Server only (uses the database). Never selects registration numbers or
// evidence links for public listings.

import { db } from "@/lib/db";
import { splitBio, type ProMeta } from "./meta";
import { canReceiveRequests, isListable, type ProListing } from "./listing";
import { HEALTH_CATEGORY_BY_TYPE } from "./types";
import { proVerificationState } from "./verification";

const MAX_DIRECTORY = 500;

const providerSelect = {
  id: true,
  userId: true,
  category: true,
  isListed: true,
  acceptingRequests: true,
  credentialStatus: true,
  credentialVerifiedById: true,
  credentialVerifiedAt: true,
} as const;

type ProfileRow = {
  id: string;
  userId: string;
  headline: string | null;
  bio: string | null;
  sports: string[];
  city: string | null;
  yearsExperience: number | null;
  isPublic: boolean;
};

async function assemble(profiles: ProfileRow[]): Promise<ProListing[]> {
  const parsed = profiles
    .map((p) => ({ p, ...splitBio(p.bio) }))
    .filter((x): x is { p: ProfileRow; bio: string; meta: ProMeta } => x.meta !== null);
  if (!parsed.length) return [];
  const userIds = parsed.map((x) => x.p.userId);
  const [providers, creds, users] = await Promise.all([
    db.wellnessProvider.findMany({ where: { userId: { in: userIds } }, select: providerSelect }),
    db.professionalCredential.findMany({
      where: { userId: { in: userIds }, status: { in: ["SUBMITTED", "REVIEWED", "VERIFIED"] } },
      select: { userId: true, title: true, status: true, verifiedById: true, verifiedAt: true },
    }),
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
  ]);
  const providerByUser = new Map(providers.map((w) => [w.userId, w]));
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const out: ProListing[] = [];
  for (const { p, bio, meta } of parsed) {
    const category = HEALTH_CATEGORY_BY_TYPE[meta.type];
    const w = category ? providerByUser.get(p.userId) ?? null : null;
    // A provider row of a different category than the stated type does not count.
    const provider = w && w.category === category ? w : null;
    const src = { profile: { isPublic: p.isPublic }, meta, provider };
    if (!isListable(src)) continue;
    const verification = proVerificationState({
      type: meta.type,
      provider,
      credentials: creds.filter((c) => c.userId === p.userId),
    });
    out.push({
      profileId: p.id,
      userId: p.userId,
      name: nameById.get(p.userId) ?? "Professional",
      type: meta.type,
      headline: p.headline,
      bio,
      sports: p.sports,
      city: p.city,
      languages: meta.languages,
      modes: meta.modes,
      specialisations: meta.specialisations,
      yearsExperience: p.yearsExperience,
      verification,
      providerId: provider?.id ?? null,
      acceptsRequests: canReceiveRequests(src, verification),
    });
  }
  return out;
}

const profileSelect = { id: true, userId: true, headline: true, bio: true, sports: true, city: true, yearsExperience: true, isPublic: true } as const;

/** Every listed professional (bounded); filter with filterListings. */
export async function loadDirectory(): Promise<ProListing[]> {
  const profiles = await db.professionalProfile.findMany({
    where: { isPublic: true, bio: { contains: "[TRIQ Connect] " } },
    select: profileSelect,
    orderBy: { updatedAt: "desc" },
    take: MAX_DIRECTORY,
  });
  return assemble(profiles);
}

/** One listed professional by ProfessionalProfile id, or null when not listed. */
export async function loadListing(profileId: string): Promise<ProListing | null> {
  const p = await db.professionalProfile.findUnique({ where: { id: profileId }, select: profileSelect });
  if (!p) return null;
  const [l] = await assemble([p]);
  return l ?? null;
}
