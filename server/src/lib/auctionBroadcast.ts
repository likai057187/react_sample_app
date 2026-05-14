/**
 * Auction realtime hub (Socket.IO), same pattern as travel_app: attach to the HTTP server,
 * validate API key in `io.use`, push full state on connect and on every broadcast.
 */
import type { Server } from 'socket.io';
import { Server as SocketIOServer } from 'socket.io';
import { getAuctionStateJson } from './auctionDb.js';
import { timingSafeEqualString } from './apiKey.js';

let io: Server | null = null;

async function auctionStatePayload() {
  const s = await getAuctionStateJson();
  return {
    type: 'auction_state' as const,
    version: 1,
    eventEndsAt: s.eventEndsAt,
    lots: s.lots,
    votes: s.votes,
    feedback: s.feedback,
  };
}

function presentedKeyFromHandshake(socket: import('socket.io').Socket): string {
  const a = socket.handshake.auth?.apiKey;
  if (typeof a === 'string' && a.trim()) return a.trim();
  const q = socket.handshake.query?.apiKey;
  if (typeof q === 'string' && q.trim()) return q.trim();
  const h = socket.handshake.headers['x-api-key'];
  if (typeof h === 'string' && h.trim()) return h.trim();
  if (Array.isArray(h) && typeof h[0] === 'string' && h[0].trim()) return h[0].trim();
  return '';
}

export function attachAuctionSocket(
  httpServer: import('node:http').Server,
  opts: { apiKey: string },
): Server {
  const { apiKey } = opts;

  io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    const presented = presentedKeyFromHandshake(socket);
    if (!timingSafeEqualString(presented, apiKey)) {
      return next(new Error('invalid_api_key'));
    }
    next();
  });

  io.on('connection', (socket) => {
    void (async () => {
      try {
        const payload = await auctionStatePayload();
        socket.emit('auction_state', payload);
      } catch (e) {
        console.error('auction socket initial snapshot', e);
      }
    })();
  });

  return io;
}

export async function broadcastAuctionState(): Promise<void> {
  if (!io) return;
  try {
    const payload = await auctionStatePayload();
    io.emit('auction_state', payload);
  } catch (e) {
    console.error('auction broadcast', e);
  }
}
