import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAuction } from '../context/AuctionProvider';
import { getArtistBadgeUrl } from '../data/artistMeta';
import { blurActiveElement } from '../lib/focus';
import type { InventoryStackParamList } from '../navigation/AppNavigator';
import type { Artwork } from '../types';

type InventoryTab = 'collections' | 'artists';
type Row = { artistId: string; artistName: string; count: number; featureArtwork?: Artwork };
type BubbleLayout = {
  leftPct: number;
  topPct: number;
  sizePx: number;
  initialXPx: number;
  initialYPx: number;
  moveXPx: number;
  moveYPx: number;
  seed: number;
  delayS: number;
  durationS: number;
  z: number;
};

type Nav = NativeStackNavigationProp<InventoryStackParamList, 'InventoryArtists'>;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function seededUnit(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x / 0xffffffff;
}

function randomOffset(seed: number, salt: number, range: number): number {
  if (range <= 0) return 0;
  return Math.round((seededUnit(seed, salt) * 2 - 1) * range);
}

function randomVisibleOffset(seed: number, salt: number, range: number): number {
  if (range <= 0) return 0;
  const raw = randomOffset(seed, salt, range);
  if (Math.abs(raw) >= 4 || range < 4) return raw;
  return raw < 0 ? -4 : 4;
}

/** Deterministic scattered cloud: each item moves inside its own non-overlapping slot. */
function computeBubbleLayout(rows: Row[], cloudWidth: number, cloudHeight: number): BubbleLayout[] {
  const n = rows.length;
  const slotColumns = n <= 1 ? 1 : 2;
  const slotRows = Math.max(1, Math.ceil(n / slotColumns));
  const slotWidth = cloudWidth / slotColumns;
  const slotHeight = cloudHeight / slotRows;

  return rows.map((row, i) => {
    const h = hashString(row.artistId);
    const slotCol = slotColumns === 1 ? 0 : i % slotColumns;
    const slotRow = Math.floor(i / slotColumns);
    const slotLeft = slotCol * slotWidth;
    const slotTop = slotRow * slotHeight;
    const sizePx = Math.round(n > 4 ? 72 + (h % 24) : 76 + (h % 42));
    const visualWidth = Math.round(sizePx * 1.32);
    const visualHeight = Math.round(sizePx * 1.06);
    const moveX = Math.max(0, Math.floor((slotWidth - visualWidth) / 2 - 6));
    const moveY = Math.max(0, Math.floor((slotHeight - visualHeight) / 2 - 6));
    const firstSlotInsetX = i === 0 ? 14 : 0;
    const firstSlotInsetY = i === 0 ? 18 : 0;
    const centerX = ((slotLeft + slotWidth / 2 + firstSlotInsetX) / cloudWidth) * 100;
    const centerY = ((slotTop + slotHeight / 2 + firstSlotInsetY) / cloudHeight) * 100;

    return {
      leftPct: clamp(centerX + 5.2, 12, 88),
      topPct: clamp(centerY + 2.6, 10, 92),
      sizePx,
      initialXPx: randomVisibleOffset(h, 1, moveX),
      initialYPx: randomVisibleOffset(h, 2, moveY),
      moveXPx: moveX,
      moveYPx: moveY,
      seed: h,
      delayS: ((h >> 5) % 8) * 0.22,
      durationS: 13 + ((h >> 9) % 12) * 0.28,
      z: 1 + (h % 6),
    };
  });
}

function useFloatingMotion(layout: BubbleLayout) {
  const floatX = useRef(new Animated.Value(layout.initialXPx)).current;
  const floatY = useRef(new Animated.Value(layout.initialYPx)).current;

  useEffect(() => {
    const points = [0, 1, 2, 3, 4].map((salt) => ({
      x: randomVisibleOffset(layout.seed, salt + 10, layout.moveXPx),
      y: randomVisibleOffset(layout.seed, salt + 20, layout.moveYPx),
    }));

    const segmentMs = Math.max(2200, Math.round((layout.durationS * 1000) / points.length));
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(Math.round(layout.delayS * 1000)),
        ...points.map((point) =>
          Animated.parallel([
            Animated.timing(floatX, {
              toValue: point.x,
              duration: segmentMs,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
            Animated.timing(floatY, {
              toValue: point.y,
              duration: segmentMs,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
          ]),
        ),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [floatX, floatY, layout.delayS, layout.durationS, layout.moveXPx, layout.moveYPx, layout.seed]);

  return { x: floatX, y: floatY };
}

export function InventoryArtistsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const nav = useNavigation<Nav>();
  const { artworks } = useAuction();
  const [tab, setTab] = useState<InventoryTab>('collections');

  const rows = useMemo(() => {
    const m = new Map<string, Row>();
    for (const a of artworks) {
      const existing = m.get(a.artistId);
      if (existing) {
        existing.count += 1;
        if (!existing.featureArtwork) existing.featureArtwork = a;
      } else {
        m.set(a.artistId, { artistId: a.artistId, artistName: a.artistName, count: 1, featureArtwork: a });
      }
    }
    return [...m.values()].sort((a, b) => a.artistName.localeCompare(b.artistName));
  }, [artworks]);

  const cloudWidth = Math.min(width - 48, 400);
  const cloudHeight = Math.max(560, Math.min(690, Math.round(width * 1.5)));
  const layouts = useMemo(() => computeBubbleLayout(rows, cloudWidth, cloudHeight), [cloudHeight, cloudWidth, rows]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 104 }]}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Inventory</Text>
        <Text style={styles.heading}>{tab === 'collections' ? 'Collections' : 'Artists'}</Text>
        <Text style={styles.subcopy}>
          {tab === 'collections'
            ? 'Tap a featured artwork to enter the artist’s wall.'
            : 'Tap a floating portrait to enter the artist’s wall.'}
        </Text>
        <View style={styles.tabs}>
          <InventoryTabButton active={tab === 'collections'} label="Collections" onPress={() => setTab('collections')} />
          <InventoryTabButton active={tab === 'artists'} label="Artists" onPress={() => setTab('artists')} />
        </View>
      </View>

      <View style={[styles.cloud, { width: cloudWidth, height: cloudHeight }]}>
        {rows.map((item, i) => {
          const badge = getArtistBadgeUrl(item.artistId);
          const layout = layouts[i]!;
          const onPress = () => {
            blurActiveElement();
            nav.navigate('InventoryArtist', { artistId: item.artistId, artistName: item.artistName });
          };
          if (tab === 'collections' && item.featureArtwork) {
            return (
              <CollectionBubble
                key={item.artistId}
                item={item}
                artwork={item.featureArtwork}
                layout={layout}
                onPress={onPress}
              />
            );
          }
          return (
            <ArtistBubble
              key={item.artistId}
              item={item}
              badge={badge}
              layout={layout}
              onPress={onPress}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

function InventoryTabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.tabPressed]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ArtistBubble({
  item,
  badge,
  layout,
  onPress,
}: {
  item: Row;
  badge: string | null;
  layout: BubbleLayout;
  onPress: () => void;
}) {
  const float = useFloatingMotion(layout);
  const groupWidth = Math.max(layout.sizePx, 150);

  return (
    <Animated.View
      style={[
        styles.row,
        {
          width: groupWidth,
          height: layout.sizePx + 34,
          left: `${layout.leftPct}%`,
          top: `${layout.topPct}%`,
          marginLeft: -groupWidth / 2,
          marginTop: -layout.sizePx / 2,
          zIndex: layout.z,
          transform: [{ translateX: float.x }, { translateY: float.y }],
        },
      ]}
    >
      <Pressable
        style={({ pressed }) => [styles.bounceGroup, pressed && styles.rowPressed]}
        onPress={onPress}
      >
        <View
          style={[
            styles.bubble,
            {
              width: layout.sizePx,
              height: layout.sizePx,
              borderRadius: layout.sizePx / 2,
            },
          ]}
        >
          {badge ? <Image source={{ uri: badge }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback} />}
        </View>
        <Text style={styles.name} numberOfLines={1}>{item.artistName}</Text>
      </Pressable>
    </Animated.View>
  );
}

function CollectionBubble({
  item,
  artwork,
  layout,
  onPress,
}: {
  item: Row;
  artwork: Artwork;
  layout: BubbleLayout;
  onPress: () => void;
}) {
  const float = useFloatingMotion(layout);
  const tileWidth = Math.round(layout.sizePx * 1.32);
  const tileHeight = Math.round(layout.sizePx * 1.03);
  const groupWidth = Math.max(tileWidth, 154);

  return (
    <Animated.View
      style={[
        styles.row,
        {
          width: groupWidth,
          height: tileHeight + 48,
          left: `${layout.leftPct}%`,
          top: `${layout.topPct}%`,
          marginLeft: -groupWidth / 2,
          marginTop: -tileHeight / 2,
          zIndex: layout.z,
          transform: [{ translateX: float.x }, { translateY: float.y }],
        },
      ]}
    >
      <Pressable style={({ pressed }) => [styles.bounceGroup, pressed && styles.rowPressed]} onPress={onPress}>
        <View style={[styles.collectionTile, { width: tileWidth, height: tileHeight }]}>
          <Image source={{ uri: artwork.imageUrl }} style={styles.collectionImage} contentFit="cover" />
        </View>
        <Text style={styles.name} numberOfLines={1}>{item.artistName}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0b' },
  scroll: { paddingHorizontal: 24, paddingTop: 18 },
  hero: { alignItems: 'center', paddingTop: 10, paddingBottom: 18 },
  eyebrow: { color: '#c9a962', fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase' },
  heading: { color: '#f5f0e6', fontSize: 30, fontWeight: '700', marginTop: 6, fontFamily: 'serif' },
  subcopy: { color: '#8f8a82', fontSize: 13, marginTop: 8, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    marginBottom: 8,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(245,240,230,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.1)',
  },
  tab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  tabActive: { backgroundColor: '#c9a962' },
  tabPressed: { opacity: 0.86 },
  tabText: { color: '#9e9992', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#15100a' },
  cloud: { alignSelf: 'center', position: 'relative', marginTop: 16 },
  row: {
    position: 'absolute',
    alignItems: 'center',
  },
  rowPressed: { opacity: 0.9 },
  bounceGroup: { alignItems: 'center' },
  bubble: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(214,181,101,0.72)',
    backgroundColor: '#151518',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, backgroundColor: '#222' },
  collectionTile: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(214,181,101,0.72)',
    backgroundColor: '#151518',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  collectionImage: { width: '100%', height: '100%' },
  name: { color: '#f5f0e6', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 8, width: 150 },
});
