import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { catalogToArtworks } from "../data/artworks";
import { loadCatalog } from "../data/catalog";
import { nextMinimumBidCents } from "../lib/bidding";
import { getOrCreateGuestId } from "../lib/guest";
import { loadPersisted, savePersisted } from "../lib/persist";
import type { Artwork, FeedbackEntry, LotRuntime, PersistedState } from "../types";

const DEFAULT_EVENT_END = new Date("2026-05-31T21:00:00").getTime();

type Action =
  | { type: "PLACE_BID"; lotId: string; amountCents: number }
  | { type: "SET_VOTE"; lotId: string; stars: number }
  | { type: "ADD_FEEDBACK"; lotId: string; body: string; displayName: string };

function buildInitialState(artworks: Artwork[], persisted: PersistedState | null): PersistedState {
  const eventEndsAt = persisted?.eventEndsAt ?? DEFAULT_EVENT_END;

  const lots: Record<string, LotRuntime> = {};
  for (const a of artworks) {
    const fromDisk = persisted?.lots[a.id];
    lots[a.id] = fromDisk
      ? {
          ...fromDisk,
          endsAt: fromDisk.endsAt ?? eventEndsAt,
        }
      : {
          currentBidCents: 0,
          bids: [],
          endsAt: eventEndsAt,
        };
  }

  return {
    version: 1,
    eventEndsAt,
    lots,
    votes: persisted?.votes ?? {},
    feedback: persisted?.feedback ?? [],
  };
}

function persist(state: PersistedState) {
  savePersisted(state);
}

function topBid(lot: LotRuntime) {
  if (!lot.bids.length) return null;
  return lot.bids.reduce((a, b) => (a.amountCents >= b.amountCents ? a : b));
}

function reducer(state: PersistedState, action: Action, artworksById: Map<string, Artwork>): PersistedState {
  switch (action.type) {
    case "PLACE_BID": {
      const artwork = artworksById.get(action.lotId);
      const lot = state.lots[action.lotId];
      if (!artwork || !lot) return state;
      if (Date.now() > lot.endsAt) return state;
      const min = nextMinimumBidCents(artwork, lot);
      if (action.amountCents < min) return state;

      const guestId = getOrCreateGuestId();
      const bid = {
        id: crypto.randomUUID(),
        guestId,
        amountCents: action.amountCents,
        placedAt: Date.now(),
      };

      const nextLot: LotRuntime = {
        ...lot,
        currentBidCents: action.amountCents,
        bids: [bid, ...lot.bids].slice(0, 64),
      };

      const next: PersistedState = {
        ...state,
        lots: { ...state.lots, [action.lotId]: nextLot },
      };
      persist(next);
      return next;
    }
    case "SET_VOTE": {
      const guestId = getOrCreateGuestId();
      const prev = state.votes[action.lotId] ?? {};
      const nextVotes = {
        ...state.votes,
        [action.lotId]: { ...prev, [guestId]: action.stars },
      };
      const next: PersistedState = { ...state, votes: nextVotes };
      persist(next);
      return next;
    }
    case "ADD_FEEDBACK": {
      const guestId = getOrCreateGuestId();
      const entry: FeedbackEntry = {
        id: crypto.randomUUID(),
        lotId: action.lotId,
        guestId,
        displayName: action.displayName || "Guest",
        body: action.body.trim().slice(0, 600),
        createdAt: Date.now(),
      };
      if (entry.body.length < 3) return state;
      const next: PersistedState = {
        ...state,
        feedback: [entry, ...state.feedback].slice(0, 200),
      };
      persist(next);
      return next;
    }
    default:
      return state;
  }
}

type AuctionContextValue = {
  artworks: Artwork[];
  state: PersistedState;
  guestId: string;
  placeBid: (lotId: string, amountCents: number) => { ok: boolean; error?: string };
  setVote: (lotId: string, stars: number) => void;
  addFeedback: (lotId: string, body: string, displayName: string) => { ok: boolean; error?: string };
  getAverageVote: (lotId: string) => number | null;
  getMyVote: (lotId: string) => number | undefined;
  isLeading: (lotId: string) => boolean;
  getArtwork: (lotId: string) => Artwork | undefined;
  getLot: (lotId: string) => LotRuntime | undefined;
  nextMinBid: (lotId: string) => number | null;
  isLotClosed: (lotId: string) => boolean;
};

const AuctionContext = createContext<AuctionContextValue | null>(null);

export function AuctionProvider({ children }: { children: ReactNode }) {
  const catalog = useMemo(() => loadCatalog(), []);
  const artworks = useMemo(() => catalogToArtworks(catalog), [catalog]);
  const artworksById = useMemo(() => new Map(artworks.map((a) => [a.id, a])), [artworks]);

  const guestId = useMemo(() => getOrCreateGuestId(), []);

  const [state, dispatch] = useReducer(
    (s: PersistedState, a: Action) => reducer(s, a, artworksById),
    artworks,
    (aw) => buildInitialState(aw, loadPersisted()),
  );

  const placeBid = useCallback(
    (lotId: string, amountCents: number) => {
      const artwork = artworksById.get(lotId);
      const lot = state.lots[lotId];
      if (!artwork || !lot) return { ok: false, error: "Lot not found." } as const;
      if (Date.now() > lot.endsAt) return { ok: false, error: "Bidding is closed for this lot." } as const;
      const min = nextMinimumBidCents(artwork, lot);
      if (amountCents < min) {
        return { ok: false, error: `Your bid must be at least ${(min / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.` } as const;
      }
      dispatch({ type: "PLACE_BID", lotId, amountCents });
      return { ok: true } as const;
    },
    [artworksById, state.lots],
  );

  const setVote = useCallback((lotId: string, stars: number) => {
    const clamped = Math.min(5, Math.max(1, Math.round(stars)));
    dispatch({ type: "SET_VOTE", lotId, stars: clamped });
  }, []);

  const addFeedback = useCallback((lotId: string, body: string, displayName: string) => {
    const t = body.trim();
    if (t.length < 3) return { ok: false, error: "Please enter at least a short note (3+ characters)." } as const;
    dispatch({ type: "ADD_FEEDBACK", lotId, body, displayName });
    return { ok: true } as const;
  }, []);

  const getAverageVote = useCallback(
    (lotId: string) => {
      const map = state.votes[lotId];
      if (!map) return null;
      const vals = Object.values(map);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    },
    [state.votes],
  );

  const getMyVote = useCallback(
    (lotId: string) => state.votes[lotId]?.[guestId],
    [guestId, state.votes],
  );

  const isLeading = useCallback(
    (lotId: string) => {
      const lot = state.lots[lotId];
      if (!lot) return false;
      const t = topBid(lot);
      return t?.guestId === guestId;
    },
    [guestId, state.lots],
  );

  const getArtwork = useCallback((lotId: string) => artworksById.get(lotId), [artworksById]);

  const getLot = useCallback((lotId: string) => state.lots[lotId], [state.lots]);

  const nextMinBid = useCallback(
    (lotId: string) => {
      const a = artworksById.get(lotId);
      const l = state.lots[lotId];
      if (!a || !l) return null;
      return nextMinimumBidCents(a, l);
    },
    [artworksById, state.lots],
  );

  const isLotClosed = useCallback(
    (lotId: string) => {
      const l = state.lots[lotId];
      if (!l) return true;
      return Date.now() > l.endsAt;
    },
    [state.lots],
  );

  const value = useMemo(
    () =>
      ({
        artworks,
        state,
        guestId,
        placeBid,
        setVote,
        addFeedback,
        getAverageVote,
        getMyVote,
        isLeading,
        getArtwork,
        getLot,
        nextMinBid,
        isLotClosed,
      }) satisfies AuctionContextValue,
    [
      artworks,
      state,
      guestId,
      placeBid,
      setVote,
      addFeedback,
      getAverageVote,
      getMyVote,
      isLeading,
      getArtwork,
      getLot,
      nextMinBid,
      isLotClosed,
    ],
  );

  return <AuctionContext.Provider value={value}>{children}</AuctionContext.Provider>;
}

export function useAuction() {
  const ctx = useContext(AuctionContext);
  if (!ctx) throw new Error("useAuction must be used within AuctionProvider");
  return ctx;
}
