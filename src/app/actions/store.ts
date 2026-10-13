"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function createProduct(name: string, price: number, description: string) {
    const session = await requireAuth(['ADMIN']);
  if (!session.orgId) return { success: false, error: "No organization found" };
  await db.product.create({
    data: { name, price, description, orgId: session.orgId }
  });
  revalidatePath("/org");
  revalidatePath("/parent");
  return { success: true };
}

// Parents order for their own children; admins may order for any student in their academy.
export async function placeOrder(productId: string, studentId: string) {
    const session = await requireAuth(['ADMIN', 'PARENT']);
  const studentWhere =
    session.role === "PARENT"
      ? { id: studentId, parentId: session.id }
      : { id: studentId, orgId: session.orgId || "__no_org__" };
  const student = await db.student.findFirst({ where: studentWhere });
  if (!student) return { success: false, error: "Student not found" };

  // Product must belong to the student's academy. (Legacy orgId = null products used to be accepted;
  // scripts/tenancy-check.ts showed none exist, and a null-org product is not attributable to any tenant.)
  const product = await db.product.findFirst({
    where: { id: productId, orgId: student.orgId || "__no_org__" },
  });
  if (!product) return { success: false, error: "Product not found" };

  await db.order.create({
    data: { productId: product.id, studentId: student.id, orgId: student.orgId }
  });
  revalidatePath("/parent");
  revalidatePath("/org");
  return { success: true };
}

export async function fulfillOrder(orderId: string) {
    const session = await requireAuth(['ADMIN']);
  // Scope via the student (Order.orgId was not populated historically)
  const result = await db.order.updateMany({
    where: { id: orderId, student: { orgId: session.orgId || "__no_org__" } },
    data: { status: "DELIVERED" }
  });
  if (result.count === 0) return { success: false, error: "Order not found" };
  revalidatePath("/org");
  revalidatePath("/parent");
  return { success: true };
}
