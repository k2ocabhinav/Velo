import { STATUS_MAP, type StatusDomain } from "@velo/ui";

type TenantStatusProps = {
  domain: StatusDomain;
  status: string | null | undefined;
  label: string;
};

export function TenantStatus({ domain, status, label }: TenantStatusProps) {
  const key = (status ?? "").trim().toUpperCase().replace(/[ -]+/g, "_");
  const tone = STATUS_MAP[domain][key]?.tone ?? "neutral";

  return <span className="status-badge" data-tone={tone}>{label}</span>;
}
