"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { placeOrder } from "@/app/actions/store";
import { Loader2, ShoppingBag } from "lucide-react";

export function ProShop({ products, studentId }: { products: any[], studentId: string }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleBuy(productId: string) {
    setLoadingId(productId);
    await placeOrder(productId, studentId);
    setLoadingId(null);
    alert("Order placed! Pay your coach at the next practice.");
  }

  return (
    <div className="pt-4 border-t border-zinc-800 mt-6">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <ShoppingBag className="w-4 h-4" /> Academy Pro Shop
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {products.map(p => (
          <div key={p.id} className="flex justify-between items-center bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <div>
              <h4 className="font-bold text-zinc-200">{p.name}</h4>
              <p className="text-sm text-indigo-400 font-bold">₹{p.price}</p>
              {p.description && <p className="text-xs text-zinc-500 mt-1">{p.description}</p>}
            </div>
            <Button 
              size="sm" 
              variant="outline"
              disabled={loadingId === p.id}
              onClick={() => handleBuy(p.id)}
              className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500 hover:text-white"
            >
              {loadingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buy"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
