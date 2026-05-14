import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { fetchArtworks } from '../data/catalog';
import { nextMinimumBidCents } from '../lib/bidding';
import { connectAuctionWebSocket } from '../lib/auctionWs';
import { apiFetch } from '../lib/apiClient';
import { formatUsdFromCents } from '../lib/format';
import { useSession } from './SessionProvider';
import type { Artwork, AuctionServerState, FeedbackEntry, LotRuntime } from '../types';

const POLL_MS_DEFAULT = 3000;
const POLL_MS_WS_FALLBACK = 25_000;

const EMPTY_ARTWORKS: Artwork[] = [];
const EMPTY_AUCTION_STATE: AuctionServerState = {
  eventEndsAt: 0,
  lots: {},
  votes: {},
  feedback: [],
};

function topBid(lot: LotRuntime) {
  if (!lot.bids.length) return null;
  return lot.bids.reduce((a, b) => (a.amountCents >= b.amountCents ? a : b));
}

type AuctionContextValue = {
  artworks: Artwork[];
  state: AuctionServerState;
  guestId: string;
  placeBid: (lotId: string, amountCents: number) => Promise<{ ok: boolean; error?: string }>;
  setVote: (lotId: string, stars: number) => Promise<void>;
  clearVote: (lotId: string) => Promise<void>;
  addFeedback: (lotId: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  getAverageVote: (lotId: string) => number | null;
  getMyVote: (lotId: string) => number | undefined;
  isLeading: (lotId: string) => boolean;
  getArtwork: (lotId: string) => Artwork | undefined;
  getLot: (lotId: string) => LotRuntime | undefined;
  nextMinBid: (lotId: string) => number | null;
  isLotClosed: (lotId: string) => boolean;
  refreshAuctionState: () => Promise<void>;
};

const AuctionContext = createContext<AuctionContextValue | null>(null);

export function AuctionProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status !== 'ready') {
    throw new Error('AuctionProvider requires an authenticated session');
  }
  const guestId = session.guestId;

  const [artworks, setArtworks] = useState<Artwork[] | null>(null);
  const [auctionState, setAuctionState] = useState<AuctionServerState | null>(null);
  const [auctionWsConnected, setAuctionWsConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshAuctionState = useCallback(async () => {
    const res = await apiFetch('/api/auction/state', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Auction state failed (${res.status})`);
    }
    const data = (await res.json()) as {
      eventEndsAt?: number;
      lots?: AuctionServerState['lots'];
      votes?: AuctionServerState['votes'];
      feedback?: FeedbackEntry[];
    };
    setAuctionState({
      eventEndsAt: data.eventEndsAt ?? 0,
      lots: data.lots ?? {},
      votes: data.votes ?? {},
      feedback: Array.isArray(data.feedback) ? data.feedback : [],
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    void (async () => {
      try {
        const [aw] = await Promise.all([fetchArtworks(), refreshAuctionState()]);
        if (cancelled) return;
        setArtworks(aw);
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load auction data.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAuctionState]);

  useEffect(() => {
    if (!artworks) return;
    const dispose = connectAuctionWebSocket({
      onState: (payload) => {
        setAuctionState({
          eventEndsAt: payload.eventEndsAt ?? 0,
          lots: payload.lots ?? {},
          votes: payload.votes ?? {},
          feedback: Array.isArray(payload.feedback) ? payload.feedback : [],
        });
      },
      onOpen: () => setAuctionWsConnected(true),
      onClose: () => setAuctionWsConnected(false),
    });
    return dispose;
  }, [artworks]);

  const pollMs = auctionWsConnected ? POLL_MS_WS_FALLBACK : POLL_MS_DEFAULT;

  useEffect(() => {
    if (!artworks || !auctionState) return;
    const id = globalThis.setInterval(() => {
      void refreshAuctionState().catch(() => {});
    }, pollMs);
    return () => globalThis.clearInterval(id);
  }, [artworks, auctionState, pollMs, refreshAuctionState]);

  useEffect(() => {
    if (!artworks || !auctionState || auctionWsConnected) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAuctionState().catch(() => {});
    });
    return () => sub.remove();
  }, [artworks, auctionState, auctionWsConnected, refreshAuctionState]);

  const artworksById = useMemo(() => new Map((artworks ?? []).map((a) => [a.id, a])), [artworks]);

  const placeBid = useCallback(
    async (lotId: string, amountCents: number) => {
      const artwork = artworksById.get(lotId);
      const lot = auctionState?.lots[lotId];
      if (!artwork || !lot) return { ok: false, error: 'Lot not found.' } as const;
      if (Date.now() > lot.endsAt) return { ok: false, error: 'Bidding is closed for this lot.' } as const;
      const min = nextMinimumBidCents(artwork, lot);
      if (amountCents < min) {
        return {
          ok: false,
          error: `Your bid must be at least ${formatUsdFromCents(min)}.`,
        } as const;
      }

      const res = await apiFetch('/api/bids', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ lotId, amountCents }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; min?: number };

      if (res.ok) {
        await refreshAuctionState();
        return { ok: true } as const;
      }
      if (data.error === 'below_min' && typeof data.min === 'number') {
        return {
          ok: false,
          error: `Your bid must be at least ${formatUsdFromCents(data.min)}.`,
        } as const;
      }
      if (data.error === 'closed') {
        await refreshAuctionState();
        return { ok: false, error: 'Bidding is closed for this lot.' } as const;
      }
      if (data.error === 'unknown_lot') {
        return { ok: false, error: 'Lot not found.' } as const;
      }
      if (res.status === 401) {
        return { ok: false, error: 'Session expired. Restart the app.' } as const;
      }
      return { ok: false, error: 'Bid was not accepted. Try again.' } as const;
    },
    [artworksById, auctionState?.lots, refreshAuctionState],
  );

  const setVote = useCallback(
    async (lotId: string, stars: number) => {
      const clamped = Math.min(5, Math.max(1, Math.round(stars)));
      const res = await apiFetch('/api/votes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ lotId, stars: clamped }),
      });
      if (res.ok) await refreshAuctionState();
    },
    [refreshAuctionState],
  );

  const clearVote = useCallback(
    async (lotId: string) => {
      const res = await apiFetch('/api/votes/clear', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ lotId }),
      });
      if (res.ok) await refreshAuctionState();
    },
    [refreshAuctionState],
  );

  const addFeedback = useCallback(
    async (lotId: string, body: string) => {
      const t = body.trim();
      if (t.length < 3) {
        return { ok: false, error: 'Please enter at least a short note (3+ characters).' } as const;
      }
      const res = await apiFetch('/api/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ lotId, body: t }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        await refreshAuctionState();
        return { ok: true } as const;
      }
      if (data.error === 'invalid_body') {
        return { ok: false, error: 'Please enter a slightly longer note.' } as const;
      }
      if (res.status === 401) {
        return { ok: false, error: 'Session expired. Restart the app.' } as const;
      }
      return { ok: false, error: 'Could not post feedback.' } as const;
    },
    [refreshAuctionState],
  );

  const getAverageVote = useCallback(
    (lotId: string) => {
      const map = auctionState?.votes[lotId];
      if (!map) return null;
      const vals = Object.values(map);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    },
    [auctionState?.votes],
  );

  const getMyVote = useCallback(
    (lotId: string) => auctionState?.votes[lotId]?.[guestId],
    [guestId, auctionState?.votes],
  );

  const isLeading = useCallback(
    (lotId: string) => {
      const lot = auctionState?.lots[lotId];
      if (!lot) return false;
      const t = topBid(lot);
      return t?.guestId === guestId;
    },
    [guestId, auctionState?.lots],
  );

  const getArtwork = useCallback((lotId: string) => artworksById.get(lotId), [artworksById]);

  const getLot = useCallback((lotId: string) => auctionState?.lots[lotId], [auctionState?.lots]);

  const nextMinBid = useCallback(
    (lotId: string) => {
      const a = artworksById.get(lotId);
      const l = auctionState?.lots[lotId];
      if (!a || !l) return null;
      return nextMinimumBidCents(a, l);
    },
    [artworksById, auctionState?.lots],
  );

  const isLotClosed = useCallback(
    (lotId: string) => {
      const l = auctionState?.lots[lotId];
      if (!l) return true;
      return Date.now() > l.endsAt;
    },
    [auctionState?.lots],
  );

  const artworksResolved = artworks ?? EMPTY_ARTWORKS;
  const state = auctionState ?? EMPTY_AUCTION_STATE;

  const value = useMemo(
    () =>
      ({
        artworks: artworksResolved,
        state,
        guestId,
        placeBid,
        setVote,
        clearVote,
        addFeedback,
        getAverageVote,
        getMyVote,
        isLeading,
        getArtwork,
        getLot,
        nextMinBid,
        isLotClosed,
        refreshAuctionState,
      }) satisfies AuctionContextValue,
    [
      artworksResolved,
      state,
      guestId,
      placeBid,
      setVote,
      clearVote,
      addFeedback,
      getAverageVote,
      getMyVote,
      isLeading,
      getArtwork,
      getLot,
      nextMinBid,
      isLotClosed,
      refreshAuctionState,
    ],
  );

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{loadError}</Text>
        <Text style={styles.hint}>Start the API (`npm run dev:api`) and check EXPO_PUBLIC_API_ORIGIN.</Text>
      </View>
    );
  }

  if (!artworks || !auctionState) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#c9a962" />
        <Text style={styles.muted}>Loading catalog…</Text>
      </View>
    );
  }

  return <AuctionContext.Provider value={value}>{children}</AuctionContext.Provider>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#0a0a0b' },
  muted: { color: '#8a8a8f', marginTop: 12 },
  error: { color: '#ffb4a8', textAlign: 'center' },
  hint: { color: '#8a8a8f', textAlign: 'center', marginTop: 12 },
});

export function useAuction() {
  const ctx = useContext(AuctionContext);
  if (!ctx) throw new Error('useAuction must be used within AuctionProvider');
  return ctx;
}
