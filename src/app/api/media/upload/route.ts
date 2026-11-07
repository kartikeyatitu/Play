// Client-upload token route for consent-first photos (flag FEATURES.media).
// The browser calls upload() from @vercel/blob/client with handleUploadUrl=/api/media/upload and a
// clientPayload of { assetId }. A token is issued only for the exact private keys reserved for that
// PENDING asset by beginMediaUploads, only to its uploader, and only while they are still an
// uploading member of the academy. Completion is confirmed by completeMediaUploads, not a webhook.

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getMembership } from "@/lib/membership";
import { MEDIA_MAX_THUMB_BYTES, MEDIA_MAX_UPLOAD_BYTES, MEDIA_UPLOAD_TOKEN_MS } from "@/lib/media/constants";
import { canUploadMedia } from "@/lib/media/policy";
import { mediaEnabled } from "@/lib/media/server";
import { blobMediaStorage } from "@/lib/media/storage";
import { parseUploadPayload, parseVariants } from "@/lib/media/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!mediaEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!blobMediaStorage.configured()) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getSession();
        if (!session?.id) throw new Error("Please sign in");
        const payload = parseUploadPayload(clientPayload);
        if (!payload) throw new Error("Bad upload payload");
        const asset = await db.mediaAsset.findUnique({
          where: { id: payload.assetId },
          select: { orgId: true, uploaderId: true, status: true, storageKey: true, variants: true, mimeType: true },
        });
        if (!asset || asset.status !== "PENDING" || asset.uploaderId !== session.id) throw new Error("Upload not allowed");
        if (!canUploadMedia(await getMembership(session.id, asset.orgId))) throw new Error("Upload not allowed");
        const thumbKey = parseVariants(asset.variants).thumb;
        if (pathname !== asset.storageKey && pathname !== thumbKey) throw new Error("Upload not allowed");
        return {
          allowedContentTypes: asset.mimeType ? [asset.mimeType] : ["image/jpeg", "image/webp"],
          maximumSizeInBytes: pathname === thumbKey ? MEDIA_MAX_THUMB_BYTES : MEDIA_MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + MEDIA_UPLOAD_TOKEN_MS,
          tokenPayload: null,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload not allowed";
    return NextResponse.json({ error: msg === "Please sign in" ? msg : "Upload not allowed" }, { status: 403 });
  }
}
