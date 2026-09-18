export type SahaPing = {
  type: 'ping';
  id: string;
};

export type SahaPong = {
  type: 'pong';
  id: string;
};

export type SahaChatMessage = {
  type: 'message';
  id: string;
  senderId: string;
  timestamp: number;
  payload: string;
};

export type SahaAck = {
  type: 'ack';
  id: string;
  messageId: string;
};

export type SahaMessage = SahaPing | SahaPong | SahaChatMessage | SahaAck;

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPing(id = createId('ping')): SahaPing {
  const message: SahaPing = { type: 'ping', id };
  assertValidMessage(message);
  return message;
}

export function createPong(id: string): SahaPong {
  const message: SahaPong = { type: 'pong', id };
  assertValidMessage(message);
  return message;
}

export function createChatMessage(
  senderId: string,
  payload: string,
  id = createId('msg'),
  timestamp = Math.floor(Date.now() / 1000),
): SahaChatMessage {
  const message: SahaChatMessage = {
    type: 'message',
    id,
    senderId,
    timestamp,
    payload,
  };

  assertValidMessage(message);

  return message;
}

export function createAck(messageId: string, id = createId('ack')): SahaAck {
  const message: SahaAck = {
    type: 'ack',
    id,
    messageId,
  };

  assertValidMessage(message);

  return message;
}

export function encodeMessage(message: SahaMessage): string {
  assertValidMessage(message);
  return JSON.stringify(message);
}

export function decodeMessage(encoded: string): SahaMessage {
  let parsed: unknown;

  try {
    parsed = JSON.parse(encoded);
  } catch {
    throw new Error('Invalid SAHA message JSON');
  }

  assertValidMessage(parsed);

  return parsed;
}

export function validateMessage(value: unknown): value is SahaMessage {
  if (
    !isRecord(value) ||
    typeof value.type !== 'string' ||
    typeof value.id !== 'string' ||
    value.id.length === 0
  ) {
    return false;
  }

  if (value.type === 'ping' || value.type === 'pong') {
    return Object.keys(value).every((key) => key === 'type' || key === 'id');
  }

  if (value.type === 'ack') {
    return (
      Object.keys(value).every(
        (key) => key === 'type' || key === 'id' || key === 'messageId',
      ) &&
      typeof value.messageId === 'string' &&
      value.messageId.length > 0
    );
  }

  if (value.type !== 'message') {
    return false;
  }

  return (
    typeof value.senderId === 'string' &&
    value.senderId.length > 0 &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp) &&
    Number.isInteger(value.timestamp) &&
    value.timestamp >= 0 &&
    typeof value.payload === 'string'
  );
}

function assertValidMessage(value: unknown): asserts value is SahaMessage {
  if (!validateMessage(value)) {
    throw new Error('Invalid SAHA message');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
