// Streams one photo after a canView check (flag FEATURES.media). There are no public URLs: files sit
// in the private Blob store and are only reachable through this route. Responses are never cached
// (private, no-store) so a consent withdrawal or a delete takes effect on the next request.
// ?v=thumb serves the 480px thumbnail; anything else serves the 2048px photo.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadAssetForViewer, mediaEnabled } from "@/lib/media/server";
import { blobMediaStorage } from "@/lib/media/storage";
import { parseVariants } from "@/lib/media/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!mediaEnabled() || !blobMediaStorage.configured()) return NOT_FOUND();
  const { id } = await params;
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return NOT_FOUND();

  const session = await getSession();
  const loaded = await loadAssetForViewer(id, session?.id ? String(session.id) : null);
  // Same 404 for "missing" and "not allowed" so ids can't be probed.
  if (!loaded || !loaded.decision.allowed) return NOT_FOUND();

  const variant = new URL(request.url).searchParams.get("v");
  const key = variant === "thumb" ? parseVariants(loaded.asset.variants).thumb ?? loaded.asset.storageKey : loaded.asset.storageKey;
  const file = await blobMediaStorage.stream(key);
  if (!file) return NOT_FOUND();

  return new NextResponse(file.body, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, noimageindex",
    },
  });
}
