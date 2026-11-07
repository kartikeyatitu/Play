"use server";

// TRIQ's own subscription invoices (SubscriptionInvoice, flag FEATURES.triqBilling). Read-only for the
// academy owner. DRAFT invoices are created only by the cron route; nothing here charges anyone.
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getSession } from "@/lib/auth";
import { isOrgOwner } from "@/lib/membership";
import { taxBreakup, type TriqBill } from "@/lib/billing/calc";
import { istMonthOf } from "@/lib/billing/periods";
import { previewOrgBill } from "@/lib/billing/server";

const OFF_ERROR = "TRIQ billing is not switched on yet.";

export interface TriqInvoiceView {
  id: string;
  invoiceNumber: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  activeStudents: number;
  currency: string;
  amountPaise: number;
  gstPaise: number;
  totalPaise: number;
  taxKind: string;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

async function ownerOrgId(): Promise<{ ok: true; orgId: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session?.id || !session.orgId) return { ok: false, error: "Please sign in again." };
  if (!(await isOrgOwner(session.id, session.orgId))) return { ok: false, error: "Only the academy owner can see TRIQ billing." };
  return { ok: true, orgId: session.orgId };
}

export async function listMyTriqInvoices(): Promise<{ ok: true; invoices: TriqInvoiceView[] } | { ok: false; error: string }> {
  if (!FEATURES.triqBilling) return { ok: false, error: OFF_ERROR };
  const who = await ownerOrgId();
  if (!who.ok) return who;
  const [org, rows] = await Promise.all([
    db.organization.findUnique({ where: { id: who.orgId }, select: { state: true } }),
    db.subscriptionInvoice.findMany({ where: { orgId: who.orgId }, orderBy: { periodStart: "desc" }, take: 36 }),
  ]);
  return {
    ok: true,
    invoices: rows.map((r) => {
      const t = taxBreakup(r.amountPaise, r.gstPaise, r.currency, org?.state);
      return {
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        status: r.status,
        periodStart: r.periodStart.toISOString(),
        periodEnd: r.periodEnd.toISOString(),
        activeStudents: r.activeStudents,
        currency: r.currency,
        amountPaise: r.amountPaise,
        gstPaise: r.gstPaise,
        totalPaise: r.amountPaise + r.gstPaise,
        taxKind: t.kind,
        cgstPaise: t.cgst,
        sgstPaise: t.sgst,
        igstPaise: t.igst,
      };
    }),
  };
}

/** Estimate for the current IST month, monthly and annual. Not an invoice. */
export async function previewMyTriqBill(): Promise<
  { ok: true; month: string; founding: boolean; monthly: TriqBill; annual: TriqBill } | { ok: false; error: string }
> {
  if (!FEATURES.triqBilling) return { ok: false, error: OFF_ERROR };
  const who = await ownerOrgId();
  if (!who.ok) return who;
  const month = istMonthOf(new Date());
  const [m, a] = await Promise.all([previewOrgBill(who.orgId, month, "MONTHLY"), previewOrgBill(who.orgId, month, "ANNUAL")]);
  if (!m || !a) return { ok: false, error: "Academy not found." };
  return { ok: true, month, founding: m.founding, monthly: m.bill, annual: a.bill };
}
