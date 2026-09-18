import { createMMKV } from 'react-native-mmkv';

import type { SahaChatMessage } from '@/ble/SahaProtocol';

const storage = createMMKV({
  id: 'saha-outbox-storage',
});

const OUTBOX_KEY = 'outbox';

export type OutboxEntry = {
  /**
   * Immutable message being delivered.
   *
   * The message ID must never change while this entry exists.
   */
  message: SahaChatMessage;

  /**
   * Local conversation/peer key used by the chat history.
   */
  peerKey: string;

  /**
   * Locally resolved receiver identity.
   */
  receiverId: string;

  /**
   * Number of transmission attempts made.
   *
   * Retry behavior will be implemented in Phase 3E.
   */
  attemptCount: number;

  /**
   * Unix timestamp in milliseconds when this outbox entry was created.
   */
  createdAt: number;

  /**
   * Unix timestamp in milliseconds of the most recent transmission attempt.
   */
  lastAttemptAt: number | null;
};

function loadEntries(): OutboxEntry[] {
  const stored = storage.getString(OUTBOX_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as OutboxEntry[];
  } catch (error) {
    console.log('[SAHA-OUTBOX] Failed to parse outbox:', error);
    return [];
  }
}

function saveEntries(entries: OutboxEntry[]): void {
  storage.set(OUTBOX_KEY, JSON.stringify(entries));
}

export function loadOutbox(): OutboxEntry[] {
  return loadEntries();
}

export function enqueueMessage(entry: OutboxEntry): void {
  const entries = loadEntries();

  const existingIndex = entries.findIndex(
    (item) => item.message.id === entry.message.id,
  );

  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  saveEntries(entries);

  console.log(
    `[SAHA-OUTBOX] Enqueued message ${entry.message.id} for peer ${entry.peerKey}`,
  );
}

export function updateOutboxEntry(
  messageId: string,
  update: Partial<OutboxEntry>,
): void {
  const entries = loadEntries();
  const index = entries.findIndex((entry) => entry.message.id === messageId);

  if (index < 0) {
    return;
  }

  entries[index] = {
    ...entries[index],
    ...update,
  };

  saveEntries(entries);
}

export function getOutboxEntry(messageId: string): OutboxEntry | null {
  const entries = loadEntries();

  return entries.find((entry) => entry.message.id === messageId) ?? null;
}

export function removeFromOutbox(messageId: string): void {
  const entries = loadEntries();
  const nextEntries = entries.filter((entry) => entry.message.id !== messageId);

  if (nextEntries.length !== entries.length) {
    saveEntries(nextEntries);

    console.log(`[SAHA-OUTBOX] Removed message ${messageId} from outbox`);
  }
}

export function clearOutbox(): void {
  storage.remove(OUTBOX_KEY);
}

export function hasOutboxMessages(): boolean {
  return loadEntries().length > 0;
}
