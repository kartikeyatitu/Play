"use client";

import { useState } from "react";
import { createLoginLink } from "@/app/actions/login-links";
import { Link2, Loader2, Check } from "lucide-react";

/**
 * Admin-only: generates a single-use, 7-day login link for a coach/parent
 * and opens WhatsApp with it pre-filled. Falls back to copying the link.
 */
export function LoginLinkButton({
  userId,
  name,
  phone,
  academyName,
  label = "Login link",
}: {
  userId: string;
  name?: string | null;
  phone?: string | null;
  academyName: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await createLoginLink(userId);
      if (!res.success) {
        alert(res.error || "Could not create login link");
        return;
      }
      const displayName = (res.name || name || "there").split(" ")[0];
      const message = `Hi ${displayName}, here is your login link for ${academyName} on Triq: ${res.url}`;
      const digits = (res.phone || phone || "").replace(/\D/g, "");
      const waPhone = digits.length === 10 ? `91${digits}` : digits;

      if (waPhone) {
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      }
      try {
        await navigator.clipboard.writeText(res.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        if (!waPhone) window.prompt("Copy this login link (valid 7 days, single use):", res.url);
      }
    } catch (e: any) {
      alert(e?.message || "Could not create login link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="Send a one-tap login link on WhatsApp (valid 7 days, single use)"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : copied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
      {copied ? "Link copied" : label}
    </button>
  );
}
