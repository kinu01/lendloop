import { z } from "zod";
import { addDays, isIsoDate, todayUtc } from "./dates";
import { fail } from "./errors";
import {
  CATEGORIES,
  CONDITIONS,
  DESCRIPTION_MAX,
  NAME_MAX,
} from "./validators";

const FAILURE_MESSAGE_MAX = 200;

const isoDate = z
  .string()
  .refine(isIsoDate, "Dates must be valid YYYY-MM-DD dates.");

export const toolInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name for the tool.")
    // Names reach log lines, where a line break could forge an entry.
    .regex(
      /^\P{Cc}*$/u,
      "Name cannot contain line breaks or control characters.",
    )
    .max(NAME_MAX, `Name must be ${NAME_MAX} characters or fewer.`),
  category: z.enum(CATEGORIES),
  condition: z.enum(CONDITIONS),
  description: z
    .string()
    .trim()
    .max(
      DESCRIPTION_MAX,
      `Description must be ${DESCRIPTION_MAX} characters or fewer.`,
    ),
});
export type ToolInput = z.infer<typeof toolInput>;

export const loanDates = z
  .object({ startDate: isoDate, endDate: isoDate })
  .refine((dates) => dates.endDate >= dates.startDate, {
    message: "The end date must be on or after the start date.",
    path: ["endDate"],
  });
export type LoanDates = z.infer<typeof loanDates>;

const loanIdText = z.string().min(1).max(64);
const runIdText = z.string().min(1).max(100);

function isNearToday(value: string) {
  const today = todayUtc();
  return value >= addDays(today, -1) && value <= addDays(today, 1);
}

// A retry can cross midnight, so the day before and after are accepted too.
const reminderDate = isoDate.refine(isNearToday);

export const reminderClaimBody = z.object({
  loanId: loanIdText,
  runId: runIdText,
  reminderDate,
});

export const reminderRecordBody = reminderClaimBody.extend({
  status: z.enum(["sent", "failed"]),
});

export const automationFailureBody = z.object({
  workflow: z.string().min(1).max(100),
  executionId: z.string().min(1).max(100),
  loanId: loanIdText.optional(),
  message: z.string().transform((text) => text.slice(0, FAILURE_MESSAGE_MAX)),
});

export function parseOrFail<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success)
    fail("INVALID", result.error.issues[0]?.message ?? "Invalid input.");
  return result.data;
}

export function parseToday(value: string) {
  return parseOrFail(isoDate, value);
}

// Anyone can call the public list, and an old date would show tools that are on loan today.
export function parsePublicToday(value: string) {
  return parseOrFail(
    isoDate.refine(isNearToday, "The date must be today."),
    value,
  );
}
