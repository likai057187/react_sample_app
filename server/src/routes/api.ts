import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import type { ClientArtwork } from '../lib/pricing.js';
import {
  ensureGuestRecord,
  claimGuestDisplayName,
  getGuestDisplayName,
  getAuctionStateJson,
  placeBid,
  setVote,
  deleteVote,
  addFeedback,
  getNetworkProfileJson,
  setNetworkBio,
  getFriendsJson,
  addFriend,
  getDirectMessagesJson,
  hasFriendshipConnection,
  addDirectMessage,
  getForumTopicsJson,
  addForumTopic,
  addForumReply,
} from '../lib/auctionDb.js';

const COOKIE = 'guest_id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROBOFLOW_REQUEST_TIMEOUT_MS = 8_000;

type DiscoveryMatchBody = {
  imageBase64?: unknown;
};

type RoboflowCandidate = {
  label: string;
  confidence: number;
};

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((p) => {
      const [k, ...rest] = p.trim().split('=');
      if (!k) return ['', ''];
      return [k, decodeURIComponent(rest.join('=') || '')];
    }),
  );
}

function setGuestCookie(reply: { header: (k: string, v: string) => void }, guestId: string): void {
  const maxAge = 365 * 24 * 60 * 60;
  reply.header(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(guestId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );
}

/** Cookie (browser) or `X-Guest-Id` (Expo / native clients that do not persist cookies). */
function getGuestIdFromRequest(request: FastifyRequest): string | null {
  const fromCookie = parseCookies(request.headers.cookie)[COOKIE];
  if (fromCookie && UUID_RE.test(fromCookie)) return fromCookie;
  const h = request.headers['x-guest-id'];
  const raw = typeof h === 'string' ? h.trim() : Array.isArray(h) && typeof h[0] === 'string' ? h[0].trim() : '';
  if (raw && UUID_RE.test(raw)) return raw;
  return null;
}

function attachMediaKeyToArtworks(artworks: ClientArtwork[], key: string): ClientArtwork[] {
  const add = (u: string) => {
    if (typeof u !== 'string' || !u.startsWith('/api/media')) return u;
    const sep = u.includes('?') ? '&' : '?';
    return `${u}${sep}apiKey=${encodeURIComponent(key)}`;
  };
  return artworks.map((a) => ({
    ...a,
    imageUrl: add(a.imageUrl),
    imageUrls: Array.isArray(a.imageUrls) ? a.imageUrls.map(add) : a.imageUrls,
  }));
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function discoveryThreshold(): number {
  return Number.isFinite(env.DISCOVERY_MATCH_THRESHOLD) ? env.DISCOVERY_MATCH_THRESHOLD : 0.4;
}

function roboflowEndpoint(): string | null {
  if (!env.ROBOFLOW_API_KEY) return null;
  const base = env.ROBOFLOW_INFERENCE_URL || (env.ROBOFLOW_MODEL_ID ? `https://classify.roboflow.com/${env.ROBOFLOW_MODEL_ID}` : '');
  if (!base) return null;
  try {
    const url = new URL(base);
    url.searchParams.set('api_key', env.ROBOFLOW_API_KEY);
    return url.toString();
  } catch {
    return null;
  }
}

function confidenceFromUnknown(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractRoboflowCandidates(payload: unknown): RoboflowCandidate[] {
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  const out: RoboflowCandidate[] = [];

  const top = stringFromUnknown(obj.top ?? obj.class ?? obj.predicted_class);
  const topConfidence = confidenceFromUnknown(obj.confidence);
  if (top && topConfidence != null) out.push({ label: top, confidence: topConfidence });

  const predictions = obj.predictions;
  if (Array.isArray(predictions)) {
    for (const item of predictions) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const label = stringFromUnknown(record.class ?? record.label ?? record.name);
      const confidence = confidenceFromUnknown(record.confidence ?? record.score);
      if (label && confidence != null) out.push({ label, confidence });
    }
  } else if (predictions && typeof predictions === 'object') {
    for (const [label, raw] of Object.entries(predictions as Record<string, unknown>)) {
      const confidence =
        confidenceFromUnknown(raw) ??
        (raw && typeof raw === 'object' ? confidenceFromUnknown((raw as Record<string, unknown>).confidence) : null);
      if (confidence != null) out.push({ label, confidence });
    }
  }

  return out
    .filter((candidate) => candidate.confidence >= 0 && candidate.confidence <= 1)
    .sort((a, b) => b.confidence - a.confidence);
}

function stripDataUrl(raw: string): string {
  const match = raw.match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i);
  return (match?.[1] ?? raw).trim();
}

export type AuctionApiOpts = {
  refreshCatalog: () => Promise<void>;
  getArtworks: () => ClientArtwork[];
  onAuctionStateChanged: () => void | Promise<void>;
  apiKey: string;
};

export const auctionApiRoutes: FastifyPluginAsync<AuctionApiOpts> = async (fastify, opts) => {
  const { refreshCatalog, getArtworks, onAuctionStateChanged, apiKey } = opts;

  const notifyAuction = () => {
    void Promise.resolve(onAuctionStateChanged()).catch((err) => {
      fastify.log.error({ err }, 'auction state notify');
    });
  };

  fastify.get('/session', async (request, reply) => {
    let guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      guestId = randomUUID();
      setGuestCookie(reply, guestId);
    }
    await ensureGuestRecord(guestId);
    const displayName = await getGuestDisplayName(guestId);
    const welcomeComplete = !!(displayName && displayName.trim().length >= 2);
    return { guestId, displayName, welcomeComplete };
  });

  fastify.patch<{ Body: { displayName?: unknown } }>('/session', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const name = request.body?.displayName;
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 40) {
      return reply.code(400).send({ error: 'invalid_display_name' });
    }
    const session = await claimGuestDisplayName(guestId, name);
    setGuestCookie(reply, session.guestId);
    return { ok: true, ...session, welcomeComplete: true };
  });

  fastify.get('/catalog', async () => {
    await refreshCatalog();
    const artworks = attachMediaKeyToArtworks(getArtworks(), apiKey);
    return { version: 1, artworks };
  });

  fastify.post<{ Body: DiscoveryMatchBody }>(
    '/discovery/match',
    { bodyLimit: 6 * 1024 * 1024 },
    async (request, reply) => {
      const endpoint = roboflowEndpoint();
      if (!endpoint) {
        return reply.code(503).send({ error: 'roboflow_not_configured', match: null });
      }

      const rawImage = request.body?.imageBase64;
      if (typeof rawImage !== 'string' || rawImage.trim().length < 128) {
        return reply.code(400).send({ error: 'invalid_image', match: null });
      }

      const imageBase64 = stripDataUrl(rawImage);
      const startedAt = Date.now();
      let roboflowPayload: unknown;
      const timeout = new AbortController();
      const timeoutId = setTimeout(() => timeout.abort(), ROBOFLOW_REQUEST_TIMEOUT_MS);
      try {
        const roboflowResponse = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: imageBase64,
          signal: timeout.signal,
        });
        clearTimeout(timeoutId);
        roboflowPayload = await roboflowResponse.json().catch(() => null);
        if (!roboflowResponse.ok) {
          fastify.log.warn(
            { status: roboflowResponse.status, elapsedMs: Date.now() - startedAt, roboflowPayload },
            'Roboflow discovery match failed',
          );
          return reply.code(502).send({ error: 'roboflow_failed', match: null });
        }
      } catch (err) {
        clearTimeout(timeoutId);
        fastify.log.warn({ err, elapsedMs: Date.now() - startedAt }, 'Roboflow discovery match request failed');
        return reply.code(502).send({ error: 'roboflow_unreachable', match: null });
      }

      const artworks = getArtworks();
      const byId = new Map(artworks.map((artwork) => [artwork.id, artwork]));
      const threshold = discoveryThreshold();
      const candidates = extractRoboflowCandidates(roboflowPayload).map((candidate) => ({
        ...candidate,
        artworkId: byId.has(candidate.label) ? candidate.label : slugify(candidate.label),
      }));
      const best = candidates.find((candidate) => candidate.confidence >= threshold && byId.has(candidate.artworkId));
      fastify.log.info(
        {
          elapsedMs: Date.now() - startedAt,
          threshold,
          candidateCount: candidates.length,
          topLabel: candidates[0]?.label,
          topConfidence: candidates[0]?.confidence,
          topArtworkId: candidates[0]?.artworkId,
          matchedArtworkId: best?.artworkId ?? null,
          matchedConfidence: best?.confidence,
        },
        'Roboflow discovery classification result',
      );

      if (!best) {
        return {
          match: null,
          threshold,
          predictions: candidates.slice(0, 3).map((candidate) => ({
            artworkId: candidate.artworkId,
            label: candidate.label,
            confidence: candidate.confidence,
          })),
        };
      }

      return {
        match: {
          artworkId: best.artworkId,
          confidence: best.confidence,
        },
        threshold,
      };
    },
  );

  fastify.get('/auction/state', async () => {
    const s = await getAuctionStateJson();
    return {
      version: 1,
      eventEndsAt: s.eventEndsAt,
      lots: s.lots,
      votes: s.votes,
      feedback: s.feedback,
    };
  });

  fastify.get('/network/forum', async () => {
    const topics = await getForumTopicsJson();
    return { version: 1, topics };
  });

  fastify.get('/network/profile', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const profile = await getNetworkProfileJson(guestId);
    return { version: 1, profile };
  });

  fastify.patch<{ Body: { bio?: unknown } }>('/network/profile', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const bio = typeof request.body?.bio === 'string' ? request.body.bio : '';
    await setNetworkBio(guestId, bio);
    return { ok: true };
  });

  fastify.get('/network/friends', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const friends = await getFriendsJson(guestId);
    return { version: 1, friends };
  });

  fastify.post<{ Body: { guestId?: unknown; displayName?: unknown } }>('/network/friends', async (request, reply) => {
    const ownerId = getGuestIdFromRequest(request);
    if (!ownerId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const friendId = typeof request.body?.guestId === 'string' ? request.body.guestId.trim() : '';
    if (!UUID_RE.test(friendId)) {
      return reply.code(400).send({ error: 'invalid_friend' });
    }
    const displayName = typeof request.body?.displayName === 'string' ? request.body.displayName : 'Collector';
    const result = await addFriend({ ownerId, friendId, displayName });
    if (!result.ok) {
      return reply.code(400).send({ error: result.error });
    }
    return { ok: true, alreadyExisted: result.alreadyExisted };
  });

  fastify.get<{ Params: { friendId: string } }>('/network/chats/:friendId/messages', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const friendId = request.params.friendId;
    if (!UUID_RE.test(friendId)) {
      return reply.code(400).send({ error: 'invalid_friend' });
    }
    if (!(await hasFriendshipConnection(guestId, friendId))) {
      return reply.code(403).send({ error: 'not_friends' });
    }
    const messages = await getDirectMessagesJson(guestId, friendId);
    return { version: 1, messages };
  });

  fastify.post<{ Params: { friendId: string }; Body: { body?: unknown } }>(
    '/network/chats/:friendId/messages',
    async (request, reply) => {
      const senderId = getGuestIdFromRequest(request);
      if (!senderId) {
        return reply.code(401).send({ error: 'no_session' });
      }
      const recipientId = request.params.friendId;
      if (!UUID_RE.test(recipientId)) {
        return reply.code(400).send({ error: 'invalid_friend' });
      }
      if (!(await hasFriendshipConnection(senderId, recipientId))) {
        return reply.code(403).send({ error: 'not_friends' });
      }
      const body = typeof request.body?.body === 'string' ? request.body.body : '';
      const result = await addDirectMessage({ senderId, recipientId, body });
      if (!result.ok) {
        return reply.code(400).send({ error: result.error });
      }
      return { ok: true };
    },
  );

  fastify.post<{ Body: { title?: unknown; body?: unknown } }>('/network/forum/topics', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
    const body = typeof request.body?.body === 'string' ? request.body.body.trim() : '';
    if (!title && !body) {
      return reply.code(400).send({ error: 'invalid_body' });
    }
    const displayName = (await getGuestDisplayName(guestId))?.trim() || 'Collector';
    await addForumTopic({ guestId, displayName, title, body });
    return { ok: true };
  });

  fastify.post<{ Body: { topicId?: unknown; body?: unknown } }>('/network/forum/replies', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const topicId = request.body?.topicId;
    const body = typeof request.body?.body === 'string' ? request.body.body.trim() : '';
    if (typeof topicId !== 'string' || body.length < 1) {
      return reply.code(400).send({ error: 'invalid_body' });
    }
    const displayName = (await getGuestDisplayName(guestId))?.trim() || 'Collector';
    const result = await addForumReply({ guestId, displayName, topicId, body });
    if (!result.ok) {
      return reply.code(404).send({ error: result.error });
    }
    return { ok: true };
  });

  fastify.post<{ Body: { lotId?: unknown; amountCents?: unknown } }>('/bids', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const lotId = request.body?.lotId;
    const amountCents = Number(request.body?.amountCents);
    if (typeof lotId !== 'string' || !Number.isFinite(amountCents) || amountCents <= 0) {
      return reply.code(400).send({ error: 'invalid_body' });
    }
    const art = getArtworks().find((e) => e.id === lotId);
    if (!art) {
      return reply.code(404).send({ error: 'unknown_lot' });
    }

    const result = await placeBid({
      guestId,
      lotId,
      amountCents,
      openingBidCents: art.openingBidCents,
    });

    if (result.ok) {
      notifyAuction();
      return { ok: true };
    }
    if (result.error === 'below_min') return reply.code(400).send({ error: result.error, min: result.min });
    if (result.error === 'closed') return reply.code(400).send({ error: result.error });
    if (result.error === 'unknown_lot') return reply.code(404).send({ error: result.error });
    return reply.code(400).send({ error: 'reject' });
  });

  fastify.post<{ Body: { lotId?: unknown } }>('/votes/clear', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const lotId = request.body?.lotId;
    if (typeof lotId !== 'string') {
      return reply.code(400).send({ error: 'invalid_body' });
    }
    if (!getArtworks().some((a) => a.id === lotId)) {
      return reply.code(404).send({ error: 'unknown_lot' });
    }
    await deleteVote({ guestId, lotId });
    notifyAuction();
    return { ok: true };
  });

  fastify.post<{ Body: { lotId?: unknown; stars?: unknown } }>('/votes', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const lotId = request.body?.lotId;
    const stars = Math.round(Number(request.body?.stars));
    if (typeof lotId !== 'string' || stars < 1 || stars > 5) {
      return reply.code(400).send({ error: 'invalid_body' });
    }
    if (!getArtworks().some((a) => a.id === lotId)) {
      return reply.code(404).send({ error: 'unknown_lot' });
    }
    await setVote({ guestId, lotId, stars });
    notifyAuction();
    return { ok: true };
  });

  fastify.post<{ Body: { lotId?: unknown; body?: unknown } }>('/feedback', async (request, reply) => {
    const guestId = getGuestIdFromRequest(request);
    if (!guestId) {
      return reply.code(401).send({ error: 'no_session' });
    }
    const lotId = request.body?.lotId;
    const body = typeof request.body?.body === 'string' ? request.body.body.trim() : '';
    if (typeof lotId !== 'string' || body.length < 3) {
      return reply.code(400).send({ error: 'invalid_body' });
    }
    if (!getArtworks().some((a) => a.id === lotId)) {
      return reply.code(404).send({ error: 'unknown_lot' });
    }
    const displayName = (await getGuestDisplayName(guestId))?.trim() || 'Guest';
    await addFeedback({ guestId, lotId, body, displayName });
    notifyAuction();
    return { ok: true };
  });

};
