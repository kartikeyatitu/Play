import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LandingPage } from "@/components/marketing/landing-page";
import { FREE_PLAN } from "@/lib/pricing";

const title = "Triq — Run your sports academy from your phone";
const description = `Attendance in seconds, fees collected on time and parents updated automatically. Built for Indian sports coaches and academies. Free up to ${FREE_PLAN.maxStudents} students.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Triq",
    type: "website",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title, description },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  // Logged-in users go straight to their app (unchanged behaviour).
  if (session) {
    if (session.role === "ADMIN") redirect("/org");
    if (session.role === "COACH") redirect("/coach");
    if (session.role === "STAFF") redirect("/staff");
    if (session.role === "PARENT") redirect("/parent");
  }

  // Logged-out visitors (and any other role) see the marketing landing page at "/".
  return <LandingPage searchParams={await searchParams} page="/" />;
}
