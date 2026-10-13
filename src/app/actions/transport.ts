"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function createRoute(data: { name: string; driverName: string; driverPhone: string; vehicleNumber: string; stops: string[]; studentNames: string[] }) {
    const session = await requireAuth(['ADMIN']);
  if (!session.orgId) return { success: false, error: "No organization found" };
  await db.transportRoute.create({ data: { orgId: session.orgId, 
      name: data.name,
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      vehicleNumber: data.vehicleNumber,
      stops: JSON.stringify(data.stops),
      studentNames: JSON.stringify(data.studentNames),
    },
  });
  revalidatePath("/org");
  return { success: true };
}

export async function getRoutes() {
    const session = await requireAuth(['ADMIN']);
  const routes = await db.transportRoute.findMany({ where: { orgId: session.orgId || "__no_org__" }, orderBy: { createdAt: "desc" } });
  return routes.map(r => ({ ...r, stops: JSON.parse(r.stops), studentNames: JSON.parse(r.studentNames) }));
}

export async function deleteRoute(id: string) {
    const session = await requireAuth(['ADMIN']);
  const result = await db.transportRoute.deleteMany({ where: { id, orgId: session.orgId || "__no_org__" } });
  if (result.count === 0) return { success: false, error: "Route not found" };
  revalidatePath("/org");
  return { success: true };
}
