import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuction } from '../context/AuctionProvider';
import { getArtistBadgeUrl, getArtistBio } from '../data/artistMeta';
import { blurActiveElement } from '../lib/focus';
import type { InventoryStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<InventoryStackParamList, 'InventoryArtist'>;
type R = RouteProp<InventoryStackParamList, 'InventoryArtist'>;

export function InventoryArtistDetailScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const route = useRoute<R>();
  const nav = useNavigation<Nav>();
  const { artistId, artistName } = route.params;
  const { artworks } = useAuction();

  const list = useMemo(() => artworks.filter((a) => a.artistId === artistId), [artworks, artistId]);
  const badge = getArtistBadgeUrl(artistId);
  const tileWidth = Math.floor((Math.min(width, 430) - 52) / 2);

  return (
    <View style={styles.root}>
      <FlatList
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Back to artists"
              style={styles.backLink}
              onPress={() => {
                blurActiveElement();
                nav.navigate('InventoryArtists');
              }}
            >
              <Ionicons name="chevron-back" size={26} color="#f5f0e6" />
            </Pressable>
            <View style={styles.badgeShell}>
              {badge ? <Image source={{ uri: badge }} style={styles.badge} contentFit="cover" /> : <View style={styles.badgeFallback} />}
            </View>
            <Text style={styles.artistName}>{artistName ?? list[0]?.artistName ?? 'Artist'}</Text>
            <Text style={styles.bio}>{getArtistBio(artistId)}</Text>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Artworks</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 104, paddingHorizontal: 20 }}
        columnWrapperStyle={styles.columns}
        numColumns={2}
        data={list}
        keyExtractor={(a) => a.id}
        ListEmptyComponent={<Text style={styles.empty}>No works for this artist.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, { width: tileWidth }, pressed && styles.pressed]}
            onPress={() => {
              blurActiveElement();
              nav.navigate('InventoryArtwork', { id: item.id, returnTo: 'artist' });
            }}
          >
            <View style={styles.imageWrap}>
              <Image source={{ uri: item.imageUrl }} style={styles.img} contentFit="cover" />
              {item.imageUrls.length > 1 ? (
                <View style={styles.photoBadge}>
                  <Ionicons name="images-outline" size={13} color="#f5f0e6" />
                  <Text style={styles.photoBadgeText}>{item.imageUrls.length} photos</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>{item.year} · {item.medium}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0b' },
  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 18 },
  backLink: {
    alignSelf: 'flex-start',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgeShell: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(214,181,101,0.72)',
    backgroundColor: '#121214',
  },
  badge: { width: '100%', height: '100%', borderRadius: 49 },
  badgeFallback: { flex: 1, borderRadius: 49, backgroundColor: '#222' },
  artistName: { color: '#f5f0e6', fontSize: 28, fontWeight: '700', marginTop: 12, fontFamily: 'serif', textAlign: 'center' },
  bio: { color: '#bdb6aa', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, maxWidth: 340 },
  divider: { width: 42, height: 1, backgroundColor: 'rgba(214,181,101,0.55)', marginTop: 18 },
  sectionTitle: { color: '#f5f0e6', fontSize: 18, fontWeight: '700', marginTop: 14, alignSelf: 'flex-start' },
  columns: { gap: 18 },
  card: {
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.92 },
  imageWrap: {
    width: '100%',
    aspectRatio: 1.52,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#151518',
  },
  img: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  photoBadgeText: { color: '#f5f0e6', fontSize: 12, fontWeight: '600' },
  cardBody: { paddingTop: 8 },
  title: { color: '#f5f0e6', fontSize: 18, fontWeight: '500', lineHeight: 22, fontFamily: 'serif' },
  meta: { color: '#a8a4a0', fontSize: 13, marginTop: 2 },
  empty: { color: '#8a8a8f', padding: 20 },
});
