"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProduct, fulfillOrder, updateProduct } from "@/app/actions/store";
import { StoreOrdersPanel } from "@/components/org/StoreOrdersPanel";
import { Loader2, Package, CheckCircle2, Pencil } from "lucide-react";

function ProductRow({ p }: { p: any }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(p.price));
  const [stock, setStock] = useState(String(p.stock));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await updateProduct(p.id, { name: p.name, price, stock, description: p.description });
    setSaving(false);
    if (r.success) {
      toast.success("Product updated");
      setEditing(false);
    } else toast.error(r.error ?? "Could not update");
  }

  return (
    <div className="p-3 bg-zinc-900 rounded-md border border-zinc-800">
      <div className="flex justify-between items-center gap-2">
        <div className="min-w-0">
          <p className="font-bold text-zinc-200 truncate">{p.name}</p>
          <p className="text-xs text-zinc-500">
            ₹{p.price} · {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
          </p>
        </div>
        <Button size="sm" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setEditing((v) => !v)}>
          <Pencil className="w-4 h-4" />
        </Button>
      </div>
      {editing && (
        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input aria-label="Price (₹)" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-zinc-950 border-zinc-800" />
          <Input aria-label="Stock" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className="bg-zinc-950 border-zinc-800" />
          <Button size="sm" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
          <p className="col-span-3 text-[11px] text-zinc-500">Price changes apply to new orders only. Past orders keep their price.</p>
        </div>
      )}
    </div>
  );
}

export function StoreManager({ products, orders }: { products: any[]; orders: any[] }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [desc, setDesc] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await createProduct(name, Number(price), desc, Number(stock));
    setLoading(false);
    if (!r.success) {
      toast.error(r.error ?? "Could not add product");
      return;
    }
    toast.success("Added to store");
    setName(""); setPrice(""); setStock(""); setDesc("");
  }

  // Orders placed before stock/price tracking (status PENDING, no snapshot).
  const legacyPending = orders.filter((o) => o.status === "PENDING");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Product Management */}
      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><Package className="w-5 h-5 text-indigo-400" /> Add New Kit / Gear</CardTitle>
          <CardDescription>Sell academy jerseys, equipment, and merchandise to parents. Parents pay at the academy.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input required maxLength={120} placeholder="Product Name (e.g. Official Jersey Size M)" value={name} onChange={e => setName(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            <div className="grid grid-cols-2 gap-3">
              <Input required placeholder="Price (₹)" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="bg-zinc-900 border-zinc-800" />
              <Input required placeholder="Units in stock" type="number" min="0" step="1" value={stock} onChange={e => setStock(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            </div>
            <Input maxLength={500} placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            <Button disabled={loading} className="w-full bg-indigo-500 text-white hover:bg-indigo-600 font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Add to Store
            </Button>
          </form>

          <div className="mt-6 space-y-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase">Inventory</h4>
            {products.length === 0 && <p className="text-sm text-zinc-500">No products yet.</p>}
            {products.map(p => <ProductRow key={p.id} p={p} />)}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <StoreOrdersPanel />

        {legacyPending.length > 0 && (
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base">Older pending orders</CardTitle>
              <CardDescription>Placed before stock and price tracking. Hand over when collected.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {legacyPending.map(order => (
                <div key={order.id} className="flex justify-between items-center p-3 bg-zinc-900 rounded-md border border-zinc-800">
                  <div>
                    <p className="font-bold text-zinc-200">{order.product.name}</p>
                    <p className="text-xs text-zinc-400">Student: {order.student.name} ({order.student.parent?.name})</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const r = await fulfillOrder(order.id);
                      if (!r.success) toast.error(r.error ?? "Could not update");
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Hand over
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
