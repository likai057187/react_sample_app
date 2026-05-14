/**
 * HTTP (Fastify) + Socket.IO + static SPA/media — aligned with travel_app stack.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { readFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { initDatabase, ensureLotsForIds } from './lib/auctionDb.js';
import { buildCatalogEntries } from './lib/catalogScan.js';
import { buildArtworksForClient, type ClientArtwork } from './lib/pricing.js';
import { auctionApiRoutes } from './routes/api.js';
import { attachAuctionSocket, broadcastAuctionState } from './lib/auctionBroadcast.js';
import { parseApiKeyFromFastifyRequest, timingSafeEqualString } from './lib/apiKey.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const distRoot = join(repoRoot, 'client', 'dist');
const artworkRoot = join(repoRoot, 'client', 'asset', 'artwork');

if (!env.API_KEY) {
  console.error(
    'Missing API_KEY. Copy env.sample to .env at the repo root (same folder as package.json), or set server/.env.',
  );
  process.exit(1);
}

let artworksCache: ClientArtwork[] = [];

async function refreshCatalog(): Promise<void> {
  const raw = await buildCatalogEntries(artworkRoot);
  artworksCache = buildArtworksForClient(raw);
  await ensureLotsForIds(artworksCache.map((a) => a.id));
}

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

fastify.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'Validation error',
      details: error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  fastify.log.error(error);
  const statusCode = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
  reply.code(statusCode).send({
    error: statusCode >= 500 ? 'Internal server error' : (error as Error).message,
  });
});

async function bootstrap(): Promise<void> {
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'X-Api-Key', 'X-Guest-Id', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  });

  fastify.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') return;
    const pathOnly = String(request.url ?? '').split('?')[0]!;
    if (!pathOnly.startsWith('/api')) return;
    const presented = parseApiKeyFromFastifyRequest(request);
    if (!timingSafeEqualString(presented, env.API_KEY)) {
      return reply.code(401).type('application/json').send({ error: 'invalid_api_key' });
    }
  });

  await initDatabase();
  await refreshCatalog();

  await fastify.register(auctionApiRoutes, {
    prefix: '/api',
    refreshCatalog,
    getArtworks: () => artworksCache,
    onAuctionStateChanged: broadcastAuctionState,
    apiKey: env.API_KEY,
  });

  await fastify.register(fastifyStatic, {
    root: artworkRoot,
    prefix: '/api/media/',
    decorateReply: false,
    index: false,
    maxAge: '7d',
    setHeaders(res) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    },
  });

  await fastify.register(fastifyStatic, {
    root: distRoot,
    index: false,
    decorateReply: false,
    maxAge: 0,
    setHeaders(res, filePath) {
      if (filePath.includes(`${sep}assets${sep}`) || filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });

  fastify.setNotFoundHandler(async (request, reply) => {
    const pathOnly = String(request.url ?? '').split('?')[0]!;
    if (pathOnly.startsWith('/api')) {
      return reply.code(404).type('application/json').send({ error: 'not_found' });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return reply.code(404).type('text/plain').send('Not Found');
    }
    if (pathOnly.startsWith('/socket.io')) {
      return reply
        .code(404)
        .type('text/plain')
        .send('Socket.IO is handled on this port; check client path matches /socket.io');
    }
    const html = await readFile(join(distRoot, 'index.html'), 'utf8');
    return reply.type('text/html').send(html);
  });

  attachAuctionSocket(fastify.server, { apiKey: env.API_KEY });

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  fastify.log.info(`Server + Socket.IO listening on port ${env.PORT}`);
  fastify.log.info(`API: /api/session, /api/catalog, /api/auction/state, …`);
  fastify.log.info(`Media: /api/media/…  SPA: ${distRoot}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
