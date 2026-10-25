"use client";

import { useState } from "react";
import { updateAcademy, updateAcademyPayments, updateAcademyLocale } from "@/app/actions/academy";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RazorpayConnect } from "@/components/org/RazorpayConnect";
import { PhotoPicker } from "@/components/ui/photo-picker";
import { BranchesCard } from "@/components/org/BranchesCard";
import { COUNTRY_OPTIONS } from "@/lib/i18n";
import { Camera, Globe } from "lucide-react";

export function AcademySettings({ org }: { org: any }) {
  const [loading, setLoading] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [photos, setPhotos] = useState<string[]>((org?.photos as string[]) || []);
  const [country, setCountry] = useState<string>(org?.country || "IN");

  // When country changes, auto-fill derived locale fields from COUNTRY_OPTIONS
  // (user can still override each one if they want).
  const [currency, setCurrency] = useState<string>(org?.currency || "INR");
  const [timezone, setTimezone] = useState<string>(org?.timezone || "Asia/Kolkata");
  const [locale, setLocale] = useState<string>(org?.locale || "en-IN");
  const [phoneCountry, setPhoneCountry] = useState<string>(org?.phoneCountry || "91");

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const match = COUNTRY_OPTIONS.find((c) => c.code === newCountry);
    if (match) {
      setCurrency(match.currency);
      setTimezone(match.timezone);
      setLocale(match.locale);
      setPhoneCountry(match.phoneCountry);
    }
  };

  const handleLocaleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingLocale(true);
    const fd = new FormData();
    fd.set("country", country);
    fd.set("currency", currency);
    fd.set("timezone", timezone);
    fd.set("locale", locale);
    fd.set("phoneCountry", phoneCountry);
    try {
      const res = await updateAcademyLocale(fd);
      if (res.success) toast.success("Locale settings saved!");
      else toast.error(res.error || "Failed to save locale settings");
    } catch (err: any) {
      toast.error(err.message || "Failed to save locale settings");
    } finally {
      setSavingLocale(false);
    }
  };

  const handlePaymentsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingPayments(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateAcademyPayments(formData);
      if (res.success) toast.success("Payment settings saved!");
      else toast.error(res.error || "Failed to save payment settings");
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment settings");
    } finally {
      setSavingPayments(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await updateAcademy(org.id, formData);
      toast.success("Academy profile updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update academy profile");
    } finally {
      setLoading(false);
    }
  };

  if (!org) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-surface shadow-hairline p-6">
        <h3 className="text-lg font-semibold text-ink mb-1">Payments &amp; Fees</h3>
        <p className="text-xs text-ink-subtle mb-4">
          Parents pay directly to your UPI ID. Fee used for a student: student override → batch fee → default fee below.
        </p>
        <form onSubmit={handlePaymentsSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-3">
              <label htmlFor="upiId" className="text-xs font-medium text-ink-muted">
                UPI ID for receiving fees — e.g. <span className="font-mono">academy@okicici</span>
              </label>
              <Input
                id="upiId"
                name="upiId"
                defaultValue={org.upiId || ""}
                placeholder="academy@okicici"
                autoComplete="off"
                inputMode="email"
                className="bg-canvas border-line text-ink placeholder:text-ink-subtle"
                data-testid="settings-upi-id"
              />
              <p className="text-[11px] text-ink-subtle">
                We embed this as a one-tap UPI link in every fee reminder. Works with GPay, PhonePe, Paytm, BHIM.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="defaultMonthlyFee" className="text-xs font-medium text-ink-muted">Default monthly fee (₹)</label>
              <Input id="defaultMonthlyFee" name="defaultMonthlyFee" type="number" min={0} step={1} defaultValue={org.defaultMonthlyFee ?? ""} placeholder="e.g. 2000" className="bg-canvas border-line text-ink placeholder:text-ink-subtle" />
            </div>
            <div className="space-y-2">
              <label htmlFor="coachSessionRate" className="text-xs font-medium text-ink-muted">Coach pay per session (₹)</label>
              <Input id="coachSessionRate" name="coachSessionRate" type="number" min={0} step={1} defaultValue={org.coachSessionRate ?? ""} placeholder="Optional" className="bg-canvas border-line text-ink placeholder:text-ink-subtle" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={savingPayments} className="bg-volt text-volt-fg hover:bg-volt/90 font-medium">
              {savingPayments ? "Saving..." : "Save Payment Settings"}
            </Button>
          </div>
        </form>
      </section>

      <RazorpayConnect />

      {/* ────────── Academy photos ────────── */}
      <section className="rounded-xl border border-line bg-surface shadow-hairline p-6">
        <div className="flex items-start gap-3 mb-4">
          <Camera className="w-5 h-5 text-ink-muted mt-0.5 shrink-0" aria-hidden />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-ink">Photos</h3>
            <p className="text-xs text-ink-subtle">
              Shown on your public academy listing. The first photo is the hero image.
            </p>
          </div>
        </div>
        <PhotoPicker mode="auto" photos={photos} onChange={setPhotos} maxPhotos={6} />
      </section>

      <BranchesCard />

      {/* ────────── Country, currency, timezone, locale ────────── */}
      <section className="rounded-xl border border-line bg-surface shadow-hairline p-6">
        <div className="flex items-start gap-3 mb-4">
          <Globe className="w-5 h-5 text-ink-muted mt-0.5 shrink-0" aria-hidden />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-ink">Country &amp; locale</h3>
            <p className="text-xs text-ink-subtle">
              Controls how currency, dates and phone numbers are formatted across your academy.
            </p>
          </div>
        </div>
        <form onSubmit={handleLocaleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="country" className="text-xs font-medium text-ink-muted">
                Country — picks matching currency, timezone, locale and phone code
              </label>
              <select
                id="country"
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink"
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="currency" className="text-xs font-medium text-ink-muted">
                Currency (ISO 4217)
              </label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                className="bg-canvas border-line text-ink"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phoneCountry" className="text-xs font-medium text-ink-muted">
                Phone country code (without +)
              </label>
              <Input
                id="phoneCountry"
                value={phoneCountry}
                onChange={(e) => setPhoneCountry(e.target.value.replace(/\D/g, ""))}
                maxLength={4}
                className="bg-canvas border-line text-ink"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="timezone" className="text-xs font-medium text-ink-muted">
                Timezone (IANA)
              </label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                maxLength={64}
                className="bg-canvas border-line text-ink"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="locale" className="text-xs font-medium text-ink-muted">
                Locale (BCP-47)
              </label>
              <Input
                id="locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                maxLength={32}
                className="bg-canvas border-line text-ink"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={savingLocale}
              className="bg-volt text-volt-fg hover:bg-volt/90 font-medium"
            >
              {savingLocale ? "Saving..." : "Save Locale Settings"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-surface shadow-hairline p-6">
        <h3 className="text-lg font-semibold text-ink mb-4">Academy Profile Details</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-muted">Academy Name *</label>
              <Input name="name" defaultValue={org.name} required className="bg-canvas border-line text-ink" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-muted">Primary Sport</label>
              <Input name="sport" defaultValue={org.sport || ""} className="bg-canvas border-line text-ink" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-muted">City *</label>
              <Input name="city" defaultValue={org.city} required className="bg-canvas border-line text-ink" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-muted">State *</label>
              <Input name="state" defaultValue={org.state} required className="bg-canvas border-line text-ink" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-muted">Full Address</label>
              <Input name="address" defaultValue={org.address || ""} className="bg-canvas border-line text-ink" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-muted">PIN Code</label>
              <Input name="pincode" defaultValue={org.pincode || ""} placeholder="e.g. 560001" maxLength={6} className="bg-canvas border-line text-ink placeholder:text-ink-subtle" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-muted">Contact Phone</label>
              <Input name="phone" defaultValue={org.phone || ""} className="bg-canvas border-line text-ink" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-muted">Contact Email</label>
              <Input name="email" type="email" defaultValue={org.email || ""} className="bg-canvas border-line text-ink" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-medium text-ink-muted">Logo URL</label>
              <Input name="logo" defaultValue={org.logo || ""} placeholder="https://example.com/logo.png" className="bg-canvas border-line text-ink placeholder:text-ink-subtle" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loading} className="bg-volt text-volt-fg hover:bg-volt/90 font-medium">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
