"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  connectRazorpay,
  disconnectRazorpay,
  getRazorpayStatus,
} from "@/app/actions/razorpay-connect";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Unplug,
} from "lucide-react";

type Status = {
  connected: boolean;
  keyId: string | null;
  mode: "test" | "live" | null;
  webhook: boolean;
  connectedAt: string | null;
  webhookUrl: string;
};

export function RazorpayConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const refreshStatus = async () => {
    try {
      const res = await getRazorpayStatus();
      setStatus(res);
    } catch (err: any) {
      console.error("Failed to load Razorpay status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyId.trim() || !keySecret.trim()) {
      toast.error("Please enter both Key ID and Key Secret.");
      return;
    }
    setConnecting(true);
    try {
      const res = await connectRazorpay({
        keyId: keyId.trim(),
        keySecret: keySecret.trim(),
        webhookSecret: webhookSecret.trim() || undefined,
      });
      if (res.success) {
        toast.success(
          `Razorpay connected in ${res.mode.toUpperCase()} mode! Direct fee payments are now active.`
        );
        setKeySecret("");
        setWebhookSecret("");
        await refreshStatus();
      } else {
        toast.error(res.error || "Failed to connect Razorpay.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to connect Razorpay.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        "Are you sure you want to disconnect Razorpay? Parents will no longer be able to pay via online links until you reconnect."
      )
    ) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await disconnectRazorpay();
      if (res.success) {
        toast.success("Razorpay disconnected.");
        await refreshStatus();
      } else {
        toast.error(res.error || "Failed to disconnect.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  };

  const copyWebhookUrl = () => {
    if (!status?.webhookUrl) return;
    navigator.clipboard.writeText(status.webhookUrl);
    setCopied(true);
    toast.success("Webhook URL copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card className="bg-zinc-900/30 border-zinc-800/50 p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400 mr-2" />
        <span className="text-sm text-zinc-400">Loading payment gateway status…</span>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/30 border-zinc-800/50 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Online Fee Collection (Razorpay)</h3>
            {status?.connected && (
              <Badge
                className={
                  status.mode === "live"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                }
              >
                {status.mode === "live" ? "LIVE" : "TEST MODE"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Accept UPI, cards, and netbanking directly into your academy&apos;s bank account. Triq never holds or touches your money.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 w-fit">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>AES-256 Encrypted</span>
        </div>
      </div>

      {status?.connected ? (
        <div className="space-y-5">
          <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="text-sm font-medium text-emerald-300">
                  Razorpay account is connected &amp; ready
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Key ID: <span className="font-mono text-zinc-200">{status.keyId}</span>
                  {status.connectedAt && (
                    <span className="ml-2">
                      • Connected on {new Date(status.connectedAt).toLocaleDateString("en-IN")}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="border-rose-900/40 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 self-start sm:self-auto"
            >
              {disconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Unplug className="w-4 h-4 mr-1.5" />
              )}
              Disconnect
            </Button>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Webhook (Instant Auto-Reconciliation)
              </span>
              <span className="text-xs text-zinc-500">
                {status.webhook ? "Configured with Secret" : "No Secret Added"}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              When a parent pays, Razorpay pings this URL to instantly flip the student&apos;s fee to <strong>PAID</strong> without waiting.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={status.webhookUrl}
                className="bg-zinc-900 border-zinc-800 text-zinc-300 font-mono text-xs select-all"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyWebhookUrl}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 shrink-0"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="ml-1.5 hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500">
              In Razorpay Dashboard → Account &amp; Settings → Webhooks → Add New Webhook. Paste this URL and select events:{" "}
              <code className="text-zinc-400">payment_link.paid</code>, <code className="text-zinc-400">payment.captured</code>, <code className="text-zinc-400">payment.failed</code>.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400 space-y-2">
            <p className="font-semibold text-zinc-200">How to get your Razorpay Keys:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                Log in to the{" "}
                <a
                  href="https://dashboard.razorpay.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline inline-flex items-center"
                >
                  Razorpay Dashboard <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </li>
              <li>Navigate to <strong>Account &amp; Settings → API Keys</strong></li>
              <li>Click <strong>Generate Key</strong> (or copy your existing Test/Live keys)</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-300 font-medium">Key ID *</label>
              <Input
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                placeholder="rzp_test_... or rzp_live_..."
                required
                className="bg-zinc-950 border-zinc-800 text-zinc-100 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-300 font-medium">Key Secret *</label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  placeholder="Paste Key Secret"
                  required
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400">Webhook Secret (Optional)</label>
              <span className="text-[11px] text-zinc-500">For instant automatic payment confirmations</span>
            </div>
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Secret defined in your Razorpay Webhook settings"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 font-mono text-sm"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={connecting || !keyId.trim() || !keySecret.trim()}
              className="bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Testing &amp; Connecting…
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Connect Razorpay
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
