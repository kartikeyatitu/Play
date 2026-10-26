"use client";
// Parent Kit Store (V8, FEATURES.marketplace). Orders are paid at the academy — no online checkout.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelMyStoreOrder, listMyStoreOrders, placeStoreOrder, requestStoreRefund } from "@/app/actions/store";
import { MAX_ORDER_QTY, ORDER_STATUS_LABELS, formatPaise, isOrderStatus } from "@/lib/store";
import { Loader2, ShoppingBag } from "lucide-react";

type Child = { id: string; name: string };
type MyOrder = Awaited<ReturnType<typeof listMyStoreOrders>>["orders"][number];

export function ProShop({ products, studentId, kids }: { products: any[]; studentId?: string; kids?: Child[] }) {
  const children: Child[] = kids && kids.length ? kids : studentId ? [{ id: studentId, name: "" }] : [];
  const [childId, setChildId] = useState<string>(children[0]?.id ?? "");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);

  const loadOrders = useCallback(async () => {
    const r = await listMyStoreOrders();
    if (r.success) setOrders(r.orders);
  }, []);
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleBuy(productId: string) {
    if (!childId) return toast.error("Add a child first");
    setLoadingId(productId);
    const r = await placeStoreOrder({ productId, studentId: childId, quantity: qty[productId] ?? 1 });
    setLoadingId(null);
    if (r.success) {
      toast.success("Order placed. Pay at the academy when you collect it.");
      loadOrders();
    } else toast.error(r.error ?? "Could not place the order");
  }

  async function cancel(id: string) {
    if (!window.confirm("Cancel this order?")) return;
    const r = await cancelMyStoreOrder(id);
    if (r.success) toast.success("Order cancelled");
    else toast.error(r.error ?? "Could not cancel");
    loadOrders();
  }

  async function refund(id: string) {
    const note = window.prompt("Why do you want a refund? (optional)") ?? undefined;
    const r = await requestStoreRefund(id, note);
    if (r.success) toast.success("Refund requested. The academy will contact you.");
    else toast.error(r.error ?? "Could not request a refund");
    loadOrders();
  }

  return (
    <div className="pt-4 border-t border-zinc-800 mt-6 space-y-6">
      <div>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" /> Academy Pro Shop
        </h3>
        <p className="text-xs text-zinc-500 mb-3">No online payment. Pay at the academy when you collect your order.</p>
        {children.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-zinc-300 mb-3">
            For
            <select value={childId} onChange={(e) => setChildId(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1">
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name || "Child"}</option>
              ))}
            </select>
          </label>
        )}
        {products.length === 0 && <p className="text-sm text-zinc-500">Nothing in the shop yet.</p>}
        <div className="grid grid-cols-1 gap-3">
          {products.map((p) => {
            const out = !(p.stock > 0);
            return (
              <div key={p.id} className="flex justify-between items-center gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <div className="min-w-0">
                  <h4 className="font-bold text-zinc-200">{p.name}</h4>
                  <p className="text-sm text-indigo-400 font-bold">₹{p.price}</p>
                  <p className="text-xs text-zinc-500">{out ? "Out of stock" : `${p.stock} available`}</p>
                  {p.description && <p className="text-xs text-zinc-500 mt-1">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label={`Quantity of ${p.name}`}
                    disabled={out}
                    value={qty[p.id] ?? 1}
                    onChange={(e) => setQty((q) => ({ ...q, [p.id]: Number(e.target.value) }))}
                    className="bg-zinc-900 border border-zinc-800 rounded px-1 py-1 text-sm"
                  >
                    {Array.from({ length: Math.max(1, Math.min(MAX_ORDER_QTY, p.stock || 1)) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={out || loadingId === p.id || !childId}
                    onClick={() => handleBuy(p.id)}
                    className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500 hover:text-white"
                  >
                    {loadingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Order"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {orders.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">My orders</h3>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="flex justify-between items-center gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-200 truncate">{o.productName} × {o.quantity}</p>
                  <p className="text-xs text-zinc-500">
                    {o.studentName} · {new Date(o.createdAt).toLocaleDateString("en-IN")} · {formatPaise(o.amountPaise)} ·{" "}
                    {o.paymentStatus === "PAID_AT_ACADEMY" ? "paid at academy" : o.paymentStatus === "REFUNDED" ? "refunded" : "pay at academy"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-zinc-300">{isOrderStatus(o.status) ? ORDER_STATUS_LABELS[o.status] : o.status}</span>
                  {o.status === "PLACED" && <Button size="sm" variant="ghost" onClick={() => cancel(o.id)}>Cancel</Button>}
                  {o.status === "FULFILLED" && <Button size="sm" variant="ghost" onClick={() => refund(o.id)}>Refund</Button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
