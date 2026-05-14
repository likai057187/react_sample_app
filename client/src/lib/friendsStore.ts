import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildFriendQrPayload as buildQrPayload } from './qrPayload';

const KEY = 'di-friends-v1';

export type FriendEntry = {
  guestId: string;
  displayName: string;
  addedAt: number;
};

async function read(): Promise<FriendEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as FriendEntry[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

async function write(rows: FriendEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(rows.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

export async function loadFriends(): Promise<FriendEntry[]> {
  return read();
}

export async function addFriend(
  guestId: string,
  displayName: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = guestId.trim();
  const name = displayName.trim() || 'Collector';
  if (g.length < 4) return { ok: false, error: 'Invalid friend code.' };
  const rows = await read();
  if (rows.some((r) => r.guestId === g)) {
    await write(rows.map((r) => (r.guestId === g ? { ...r, displayName: name } : r)));
    return { ok: false, error: 'Already in your list.' };
  }
  await write([{ guestId: g, displayName: name, addedAt: Date.now() }, ...rows]);
  return { ok: true };
}

export function buildFriendQrPayload(guestId: string, displayName?: string): string {
  return buildQrPayload(guestId, displayName);
}
