/** Payload printed beside labels: `exh:<artworkId>` (artwork id is catalog id, e.g. `ningzhang--divine-illumination-no-1`). */
export const EXH_ART_PREFIX = "exh:";

export const EXH_FRIEND_PREFIX = "exh-friend:";

export function buildArtworkQrPayload(artworkId: string): string {
  return `${EXH_ART_PREFIX}${artworkId}`;
}

export function parseArtworkIdFromQr(data: string): string | null {
  const t = data.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith(EXH_ART_PREFIX)) {
    const id = t.slice(EXH_ART_PREFIX.length).trim();
    return id || null;
  }
  const mPath = t.match(/\/inventory\/artwork\/([^/?#]+)/i);
  if (mPath?.[1]) return decodeURIComponent(mPath[1]);
  const mLot = t.match(/\/lot\/([^/?#]+)/i);
  if (mLot?.[1]) return decodeURIComponent(mLot[1]);
  return null;
}

export function parseFriendIdFromQr(data: string): string | null {
  return parseFriendTagFromQr(data)?.guestId ?? null;
}

export function buildFriendQrPayload(guestId: string, displayName?: string): string {
  const name = displayName?.trim();
  return name ? `${EXH_FRIEND_PREFIX}${guestId}|${encodeURIComponent(name)}` : `${EXH_FRIEND_PREFIX}${guestId}`;
}

export function parseFriendTagFromQr(data: string): { guestId: string; displayName?: string } | null {
  const t = data.trim();
  if (!t) return null;
  if (t.toLowerCase().startsWith(EXH_FRIEND_PREFIX)) {
    const payload = t.slice(EXH_FRIEND_PREFIX.length).trim();
    const [id, encodedName] = payload.split('|');
    const guestId = id?.trim();
    if (!guestId) return null;
    const displayName = encodedName ? decodeURIComponent(encodedName).trim() : '';
    return { guestId, displayName: displayName || undefined };
  }
  return null;
}
