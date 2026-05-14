import Constants from 'expo-constants';
import { getStoredGuestId } from './guestStorage';

type Extra = { apiOrigin?: string; apiKey?: string };

export function getApiOrigin(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  const fromExtra = extra?.apiOrigin?.trim();
  if (fromExtra) return fromExtra.replace(/\/$/, '');
  return (process.env.EXPO_PUBLIC_API_ORIGIN ?? 'http://127.0.0.1:3847').replace(/\/$/, '');
}

export function getApiKey(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  const k = extra?.apiKey ?? process.env.EXPO_PUBLIC_API_KEY ?? process.env.VITE_API_KEY;
  return typeof k === 'string' ? k.trim() : '';
}

export function apiHeaders(extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra);
  const key = getApiKey();
  if (key) headers.set('X-Api-Key', key);
  return headers;
}

/** Absolute URL for same-origin paths like `/api/...`. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const origin = getApiOrigin();
  const url = path.startsWith('http') ? path : `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init?.headers ?? {});
  const k = getApiKey();
  if (k) headers.set('X-Api-Key', k);
  const gid = await getStoredGuestId();
  if (gid) headers.set('X-Guest-Id', gid);
  return fetch(url, { ...init, headers, credentials: 'include' });
}

export function apiMediaUrl(path: string): string {
  const k = getApiKey();
  if (!k || !path.startsWith('/api/')) return `${getApiOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
  const sep = path.includes('?') ? '&' : '?';
  return `${getApiOrigin()}${path.startsWith('/') ? path : `/${path}`}${sep}apiKey=${encodeURIComponent(k)}`;
}

export type DiscoveryMatchResult = {
  match: { artworkId: string; confidence: number } | null;
  error?: string;
  threshold?: number;
};

export async function matchArtworkFrame(imageBase64: string): Promise<DiscoveryMatchResult> {
  const res = await apiFetch('/api/discovery/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<DiscoveryMatchResult>;
  if (!res.ok) {
    return { match: null, error: typeof data.error === 'string' ? data.error : `match_failed_${res.status}` };
  }
  return {
    match:
      data.match && typeof data.match.artworkId === 'string' && typeof data.match.confidence === 'number'
        ? data.match
        : null,
    threshold: typeof data.threshold === 'number' ? data.threshold : undefined,
  };
}
