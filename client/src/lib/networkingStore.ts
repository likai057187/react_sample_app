import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './apiClient';

const CHAT_PREFIX = 'cr-network-chat-v1:';

export type ChatMessage = {
  id: string;
  friendGuestId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: number;
};

export type ForumReply = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: number;
};

export type ForumTopic = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  createdAt: number;
  replies: ForumReply[];
};

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function chatKey(friendGuestId: string): string {
  return `${CHAT_PREFIX}${friendGuestId}`;
}

export async function loadChatMessages(friendGuestId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(chatKey(friendGuestId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveChatMessages(friendGuestId: string, rows: ChatMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(chatKey(friendGuestId), JSON.stringify(rows.slice(-120)));
  } catch {
    /* ignore local persistence failures */
  }
}

export async function addChatMessage(input: {
  friendGuestId: string;
  authorId: string;
  authorName: string;
  body: string;
}): Promise<ChatMessage | null> {
  const body = input.body.trim();
  if (!body) return null;
  const rows = await loadChatMessages(input.friendGuestId);
  const message: ChatMessage = {
    id: id('msg'),
    friendGuestId: input.friendGuestId,
    authorId: input.authorId,
    authorName: input.authorName.trim() || 'Collector',
    body: body.slice(0, 800),
    createdAt: Date.now(),
  };
  await saveChatMessages(input.friendGuestId, [...rows, message]);
  return message;
}

export async function loadForumTopics(): Promise<ForumTopic[]> {
  try {
    const res = await apiFetch('/api/network/forum', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as { topics?: ForumTopic[] };
    return Array.isArray(data.topics) ? data.topics : [];
  } catch {
    return [];
  }
}

export async function addForumTopic(input: {
  authorId: string;
  authorName: string;
  title: string;
  body: string;
}): Promise<ForumTopic | null> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title && !body) return null;
  const res = await apiFetch('/api/network/forum/topics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ title, body }),
  });
  return res.ok
    ? {
        id: id('topic'),
        authorId: input.authorId,
        authorName: input.authorName.trim() || 'Collector',
        title: (title || body.slice(0, 48)).slice(0, 90),
        body: body.slice(0, 1200),
        createdAt: Date.now(),
        replies: [],
      }
    : null;
}

export async function addForumReply(input: {
  topicId: string;
  authorId: string;
  authorName: string;
  body: string;
}): Promise<ForumReply | null> {
  const body = input.body.trim();
  if (!body) return null;
  const res = await apiFetch('/api/network/forum/replies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ topicId: input.topicId, body }),
  });
  return res.ok
    ? {
        id: id('reply'),
        authorId: input.authorId,
        authorName: input.authorName.trim() || 'Collector',
        body: body.slice(0, 800),
        createdAt: Date.now(),
      }
    : null;
}
