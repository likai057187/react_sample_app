import { apiFetch } from './apiClient';

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

export async function loadChatMessages(friendGuestId: string): Promise<ChatMessage[]> {
  try {
    const res = await apiFetch(`/api/network/chats/${encodeURIComponent(friendGuestId)}/messages`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as { messages?: ChatMessage[] };
    return Array.isArray(data.messages) ? data.messages : [];
  } catch {
    return [];
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
  const res = await apiFetch(`/api/network/chats/${encodeURIComponent(input.friendGuestId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) return null;
  const rows = await loadChatMessages(input.friendGuestId);
  return rows[rows.length - 1] ?? null;
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
    ? ((await loadForumTopics())[0] ?? null)
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
    ? { id: input.topicId, authorId: input.authorId, authorName: input.authorName.trim() || 'Collector', body, createdAt: Date.now() }
    : null;
}
