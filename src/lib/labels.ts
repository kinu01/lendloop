import { WAITING_COUNT_LIMIT } from "@convex/lib/validators";
import { CATEGORIES } from "@convex/lib/validators";

export { CATEGORIES };
export type Category = (typeof CATEGORIES)[number];

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const STATUS_LABEL = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
  returned: "Returned",
} as const;

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function formatDate(date: string): string {
  return DAY.format(utc(date));
}

export function formatRange(start: string, end: string): string {
  return start === end
    ? formatDate(start)
    : DAY.formatRange(utc(start), utc(end));
}

export function isCategory(value: string | null): value is Category {
  return (CATEGORIES as readonly string[]).includes(value ?? "");
}

export function hasOpenLoan(tool: {
  availability: "available" | "on_loan";
  bookings: unknown[];
}): boolean {
  return tool.availability === "on_loan" || tool.bookings.length > 0;
}

export function formatWaitingCount(count: number): string {
  return count > WAITING_COUNT_LIMIT
    ? `${WAITING_COUNT_LIMIT}+`
    : String(count);
}
