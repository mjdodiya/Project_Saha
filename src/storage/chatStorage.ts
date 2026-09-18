import { createMMKV } from 'react-native-mmkv';

import type { ChatMessage } from '@/ble/types';

const storage = createMMKV({
  id: 'saha-chat-storage',
});

const CHAT_HISTORY_PREFIX = 'chat-history:';

function getStorageKey(peerKey: string): string {
  return `${CHAT_HISTORY_PREFIX}${peerKey}`;
}

function sanitizePeerKey(peerKey: string): string {
  return peerKey.trim();
}

export function loadChatHistory(peerKey: string): ChatMessage[] {
  const normalizedPeerKey = sanitizePeerKey(peerKey);

  if (!normalizedPeerKey) {
    return [];
  }

  const stored = storage.getString(getStorageKey(normalizedPeerKey));

  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as ChatMessage[];
  } catch (error) {
    console.log(
      `[SAHA-STORAGE] Failed to parse chat history for peer ${normalizedPeerKey}:`,
      error,
    );
    return [];
  }
}

export function saveChatHistory(
  peerKey: string,
  messages: ChatMessage[],
): void {
  const normalizedPeerKey = sanitizePeerKey(peerKey);

  if (!normalizedPeerKey) {
    return;
  }

  storage.set(getStorageKey(normalizedPeerKey), JSON.stringify(messages));
}

export function clearChatHistory(peerKey: string): void {
  const normalizedPeerKey = sanitizePeerKey(peerKey);

  if (!normalizedPeerKey) {
    return;
  }

  storage.remove(getStorageKey(normalizedPeerKey));
}

export function hasChatHistory(peerKey: string): boolean {
  const normalizedPeerKey = sanitizePeerKey(peerKey);

  if (!normalizedPeerKey) {
    return false;
  }

  return storage.contains(getStorageKey(normalizedPeerKey));
}
