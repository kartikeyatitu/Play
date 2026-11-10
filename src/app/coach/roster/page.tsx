import { redirect } from "next/navigation";

// One coach app: the squad roster lives on the coach home.
export default async function CoachRosterPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) || {};
  redirect(sp.scope === "all" ? "/coach?tab=squad&scope=all" : "/coach?tab=squad");
}
