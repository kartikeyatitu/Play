"use server";
// Kit Store (TRIQ Commerce, V8). Everything here is gated by FEATURES.marketplace.
// Pure rules (state machine, snapshots, validation) live in src/lib/store.ts.
// Payment is "pay at the academy" only: nothing in this file simulates an online payment.
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import {
  canActorTransition,
  checkStock,
  clampNote,
  isOrderFilter,
  isOrderStatus,
  ORDER_FILTERS,
  priceSnapshot,
  restockQuantity,
  validateProductInput,
  validateQuantity,
  type OrderStatus,
} from "@/lib/store";

const DISABLED = { success: false as const, error: "The kit store is not enabled" };

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } }).catch(() => {});
}

function revalidateStore() {
  revalidatePath("/org");
  revalidatePath("/parent");
}

class StoreError extends Error {}

// ── Catalogue ──────────────────────────────────────────────────────────────────

export async function createProduct(name: string, price: number, description: string, stock?: number) {
  if (!FEATURES.marketplace) return DISABLED;
  const auth = await checkPermission("store.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const v = validateProductInput({ name, price, stock, description });
  if (!v.ok) return { success: false, error: v.error };
  const product = await db.product.create({
    data: { name: v.value.name, price: v.value.price, stock: v.value.stock, description: v.value.description, orgId: session.orgId },
  });
  await audit(session.id, session.orgId, "STORE_PRODUCT_CREATED", { productId: product.id, price: v.value.price, stock: v.value.stock });
  revalidateStore();
  return { success: true };
}

export async function updateProduct(
  productId: string,
  input: { name: string; price: number | string; stock: number | string; description?: string | null },
) {
  if (!FEATURES.marketplace) return DISABLED;
  const auth = await checkPermission("store.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const v = validateProductInput(input);
  if (!v.ok) return { success: false, error: v.error };
  const before = await db.product.findFirst({ where: { id: String(productId), orgId: session.orgId } });
  if (!before) return { success: false, error: "Product not found" };
  await db.product.update({
    where: { id: before.id },
    data: { name: v.value.name, price: v.value.price, stock: v.value.stock, description: v.value.description },
  });
  await audit(session.id, session.orgId, "STORE_PRODUCT_UPDATED", {
    productId: before.id,
    before: { name: before.name, price: before.price, stock: before.stock },
    after: { name: v.value.name, price: v.value.price, stock: v.value.stock },
  });
  revalidateStore();
  return { success: true };
}

// ── Placing orders ─────────────────────────────────────────────────────────────

/**
 * Places a pay-at-academy order. Stock is reserved with one conditional UPDATE inside the same
 * transaction that writes the order, so concurrent orders for the last unit cannot both succeed.
 */
export async function placeStoreOrder(input: { productId: string; studentId: string; quantity: number | string }) {
  if (!FEATURES.marketplace) return DISABLED;
  const session = await requireAuth(["ADMIN", "PARENT"]);
  const q = validateQuantity(input?.quantity);
  if (!q.ok) return { success: false, error: q.error };
  const quantity = q.value;

  let studentWhere: { id: string; parentId?: string; orgId?: string };
  if (session.role === "PARENT") {
    studentWhere = { id: String(input.studentId), parentId: session.id };
  } else {
    const auth = await checkPermission("store.manage");
    if (!auth.ok) return { success: false, error: auth.error };
    studentWhere = { id: String(input.studentId), orgId: auth.session.orgId };
  }
  const student = await db.student.findFirst({ where: studentWhere, select: { id: true, orgId: true } });
  if (!student || !student.orgId) return { success: false, error: "Student not found" };
  const orgId = student.orgId;

  try {
    const orderId = await db.$transaction(async (tx) => {
      const reserved = await tx.product.updateMany({
        where: { id: String(input.productId), orgId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      // Row is locked by our UPDATE (or does not qualify) — re-read for snapshot / error message.
      const product = await tx.product.findFirst({ where: { id: String(input.productId), orgId }, select: { id: true, price: true, stock: true } });
      if (!product) throw new StoreError("Product not found");
      if (reserved.count === 0) {
        const s = checkStock(product.stock, quantity);
        throw new StoreError(s.ok ? "Could not reserve stock, please try again" : s.error);
      }
      const snap = priceSnapshot(product.price, quantity);
      const order = await tx.order.create({
        data: { productId: product.id, studentId: student.id, orgId, status: "PLACED" },
      });
      await tx.storeOrderDetail.create({
        data: { orgId, orderId: order.id, quantity, unitPricePaise: snap.unitPricePaise, amountPaise: snap.amountPaise, placedById: session.id },
      });
      await tx.storeOrderEvent.create({ data: { orgId, orderId: order.id, fromStatus: null, toStatus: "PLACED", actorId: session.id } });
      return order.id;
    });
    await audit(session.id, orgId, "STORE_ORDER_PLACED", { orderId, productId: input.productId, studentId: student.id, quantity });
    revalidateStore();
    return { success: true, orderId };
  } catch (e) {
    if (e instanceof StoreError) return { success: false, error: e.message };
    throw e;
  }
}

// ── Transitions ────────────────────────────────────────────────────────────────

async function applyTransition(opts: {
  orderId: string;
  orgId: string;
  actorId: string;
  actor: "SELLER" | "PARENT";
  parentId?: string;
  to: OrderStatus;
  paymentCollected?: boolean;
  itemReturned?: boolean;
  note?: string | null;
}) {
  const order = await db.order.findFirst({
    where: {
      id: String(opts.orderId),
      orgId: opts.orgId,
      ...(opts.parentId ? { student: { parentId: opts.parentId } } : {}),
    },
    include: { detail: true },
  });
  if (!order || !order.detail) return { success: false, error: "Order not found" };
  const from = order.status;
  if (!isOrderStatus(from) || !canActorTransition(opts.actor, from, opts.to))
    return { success: false, error: `Can't change an order from ${from} to ${opts.to}` };

  const detail = order.detail;
  const restock = restockQuantity(opts.to, detail.quantity, !!opts.itemReturned);
  try {
    await db.$transaction(async (tx) => {
      // Compare-and-set: only one concurrent click can move the order out of `from`.
      const moved = await tx.order.updateMany({ where: { id: order.id, orgId: opts.orgId, status: from }, data: { status: opts.to } });
      if (moved.count === 0) throw new StoreError("This order was just changed by someone else. Refresh and try again.");
      if (restock > 0) {
        await tx.product.updateMany({ where: { id: order.productId, orgId: opts.orgId }, data: { stock: { increment: restock } } });
      }
      const detailUpdate: Record<string, unknown> = {};
      if (opts.to === "FULFILLED" && from === "CONFIRMED" && opts.paymentCollected) {
        detailUpdate.paymentStatus = "PAID_AT_ACADEMY";
        detailUpdate.paidAt = new Date();
        detailUpdate.paidRecordedById = opts.actorId;
      }
      if (opts.to === "REFUNDED" && detail.paymentStatus === "PAID_AT_ACADEMY") detailUpdate.paymentStatus = "REFUNDED";
      if (Object.keys(detailUpdate).length) await tx.storeOrderDetail.update({ where: { id: detail.id }, data: detailUpdate });
      await tx.storeOrderEvent.create({
        data: { orgId: opts.orgId, orderId: order.id, fromStatus: from, toStatus: opts.to, actorId: opts.actorId, note: opts.note ?? null },
      });
    });
  } catch (e) {
    if (e instanceof StoreError) return { success: false, error: e.message };
    throw e;
  }
  await audit(opts.actorId, opts.orgId, `STORE_ORDER_${opts.to}`, {
    orderId: order.id,
    from,
    restocked: restock,
    ...(opts.to === "FULFILLED" ? { paymentCollected: !!opts.paymentCollected } : {}),
    ...(opts.to === "REFUNDED" ? { refundPaise: detail.paymentStatus === "PAID_AT_ACADEMY" ? detail.amountPaise : 0 } : {}),
  });
  revalidateStore();
  return { success: true };
}

/** Seller moves an order (store.manage). */
export async function transitionStoreOrder(
  orderId: string,
  to: string,
  opts: { paymentCollected?: boolean; itemReturned?: boolean; note?: string } = {},
) {
  if (!FEATURES.marketplace) return DISABLED;
  const auth = await checkPermission("store.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isOrderStatus(to)) return { success: false, error: "Unknown status" };
  return applyTransition({
    orderId,
    orgId: auth.session.orgId,
    actorId: auth.session.id,
    actor: "SELLER",
    to,
    paymentCollected: !!opts.paymentCollected,
    itemReturned: !!opts.itemReturned,
    note: clampNote(opts.note),
  });
}

/** The org of an order that belongs to one of this parent's children (null if not theirs). */
async function parentOrderOrg(orderId: string, parentId: string) {
  const o = await db.order.findFirst({ where: { id: String(orderId), student: { parentId } }, select: { orgId: true } });
  return o?.orgId ?? null;
}

/** Parent cancels their own order while it is still PLACED. */
export async function cancelMyStoreOrder(orderId: string) {
  if (!FEATURES.marketplace) return DISABLED;
  const session = await requireAuth(["PARENT"]);
  const orgId = await parentOrderOrg(orderId, session.id);
  if (!orgId) return { success: false, error: "Order not found" };
  return applyTransition({ orderId, orgId, actorId: session.id, actor: "PARENT", parentId: session.id, to: "CANCELLED" });
}

/** Parent asks for a refund after hand-over. The academy decides and records it. */
export async function requestStoreRefund(orderId: string, note?: string) {
  if (!FEATURES.marketplace) return DISABLED;
  const session = await requireAuth(["PARENT"]);
  const orgId = await parentOrderOrg(orderId, session.id);
  if (!orgId) return { success: false, error: "Order not found" };
  return applyTransition({
    orderId,
    orgId,
    actorId: session.id,
    actor: "PARENT",
    parentId: session.id,
    to: "REFUND_REQUESTED",
    note: clampNote(note),
  });
}

// ── Reads ──────────────────────────────────────────────────────────────────────

const orderInclude = {
  detail: true,
  product: { select: { id: true, name: true } },
  student: { select: { id: true, name: true, parent: { select: { id: true, name: true, phone: true } } } },
} as const;

/** Seller order list (v2 orders only — legacy PENDING/DELIVERED rows have no snapshot). */
export async function listStoreOrders(filter: string = "OPEN") {
  if (!FEATURES.marketplace) return { ...DISABLED, orders: [] };
  const auth = await checkPermission("store.manage");
  if (!auth.ok) return { success: false, error: auth.error, orders: [] };
  const statuses = [...ORDER_FILTERS[isOrderFilter(filter) ? filter : "OPEN"]];
  const orders = await db.order.findMany({
    where: { orgId: auth.session.orgId, status: { in: statuses }, detail: { isNot: null } },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const events = orders.length
    ? await db.storeOrderEvent.findMany({
        where: { orgId: auth.session.orgId, orderId: { in: orders.map((o) => o.id) } },
        orderBy: { createdAt: "asc" },
        select: { orderId: true, fromStatus: true, toStatus: true, note: true, createdAt: true },
      })
    : [];
  return {
    success: true,
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      product: o.product,
      student: { id: o.student.id, name: o.student.name },
      parent: o.student.parent ? { name: o.student.parent.name, phone: o.student.parent.phone } : null,
      quantity: o.detail!.quantity,
      unitPricePaise: o.detail!.unitPricePaise,
      amountPaise: o.detail!.amountPaise,
      paymentStatus: o.detail!.paymentStatus,
      paidAt: o.detail!.paidAt?.toISOString() ?? null,
      events: events.filter((e) => e.orderId === o.id).map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    })),
  };
}

/** A parent's own orders across their children. */
export async function listMyStoreOrders() {
  if (!FEATURES.marketplace) return { ...DISABLED, orders: [] };
  const session = await requireAuth(["PARENT"]);
  const orders = await db.order.findMany({
    where: { student: { parentId: session.id }, detail: { isNot: null } },
    include: { detail: true, product: { select: { id: true, name: true } }, student: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return {
    success: true,
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      productName: o.product.name,
      studentName: o.student.name,
      quantity: o.detail!.quantity,
      amountPaise: o.detail!.amountPaise,
      paymentStatus: o.detail!.paymentStatus,
    })),
  };
}

// ── Legacy (pre-v2) actions, kept for old clients; now behind the same flag ───

/** @deprecated v1 order without stock or price snapshot. Use placeStoreOrder. */
export async function placeOrder(productId: string, studentId: string) {
  if (!FEATURES.marketplace) return DISABLED;
  return placeStoreOrder({ productId, studentId, quantity: 1 });
}

/** Hands over a legacy PENDING order (no snapshot). v2 orders go through transitionStoreOrder. */
export async function fulfillOrder(orderId: string) {
  if (!FEATURES.marketplace) return DISABLED;
  const auth = await checkPermission("store.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const result = await db.order.updateMany({
    where: { id: orderId, status: "PENDING", student: { orgId: session.orgId } },
    data: { status: "DELIVERED" },
  });
  if (result.count === 0) return { success: false, error: "Order not found" };
  await audit(session.id, session.orgId, "STORE_ORDER_DELIVERED", { orderId, legacy: true });
  revalidateStore();
  return { success: true };
}
