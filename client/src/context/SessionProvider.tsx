import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '../lib/apiClient';
import { setStoredGuestId } from '../lib/guestStorage';

export type SessionReady = {
  status: 'ready';
  guestId: string;
  displayName: string;
  welcomeComplete: boolean;
};

type SessionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | SessionReady;

type SessionContextValue = SessionState & {
  refreshSession: () => Promise<void>;
  patchDisplayName: (displayName: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  const refreshSession = useCallback(async () => {
    const res = await apiFetch('/api/session', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const keyHint =
        res.status === 401 && body.error === 'invalid_api_key'
          ? ' Set API_KEY and VITE_API_KEY (or EXPO_PUBLIC_API_KEY) in repo root `.env` to match the server, then restart.'
          : '';
      const hint =
        res.status === 404 || res.status === 0
          ? ' Start the API on port 3847 (`npm run dev:api` from repo root). For devices/emulators set EXPO_PUBLIC_API_ORIGIN to your machine IP:3847.'
          : '';
      setSession({ status: 'error', message: `Session request failed (${res.status}).${keyHint}${hint}` });
      return;
    }
    const data = (await res.json()) as {
      guestId?: string;
      displayName?: string | null;
      welcomeComplete?: boolean;
    };
    if (!data.guestId) {
      setSession({ status: 'error', message: 'Invalid session response.' });
      return;
    }
    await setStoredGuestId(data.guestId);
    setSession({
      status: 'ready',
      guestId: data.guestId,
      displayName: (data.displayName ?? '').trim(),
      welcomeComplete: !!data.welcomeComplete,
    });
  }, []);

  useEffect(() => {
    void refreshSession().catch((e: unknown) => {
      setSession({
        status: 'error',
        message: e instanceof Error ? e.message : 'Could not reach the server.',
      });
    });
  }, [refreshSession]);

  const patchDisplayName = useCallback(
    async (displayName: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const res = await apiFetch('/api/session', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (body.error === 'invalid_display_name') {
          return { ok: false, error: 'Use 2–40 characters for your name.' };
        }
        if (body.error === 'no_session') {
          return { ok: false, error: 'Session expired. Restart the app.' };
        }
        return { ok: false, error: 'Could not save your name. Try again.' };
      }
      await refreshSession();
      return { ok: true };
    },
    [refreshSession],
  );

  const value = useMemo(
    (): SessionContextValue => ({
      ...session,
      refreshSession,
      patchDisplayName,
    }),
    [session, refreshSession, patchDisplayName],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
