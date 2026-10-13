"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCoupon } from "@/app/actions/coupons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Coupon = {
  id: string;
  code: string;
  discount: number;
  type: string;
  isActive: boolean;
  usageLimit: number;
  usedCount: number;
  createdAt: Date;
};

export function CouponManager({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    discount: "",
    type: "FLAT",
  });
  const [error, setError] = useState("");

  const selectClass = "flex h-10 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-700 disabled:cursor-not-allowed disabled:opacity-50";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.discount) return;

    setIsSubmitting(true);
    setError("");

    const result = await createCoupon(
      formData.code, 
      parseFloat(formData.discount), 
      formData.type
    );

    if (result.success && result.data) {
      setCoupons([result.data, ...coupons]);
      setFormData({ code: "", discount: "", type: "FLAT" });
    } else {
      setError(result.error || "Failed to create coupon");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/40 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle>Create Discount Coupon</CardTitle>
          <CardDescription className="text-zinc-400">Add new promotional codes</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm text-zinc-400">Coupon Code</label>
              <Input
                className="bg-zinc-950 border-zinc-800 uppercase"
                placeholder="e.g. SUMMER20"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="w-32 space-y-2">
              <label className="text-sm text-zinc-400">Type</label>
              <select 
                className={selectClass}
                value={formData.type} 
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="FLAT">Flat (₹)</option>
                <option value="PERCENT">Percent (%)</option>
              </select>
            </div>
            <div className="w-32 space-y-2">
              <label className="text-sm text-zinc-400">Discount</label>
              <Input
                className="bg-zinc-950 border-zinc-800"
                type="number"
                min="1"
                placeholder={formData.type === "PERCENT" ? "e.g. 10" : "e.g. 500"}
                value={formData.discount}
                onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </form>
          {error && <p className="text-sm text-rose-500 mt-4">{error}</p>}
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/40 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle>Active Coupons</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                <TableHead className="text-zinc-400">Code</TableHead>
                <TableHead className="text-zinc-400">Discount</TableHead>
                <TableHead className="text-zinc-400">Usage</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400 text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                  <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                    No coupons created yet.
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((coupon) => (
                  <TableRow key={coupon.id} className="border-zinc-800 hover:bg-zinc-900/50">
                    <TableCell className="font-mono font-bold text-amber-400">{coupon.code}</TableCell>
                    <TableCell>
                      {coupon.type === "FLAT" ? "₹" : ""}{coupon.discount}{coupon.type === "PERCENT" ? "%" : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-sky-500" 
                            style={{ width: `${Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400">
                          {coupon.usedCount} / {coupon.usageLimit}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {coupon.isActive ? (
                        <Badge variant="lime">ACTIVE</Badge>
                      ) : (
                        <Badge variant="outline">INACTIVE</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-zinc-400">
                      {new Date(coupon.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
