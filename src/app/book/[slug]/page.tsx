import type { Metadata } from "next";
import { getPublicVenue } from "../actions";
import { BookClient } from "./BookClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getPublicVenue(slug);
  return { title: venue ? `Book a slot · ${venue.name}` : "Book a slot", description: venue ? `Book a court at ${venue.name} in under a minute.` : undefined };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await getPublicVenue(slug);
  if (!venue) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-semibold">This booking page isn&apos;t available.</p>
          <p className="text-sm text-zinc-400 mt-1">Please check the link with the venue.</p>
        </div>
      </div>
    );
  }
  return <BookClient venue={venue} />;
}
