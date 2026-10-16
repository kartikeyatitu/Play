"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission, requirePermission } from "@/lib/membership";

export async function createRoute(data: { name: string; driverName: string; driverPhone: string; vehicleNumber: string; stops: string[]; studentNames: string[] }) {
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
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
  const { session } = await requirePermission("batches.manage");
  const routes = await db.transportRoute.findMany({ where: { orgId: session.orgId }, orderBy: { createdAt: "desc" } });
  return routes.map(r => ({ ...r, stops: JSON.parse(r.stops), studentNames: JSON.parse(r.studentNames) }));
}

export async function deleteRoute(id: string) {
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const result = await db.transportRoute.deleteMany({ where: { id, orgId: session.orgId } });
  if (result.count === 0) return { success: false, error: "Route not found" };
  revalidatePath("/org");
  return { success: true };
}
