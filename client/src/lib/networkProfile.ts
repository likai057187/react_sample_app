import { apiFetch } from './apiClient';

export async function loadNetworkBio(): Promise<string> {
  try {
    const res = await apiFetch('/api/network/profile', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return '';
    const data = (await res.json().catch(() => ({}))) as { profile?: { bio?: string } };
    return typeof data.profile?.bio === 'string' ? data.profile.bio : '';
  } catch {
    return '';
  }
}

export async function saveNetworkBio(bio: string): Promise<void> {
  await apiFetch('/api/network/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ bio }),
  }).catch(() => undefined);
}
