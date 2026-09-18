import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'saha-seen-messages-storage' });

const SEEN_MESSAGES_KEY = 'seen-message-ids';

function loadSeenIds(): Set<string> {
  const stored = storage.getString(SEEN_MESSAGES_KEY);

  if (!stored) {
    return new Set<string>();
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(
      parsed.filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      ),
    );
  } catch (error) {
    console.log('[SAHA-SEEN] Failed to parse seen-message storage:', error);

    return new Set<string>();
  }
}

function saveSeenIds(seenIds: Set<string>): void {
  storage.set(SEEN_MESSAGES_KEY, JSON.stringify([...seenIds]));
}

export function hasSeenMessage(messageId: string): boolean {
  if (!messageId) {
    return false;
  }

  return loadSeenIds().has(messageId);
}

export function markMessageSeen(messageId: string): void {
  if (!messageId) {
    return;
  }

  const seenIds = loadSeenIds();

  if (seenIds.has(messageId)) {
    return;
  }

  seenIds.add(messageId);
  saveSeenIds(seenIds);

  console.log(`[SAHA-SEEN] Marked message as seen: ${messageId}`);
}

export function removeSeenMessage(messageId: string): void {
  if (!messageId) {
    return;
  }

  const seenIds = loadSeenIds();

  if (!seenIds.delete(messageId)) {
    return;
  }

  saveSeenIds(seenIds);

  console.log(`[SAHA-SEEN] Removed seen message: ${messageId}`);
}

export function clearSeenMessages(): void {
  storage.remove(SEEN_MESSAGES_KEY);

  console.log('[SAHA-SEEN] Cleared all seen message IDs');
}

export function getSeenMessageCount(): number {
  return loadSeenIds().size;
}
