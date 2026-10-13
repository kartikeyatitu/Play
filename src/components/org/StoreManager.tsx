"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProduct, fulfillOrder } from "@/app/actions/store";
import { Loader2, Package, ShoppingCart, CheckCircle2 } from "lucide-react";

export function StoreManager({ products, orders }: { products: any[], orders: any[] }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await createProduct(name, parseFloat(price), desc);
    setName(""); setPrice(""); setDesc("");
    setLoading(false);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Product Management */}
      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><Package className="w-5 h-5 text-indigo-400" /> Add New Kit / Gear</CardTitle>
          <CardDescription>Sell academy jerseys, equipment, and merchandise directly to parents.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input required placeholder="Product Name (e.g. Official Jersey Size M)" value={name} onChange={e => setName(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            <Input required placeholder="Price (₹)" type="number" value={price} onChange={e => setPrice(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            <Input required placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            <Button disabled={loading} className="w-full bg-indigo-500 text-white hover:bg-indigo-600 font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Add to Store
            </Button>
          </form>

          <div className="mt-6 space-y-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase">Active Inventory</h4>
            {products.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-zinc-900 rounded-md border border-zinc-800">
                <div>
                  <p className="font-bold text-zinc-200">{p.name}</p>
                  <p className="text-xs text-zinc-500">₹{p.price}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Order Management */}
      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-lime-400" /> Pending Orders</CardTitle>
          <CardDescription>Fulfill orders placed by parents on the field.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orders.filter(o => o.status === "PENDING").length === 0 ? (
              <p className="text-zinc-500 text-sm">No pending orders.</p>
            ) : (
              orders.filter(o => o.status === "PENDING").map(order => (
                <div key={order.id} className="flex justify-between items-center p-3 bg-lime-400/10 rounded-md border border-lime-400/20">
                  <div>
                    <p className="font-bold text-lime-400">{order.product.name}</p>
                    <p className="text-xs text-zinc-300">Student: {order.student.name} ({order.student.parent?.name})</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={async () => await fulfillOrder(order.id)} 
                    className="bg-lime-500 hover:bg-lime-600 text-zinc-950 font-bold"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Fulfill
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
