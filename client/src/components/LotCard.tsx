import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { formatUsdFromCents } from '../lib/format';
import type { Artwork } from '../types';
import { useAuction } from '../context/AuctionProvider';
import { Countdown } from './Countdown';
import { blurActiveElement } from '../lib/focus';
import type { MainTabParamList } from '../navigation/AppNavigator';

type TabNav = BottomTabNavigationProp<MainTabParamList>;

type Props = { artwork: Artwork };

export function LotCard({ artwork }: Props) {
  const nav = useNavigation<TabNav>();
  const { getLot, isLotClosed, isLeading, guestId } = useAuction();
  const lot = getLot(artwork.id);
  const closed = isLotClosed(artwork.id);
  const hasBids = lot ? lot.bids.length > 0 : false;
  const hasMyBid = lot ? lot.bids.some((b) => b.guestId === guestId) : false;
  const displayBid = hasBids && lot ? lot.currentBidCents : artwork.openingBidCents;
  const bidLabel = hasBids ? 'CURRENT BID' : 'OPENING BID';
  const leading = isLeading(artwork.id);
  const outbid = hasBids && !leading && !closed && hasMyBid;
  const inProgress = hasBids && !leading && !closed && !hasMyBid;
  const open = !hasBids && !closed;
  const statusBadge = closed ? (
    <Badge label="Closed" tone="muted" />
  ) : leading ? (
    <Badge label="Leading" tone="ok" />
  ) : outbid ? (
    <Badge label="Outbid" tone="warn" />
  ) : inProgress ? (
    <Badge label="Bidding" tone="gold" />
  ) : open ? (
    <Badge label="Open" tone="gold" />
  ) : null;

  return (
    <Pressable
      onPress={() => {
        blurActiveElement();
        nav.navigate('Inventory', { screen: 'InventoryArtwork', params: { id: artwork.id, returnTo: 'auction' } });
      }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageShell}>
        <Image source={{ uri: artwork.imageUrl }} style={styles.img} contentFit="cover" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{artwork.title}</Text>
        <Text style={styles.bidLabel}>{bidLabel}</Text>
        <Text style={styles.bidVal}>{formatUsdFromCents(displayBid)}</Text>
        <View style={styles.badges}>
          {statusBadge}
        </View>
        <View style={styles.rule} />
        {lot && (
          <View style={styles.timer}>
            <Ionicons name="time-outline" color="#c9a962" size={15} />
            <Countdown endMs={lot.endsAt} variant="closes" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Badge({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'gold' | 'muted' }) {
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 176,
    marginBottom: 10,
    backgroundColor: '#121214',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#242428',
    flexDirection: 'row',
    padding: 8,
    gap: 16,
  },
  pressed: { opacity: 0.92 },
  imageShell: { width: '46%', borderRadius: 6, overflow: 'hidden', backgroundColor: '#1a1a1d' },
  img: { width: '100%', height: '100%', minHeight: 132, backgroundColor: '#1a1a1d' },
  body: { flex: 1, paddingVertical: 10, paddingRight: 6 },
  title: { color: '#f5f0e6', fontSize: 22, fontWeight: '500', fontFamily: 'serif', marginBottom: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pill_ok: { backgroundColor: 'rgba(72, 199, 142, 0.2)' },
  pill_warn: { backgroundColor: 'rgba(255, 107, 107, 0.2)' },
  pill_gold: { backgroundColor: 'rgba(201, 169, 98, 0.25)' },
  pill_muted: { backgroundColor: 'rgba(255,255,255,0.08)' },
  pillText: { color: '#f5f0e6', fontSize: 12, fontWeight: '600' },
  bidLabel: { color: '#a8a4a0', fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  bidVal: { color: '#f5f0e6', fontSize: 22, fontWeight: '700', marginTop: 3 },
  rule: { height: 1, backgroundColor: '#242428', marginTop: 13, marginBottom: 11 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});
