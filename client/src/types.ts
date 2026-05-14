export type Artwork = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  /** All exhibition images (angles); first is hero / catalog image */
  imageUrls: string[];
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

/** Authoritative auction snapshot from `GET /api/auction/state` (server JSON store). */
export type AuctionServerState = {
  eventEndsAt: number;
  lots: Record<string, LotRuntime>;
  /** lotId -> guestId -> 1–5 */
  votes: Record<string, Record<string, number>>;
  feedback: FeedbackEntry[];
};
