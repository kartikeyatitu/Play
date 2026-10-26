import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export default async function JoinSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ academy?: string }>;
}) {
  const { academy } = await searchParams;
  const org = academy
    ? await db.organization.findUnique({ where: { slug: academy }, select: { name: true } })
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader className="text-center">
          <div className="mx-auto bg-cyan-500 w-12 h-12 rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 className="text-zinc-950 w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Registration received</CardTitle>
          {org && <CardDescription>{org.name}</CardDescription>}
        </CardHeader>
        <CardContent className="text-center text-sm text-zinc-300">
          Your academy will review your registration and confirm the batch. Once they approve it, they'll send you a one-tap login link on WhatsApp.
        </CardContent>
      </Card>
    </div>
  );
}
