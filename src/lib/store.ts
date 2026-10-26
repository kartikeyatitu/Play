// TRIQ Commerce (V8) — pure Kit Store rules. Client- and server-safe: no DB access here.
// The server actions in src/app/actions/store.ts enforce these against the database.

export const ORDER_STATUSES = ["PLACED", "CONFIRMED", "FULFILLED", "CANCELLED", "REFUND_REQUESTED", "REFUNDED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed moves. Anything not listed is rejected. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["FULFILLED", "CANCELLED"],
  FULFILLED: ["REFUND_REQUESTED"],
  REFUND_REQUESTED: ["REFUNDED", "FULFILLED"], // FULFILLED again = refund declined
  CANCELLED: [],
  REFUNDED: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  FULFILLED: "Handed over",
  CANCELLED: "Cancelled",
  REFUND_REQUESTED: "Refund requested",
  REFUNDED: "Refunded",
};

export const PAYMENT_MODE_PAY_AT_ACADEMY = "PAY_AT_ACADEMY";
export const PAYMENT_STATUSES = ["UNPAID", "PAID_AT_ACADEMY", "REFUNDED"] as const;
export type StorePaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MAX_ORDER_QTY = 10;
export const MAX_PRICE = 1_000_000; // ₹10 lakh
export const MAX_STOCK = 100_000;

export const isOrderStatus = (v: unknown): v is OrderStatus =>
  typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);

export function canTransition(from: string, to: string): boolean {
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false;
  return ORDER_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

/** Who may make a move: the seller (store.manage) or the parent who owns the order. */
export function canActorTransition(actor: "SELLER" | "PARENT", from: string, to: string): boolean {
  if (!canTransition(from, to)) return false;
  if (actor === "SELLER") return true;
  // Parents may only cancel before confirmation, or ask for a refund after hand-over.
  return (from === "PLACED" && to === "CANCELLED") || (from === "FULFILLED" && to === "REFUND_REQUESTED");
}

/** Stock to put back when entering `to`. Cancel always restocks; refund only if the item came back. */
export function restockQuantity(to: OrderStatus, quantity: number, itemReturned: boolean): number {
  if (to === "CANCELLED") return quantity;
  if (to === "REFUNDED" && itemReturned) return quantity;
  return 0;
}

/** Rupees (Product.price is a Float in ₹) → integer paise. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatPaise(paise: number, symbol = "₹"): string {
  const r = paise / 100;
  return `${symbol}${Number.isInteger(r) ? r.toLocaleString("en-IN") : r.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Price snapshot taken at order time; never recomputed from the live product later. */
export function priceSnapshot(unitPriceRupees: number, quantity: number): { unitPricePaise: number; amountPaise: number } {
  const unitPricePaise = toPaise(unitPriceRupees);
  return { unitPricePaise, amountPaise: unitPricePaise * quantity };
}

/** Money to hand back on refund: only what was actually collected. */
export function refundAmountPaise(amountPaise: number, paymentStatus: string): number {
  return paymentStatus === "PAID_AT_ACADEMY" ? amountPaise : 0;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateQuantity(q: unknown): Validated<number> {
  const n = typeof q === "string" ? Number(q) : q;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_ORDER_QTY)
    return { ok: false, error: `Quantity must be between 1 and ${MAX_ORDER_QTY}` };
  return { ok: true, value: n };
}

/** Can `quantity` be reserved from `stock`? Mirrors the conditional UPDATE … WHERE stock >= qty. */
export function checkStock(stock: number, quantity: number): Validated<number> {
  if (stock <= 0) return { ok: false, error: "Out of stock" };
  if (stock < quantity) return { ok: false, error: `Only ${stock} left` };
  return { ok: true, value: stock - quantity };
}

export interface ProductInput {
  name: string;
  price: number;
  stock: number;
  description: string | null;
}

export function validateProductInput(raw: { name?: unknown; price?: unknown; stock?: unknown; description?: unknown }): Validated<ProductInput> {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name || name.length > 120) return { ok: false, error: "Name is required (max 120 characters)" };
  const price = typeof raw.price === "string" ? Number(raw.price) : raw.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > MAX_PRICE)
    return { ok: false, error: "Enter a price greater than 0" };
  if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) return { ok: false, error: "Price can have at most 2 decimals" };
  const stock = typeof raw.stock === "string" ? Number(raw.stock) : raw.stock;
  if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0 || stock > MAX_STOCK)
    return { ok: false, error: "Stock must be a whole number (0 or more)" };
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (description.length > 500) return { ok: false, error: "Description is too long (max 500 characters)" };
  return { ok: true, value: { name, price, stock, description: description || null } };
}

/** Seller screen filter buckets. */
export const ORDER_FILTERS = {
  OPEN: ["PLACED", "CONFIRMED"],
  REFUNDS: ["REFUND_REQUESTED"],
  DONE: ["FULFILLED", "CANCELLED", "REFUNDED"],
  ALL: [...ORDER_STATUSES],
} as const satisfies Record<string, readonly OrderStatus[]>;
export type OrderFilter = keyof typeof ORDER_FILTERS;
export const isOrderFilter = (v: unknown): v is OrderFilter => typeof v === "string" && v in ORDER_FILTERS;

export function clampNote(note: unknown, max = 300): string | null {
  if (typeof note !== "string") return null;
  const t = note.trim();
  return t ? t.slice(0, max) : null;
}
