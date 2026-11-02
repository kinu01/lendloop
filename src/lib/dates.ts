import { addDays, rangesOverlap } from "@convex/lib/dates";

export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function firstFreeStart(
  bookings: { startDate: string; endDate: string }[],
  from: string,
  days: number,
): string {
  let start = from;
  for (const booking of bookings) {
    const range = { startDate: start, endDate: addDays(start, days - 1) };
    if (rangesOverlap(booking, range)) start = addDays(booking.endDate, 1);
  }
  return start;
}
