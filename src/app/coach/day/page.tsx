import { redirect } from "next/navigation";

// One coach app: today's sessions and attendance live on the coach home.
export default async function CoachDayPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) || {};
  redirect(sp.scope === "all" ? "/coach?tab=today&scope=all" : "/coach?tab=today");
}
