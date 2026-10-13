import { getBatches, getOrgBySlug } from "@/app/actions/trial";
import { TrialClient } from "./TrialClient";

export default async function TrialPage({
  searchParams,
}: {
  searchParams: Promise<{ academy?: string; batch?: string }>;
}) {
  const { academy, batch } = await searchParams;

  if (!academy) {
    return <div className="p-8 text-center text-white bg-zinc-950 min-h-screen">Please use the link provided by your academy</div>;
  }

  const org = await getOrgBySlug(academy);

  if (!org) {
    return <div className="p-8 text-center text-white bg-zinc-950 min-h-screen">Academy not found.</div>;
  }

  const batches = await getBatches(org.id);

  return <TrialClient batches={batches} org={org} initialBatchId={batch} />;
}
