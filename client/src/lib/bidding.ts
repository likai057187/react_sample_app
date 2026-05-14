import type { Artwork, LotRuntime } from "../types";

const MIN_INCREMENT_CENTS = 50_00;

export function nextMinimumBidCents(artwork: Artwork, lot: LotRuntime): number {
  if (lot.bids.length === 0) return artwork.openingBidCents;
  const pct = Math.max(MIN_INCREMENT_CENTS, Math.round(lot.currentBidCents * 0.05));
  return lot.currentBidCents + pct;
}
