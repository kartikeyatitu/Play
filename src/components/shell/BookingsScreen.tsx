"use client";

import { TurfBoard } from "@/components/org/TurfBoard";
import { VenueUtilisation } from "@/components/org/VenueUtilisation";
import { FEATURES } from "@/lib/features";

/** Bookings tab: real hourly court/turf bookings (see TurfBoard). Fetches its own data. */
export function BookingsScreen() {
  return (
    <div className="space-y-6">
      <TurfBoard />
      {FEATURES.spacesOps && <VenueUtilisation />}
    </div>
  );
}
