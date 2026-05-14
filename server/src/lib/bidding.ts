const MIN_INCREMENT_CENTS = 50_00;

export function nextMinimumBidCents(
  openingBidCents: number,
  currentBidCents: number,
  bidCount: number,
): number {
  if (bidCount === 0) return openingBidCents;
  const pct = Math.max(MIN_INCREMENT_CENTS, Math.round(currentBidCents * 0.05));
  return currentBidCents + pct;
}

export function isReserveMet(reserveCents: number, currentBidCents: number): boolean {
  return currentBidCents >= reserveCents;
}
