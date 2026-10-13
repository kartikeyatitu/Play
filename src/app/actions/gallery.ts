"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { safeHttpUrl } from "@/lib/safe-url";

export async function addPhoto(url: string, caption: string, _uploadedById: string) {
    const session = await requireAuth(['ADMIN', 'COACH']);
  try {
    if (!session.orgId) return { success: false, error: "No organization found" };
    // Only absolute http(s) links: never store javascript:/data: URLs that other users may click
    const safeUrl = safeHttpUrl(url);
    if (!safeUrl) return { success: false, error: "Please provide a valid http(s) photo link" };
    // Never trust uploadedById from the client — always the logged-in user
    const uploadedById = session.id as string;

    // Verify the user exists (prevents FK violation after DB reset)
    const user = await db.user.findUnique({ where: { id: uploadedById } });
    if (!user) {
      return { success: false, error: "Session expired. Please logout and login again." };
    }

    await db.galleryPhoto.create({ data: { orgId: session.orgId,  url: safeUrl, caption: caption ? String(caption).slice(0, 300) : caption, uploadedById } });
    revalidatePath("/org");
    return { success: true };
  } catch (e: any) {
    console.error("Gallery error:", e);
    return { success: false, error: e?.message || "Failed to add photo" };
  }
}

export async function getPhotos() {
    const session = await requireAuth();
  return db.galleryPhoto.findMany({
    where: { orgId: session.orgId || "__no_org__" },
    // Only expose the uploader's display fields (not phone/email/password hash)
    include: { uploadedBy: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function deletePhoto(id: string) {
    const session = await requireAuth();
  try {
    // Admins can delete any photo in their academy; others only their own uploads
    const result = await db.galleryPhoto.deleteMany({
      where: {
        id,
        orgId: session.orgId || "__no_org__",
        ...(session.role === "ADMIN" ? {} : { uploadedById: session.id }),
      },
    });
    if (result.count === 0) return { success: false, error: "Photo not found" };
    revalidatePath("/org");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: "Failed to delete photo" };
  }
}
