const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsdFromCents(cents: number): string {
  return usd.format(Math.round(cents / 100));
}

export function formatRelativeTime(isoOrMs: number): string {
  const d = new Date(isoOrMs);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
