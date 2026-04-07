export function MetricCard({
  label,
  value,
  detail
}: Readonly<{
  label: string;
  value: string;
  detail: string;
}>) {
  return (
    <article className="panel metric-card">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}
