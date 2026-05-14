/**
 * Auction + guest persistence via Prisma (authoritative store).
 */
import { randomUUID } from 'node:crypto';
import { nextMinimumBidCents } from './bidding.js';
import { prisma } from '../config/db.js';

/** Global lot end: 8:30 PM America/New_York, May 14, 2026 (EDT, UTC−4). */
const DEFAULT_EVENT_END = new Date('2026-05-14T20:30:00-04:00');
const SETTINGS_ID = 1;
const MAX_BIDS_PER_LOT = 64;
const MAX_FEEDBACK_GLOBAL = 200;
const MAX_FORUM_TOPICS = 120;
const MAX_FORUM_REPLIES_PER_TOPIC = 80;

export async function initDatabase(): Promise<void> {
  await prisma.$connect();
  await prisma.eventSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, eventEndsAt: DEFAULT_EVENT_END },
    update: {},
  });
}

export async function clearAllAuctionParticipationData(): Promise<void> {
  const endedAt = new Date(Date.now() - 60_000);
  await prisma.$transaction(async (tx) => {
    await tx.guest.deleteMany();
    await tx.eventSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, eventEndsAt: endedAt },
      update: { eventEndsAt: endedAt },
    });
    await tx.lot.updateMany({
      data: { currentBidCents: 0, endsAt: endedAt },
    });
  });
}

export async function resetAuctionScheduleToDefault(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.eventSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, eventEndsAt: DEFAULT_EVENT_END },
      update: { eventEndsAt: DEFAULT_EVENT_END },
    });
    await tx.lot.updateMany({
      data: { endsAt: DEFAULT_EVENT_END },
    });
  });
}

export async function ensureLotsForIds(lotIds: string[]): Promise<void> {
  const settings = await prisma.eventSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } });
  const endsAt = settings.eventEndsAt;
  for (const id of lotIds) {
    await prisma.lot.upsert({
      where: { id },
      create: { id, currentBidCents: 0, endsAt },
      update: {},
    });
  }
}

export async function ensureGuestRecord(guestId: string): Promise<void> {
  await prisma.guest.upsert({
    where: { id: guestId },
    create: { id: guestId, displayName: null },
    update: {},
  });
}

export async function getGuestDisplayName(guestId: string): Promise<string | null> {
  const g = await prisma.guest.findUnique({ where: { id: guestId } });
  return g?.displayName ?? null;
}

export async function setGuestDisplayName(guestId: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim().slice(0, 40);
  await prisma.guest.upsert({
    where: { id: guestId },
    create: { id: guestId, displayName: trimmed },
    update: { displayName: trimmed },
  });
}

function bidToJson(b: { id: string; guestId: string; amountCents: number; placedAt: Date }) {
  return {
    id: b.id,
    guestId: b.guestId,
    amountCents: b.amountCents,
    placedAt: b.placedAt.getTime(),
  };
}

export async function getAuctionStateJson() {
  const settings = await prisma.eventSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } });
  const eventEndsAt = settings.eventEndsAt.getTime();

  const lotsRows = await prisma.lot.findMany({
    include: {
      bids: { orderBy: { placedAt: 'desc' }, take: MAX_BIDS_PER_LOT },
    },
  });

  const lots: Record<
    string,
    { currentBidCents: number; bids: ReturnType<typeof bidToJson>[]; endsAt: number }
  > = {};
  for (const row of lotsRows) {
    lots[row.id] = {
      currentBidCents: row.currentBidCents,
      bids: row.bids.map(bidToJson),
      endsAt: row.endsAt.getTime(),
    };
  }

  const voteRows = await prisma.vote.findMany();
  const votes: Record<string, Record<string, number>> = {};
  for (const v of voteRows) {
    if (!votes[v.lotId]) votes[v.lotId] = {};
    votes[v.lotId]![v.guestId] = v.stars;
  }

  const feedbackRows = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    take: MAX_FEEDBACK_GLOBAL,
  });
  const feedback = feedbackRows.map((f) => ({
    id: f.id,
    lotId: f.lotId,
    guestId: f.guestId,
    displayName: f.displayName,
    body: f.body,
    createdAt: f.createdAt.getTime(),
  }));

  return { eventEndsAt, lots, votes, feedback };
}

export async function getLotForReserve(lotId: string) {
  return prisma.lot.findUnique({ where: { id: lotId } });
}

export type PlaceBidResult =
  | { ok: true }
  | { ok: false; error: 'unknown_lot' | 'closed' | 'below_min'; min?: number };

export async function placeBid({
  guestId,
  lotId,
  amountCents,
  openingBidCents,
}: {
  guestId: string;
  lotId: string;
  amountCents: number;
  openingBidCents: number;
}): Promise<PlaceBidResult> {
  return prisma.$transaction(async (tx) => {
    const lot = await tx.lot.findUnique({ where: { id: lotId } });
    if (!lot) return { ok: false, error: 'unknown_lot' };
    if (Date.now() > lot.endsAt.getTime()) return { ok: false, error: 'closed' };

    const bidCount = await tx.bid.count({ where: { lotId } });
    const min = nextMinimumBidCents(openingBidCents, lot.currentBidCents, bidCount);
    if (amountCents < min) return { ok: false, error: 'below_min', min };

    await tx.guest.upsert({
      where: { id: guestId },
      create: { id: guestId },
      update: {},
    });

    const bidId = randomUUID();
    await tx.bid.create({
      data: {
        id: bidId,
        lotId,
        guestId,
        amountCents,
        placedAt: new Date(),
      },
    });
    await tx.lot.update({
      where: { id: lotId },
      data: { currentBidCents: amountCents },
    });

    const keep = await tx.bid.findMany({
      where: { lotId },
      orderBy: { placedAt: 'desc' },
      take: MAX_BIDS_PER_LOT,
      select: { id: true },
    });
    const keepIds = keep.map((b) => b.id);
    await tx.bid.deleteMany({
      where: { lotId, id: { notIn: keepIds } },
    });

    return { ok: true };
  });
}

export async function setVote({
  guestId,
  lotId,
  stars,
}: {
  guestId: string;
  lotId: string;
  stars: number;
}): Promise<void> {
  await prisma.guest.upsert({
    where: { id: guestId },
    create: { id: guestId },
    update: {},
  });
  await prisma.vote.upsert({
    where: { lotId_guestId: { lotId, guestId } },
    create: { lotId, guestId, stars },
    update: { stars },
  });
}

export async function deleteVote({ guestId, lotId }: { guestId: string; lotId: string }): Promise<void> {
  await prisma.vote.deleteMany({
    where: { lotId, guestId },
  });
}

export async function addFeedback({
  guestId,
  lotId,
  body,
  displayName,
}: {
  guestId: string;
  lotId: string;
  body: string;
  displayName: string;
}): Promise<void> {
  const id = randomUUID();
  await prisma.feedback.create({
    data: {
      id,
      lotId,
      guestId,
      displayName: displayName.slice(0, 40),
      body: body.slice(0, 600),
      createdAt: new Date(),
    },
  });

  const keep = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    take: MAX_FEEDBACK_GLOBAL,
    select: { id: true },
  });
  const keepIds = keep.map((f) => f.id);
  await prisma.feedback.deleteMany({
    where: { id: { notIn: keepIds } },
  });
}

function forumReplyToJson(reply: { id: string; guestId: string; displayName: string; body: string; createdAt: Date }) {
  return {
    id: reply.id,
    authorId: reply.guestId,
    authorName: reply.displayName,
    body: reply.body,
    createdAt: reply.createdAt.getTime(),
  };
}

function forumTopicToJson(topic: {
  id: string;
  guestId: string;
  displayName: string;
  title: string;
  body: string;
  createdAt: Date;
  replies: { id: string; guestId: string; displayName: string; body: string; createdAt: Date }[];
}) {
  return {
    id: topic.id,
    authorId: topic.guestId,
    authorName: topic.displayName,
    title: topic.title,
    body: topic.body,
    createdAt: topic.createdAt.getTime(),
    replies: topic.replies.map(forumReplyToJson),
  };
}

export async function getForumTopicsJson() {
  const topics = await prisma.forumTopic.findMany({
    orderBy: { createdAt: 'desc' },
    take: MAX_FORUM_TOPICS,
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
        take: MAX_FORUM_REPLIES_PER_TOPIC,
      },
    },
  });
  return topics.map(forumTopicToJson);
}

export async function addForumTopic({
  guestId,
  displayName,
  title,
  body,
}: {
  guestId: string;
  displayName: string;
  title: string;
  body: string;
}) {
  await ensureGuestRecord(guestId);
  const cleanBody = body.trim().slice(0, 1200);
  const cleanTitle = (title.trim() || cleanBody.slice(0, 48) || 'Untitled topic').slice(0, 90);
  await prisma.forumTopic.create({
    data: {
      id: randomUUID(),
      guestId,
      displayName: displayName.trim().slice(0, 40) || 'Collector',
      title: cleanTitle,
      body: cleanBody,
      createdAt: new Date(),
    },
  });

  const keep = await prisma.forumTopic.findMany({
    orderBy: { createdAt: 'desc' },
    take: MAX_FORUM_TOPICS,
    select: { id: true },
  });
  const keepIds = keep.map((topic) => topic.id);
  await prisma.forumTopic.deleteMany({
    where: { id: { notIn: keepIds } },
  });
}

export async function addForumReply({
  guestId,
  displayName,
  topicId,
  body,
}: {
  guestId: string;
  displayName: string;
  topicId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: 'unknown_topic' }> {
  await ensureGuestRecord(guestId);
  const topic = await prisma.forumTopic.findUnique({ where: { id: topicId }, select: { id: true } });
  if (!topic) return { ok: false, error: 'unknown_topic' };

  await prisma.forumReply.create({
    data: {
      id: randomUUID(),
      topicId,
      guestId,
      displayName: displayName.trim().slice(0, 40) || 'Collector',
      body: body.trim().slice(0, 800),
      createdAt: new Date(),
    },
  });

  const keep = await prisma.forumReply.findMany({
    where: { topicId },
    orderBy: { createdAt: 'desc' },
    take: MAX_FORUM_REPLIES_PER_TOPIC,
    select: { id: true },
  });
  const keepIds = keep.map((reply) => reply.id);
  await prisma.forumReply.deleteMany({
    where: { topicId, id: { notIn: keepIds } },
  });

  return { ok: true };
}
