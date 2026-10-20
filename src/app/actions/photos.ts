"use server";

/**
 * Academy photo upload + management.
 *
 * Photos go to Vercel Blob (public access). URLs are stored in
 * Organization.photos (text array). First photo acts as the hero/OG image.
 *
 * Env required: BLOB_READ_WRITE_TOKEN (auto-set by Vercel once Blob is
 * enabled on the project).
 */

import { put, del } from "@vercel/blob";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isOrgOwner } from "@/lib/membership";
import { revalidatePath } from "next/cache";

const MAX_PHOTOS_PER_ACADEMY = 6;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB (post-client-resize this is generous)
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type UploadResult =
  | { success: true; url: string; count: number }
  | { success: false; error: string };

/**
 * Upload a single photo for the given org. Returns the new photo URL.
 * The caller may upload during onboarding (orgId passed) or from settings
 * (orgId derived from session). Only ADMIN of that org can upload.
 */
export async function uploadAcademyPhoto(formData: FormData): Promise<UploadResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Please sign in first." };
  if (!session.orgId) return { success: false, error: "No academy found for your account." };
  if (!(await isOrgOwner(session.id, session.orgId))) {
    return { success: false, error: "Only the academy owner can upload photos." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "No file provided." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { success: false, error: "Please upload a JPG, PNG, or WebP image." };
  }
  if (file.size > MAX_BYTES) {
    return { success: false, error: "Image is too large (max 5MB)." };
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { success: false, error: "Photo uploads are not configured yet. Please contact support." };
  }

  const org = await db.organization.findUnique({
    where: { id: session.orgId },
    select: { photos: true },
  });
  if (!org) return { success: false, error: "Academy not found." };
  if (org.photos.length >= MAX_PHOTOS_PER_ACADEMY) {
    return { success: false, error: `You can only have up to ${MAX_PHOTOS_PER_ACADEMY} photos.` };
  }

  try {
    // Random filename so viewer-side predictions can't collide with existing blobs.
    const ext = file.type.split("/")[1] || "jpg";
    const filename = `orgs/${session.orgId}/${randomBytes(16).toString("hex")}.${ext}`;
    const blob = await put(filename, file, { access: "public", contentType: file.type });

    const updated = await db.organization.update({
      where: { id: session.orgId },
      data: { photos: { set: [...org.photos, blob.url] } },
      select: { photos: true },
    });

    revalidatePath("/org");
    revalidatePath(`/academies/[city]/[sport]/[slug]`, "page");

    return { success: true, url: blob.url, count: updated.photos.length };
  } catch (err) {
    console.error("[photos] upload failed", err);
    return { success: false, error: "Upload failed. Please try again." };
  }
}

export async function removeAcademyPhoto(url: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Please sign in first." };
  if (!session.orgId) return { success: false, error: "No academy found for your account." };
  if (!(await isOrgOwner(session.id, session.orgId))) {
    return { success: false, error: "Only the academy owner can remove photos." };
  }

  const org = await db.organization.findUnique({
    where: { id: session.orgId },
    select: { photos: true },
  });
  if (!org) return { success: false, error: "Academy not found." };
  if (!org.photos.includes(url)) return { success: false, error: "Photo not found." };

  try {
    // Best-effort delete from Blob; don't fail the whole op if it 404s.
    try {
      await del(url);
    } catch (e) {
      console.warn("[photos] blob delete failed (continuing)", e);
    }

    await db.organization.update({
      where: { id: session.orgId },
      data: { photos: { set: org.photos.filter((p) => p !== url) } },
    });

    revalidatePath("/org");
    revalidatePath(`/academies/[city]/[sport]/[slug]`, "page");
    return { success: true };
  } catch (err) {
    console.error("[photos] remove failed", err);
    return { success: false, error: "Could not remove photo." };
  }
}

/** Reorder (used by drag-handle in settings; new order replaces existing). */
export async function reorderAcademyPhotos(urls: string[]): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Please sign in first." };
  if (!session.orgId) return { success: false, error: "No academy found for your account." };
  if (!(await isOrgOwner(session.id, session.orgId))) {
    return { success: false, error: "Only the academy owner can reorder photos." };
  }
  const org = await db.organization.findUnique({
    where: { id: session.orgId },
    select: { photos: true },
  });
  if (!org) return { success: false, error: "Academy not found." };
  const existing = new Set(org.photos);
  if (urls.length !== org.photos.length || !urls.every((u) => existing.has(u))) {
    return { success: false, error: "Photo list has changed; please refresh." };
  }
  await db.organization.update({
    where: { id: session.orgId },
    data: { photos: { set: urls } },
  });
  revalidatePath("/org");
  revalidatePath(`/academies/[city]/[sport]/[slug]`, "page");
  return { success: true };
}
