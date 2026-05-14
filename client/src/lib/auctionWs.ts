import { io, type Socket } from 'socket.io-client';
import type { AuctionServerState, FeedbackEntry } from '../types';
import { getApiKey, getApiOrigin } from './apiClient';

export type AuctionStatePush = {
  type: 'auction_state';
  version: number;
  eventEndsAt: number;
  lots: AuctionServerState['lots'];
  votes: AuctionServerState['votes'];
  feedback: FeedbackEntry[];
};

export type AuctionWsOptions = {
  onState: (payload: AuctionStatePush) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export function connectAuctionWebSocket(options: AuctionWsOptions): () => void {
  const { onState, onOpen, onClose } = options;
  let stopped = false;

  const k = getApiKey();
  const s: Socket = io(getApiOrigin(), {
    path: '/socket.io',
    autoConnect: true,
    transports: ['websocket', 'polling'],
    auth: { apiKey: k },
    query: { apiKey: k },
    reconnection: true,
    reconnectionDelay: 400,
    reconnectionDelayMax: 30_000,
  });

  const onAuctionState = (payload: AuctionStatePush) => {
    if (payload?.type === 'auction_state') onState(payload);
  };

  s.on('connect', () => onOpen?.());
  s.on('disconnect', () => {
    if (!stopped) onClose?.();
  });
  s.on('connect_error', () => {
    if (!stopped) onClose?.();
  });
  s.on('auction_state', onAuctionState);

  return () => {
    stopped = true;
    s.off('auction_state', onAuctionState);
    s.disconnect();
  };
}
