import { describe, expect, test } from 'bun:test';

import { decodeBase64, encodeBase64 } from './BleConnection';
import { createChatMessage, decodeMessage, encodeMessage } from './SahaProtocol';

const samples = [
  'TEST-12345', 'hello', '12345', 'hello!', 'hello world',
  'hello ', ' hello',
  'A longer SAHA message that remains within the configured transport payload limit.',
  'caf\u00e9', 'hello \u{1F44B}',
];

describe('SAHA message data-integrity pipeline', () => {
  test.each(samples)('preserves every byte and character for %p', (input) => {
    const message = createChatMessage('SAHA-ABCD', input, 'msg-integrity', 100);
    const protocolJson = encodeMessage(message);
    const transportBase64 = encodeBase64(protocolJson);

    // BLE-PLX decodes Base64 to raw GATT bytes; Android decodes those bytes as UTF-8.
    const androidNativePayload = decodeBase64(transportBase64);
    const centralNotificationPayload = decodeBase64(encodeBase64(androidNativePayload));
    const parsed = decodeMessage(centralNotificationPayload);
    const reactStateValue = parsed.type === 'message' ? parsed.payload : null;
    const renderedMessageText = reactStateValue;

    expect(new TextEncoder().encode(protocolJson).byteLength).toBe(
      new TextEncoder().encode(androidNativePayload).byteLength,
    );
    expect(transportBase64.length % 4).toBe(0);
    expect(androidNativePayload).toBe(protocolJson);
    expect(centralNotificationPayload).toBe(protocolJson);
    expect(reactStateValue).toBe(input);
    expect(renderedMessageText).toBe(input);
  });

  test('records the exact TEST-12345 protocol and transport values', () => {
    const protocolJson = encodeMessage(
      createChatMessage('SAHA-ABCD', 'TEST-12345', 'msg-integrity', 100),
    );
    expect(protocolJson).toBe(
      '{"type":"message","id":"msg-integrity","senderId":"SAHA-ABCD","timestamp":100,"payload":"TEST-12345"}',
    );
    expect(new TextEncoder().encode(protocolJson).byteLength).toBe(101);
    expect(encodeBase64(protocolJson)).toBe(
      'eyJ0eXBlIjoibWVzc2FnZSIsImlkIjoibXNnLWludGVncml0eSIsInNlbmRlcklkIjoiU0FIQS1BQkNEIiwidGltZXN0YW1wIjoxMDAsInBheWxvYWQiOiJURVNULTEyMzQ1In0=',
    );
  });
});
