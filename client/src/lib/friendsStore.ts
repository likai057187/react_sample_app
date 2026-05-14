import { apiFetch } from './apiClient';
import { buildFriendQrPayload as buildQrPayload } from './qrPayload';

export type FriendEntry = {
  guestId: string;
  displayName: string;
  addedAt: number;
};

export async function loadFriends(): Promise<FriendEntry[]> {
  try {
    const res = await apiFetch('/api/network/friends', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as { friends?: FriendEntry[] };
    return Array.isArray(data.friends) ? data.friends : [];
  } catch {
    return [];
  }
}

export async function addFriend(
  guestId: string,
  displayName: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = guestId.trim();
  const name = displayName.trim() || 'Collector';
  if (g.length < 4) return { ok: false, error: 'Invalid friend code.' };
  const res = await apiFetch('/api/network/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ guestId: g, displayName: name }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; alreadyExisted?: boolean };
  if (!res.ok) {
    if (data.error === 'self_friend') return { ok: false, error: 'That is your own collector tag.' };
    if (data.error === 'invalid_friend') return { ok: false, error: 'Invalid friend code.' };
    if (res.status === 401) return { ok: false, error: 'Session expired. Restart the app.' };
    return { ok: false, error: 'Could not add friend.' };
  }
  if (data.alreadyExisted) return { ok: false, error: 'Already in your list.' };
  return { ok: true };
}

export function buildFriendQrPayload(guestId: string, displayName?: string): string {
  return buildQrPayload(guestId, displayName);
}
