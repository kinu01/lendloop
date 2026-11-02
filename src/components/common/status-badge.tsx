import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/labels";

const STATUS_VARIANT: Record<
  keyof typeof STATUS_LABEL,
  ComponentProps<typeof Badge>["variant"]
> = {
  pending: "warning",
  approved: "success",
  declined: "neutral",
  cancelled: "neutral",
  returned: "neutral",
};

export function StatusBadge({
  status,
  isOverdue,
  hasStarted,
}: {
  status: keyof typeof STATUS_LABEL;
  isOverdue: boolean;
  hasStarted: boolean;
}) {
  if (isOverdue) return <Badge variant="destructive">Overdue</Badge>;
  if (status === "approved") {
    return hasStarted ? (
      <Badge variant="info">On loan</Badge>
    ) : (
      <Badge variant="neutral">Booked</Badge>
    );
  }
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function AvailabilityBadge({
  availability,
}: {
  availability: "available" | "on_loan";
}) {
  return availability === "available" ? (
    <Badge variant="success">Available</Badge>
  ) : (
    <Badge variant="info">On loan</Badge>
  );
}
