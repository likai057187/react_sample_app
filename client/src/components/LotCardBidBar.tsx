import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuction } from '../context/AuctionProvider';
import { nextMinimumBidCents } from '../lib/bidding';
import type { Artwork, LotRuntime } from '../types';

type Props = { artwork: Artwork; variant?: 'card' | 'detail' };

export function LotCardBidBar({ artwork, variant = 'card' }: Props) {
  const { getLot, placeBid, nextMinBid, isLotClosed, isLeading } = useAuction();
  const lot = getLot(artwork.id);
  const min = nextMinBid(artwork.id);
  const closed = isLotClosed(artwork.id);
  const leading = isLeading(artwork.id);
  const defaultUsd = min ? Math.ceil(min / 100) : Math.ceil(artwork.openingBidCents / 100);
  const [raw, setRaw] = useState(String(defaultUsd));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const disabled = saving || leading;

  useEffect(() => {
    setRaw(String(defaultUsd));
    setError(null);
  }, [defaultUsd]);

  if (!lot || min === null || closed) return null;

  const onSubmit = async () => {
    if (disabled) return;
    setError(null);
    const dollars = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError('Invalid amount.');
      return;
    }
    const cents = Math.round(dollars * 100);
    setSaving(true);
    const res = await placeBid(artwork.id, cents);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Bid not accepted.');
      return;
    }
    const nextLot: LotRuntime = {
      ...lot,
      currentBidCents: cents,
      bids: [
        {
          id: 'temp',
          guestId: 'temp',
          amountCents: cents,
          placedAt: Date.now(),
        },
        ...lot.bids,
      ],
    };
    const floor = nextMinimumBidCents(artwork, nextLot);
    setRaw(String(Math.ceil(floor / 100)));
  };

  return (
    <View style={[styles.wrap, variant === 'detail' && styles.detailWrap]}>
      <TextInput
        accessibilityLabel="Your bid in US dollars"
        style={[styles.field, variant === 'detail' && styles.detailField, leading && styles.disabledField]}
        keyboardType="decimal-pad"
        autoCorrect={false}
        editable={!disabled}
        value={raw}
        onChangeText={setRaw}
      />
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          variant === 'detail' && styles.detailBtn,
          disabled && styles.disabledBtn,
          pressed && !disabled && styles.btnPressed,
        ]}
        onPress={onSubmit}
        disabled={disabled}
      >
        <Text style={[styles.btnText, disabled && styles.disabledBtnText]}>{saving ? '…' : leading ? 'Leading' : 'Bid'}</Text>
      </Pressable>
      {error ? (
        <Text style={styles.err} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  detailWrap: { paddingTop: 14, paddingBottom: 12, gap: 12 },
  field: {
    flex: 1,
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#3a3a40',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f5f0e6',
    fontSize: 18,
    backgroundColor: '#0e0e10',
  },
  detailField: {
    minHeight: 46,
    borderRadius: 11,
  },
  disabledField: {
    opacity: 0.45,
    backgroundColor: '#0b0b0c',
  },
  btn: { backgroundColor: '#c9a962', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  detailBtn: {
    minHeight: 46,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.55,
    backgroundColor: '#6b5d3a',
  },
  btnPressed: { opacity: 0.9 },
  btnText: { color: '#1a1208', fontWeight: '700', fontSize: 16 },
  disabledBtnText: { color: '#2a2418' },
  err: { width: '100%', color: '#ffb4a8', fontSize: 13 },
});
