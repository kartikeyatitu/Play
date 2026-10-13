"use client";

import { useRef, useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface RecapShareData {
  batchName: string;
  sport: string;
  dateLabel: string;
  present: number;
  total: number;
  recap: string;
  coachName: string;
  academyName: string;
  showPoweredBy: boolean;
}

const W = 1080;
const H = 1350;
const PAD = 88;
const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const DEFAULT_BRAND = "#a3e635";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Word-wrap `text` into at most `maxLines` lines of `maxWidth`, ellipsising the last line if cut. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.replace(/\r/g, "").split("\n").map((p) => p.trim()).filter(Boolean);
  let truncated = false;

  outer: for (let pi = 0; pi < paragraphs.length; pi++) {
    const words = paragraphs[pi].split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        if (lines.length === maxLines) {
          truncated = true;
          break outer;
        }
      }
      // A single very long word: hard-break it
      let w = word;
      while (ctx.measureText(w).width > maxWidth && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && ctx.measureText(w.slice(0, cut)).width > maxWidth) cut--;
        lines.push(w.slice(0, cut));
        if (lines.length === maxLines) {
          truncated = true;
          break outer;
        }
        w = w.slice(cut);
      }
      line = w;
    }
    if (line) {
      lines.push(line);
      if (lines.length === maxLines) {
        if (pi < paragraphs.length - 1) truncated = true;
        break;
      }
    }
  }

  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Reads the white-label `--brand` CSS variable (org override on the shell, else Triq lime). */
function resolveBrand(el: HTMLElement | null): string {
  try {
    const v = getComputedStyle(el || document.documentElement).getPropertyValue("--brand").trim();
    return v || DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}

function drawCard(data: RecapShareData, brand: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#18181b");
  bg.addColorStop(1, "#09090b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft brand glow, top-right
  const glow = ctx.createRadialGradient(W - 120, 120, 0, W - 120, 120, 520);
  glow.addColorStop(0, /^#[0-9a-f]{6}$/i.test(brand) ? `${brand}33` : "rgba(163,230,53,0.2)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Accent bar
  ctx.fillStyle = brand;
  ctx.fillRect(0, 0, W, 18);

  const contentW = W - PAD * 2;
  ctx.textBaseline = "alphabetic";

  // Academy name
  let y = 150;
  ctx.fillStyle = brand;
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText(fitText(ctx, data.academyName.toUpperCase(), contentW), PAD, y);

  // Batch name (max 2 lines)
  y += 84;
  ctx.fillStyle = "#fafafa";
  ctx.font = `800 68px ${FONT}`;
  const titleLines = wrapLines(ctx, data.batchName, contentW, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, PAD, y + i * 80));
  y += Math.max(0, titleLines.length - 1) * 80;

  // Sport · date
  y += 62;
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText(fitText(ctx, [data.sport, data.dateLabel].filter(Boolean).join("  ·  "), contentW), PAD, y);

  // Attendance block
  y += 52;
  const boxH = 260;
  roundRect(ctx, PAD, y, contentW, boxH, 36);
  ctx.fillStyle = "rgba(39,39,42,0.75)";
  ctx.fill();
  ctx.strokeStyle = "rgba(63,63,70,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const statX = PAD + 48;
  ctx.fillStyle = "#fafafa";
  ctx.font = `900 150px ${FONT}`;
  const presentStr = String(data.present);
  ctx.fillText(presentStr, statX, y + 170);
  const presentW = ctx.measureText(presentStr).width;
  ctx.fillStyle = "#71717a";
  ctx.font = `800 80px ${FONT}`;
  ctx.fillText(`/${data.total}`, statX + presentW + 8, y + 170);

  ctx.fillStyle = "#d4d4d8";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText("attended", statX, y + 222);

  // Percentage + progress bar on the right
  const pct = data.total > 0 ? Math.max(0, Math.min(1, data.present / data.total)) : 0;
  const barW = 280;
  const barX = PAD + contentW - 48 - barW;
  ctx.fillStyle = brand;
  ctx.font = `900 64px ${FONT}`;
  const pctStr = `${Math.round(pct * 100)}%`;
  ctx.fillText(pctStr, barX + barW - ctx.measureText(pctStr).width, y + 130);
  roundRect(ctx, barX, y + 168, barW, 18, 9);
  ctx.fillStyle = "#3f3f46";
  ctx.fill();
  if (pct > 0) {
    roundRect(ctx, barX, y + 168, Math.max(18, barW * pct), 18, 9);
    ctx.fillStyle = brand;
    ctx.fill();
  }
  y += boxH;

  // Coach's note
  y += 84;
  ctx.fillStyle = "#71717a";
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText("COACH'S NOTE", PAD, y);

  y += 62;
  ctx.fillStyle = "#e4e4e7";
  ctx.font = `500 40px ${FONT}`;
  const footerTop = data.showPoweredBy ? H - 150 : H - 70;
  const coachLineY = footerTop - 48;
  const lineH = 56;
  const availableLines = Math.max(1, Math.floor((coachLineY - 80 - y) / lineH) + 1);
  const recapLines = wrapLines(ctx, data.recap?.trim() || "Great session today!", contentW, Math.min(8, availableLines));
  recapLines.forEach((l, i) => ctx.fillText(l, PAD, y + i * lineH));

  // Coach name
  ctx.fillStyle = "#fafafa";
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText(fitText(ctx, `— ${data.coachName}`, contentW), PAD, coachLineY);

  // Footer
  if (data.showPoweredBy) {
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, footerTop);
    ctx.lineTo(W - PAD, footerTop);
    ctx.stroke();

    const left = "Powered by ";
    const brandWord = "Triq";
    const right = "  ·  triqsports.vercel.app";
    ctx.font = `600 30px ${FONT}`;
    const leftW = ctx.measureText(left).width;
    const rightW = ctx.measureText(right).width;
    ctx.font = `900 30px ${FONT}`;
    const brandW = ctx.measureText(brandWord).width;
    let x = (W - (leftW + brandW + rightW)) / 2;
    const fy = footerTop + 76;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillStyle = "#71717a";
    ctx.fillText(left, x, fy);
    x += leftW;
    ctx.font = `900 30px ${FONT}`;
    ctx.fillStyle = brand;
    ctx.fillText(brandWord, x, fy);
    x += brandW;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillStyle = "#71717a";
    ctx.fillText(right, x, fy);
  }

  return canvas;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create image"))), "image/png");
  });
}

function textVersion(d: RecapShareData) {
  const lines = [
    `*${d.academyName}* · ${d.batchName}`,
    `${d.dateLabel}: ${d.present}/${d.total} attended`,
    "",
    d.recap,
    "",
    `— ${d.coachName}`,
  ];
  if (d.showPoweredBy) lines.push("", "Sent via Triq · triqsports.vercel.app");
  return lines.join("\n");
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "recap";
}

export function ShareRecapButton({ data, className }: { data: RecapShareData; className?: string }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const fallback = (blob: Blob | null, fileName: string, text: string) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    toast.success(blob ? "Card downloaded — attach it in WhatsApp" : "Opening WhatsApp…");
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    const text = textVersion(data);
    const fileName = `${slugify(data.batchName)}-recap.png`;
    let blob: Blob | null = null;
    try {
      const canvas = drawCard(data, resolveBrand(ref.current));
      blob = await toBlob(canvas);
      const file = new File([blob], fileName, { type: "image/png" });
      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });
      if (canShareFiles) {
        try {
          await navigator.share({ files: [file], text });
          toast.success("Recap shared");
        } catch (err) {
          const name = (err as { name?: string } | null)?.name;
          if (name === "AbortError") return; // user closed the share sheet
          // NotAllowedError (lost user activation, e.g. iOS Safari) or anything else → fallback
          fallback(blob, fileName, text);
        }
      } else {
        fallback(blob, fileName, text);
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create the recap card — sharing as text instead.");
      try {
        fallback(blob, fileName, text);
      } catch {
        // ignore
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleShare}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-2 h-10 px-3 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/70 disabled:opacity-60 transition-colors ${className || ""}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
      Share recap card
    </button>
  );
}
