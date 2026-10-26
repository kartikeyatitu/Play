"use client";

import { useEffect, useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getTaxProfile, saveTaxProfile } from "@/app/actions/gst-invoices";
import { GST_STATE_CODES, SAC_HINTS, normalizeGstin, validateGstin } from "@/lib/gst";

type Form = {
  legalName: string;
  gstin: string;
  address: string;
  sacCode: string;
  ratePct: string;
  priceMode: "INCLUSIVE" | "EXCLUSIVE";
  invoicePrefix: string;
  creditNotePrefix: string;
};

const EMPTY: Form = { legalName: "", gstin: "", address: "", sacCode: "", ratePct: "", priceMode: "INCLUSIVE", invoicePrefix: "INV", creditNotePrefix: "CN" };

/** Settings → GST details (flag gstInvoices). Writes need settings.manage. */
export function GstSettingsCard() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTaxProfile()
      .then((r) => {
        if (!r.success) {
          setError(r.error);
          return;
        }
        setCanEdit(r.canEdit);
        if (r.profile) {
          setForm({
            legalName: r.profile.legalName,
            gstin: r.profile.gstin,
            address: r.profile.address,
            sacCode: r.profile.sacCode,
            ratePct: String(r.profile.rateBps / 100),
            priceMode: r.profile.priceMode === "EXCLUSIVE" ? "EXCLUSIVE" : "INCLUSIVE",
            invoicePrefix: r.profile.invoicePrefix,
            creditNotePrefix: r.profile.creditNotePrefix,
          });
        }
      })
      .catch(() => setError("Couldn't load GST details."))
      .finally(() => setLoading(false));
  }, []);

  const gstinCheck = form.gstin.length >= 15 ? validateGstin(form.gstin) : null;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === "gstin" ? normalizeGstin(e.target.value) : e.target.value }));

  async function onSave() {
    setSaving(true);
    try {
      const rateBps = Math.round(Number(form.ratePct) * 100);
      const res = await saveTaxProfile({ ...form, rateBps });
      if (!res.success) toast.error(res.error);
      else toast.success("GST details saved");
    } catch {
      toast.error("Couldn't save GST details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface shadow-hairline p-6">
      <div className="flex items-start gap-3 mb-4">
        <Landmark className="w-5 h-5 text-ink-muted mt-0.5 shrink-0" aria-hidden />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-ink">GST details</h3>
          <p className="text-xs text-ink-subtle">Used on GST tax invoices for fees. Your fee amounts and receipts are not changed.</p>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-ink-subtle">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <fieldset disabled={!canEdit || saving} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-subtle sm:col-span-2">
            Legal name (as on GST registration)
            <Input value={form.legalName} onChange={set("legalName")} maxLength={160} />
          </label>
          <label className="text-xs text-ink-subtle">
            GSTIN
            <Input value={form.gstin} onChange={set("gstin")} maxLength={15} placeholder="27AAPFU0939F1ZV" className="font-mono" />
            {gstinCheck && (
              <span className={gstinCheck.ok ? "text-emerald-600" : "text-red-500"}>
                {gstinCheck.ok ? `Valid · ${GST_STATE_CODES[gstinCheck.stateCode]}` : gstinCheck.error}
              </span>
            )}
          </label>
          <label className="text-xs text-ink-subtle">
            SAC / HSN code
            <Input value={form.sacCode} onChange={set("sacCode")} maxLength={8} inputMode="numeric" list="gst-sac-hints" />
            <datalist id="gst-sac-hints">
              {SAC_HINTS.map((h) => (
                <option key={h.code} value={h.code}>{h.label}</option>
              ))}
            </datalist>
            <span>Ask your CA. Common: {SAC_HINTS.map((h) => `${h.code} (${h.label})`).join(", ")}.</span>
          </label>
          <label className="text-xs text-ink-subtle sm:col-span-2">
            Registered address
            <textarea value={form.address} onChange={set("address")} maxLength={400} rows={2} className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" />
          </label>
          <label className="text-xs text-ink-subtle">
            GST rate (%)
            <Input value={form.ratePct} onChange={set("ratePct")} inputMode="decimal" placeholder="e.g. 18" />
          </label>
          <label className="text-xs text-ink-subtle">
            Your fee amounts are
            <select value={form.priceMode} onChange={set("priceMode")} className="h-10 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink">
              <option value="INCLUSIVE">Inclusive of GST</option>
              <option value="EXCLUSIVE">Exclusive of GST (GST shown on top)</option>
            </select>
            {form.priceMode === "EXCLUSIVE" && (
              <span className="text-amber-600">TRIQ does not add GST to fees yet, so exclusive invoices show the GST as a balance due.</span>
            )}
          </label>
          <label className="text-xs text-ink-subtle">
            Invoice number prefix
            <Input value={form.invoicePrefix} onChange={set("invoicePrefix")} maxLength={4} className="uppercase" />
          </label>
          <label className="text-xs text-ink-subtle">
            Credit note prefix
            <Input value={form.creditNotePrefix} onChange={set("creditNotePrefix")} maxLength={4} className="uppercase" />
          </label>
          {canEdit ? (
            <div className="sm:col-span-2">
              <Button type="button" onClick={onSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save GST details
              </Button>
            </div>
          ) : (
            <p className="text-xs text-ink-subtle sm:col-span-2">Only people with settings access can change these.</p>
          )}
        </fieldset>
      )}
    </section>
  );
}
