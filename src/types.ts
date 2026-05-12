export type Artwork = {
  id: string;
  title: string;
  series: string;
  medium: string;
  dimensions: string;
  year: string;
  imageUrl: string;
  /** Short wall text for catalog cards */
  description: string;
  estimateLowCents: number;
  estimateHighCents: number;
  openingBidCents: number;
  reserveCents: number;
};

export type BidRecord = {
  id: string;
  guestId: string;
  amountCents: number;
  placedAt: number;
};

export type LotRuntime = {
  currentBidCents: number;
  bids: BidRecord[];
  /** Unix ms when this lot closes */
  endsAt: number;
};

export type FeedbackEntry = {
  id: string;
  lotId: string;
  guestId: string;
  displayName: string;
  body: string;
  createdAt: number;
};

export type PersistedState = {
  version: 1;
  eventEndsAt: number;
  lots: Record<string, LotRuntime>;
  /** lotId -> guestId -> 1–5 */
  votes: Record<string, Record<string, number>>;
  feedback: FeedbackEntry[];
};

export const STORAGE_KEY = "di-auction-v1";
export const GUEST_ID_KEY = "di-guest-id";
export const DISPLAY_NAME_KEY = "di-display-name";
