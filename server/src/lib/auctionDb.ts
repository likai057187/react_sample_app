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
const MAX_DIRECT_MESSAGES_PER_CONVERSATION = 120;

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
  await resetAuctionScheduleToEndAt(DEFAULT_EVENT_END);
}

/** Set global lot end time (reopens lots whose endsAt was in the past). */
export async function resetAuctionScheduleToEndAt(eventEndsAt: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.eventSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, eventEndsAt },
      update: { eventEndsAt },
    });
    await tx.lot.updateMany({
      data: { endsAt: eventEndsAt },
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

function cleanDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, ' ').slice(0, 40);
}

function displayNameKey(displayName: string): string {
  return cleanDisplayName(displayName).toLocaleLowerCase('en-US');
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export async function claimGuestDisplayName(
  guestId: string,
  displayName: string,
): Promise<{ guestId: string; displayName: string }> {
  const trimmed = cleanDisplayName(displayName);
  const key = displayNameKey(trimmed);
  const existing = await prisma.guest.findUnique({
    where: { displayNameKey: key },
    select: { id: true, displayName: true },
  });
  if (existing) {
    return { guestId: existing.id, displayName: existing.displayName ?? trimmed };
  }

  try {
    const guest = await prisma.guest.upsert({
      where: { id: guestId },
      create: { id: guestId, displayName: trimmed, displayNameKey: key },
      update: { displayName: trimmed, displayNameKey: key },
      select: { id: true, displayName: true },
    });
    return { guestId: guest.id, displayName: guest.displayName ?? trimmed };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const guest = await prisma.guest.findUnique({
      where: { displayNameKey: key },
      select: { id: true, displayName: true },
    });
    if (!guest) throw error;
    return { guestId: guest.id, displayName: guest.displayName ?? trimmed };
  }
}

export async function getNetworkProfileJson(guestId: string) {
  await ensureGuestRecord(guestId);
  const guest = await prisma.guest.findUnique({ where: { id: guestId } });
  return {
    guestId,
    displayName: guest?.displayName ?? null,
    bio: guest?.bio ?? '',
  };
}

export async function setNetworkBio(guestId: string, bio: string): Promise<void> {
  await prisma.guest.upsert({
    where: { id: guestId },
    create: { id: guestId, bio: bio.trim().slice(0, 400) },
    update: { bio: bio.trim().slice(0, 400) },
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
    const lockedLots = await tx.$queryRaw<
      { id: string; currentBidCents: number; endsAt: Date }[]
    >`SELECT "id", "currentBidCents", "endsAt" FROM "Lot" WHERE "id" = ${lotId} FOR UPDATE`;
    const lot = lockedLots[0];
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

function friendToJson(friendship: {
  friendId: string;
  capturedDisplayName: string | null;
  addedAt: Date;
  friend: { displayName: string | null };
}) {
  return {
    guestId: friendship.friendId,
    displayName: friendship.friend.displayName?.trim() || friendship.capturedDisplayName?.trim() || 'Collector',
    addedAt: friendship.addedAt.getTime(),
  };
}

export async function getFriendsJson(guestId: string) {
  await ensureGuestRecord(guestId);
  const rows = await prisma.friendship.findMany({
    where: { ownerId: guestId },
    orderBy: { addedAt: 'desc' },
    include: { friend: { select: { displayName: true } } },
  });
  return rows.map(friendToJson);
}

export async function addFriend({
  ownerId,
  friendId,
  displayName,
}: {
  ownerId: string;
  friendId: string;
  displayName: string;
}): Promise<{ ok: true; alreadyExisted: boolean } | { ok: false; error: 'self_friend' }> {
  if (ownerId === friendId) return { ok: false, error: 'self_friend' };
  const capturedDisplayName = displayName.trim().slice(0, 40) || 'Collector';
  const existing = await prisma.friendship.findUnique({
    where: { ownerId_friendId: { ownerId, friendId } },
    select: { ownerId: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.guest.upsert({ where: { id: ownerId }, create: { id: ownerId }, update: {} });
    await tx.guest.upsert({
      where: { id: friendId },
      create: { id: friendId, displayName: capturedDisplayName },
      update: {},
    });
    await tx.friendship.upsert({
      where: { ownerId_friendId: { ownerId, friendId } },
      create: { ownerId, friendId, capturedDisplayName, addedAt: new Date() },
      update: { capturedDisplayName },
    });
  });
  return { ok: true, alreadyExisted: !!existing };
}

function directMessageToJson(message: {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: Date;
  sender: { displayName: string | null };
}, viewerId: string) {
  const friendGuestId = message.senderId === viewerId ? message.recipientId : message.senderId;
  return {
    id: message.id,
    friendGuestId,
    authorId: message.senderId,
    authorName: message.sender.displayName?.trim() || 'Collector',
    body: message.body,
    createdAt: message.createdAt.getTime(),
  };
}

export async function getDirectMessagesJson(guestId: string, friendGuestId: string) {
  await ensureGuestRecord(guestId);
  const rows = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: guestId, recipientId: friendGuestId },
        { senderId: friendGuestId, recipientId: guestId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_DIRECT_MESSAGES_PER_CONVERSATION,
    include: { sender: { select: { displayName: true } } },
  });
  return rows.reverse().map((row) => directMessageToJson(row, guestId));
}

export async function hasFriendshipConnection(guestId: string, friendGuestId: string): Promise<boolean> {
  if (guestId === friendGuestId) return false;
  const row = await prisma.friendship.findFirst({
    where: {
      OR: [
        { ownerId: guestId, friendId: friendGuestId },
        { ownerId: friendGuestId, friendId: guestId },
      ],
    },
    select: { ownerId: true },
  });
  return !!row;
}

export async function addDirectMessage({
  senderId,
  recipientId,
  body,
}: {
  senderId: string;
  recipientId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: 'self_message' | 'invalid_body' }> {
  if (senderId === recipientId) return { ok: false, error: 'self_message' };
  const cleanBody = body.trim().slice(0, 800);
  if (!cleanBody) return { ok: false, error: 'invalid_body' };
  await prisma.$transaction(async (tx) => {
    await tx.guest.upsert({ where: { id: senderId }, create: { id: senderId }, update: {} });
    await tx.guest.upsert({ where: { id: recipientId }, create: { id: recipientId }, update: {} });
    await tx.directMessage.create({
      data: {
        id: randomUUID(),
        senderId,
        recipientId,
        body: cleanBody,
        createdAt: new Date(),
      },
    });
  });
  return { ok: true };
}
