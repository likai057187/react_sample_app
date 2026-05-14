import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LotCard } from '../components/LotCard';
import { useAuction } from '../context/AuctionProvider';
import type { Artwork, LotRuntime } from '../types';

type AuctionStatus = 'bidding' | 'open' | 'closed';
type LotRow = { artwork: Artwork; status: AuctionStatus };

function sortAuctionLots(artworks: Artwork[], getLot: (id: string) => LotRuntime | undefined) {
  return [...artworks].sort((a, b) => {
    const la = getLot(a.id);
    const lb = getLot(b.id);
    const ta = la?.bids[0]?.placedAt ?? 0;
    const tb = lb?.bids[0]?.placedAt ?? 0;
    if (ta !== tb) return tb - ta;
    const ea = la?.endsAt ?? 0;
    const eb = lb?.endsAt ?? 0;
    if (ea !== eb) return ea - eb;
    return a.title.localeCompare(b.title);
  });
}

function getAuctionStatus(artwork: Artwork, getLot: (id: string) => LotRuntime | undefined, isLotClosed: (id: string) => boolean): AuctionStatus {
  const lot = getLot(artwork.id);
  if (!lot || isLotClosed(artwork.id)) return 'closed';
  return lot.bids.length > 0 ? 'bidding' : 'open';
}

const STATUS_META: Record<AuctionStatus, { label: string; emptyTitle: string; emptyHint: string }> = {
  bidding: {
    label: 'Bidding',
    emptyTitle: 'No active bidding yet.',
    emptyHint: 'Open lots will move here as soon as the first bid is placed.',
  },
  open: {
    label: 'Open',
    emptyTitle: 'No open lots right now.',
    emptyHint: 'Lots without bids appear here before bidding starts.',
  },
  closed: {
    label: 'Closed',
    emptyTitle: 'No closed lots yet.',
    emptyHint: 'Completed lots will appear here after the auction closes.',
  },
};

export function AuctionScreen() {
  const { artworks, getLot, isLotClosed } = useAuction();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<AuctionStatus>('bidding');
  const rows = useMemo<LotRow[]>(() => {
    const lots = sortAuctionLots(artworks.filter((a) => getLot(a.id)), getLot);
    return lots.map((artwork) => ({ artwork, status: getAuctionStatus(artwork, getLot, isLotClosed) }));
  }, [artworks, getLot, isLotClosed]);
  const counts = useMemo(
    () => ({
      bidding: rows.filter((row) => row.status === 'bidding').length,
      open: rows.filter((row) => row.status === 'open').length,
      closed: rows.filter((row) => row.status === 'closed').length,
    }),
    [rows],
  );
  const listed = rows.filter((row) => row.status === status);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Silent Auction</Text>
        <View style={styles.statusTabs}>
          {(['bidding', 'open', 'closed'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setStatus(item)}
              style={[styles.statusTab, status === item && styles.statusTabOn]}
            >
              <Text style={[styles.statusText, status === item && styles.statusTextOn]}>{STATUS_META[item].label}</Text>
              <Text style={[styles.statusCount, status === item && styles.statusTextOn]}>{counts[item]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {artworks.length === 0 ? (
          <Text style={styles.empty}>No artwork in catalog.</Text>
        ) : listed.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.lead}>{STATUS_META[status].emptyTitle}</Text>
            <Text style={styles.hint}>{STATUS_META[status].emptyHint}</Text>
          </View>
        ) : (
          listed.map((row) => <LotCard key={row.artwork.id} artwork={row.artwork} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0b' },
  hero: { paddingHorizontal: 14, paddingBottom: 12, alignItems: 'center', gap: 12 },
  heroTitle: { color: '#c9a962', fontSize: 32, fontWeight: '500', fontFamily: 'serif', letterSpacing: 0.2 },
  statusTabs: {
    width: '100%',
    flexDirection: 'row',
    padding: 4,
    borderRadius: 18,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#242428',
  },
  statusTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTabOn: { backgroundColor: 'rgba(201,169,98,0.16)' },
  statusText: { color: '#8a8a8f', fontSize: 12, fontWeight: '700' },
  statusTextOn: { color: '#f5f0e6' },
  statusCount: { color: '#6e6e73', fontSize: 11, marginTop: 2 },
  scroll: { paddingHorizontal: 14 },
  empty: { color: '#8a8a8f', padding: 20 },
  emptyBox: {
    marginTop: 22,
    padding: 20,
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#242428',
    backgroundColor: '#101012',
  },
  lead: { color: '#f5f0e6', fontSize: 18, fontWeight: '600' },
  hint: { color: '#8a8a8f', fontSize: 14 },
});
