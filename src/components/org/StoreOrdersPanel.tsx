"use client";
// Seller order management for the Kit Store (V8, FEATURES.marketplace). Pay at academy only.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listStoreOrders, transitionStoreOrder } from "@/app/actions/store";
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS, formatPaise, isOrderStatus, type OrderFilter, type OrderStatus } from "@/lib/store";
import { Loader2, ShoppingCart } from "lucide-react";

type SellerOrder = Awaited<ReturnType<typeof listStoreOrders>>["orders"][number];

const FILTER_LABELS: Record<OrderFilter, string> = { OPEN: "Open", REFUNDS: "Refunds", DONE: "Done", ALL: "All" };
const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Confirm",
  FULFILLED: "Hand over",
  CANCELLED: "Cancel",
  REFUNDED: "Record refund",
};

export function StoreOrdersPanel() {
  const [filter, setFilter] = useState<OrderFilter>("OPEN");
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: OrderFilter) => {
    setLoading(true);
    const r = await listStoreOrders(f);
    if (r.success) {
      setOrders(r.orders);
      setError(null);
    } else setError(r.error ?? "Could not load orders");
    setLoading(false);
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function move(o: SellerOrder, to: OrderStatus) {
    let paymentCollected = false;
    let itemReturned = false;
    if (to === "FULFILLED" && o.status === "CONFIRMED") {
      paymentCollected = window.confirm(`Was ${formatPaise(o.amountPaise)} collected at the academy?\nOK = paid now, Cancel = hand over unpaid.`);
    }
    if (to === "REFUNDED") {
      const paid = o.paymentStatus === "PAID_AT_ACADEMY";
      if (!window.confirm(paid ? `Confirm ${formatPaise(o.amountPaise)} was returned to the parent at the academy.` : "This order was not paid. Mark the refund request as closed (nothing to return)?")) return;
      itemReturned = window.confirm("Did the item come back in sellable condition? OK = add it back to stock.");
    }
    if (to === "CANCELLED" && !window.confirm("Cancel this order? Stock will be put back.")) return;
    if (to === "FULFILLED" && o.status === "REFUND_REQUESTED" && !window.confirm("Decline the refund request?")) return;
    setBusy(o.id);
    const r = await transitionStoreOrder(o.id, to, { paymentCollected, itemReturned });
    setBusy(null);
    if (r.success) toast.success(`Order ${ORDER_STATUS_LABELS[to].toLowerCase()}`);
    else toast.error(r.error ?? "Could not update the order");
    load(filter);
  }

  return (
    <Card className="bg-zinc-900/40 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-lime-400" /> Orders
        </CardTitle>
        <CardDescription>Parents pay at the academy. Confirm, hand over and record payment here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Order filter">
          {(Object.keys(FILTER_LABELS) as OrderFilter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${filter === f ? "bg-lime-400 text-zinc-950 border-lime-400" : "border-zinc-700 text-zinc-300"}`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : orders.length === 0 ? (
          <p className="text-zinc-500 text-sm">No orders here.</p>
        ) : (
          orders.map((o) => {
            const next = isOrderStatus(o.status) ? ORDER_TRANSITIONS[o.status] : [];
            return (
              <div key={o.id} className="p-3 bg-zinc-900 rounded-md border border-zinc-800 space-y-2">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-100 truncate">
                      {o.product.name} × {o.quantity}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {o.student.name}
                      {o.parent ? ` · ${o.parent.name}${o.parent.phone ? ` (${o.parent.phone})` : ""}` : ""}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatPaise(o.unitPricePaise)} each · placed {new Date(o.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-zinc-100">{formatPaise(o.amountPaise)}</p>
                    <p className="text-xs text-zinc-300">{isOrderStatus(o.status) ? ORDER_STATUS_LABELS[o.status] : o.status}</p>
                    <p className="text-[11px] text-zinc-500">
                      {o.paymentStatus === "PAID_AT_ACADEMY" ? "Paid at academy" : o.paymentStatus === "REFUNDED" ? "Refunded" : "Not paid"}
                    </p>
                  </div>
                </div>
                {next.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {next.map((to) => (
                      <Button
                        key={to}
                        size="sm"
                        variant={to === "CANCELLED" ? "outline" : "default"}
                        disabled={busy === o.id}
                        onClick={() => move(o, to)}
                      >
                        {o.status === "REFUND_REQUESTED" && to === "FULFILLED" ? "Decline refund" : ACTION_LABELS[to] ?? ORDER_STATUS_LABELS[to]}
                      </Button>
                    ))}
                  </div>
                )}
                {o.events.length > 0 && (
                  <details className="text-xs text-zinc-500">
                    <summary className="cursor-pointer">History</summary>
                    <ul className="mt-1 space-y-0.5">
                      {o.events.map((e, i) => (
                        <li key={i}>
                          {new Date(e.createdAt).toLocaleString("en-IN")} — {isOrderStatus(e.toStatus) ? ORDER_STATUS_LABELS[e.toStatus] : e.toStatus}
                          {e.note ? `: ${e.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
