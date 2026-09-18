import { describe, expect, test } from 'bun:test';

import {
  createAck,
  createChatMessage,
  createPing,
  createPong,
  decodeMessage,
  encodeMessage,
  validateMessage,
} from './SahaProtocol';

describe('SAHA message protocol', () => {
  test('creates and validates a chat message', () => {
    const message = createChatMessage(
      'SAHA-ABCD',
      'Hello',
      'msg-123',
      1788712345,
    );

    expect(message).toEqual({
      type: 'message',
      id: 'msg-123',
      senderId: 'SAHA-ABCD',
      timestamp: 1788712345,
      payload: 'Hello',
    });
    expect(validateMessage(message)).toBe(true);
  });

  test('creates a ping', () => {
    expect(createPing('test-123')).toEqual({ type: 'ping', id: 'test-123' });
  });

  test('creates a pong with the request id', () => {
    expect(createPong('test-123')).toEqual({ type: 'pong', id: 'test-123' });
  });

  test('creates an ACK for a message', () => {
    expect(createAck('msg-123', 'ack-123')).toEqual({
      type: 'ack',
      id: 'ack-123',
      messageId: 'msg-123',
    });
  });

  test('encodes and decodes an ACK', () => {
    const ack = createAck('msg-123', 'ack-123');

    expect(decodeMessage(encodeMessage(ack))).toEqual(ack);
  });

  test('rejects invalid ACKs', () => {
    expect(
      validateMessage({
        type: 'ack',
        id: 'ack-123',
      }),
    ).toBe(false);

    expect(
      validateMessage({
        type: 'ack',
        id: 'ack-123',
        messageId: '',
      }),
    ).toBe(false);

    expect(
      validateMessage({
        type: 'ack',
        id: 'ack-123',
        messageId: 'msg-123',
        unexpected: true,
      }),
    ).toBe(false);
  });

  test('encodes and decodes a chat message', () => {
    const message = createChatMessage('SAHA-ABCD', 'こんにちは', 'msg-1', 100);

    expect(decodeMessage(encodeMessage(message))).toEqual(message);
  });

  test('rejects missing message fields', () => {
    expect(
      validateMessage({ type: 'message', id: 'msg-1', payload: 'Hello' }),
    ).toBe(false);
    expect(validateMessage({ type: 'ping' })).toBe(false);
  });

  test('rejects unknown message types', () => {
    expect(
      validateMessage({ type: 'broadcast', id: 'msg-1', payload: 'Hello' }),
    ).toBe(false);
  });

  test('rejects extra fields on ping and pong', () => {
    expect(
      validateMessage({ type: 'ping', id: 'test-1', payload: 'unexpected' }),
    ).toBe(false);
    expect(
      validateMessage({ type: 'pong', id: 'test-1', senderId: 'SAHA-ABCD' }),
    ).toBe(false);
  });

  test('rejects malformed JSON payloads', () => {
    expect(() => decodeMessage('{not-json')).toThrow(
      'Invalid SAHA message JSON',
    );
    expect(() =>
      decodeMessage(JSON.stringify({ type: 'message', id: 'msg-1' })),
    ).toThrow('Invalid SAHA message');
  });

  test('rejects invalid constructor values', () => {
    expect(() => createPong('')).toThrow('Invalid SAHA message');
    expect(() => createChatMessage('', 'Hello')).toThrow(
      'Invalid SAHA message',
    );
    expect(() => createAck('')).toThrow('Invalid SAHA message');
  });
});
