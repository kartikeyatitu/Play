// TRIQ Spaces utilisation report: pure aggregation over real booking rows. Spec §7.
// Metric definitions (documented so numbers can be reconciled with the rows):
//  capacityHours  = (closeHour − openHour) × days, using the facility's CURRENT opening hours
//  blockedHours   = hours of active maintenance blocks (source BLOCK, status CONFIRMED)
//  bookedHours    = hours of CONFIRMED + COMPLETED + NO_SHOW customer bookings
//  utilisation    = bookedHours ÷ (capacityHours − blockedHours), null when nothing was available
//  bookedValue    = Σ amount of those bookings (what customers agreed to pay)
//  recorded       = Σ advancePaid of those bookings (money recorded as received — NOT gateway-verified)

import { BLOCK_SOURCE } from "@/lib/venue-policy";

export type UtilFacility = { id: string; name: string; openHour: number; closeHour: number };
export type UtilBooking = {
  facilityId: string;
  startTime: Date;
  endTime: Date;
  status: string;
  source: string;
  amount: number;
  advancePaid: number;
};

export type UtilRow = {
  facilityId: string;
  name: string;
  capacityHours: number;
  blockedHours: number;
  bookedHours: number;
  utilisation: number | null;
  bookings: number;
  bookedValue: number;
  recorded: number;
  cancellations: number;
  noShows: number;
  online: number;
  counter: number;
};

const COUNTED = ["CONFIRMED", "COMPLETED", "NO_SHOW"];

const hoursOf = (b: UtilBooking) => Math.max(0, Math.round((b.endTime.getTime() - b.startTime.getTime()) / 3600_000));

export function computeUtilisation(facilities: UtilFacility[], bookings: UtilBooking[], days: number): { rows: UtilRow[]; total: UtilRow } {
  const rows = facilities.map<UtilRow>((f) => ({
    facilityId: f.id,
    name: f.name,
    capacityHours: Math.max(0, f.closeHour - f.openHour) * Math.max(0, days),
    blockedHours: 0,
    bookedHours: 0,
    utilisation: null,
    bookings: 0,
    bookedValue: 0,
    recorded: 0,
    cancellations: 0,
    noShows: 0,
    online: 0,
    counter: 0,
  }));
  const byId = new Map(rows.map((r) => [r.facilityId, r]));

  for (const b of bookings) {
    const r = byId.get(b.facilityId);
    if (!r) continue;
    if (b.source === BLOCK_SOURCE) {
      if (b.status === "CONFIRMED") r.blockedHours += hoursOf(b);
      continue;
    }
    if (b.status === "CANCELLED") {
      r.cancellations++;
      continue;
    }
    if (!COUNTED.includes(b.status)) continue; // HOLD, EXPIRED, PAID_CONFLICT are not delivered bookings
    r.bookings++;
    r.bookedHours += hoursOf(b);
    r.bookedValue += b.amount;
    r.recorded += b.advancePaid;
    if (b.status === "NO_SHOW") r.noShows++;
    if (b.source === "ONLINE") r.online++;
    else r.counter++;
  }

  const total: UtilRow = {
    facilityId: "ALL",
    name: "All courts",
    capacityHours: 0,
    blockedHours: 0,
    bookedHours: 0,
    utilisation: null,
    bookings: 0,
    bookedValue: 0,
    recorded: 0,
    cancellations: 0,
    noShows: 0,
    online: 0,
    counter: 0,
  };
  for (const r of rows) {
    const avail = r.capacityHours - r.blockedHours;
    r.utilisation = avail > 0 ? Math.min(1, r.bookedHours / avail) : null;
    for (const k of ["capacityHours", "blockedHours", "bookedHours", "bookings", "bookedValue", "recorded", "cancellations", "noShows", "online", "counter"] as const) {
      total[k] += r[k];
    }
  }
  const avail = total.capacityHours - total.blockedHours;
  total.utilisation = avail > 0 ? Math.min(1, total.bookedHours / avail) : null;
  return { rows, total };
}
