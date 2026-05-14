import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuction } from '../context/AuctionProvider';
import { formatUsdFromCents } from '../lib/format';
import { ImageCarousel } from '../components/ImageCarousel';
import { LotCardBidBar } from '../components/LotCardBidBar';
import { Countdown } from '../components/Countdown';
import { blurActiveElement } from '../lib/focus';
import type { InventoryStackParamList, MainTabParamList } from '../navigation/AppNavigator';

type R = RouteProp<InventoryStackParamList, 'InventoryArtwork'>;
type Nav = NativeStackNavigationProp<InventoryStackParamList, 'InventoryArtwork'>;
type RootNav = BottomTabNavigationProp<MainTabParamList>;

function formatArtistDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return name;
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .split(' ')
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join(' ');
  }
  return trimmed;
}

export function InventoryArtworkDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<R>();
  const nav = useNavigation<Nav>();
  const id = decodeURIComponent(route.params.id);
  const { getArtwork, getLot, isLotClosed, isLeading, guestId, setVote, clearVote, addFeedback, getMyVote, getAverageVote, refreshAuctionState } =
    useAuction();
  const artwork = getArtwork(id);
  const lot = getLot(id);
  const [fb, setFb] = useState('');
  const [fbErr, setFbErr] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [bidRulesOpen, setBidRulesOpen] = useState(false);

  useEffect(() => {
    void refreshAuctionState();
  }, [id, refreshAuctionState]);

  if (!artwork) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Not found</Text>
        <Pressable
          style={styles.btn}
          onPress={() => {
            blurActiveElement();
            nav.navigate('InventoryArtists');
          }}
        >
          <Text style={styles.btnText}>Back to inventory</Text>
        </Pressable>
      </View>
    );
  }

  const closed = isLotClosed(artwork.id);
  const myStars = getMyVote(artwork.id);
  const avg = getAverageVote(artwork.id);
  const artistDisplayName = formatArtistDisplayName(artwork.artistName);
  const hasMyBid = lot ? lot.bids.some((bid) => bid.guestId === guestId) : false;
  const leading = hasMyBid && isLeading(artwork.id);
  const outbid = hasMyBid && !leading;

  const submitFeedback = async () => {
    setFbErr(null);
    const r = await addFeedback(artwork.id, fb);
    if (!r.ok) setFbErr(r.error ?? 'Could not post');
    else {
      setFb('');
      setFeedbackOpen(false);
    }
  };

  const share = async () => {
    try {
      await Share.share({ message: `${artwork.title} — ${artwork.artistName}` });
    } catch {
      /* ignore */
    }
  };

  const goBack = () => {
    blurActiveElement();
    if (route.params.returnTo === 'auction') {
      nav.popToTop();
      nav.getParent<RootNav>()?.navigate('Auction');
      return;
    }
    if (route.params.returnTo === 'inventory') {
      nav.navigate('InventoryArtists');
      return;
    }
    nav.navigate('InventoryArtist', { artistId: artwork.artistId, artistName: artwork.artistName });
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 110 }]}>
        <View style={styles.topbar}>
          <Pressable
            style={styles.iconBtn}
            onPress={goBack}
          >
            <Ionicons name="chevron-back" color="#f5f0e6" size={24} />
          </Pressable>
        </View>

        <View style={styles.carouselShell}>
          <ImageCarousel urls={artwork.imageUrls} alt={artwork.title} height={390} horizontalInset={14} borderRadius={18} fit="contain" />
        </View>

        <View style={styles.panel}>
          <View style={styles.head}>
            <View style={styles.headCopy}>
              <Text style={styles.artist}>{artistDisplayName}</Text>
              <Text style={styles.title}>{artwork.title}</Text>
              <Text style={styles.inlineMeta}>
                {artwork.dimensions} · {artwork.year}
              </Text>
            </View>
            <View style={styles.quickActions}>
              <Pressable accessibilityLabel="Rate artwork and add note" style={styles.smallAction} onPress={() => setFeedbackOpen(true)}>
                <Ionicons name={myStars ? 'star' : 'star-outline'} color={myStars ? '#f0b429' : '#f5f0e6'} size={18} />
              </Pressable>
              <Pressable style={styles.smallAction} onPress={share}>
                <Ionicons name="share-outline" color="#f5f0e6" size={18} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.medium}>{artwork.medium}</Text>
          <Text style={styles.body}>{artwork.description}</Text>

          {lot && (
            <View style={styles.auctionCard}>
              <View style={styles.auctionHeader}>
                <View style={styles.auctionHeaderCopy}>
                  {lot && !closed && (
                    <View style={styles.bidTitleRow}>
                      <Text style={styles.bidLine}>
                        {lot.bids.length
                          ? `Current bid ${formatUsdFromCents(lot.currentBidCents)}`
                          : `Opening bid ${formatUsdFromCents(artwork.openingBidCents)}`}
                      </Text>
                      {leading ? (
                        <View style={[styles.participationPill, styles.leadingPill]}>
                          <Text style={[styles.participationText, styles.leadingText]}>Leading</Text>
                        </View>
                      ) : outbid ? (
                        <View style={[styles.participationPill, styles.outbidPill]}>
                          <Text style={[styles.participationText, styles.outbidText]}>Outbid</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
                <Pressable accessibilityLabel="Bid rules" style={styles.infoBtn} onPress={() => setBidRulesOpen(true)}>
                  <Ionicons name="information" color="#c9a962" size={17} />
                </Pressable>
              </View>
              <LotCardBidBar artwork={artwork} variant="detail" />
              <View style={styles.countdownRow}>
                <Ionicons name="time-outline" color="#7a7670" size={15} />
                <Countdown endMs={lot.endsAt} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={feedbackOpen} transparent animationType="slide" onRequestClose={() => setFeedbackOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setFeedbackOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 22 }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Your feedback</Text>
              <Pressable accessibilityLabel="Close response sheet" style={styles.sheetClose} onPress={() => setFeedbackOpen(false)}>
                <Ionicons name="close" color="#f5f0e6" size={19} />
              </Pressable>
            </View>

            <View style={styles.block}>
              <Text style={styles.section}>Rating</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Pressable key={s} onPress={() => void setVote(artwork.id, s)} style={styles.starBtn}>
                    <Ionicons
                      name={myStars && myStars >= s ? 'star' : 'star-outline'}
                      size={28}
                      color={myStars && myStars >= s ? '#f0b429' : '#6e6e73'}
                    />
                  </Pressable>
                ))}
                <Pressable onPress={() => void clearVote(artwork.id)} style={styles.clear}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              </View>
              {avg != null ? <Text style={styles.avg}>Average {avg.toFixed(1)} ★</Text> : null}
            </View>

            <View style={styles.block}>
              <Text style={[styles.section, styles.noteSection]}>Note</Text>
              <TextInput
                style={styles.ta}
                multiline
                value={fb}
                onChangeText={setFb}
                placeholder="Short reflection…"
                placeholderTextColor="#6e6e73"
              />
              {fbErr ? <Text style={styles.err}>{fbErr}</Text> : null}
              <Pressable style={styles.btn} onPress={submitFeedback}>
                <Text style={styles.btnText}>Post</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={bidRulesOpen} transparent animationType="fade" onRequestClose={() => setBidRulesOpen(false)}>
        <Pressable style={styles.rulesBackdrop} onPress={() => setBidRulesOpen(false)}>
          <Pressable style={styles.rulesCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.rulesTitle}>Bid rules</Text>
              <Pressable accessibilityLabel="Close bid rules" style={styles.sheetClose} onPress={() => setBidRulesOpen(false)}>
                <Ionicons name="close" color="#f5f0e6" size={19} />
              </Pressable>
            </View>
            <Text style={styles.rulesText}>Opening bid is the first acceptable bid for this artwork.</Text>
            <Text style={styles.rulesText}>Each new bid must meet the next minimum bid shown in the input.</Text>
            <Text style={styles.rulesText}>Minimum increment is $50, or 5% above the current bid, whichever is greater.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0b' },
  root: { flex: 1, backgroundColor: '#0a0a0b' },
  content: { paddingHorizontal: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0a0a0b' },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,10,12,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.22)',
  },
  carouselShell: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#202024',
  },
  panel: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#0f0f11',
    borderWidth: 1,
    borderColor: '#242428',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headCopy: { flex: 1 },
  artist: { color: '#c9a962', fontSize: 12, letterSpacing: 1.1, marginTop: 2 },
  title: { color: '#f5f0e6', fontSize: 28, fontWeight: '700', lineHeight: 34, fontFamily: 'serif' },
  inlineMeta: { color: '#c9c5bc', lineHeight: 19, marginTop: 4 },
  quickActions: { flexDirection: 'row', gap: 8, paddingTop: 2 },
  smallAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: '#2a2a30',
  },
  medium: { color: '#a8a4a0', lineHeight: 19 },
  body: { color: '#c9c5bc', lineHeight: 22, marginTop: 8 },
  auctionCard: {
    borderWidth: 1,
    borderColor: 'rgba(214,181,101,0.28)',
    backgroundColor: '#141416',
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 14,
    marginTop: 8,
  },
  auctionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
  },
  auctionHeaderCopy: { flex: 1 },
  bidTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  bidLine: { color: '#f5f0e6', fontSize: 18, fontWeight: '600' },
  participationPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  leadingPill: {
    backgroundColor: 'rgba(88,214,141,0.13)',
    borderColor: 'rgba(88,214,141,0.34)',
  },
  outbidPill: {
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderColor: 'rgba(255,107,107,0.32)',
  },
  participationText: { fontSize: 11, fontWeight: '800' },
  leadingText: { color: '#8ee6a8' },
  outbidText: { color: '#ffb4a8' },
  infoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(214,181,101,0.32)',
    backgroundColor: '#111113',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: '#25252a',
  },
  block: { marginTop: 4 },
  section: { color: '#f5f0e6', fontWeight: '700', marginTop: 8 },
  noteSection: { marginBottom: 7 },
  stars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  starBtn: { paddingVertical: 8, paddingRight: 6 },
  clear: { marginLeft: 8 },
  clearText: { color: '#a8a4a0' },
  avg: { color: '#8a8a8f' },
  ta: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#3a3a40',
    borderRadius: 10,
    padding: 12,
    color: '#f5f0e6',
    textAlignVertical: 'top',
  },
  err: { color: '#ffb4a8' },
  btn: { backgroundColor: '#2a2a32', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#f5f0e6', fontWeight: '600' },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.56)',
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#101012',
    borderWidth: 1,
    borderColor: '#2a2a30',
    gap: 10,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: '#3a3a40',
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { color: '#f5f0e6', fontSize: 20, fontWeight: '700', fontFamily: 'serif' },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: '#2a2a30',
  },
  rulesBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  rulesCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: '#101012',
    borderWidth: 1,
    borderColor: '#2a2a30',
    padding: 18,
    gap: 10,
  },
  rulesTitle: { color: '#f5f0e6', fontSize: 20, fontWeight: '700', fontFamily: 'serif' },
  rulesText: { color: '#c9c5bc', lineHeight: 21 },
});
