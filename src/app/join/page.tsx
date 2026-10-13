import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import JoinForm from "./JoinForm";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ academy?: string }>;
}) {
  const { academy } = await searchParams;

  if (!academy) {
    return <div className="p-8 text-center text-white">Please use the link provided by your academy</div>;
  }

  const org = await db.organization.findUnique({ where: { slug: academy } });

  if (!org) return <div className="p-8 text-center text-white">Academy not found.</div>;

  const batches = await db.batch.findMany({
    where: { orgId: org.id },
    select: { id: true, name: true, sport: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader className="text-center">
          <div className="mx-auto bg-cyan-500 w-12 h-12 rounded-full flex items-center justify-center mb-2">
            <Trophy className="text-zinc-950 w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">{org.name}</CardTitle>
          <CardDescription>{org.city ? `${org.city} • ` : ""}Academy Registration Form</CardDescription>
        </CardHeader>
        <CardContent>
          <JoinForm orgName={org.name} slug={org.slug} batches={batches} />
        </CardContent>
      </Card>
    </div>
  );
}
