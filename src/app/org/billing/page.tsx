import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { listMyTriqInvoices, previewMyTriqBill } from "@/app/actions/triq-billing";
import { TriqInvoiceTable } from "@/components/billing/TriqInvoiceTable";
import { TriqBillSummary } from "@/components/billing/TriqBillSummary";
import { Card, Flash, Page, Section, ghostButtonCls } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TRIQ billing | Triq", robots: { index: false, follow: false } };

/** Owner-only: TRIQ's own plan invoices (DRAFT until issued) and this month's estimate. Nothing is charged here. */
export default async function TriqBillingPage() {
  if (!FEATURES.triqBilling) notFound();
  await requireAuth(["ADMIN"]);
  const [invoices, preview] = await Promise.all([listMyTriqInvoices(), previewMyTriqBill()]);
  const back = (
    <Link href="/org" className={ghostButtonCls}>
      Back
    </Link>
  );

  if (!invoices.ok) {
    return (
      <Page eyebrow="Billing" title="Your TRIQ plan" actions={back}>
        <Flash error={invoices.error} />
      </Page>
    );
  }

  return (
    <Page eyebrow="Billing" title="Your TRIQ plan" actions={back}>
      {preview.ok && (
        <Section title="This month (estimate)">
          <div className="grid gap-3 sm:grid-cols-2">
            <TriqBillSummary title="Monthly" bill={preview.monthly} founding={preview.founding} />
            <TriqBillSummary title="Annual option" bill={preview.annual} founding={preview.founding} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Active students are those enrolled in at least one batch. Free up to 30 active students. Estimates only; invoices are prepared at the start of each month.
          </p>
        </Section>
      )}
      <Section title="Invoices">
        <Card>
          <TriqInvoiceTable invoices={invoices.invoices} />
        </Card>
        <p className="mt-2 text-xs text-zinc-500">Draft invoices are not yet issued and nothing has been charged.</p>
      </Section>
    </Page>
  );
}
