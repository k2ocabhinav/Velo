import { cn } from "../lib/cn";

export type StatusDomain = "ride" | "request" | "payout" | "driver" | "promo" | "user";
export type StatusTone = "neutral" | "info" | "live" | "attention" | "success" | "danger";

export interface StatusEntry {
  label: string;
  tone: StatusTone;
}

/** Single source of human labels and semantic tones for backend status enums. */
export const STATUS_MAP: Record<StatusDomain, Record<string, StatusEntry>> = {
  ride: {
    REQUESTED: { label: "Finding a driver", tone: "attention" },
    PENDING: { label: "Finding a driver", tone: "attention" },
    ASSIGNED: { label: "Driver assigned", tone: "info" },
    CONFIRMED: { label: "Driver assigned", tone: "info" },
    ARRIVING: { label: "Driver arriving", tone: "live" },
    ON_TRIP: { label: "Trip in progress", tone: "live" },
    ONGOING: { label: "Trip in progress", tone: "live" },
    COMPLETED: { label: "Completed", tone: "success" },
    ENDED: { label: "Completed", tone: "success" },
    CANCELLED: { label: "Cancelled", tone: "danger" },
  },
  request: {
    PENDING: { label: "Finding a driver", tone: "attention" },
    CANCELLED: { label: "Cancelled", tone: "danger" },
    CONFIRMED: { label: "Confirmed", tone: "success" },
    SCHEDULED: { label: "Scheduled", tone: "info" },
    EXPIRED: { label: "Expired", tone: "neutral" },
  },
  payout: {
    PENDING: { label: "Pending", tone: "attention" },
    APPROVED: { label: "Approved", tone: "info" },
    REJECTED: { label: "Rejected", tone: "danger" },
    PROCESSED: { label: "Processed", tone: "success" },
  },
  driver: {
    PENDING: { label: "Pending review", tone: "attention" },
    APPROVED: { label: "Active", tone: "success" },
    ACTIVE: { label: "Active", tone: "success" },
    REJECTED: { label: "Rejected", tone: "danger" },
    SUSPENDED: { label: "Suspended", tone: "danger" },
  },
  promo: {
    ACTIVE: { label: "Active", tone: "success" },
    INACTIVE: { label: "Inactive", tone: "neutral" },
    DEACTIVATED: { label: "Inactive", tone: "neutral" },
    EXPIRED: { label: "Expired", tone: "neutral" },
  },
  user: {
    ACTIVE: { label: "Active", tone: "success" },
    INACTIVE: { label: "Inactive", tone: "neutral" },
    DEACTIVATED: { label: "Inactive", tone: "neutral" },
    SUSPENDED: { label: "Suspended", tone: "danger" },
    DELETED: { label: "Deleted", tone: "danger" },
  },
};

export interface StatusBadgeProps {
  status: string | null | undefined;
  domain: StatusDomain;
  className?: string;
  labels?: StatusBadgeLabels;
}

/**
 * Tenant nouns that replace the default driver and trip words inside a status label, so a
 * white-label tenant reads "Finding a chauffeur" and "Transfer in progress" without a
 * second status map.
 */
export interface StatusBadgeLabels {
  driver?: string;
  trip?: string;
}

function humanizeStatus(status: string): string {
  const words = status.trim().toLowerCase().replace(/[_-]+/g, " ").split(/\s+/).filter(Boolean);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") || "Unknown";
}

function withTenantNouns(label: string, labels?: StatusBadgeLabels): string {
  const swap = (text: string, english: string, noun: string | undefined): string => {
    if (!noun) return text;
    return text.replace(new RegExp(`\\b${english}\\b`, "gi"), (matched) =>
      matched.charAt(0) === matched.charAt(0).toUpperCase() ? noun : noun.toLowerCase(),
    );
  };
  return swap(swap(label, "driver", labels?.driver), "trip", labels?.trip);
}

/** Show a domain-aware plain label and tone for a status value. */
export function StatusBadge({ className, domain, status, labels }: StatusBadgeProps) {
  const key = (status ?? "").trim().toUpperCase().replace(/[ -]+/g, "_");
  const entry = STATUS_MAP[domain][key] ?? { label: status ? humanizeStatus(status) : "Unknown", tone: "neutral" as const };

  return (
    <span className={cn("status-badge", className)} data-tone={entry.tone}>
      {withTenantNouns(entry.label, labels)}
    </span>
  );
}
