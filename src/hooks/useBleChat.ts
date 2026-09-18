import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Characteristic,
  Device,
  Subscription,
} from 'react-native-ble-plx';

import { decodeBase64, encodeBase64 } from '@/ble/BleConnection';
import { bleManager } from '@/ble/BleManager';
import {
  IDENTITY_CHARACTERISTIC_UUID,
  RX_CHARACTERISTIC_UUID,
  SAHA_BLE_CONFIG,
  SAHA_SERVICE_UUID,
  TX_CHARACTERISTIC_UUID,
} from '@/ble/config';
import { sahaBlePeripheral } from '@/ble/SahaBlePeripheral';
import {
  createAck,
  createChatMessage,
  decodeMessage,
  encodeMessage,
} from '@/ble/SahaProtocol';
import type { ChatConnectionState, ChatMessage } from '@/ble/types';
import { loadChatHistory, saveChatHistory } from '@/storage/chatStorage';
import {
  enqueueMessage,
  getOutboxEntry,
  removeFromOutbox,
  updateOutboxEntry,
} from '@/storage/outboxStorage';
import { hasSeenMessage, markMessageSeen } from '@/storage/seenMessagesStorage';

export function useBleChat(
  targetDeviceId?: string | null,
  targetDeviceName?: string | null,
) {
  const [connectionState, setConnectionState] =
    useState<ChatConnectionState>('disconnected');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerIdentity, setPeerIdentity] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connectedDeviceRef = useRef<Device | null>(null);
  const txSubscriptionRef = useRef<Subscription | null>(null);
  const disconnectSubscriptionRef = useRef<Subscription | null>(null);
  const peerIdentityRef = useRef<string | null>(null);
  const connectionStateRef = useRef<ChatConnectionState>('disconnected');
  const connectionAttemptRef = useRef(0);
  const connectionInFlightRef = useRef(false);
  const localNodeIdRef = useRef('UNKNOWN');
  const connectedCentralDeviceIdRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef(new Set<string>());
  const activeHistoryPeerKeyRef = useRef<string | null>(null);

  const updateConnectionState = useCallback((state: ChatConnectionState) => {
    connectionStateRef.current = state;
    setConnectionState(state);
  }, []);

  const loadHistoryForPeer = useCallback((peerKey: string) => {
    const history = loadChatHistory(peerKey);

    activeHistoryPeerKeyRef.current = peerKey;
    seenMessageIdsRef.current = new Set(history.map((message) => message.id));
    setMessages(history);

    console.log(
      `[SAHA-STORAGE] Loaded ${history.length} messages for peer ${peerKey}`,
    );
  }, []);

  const resetChatSession = useCallback(() => {
    seenMessageIdsRef.current.clear();
    setMessages([]);
    peerIdentityRef.current = null;
    setPeerIdentity(null);
    setErrorMessage(null);
    activeHistoryPeerKeyRef.current = null;
  }, []);

  const addMessage = useCallback(
    ({
      id,
      senderId,
      receiverId,
      content,
      isSelf,
      status,
      timestamp,
      peerDeviceId,
      receivedVia,
    }: {
      id: string;
      senderId: string;
      receiverId: string;
      content: string;
      isSelf: boolean;
      status: ChatMessage['status'];
      timestamp?: number;
      peerDeviceId?: string;
      receivedVia?: ChatMessage['receivedVia'];
    }) => {
      if (seenMessageIdsRef.current.has(id)) {
        return;
      }

      seenMessageIdsRef.current.add(id);

      const newMessage: ChatMessage = {
        id,
        senderId,
        receiverId,
        peerDeviceId,
        receivedVia,
        content,
        text: content,
        timestamp: timestamp ?? Date.now(),
        isSelf,
        status,
      };

      setMessages((prev) => {
        const nextMessages = [...prev, newMessage];

        const historyPeerKey = peerDeviceId ?? activeHistoryPeerKeyRef.current;

        if (historyPeerKey) {
          saveChatHistory(historyPeerKey, nextMessages);

          console.log(
            `[SAHA-STORAGE] Saved ${nextMessages.length} messages for peer ${historyPeerKey}`,
          );
        }

        return nextMessages;
      });
    },
    [],
  );
  const updateMessageStatus = useCallback(
    (messageId: string, status: ChatMessage['status']) => {
      setMessages((prev) => {
        const index = prev.findIndex((message) => message.id === messageId);

        if (index === -1) {
          return prev;
        }

        const nextMessages = [...prev];

        nextMessages[index] = {
          ...nextMessages[index],
          status,
        };

        const historyPeerKey = activeHistoryPeerKeyRef.current;

        if (historyPeerKey) {
          saveChatHistory(historyPeerKey, nextMessages);

          console.log(
            `[SAHA-STORAGE] Updated message ${messageId} status to ${status}`,
          );
        }

        return nextMessages;
      });
    },
    [],
  );
  const disconnect = useCallback(async () => {
    connectionAttemptRef.current += 1;
    connectionInFlightRef.current = false;

    console.log('[SAHA-BLE][CENTRAL] Disconnecting BLE chat session...');

    if (txSubscriptionRef.current) {
      const subscription = txSubscriptionRef.current;
      txSubscriptionRef.current = null;
      subscription.remove();

      console.log('[SAHA-BLE][CENTRAL][TX] Unsubscribed from TX notifications');
    }

    if (disconnectSubscriptionRef.current) {
      disconnectSubscriptionRef.current.remove();
      disconnectSubscriptionRef.current = null;
    }

    const connectedDevice = connectedDeviceRef.current;
    connectedDeviceRef.current = null;

    if (connectedDevice) {
      try {
        await connectedDevice.cancelConnection();

        console.log(
          '[SAHA-BLE][CENTRAL] BLE connection cancelled successfully',
        );
      } catch (err) {
        console.log('[SAHA-BLE][CENTRAL] Disconnect warning/error:', err);
      }
    }

    resetChatSession();
    updateConnectionState('disconnected');
  }, [resetChatSession, updateConnectionState]);

  const connectToPeer = useCallback(
    async (deviceId: string, deviceName?: string | null) => {
      if (connectionInFlightRef.current || connectedDeviceRef.current) {
        return;
      }

      const attemptId = connectionAttemptRef.current + 1;
      connectionAttemptRef.current = attemptId;
      connectionInFlightRef.current = true;

      resetChatSession();

      loadHistoryForPeer(deviceId);

      updateConnectionState('connecting');

      console.log(
        `[SAHA-BLE][CENTRAL] Initiating BLE connection to peripheral device: ${deviceId}`,
      );

      const rawManager = bleManager.getNativeManager();

      if (!rawManager) {
        const err = 'Native BLE manager is unavailable';

        console.log('[SAHA-BLE][CENTRAL] Error:', err);
        setErrorMessage(err);
        updateConnectionState('error');
        connectionInFlightRef.current = false;

        return;
      }

      try {
        const device = await rawManager.connectToDevice(deviceId, {
          timeout: 10000,
        });

        if (connectionAttemptRef.current !== attemptId) {
          await device.cancelConnection();
          return;
        }

        connectedDeviceRef.current = device;

        console.log(
          `[SAHA-BLE][CENTRAL] BLE connection established with device: ${deviceId}`,
        );

        try {
          await bleManager.requestMtu(device, SAHA_BLE_CONFIG.requestedMtu);
        } catch (error) {
          console.log('[SAHA-BLE][CENTRAL] MTU request skipped', error);
        }

        updateConnectionState('discovering');

        console.log(
          `[SAHA-BLE][CENTRAL] Starting GATT service discovery for device: ${deviceId}`,
        );

        await device.discoverAllServicesAndCharacteristics();

        console.log(
          `[SAHA-BLE][CENTRAL] GATT service discovery completed for device: ${deviceId}`,
        );

        try {
          console.log(
            `[SAHA-BLE][CENTRAL] Reading Identity characteristic (${IDENTITY_CHARACTERISTIC_UUID})...`,
          );

          const identityChar: Characteristic =
            await device.readCharacteristicForService(
              SAHA_SERVICE_UUID,
              IDENTITY_CHARACTERISTIC_UUID,
            );

          if (identityChar.value) {
            const identity = decodeBase64(identityChar.value);

            console.log(
              `[SAHA-BLE][CENTRAL] Read identity from peer: "${identity}"`,
            );

            peerIdentityRef.current = identity;
            setPeerIdentity(identity);
          }
        } catch (readErr) {
          console.log(
            '[SAHA-BLE][CENTRAL] Identity characteristic read skipped or failed:',
            readErr,
          );
        }

        console.log(
          `[SAHA-BLE][CENTRAL][TX] Subscribing to TX notifications (${TX_CHARACTERISTIC_UUID})...`,
        );

        txSubscriptionRef.current?.remove();

        txSubscriptionRef.current = device.monitorCharacteristicForService(
          SAHA_SERVICE_UUID,
          TX_CHARACTERISTIC_UUID,
          async (error, characteristic) => {
            if (error) {
              console.log(
                '[SAHA-BLE][CENTRAL][TX] Notification subscription error:',
                error.message,
              );

              return;
            }

            if (characteristic?.value) {
              console.log(
                '[SAHA-BLE][CENTRAL][TX] Received raw TX notification value (Base64):',
                characteristic.value,
              );

              const decodedText = decodeBase64(characteristic.value);

              const paddingBytes = characteristic.value.endsWith('==')
                ? 2
                : characteristic.value.endsWith('=')
                  ? 1
                  : 0;

              console.log(
                `[SAHA-BLE][CENTRAL][TX] notification Base64 chars=${characteristic.value.length}, raw bytes=${(characteristic.value.length / 4) * 3 - paddingBytes}, decoded JSON chars=${decodedText.length}`,
              );

              const protocolMessage = decodeMessage(decodedText);

              if (protocolMessage.type === 'ack') {
                console.log(
                  `[SAHA-ACK][CENTRAL] Received ACK for message ${protocolMessage.messageId}`,
                );

                const ackedMessageId = protocolMessage.messageId;

                /*
                 * Only acknowledge messages that this device actually
                 * has in its durable outbox.
                 */
                const outboxEntry = getOutboxEntry(ackedMessageId);

                if (!outboxEntry) {
                  console.log(
                    `[SAHA-ACK][CENTRAL] ACK ignored; message ${ackedMessageId} is not in outbox`,
                  );

                  return;
                }

                updateMessageStatus(ackedMessageId, 'sent');
                removeFromOutbox(ackedMessageId);

                console.log(
                  `[SAHA-ACK][CENTRAL] Message ${ackedMessageId} marked delivered and removed from outbox`,
                );

                return;
              }

              if (protocolMessage.type !== 'message') {
                return;
              }

              if (hasSeenMessage(protocolMessage.id)) {
                console.log(
                  `[SAHA-SEEN] Ignoring duplicate message ${protocolMessage.id} from Central`,
                );

                return;
              }

              markMessageSeen(protocolMessage.id);

              /*
               * This device is acting as Central here.
               *
               * The incoming message arrived through TX, so the ACK
               * must go back through the connected peripheral's RX
               * characteristic.
               */
              const ack = createAck(protocolMessage.id);

              try {
                const ackPayload = encodeMessage(ack);
                const ackBase64 = encodeBase64(ackPayload);

                await device.writeCharacteristicWithResponseForService(
                  SAHA_SERVICE_UUID,
                  RX_CHARACTERISTIC_UUID,
                  ackBase64,
                );

                console.log(
                  `[SAHA-ACK][CENTRAL] ACK sent for message ${protocolMessage.id}`,
                );
              } catch (error) {
                console.log(
                  `[SAHA-ACK][CENTRAL] Failed to send ACK for message ${protocolMessage.id}:`,
                  error,
                );
              }

              addMessage({
                id: protocolMessage.id,
                senderId: protocolMessage.senderId,
                receiverId: localNodeIdRef.current,
                content: protocolMessage.payload,
                isSelf: false,
                status: 'received',
                timestamp: protocolMessage.timestamp * 1000,
                peerDeviceId: deviceId,
                receivedVia: 'central',
              });
            }
          },
        );

        console.log(
          '[SAHA-BLE][CENTRAL][TX] TX notification subscription active',
        );

        disconnectSubscriptionRef.current?.remove();

        disconnectSubscriptionRef.current = rawManager.onDeviceDisconnected(
          deviceId,
          (error) => {
            if (connectionAttemptRef.current !== attemptId) {
              return;
            }

            connectionInFlightRef.current = false;

            if (error) {
              setErrorMessage(`Connection lost: ${error.message}`);
            } else {
              setErrorMessage('Connection lost');
            }

            connectedDeviceRef.current = null;

            txSubscriptionRef.current?.remove();
            txSubscriptionRef.current = null;

            disconnectSubscriptionRef.current?.remove();
            disconnectSubscriptionRef.current = null;

            updateConnectionState('disconnected');
          },
        );

        if (connectionAttemptRef.current !== attemptId) {
          txSubscriptionRef.current?.remove();
          txSubscriptionRef.current = null;

          await device.cancelConnection();

          connectedDeviceRef.current = null;

          return;
        }

        updateConnectionState('connected');

        console.log(
          `[SAHA-BLE][CENTRAL] Chat connection ready with peripheral: ${deviceId}`,
        );
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to connect to BLE device';

        console.log(
          `[SAHA-BLE][CENTRAL] BLE Connection failed for ${deviceId}: ${msg}`,
        );

        if (connectionAttemptRef.current === attemptId) {
          txSubscriptionRef.current?.remove();
          txSubscriptionRef.current = null;

          disconnectSubscriptionRef.current?.remove();
          disconnectSubscriptionRef.current = null;

          const failedDevice = connectedDeviceRef.current;
          connectedDeviceRef.current = null;

          if (failedDevice) {
            try {
              await failedDevice.cancelConnection();
            } catch {
              // The connection may already be gone.
            }
          }

          setErrorMessage(msg);
          updateConnectionState('error');
        }
      } finally {
        if (connectionAttemptRef.current === attemptId) {
          connectionInFlightRef.current = false;
        }
      }
    },
    [
      addMessage,
      loadHistoryForPeer,
      resetChatSession,
      updateConnectionState,
      updateMessageStatus,
    ],
  );

  useEffect(() => {
    const centralSub = sahaBlePeripheral.onCentralConnected((event) => {
      console.log(
        `[SAHA-BLE][PERIPHERAL] Central ${event.deviceId} connection status: ${event.connected}`,
      );

      if (event.connected) {
        connectedCentralDeviceIdRef.current = event.deviceId;
      } else if (connectedCentralDeviceIdRef.current === event.deviceId) {
        connectedCentralDeviceIdRef.current = null;
      }
    });

    return () => {
      centralSub.remove();
    };
  }, []);

  useEffect(() => {
    const dataSub = sahaBlePeripheral.onDataReceived((event) => {
      if (event.payload) {
        connectedCentralDeviceIdRef.current = event.deviceId;

        console.log(
          `[SAHA-BLE][PERIPHERAL][RX] Peripheral received RX payload from Central (${event.deviceId}): "${event.payload}"`,
        );

        try {
          const protocolMessage = decodeMessage(event.payload);

          if (protocolMessage.type !== 'message') {
            return;
          }

          if (hasSeenMessage(protocolMessage.id)) {
            console.log(
              `[SAHA-SEEN] Ignoring duplicate message ${protocolMessage.id} from Peripheral`,
            );

            return;
          }

          markMessageSeen(protocolMessage.id);

          addMessage({
            id: protocolMessage.id,
            senderId:
              protocolMessage.senderId ||
              `Central (${event.deviceId.slice(-4)})`,
            receiverId: localNodeIdRef.current,
            content: protocolMessage.payload,
            isSelf: false,
            status: 'received',
            timestamp: protocolMessage.timestamp * 1000,
            peerDeviceId: event.deviceId,
            receivedVia: 'peripheral',
          });
        } catch (error) {
          console.log(
            '[SAHA-BLE][PERIPHERAL][RX] Invalid protocol message',
            error,
          );
        }
      }
    });

    return () => {
      dataSub.remove();
    };
  }, [addMessage]);

  useEffect(() => {
    void sahaBlePeripheral.getNodeId().then((nodeId) => {
      localNodeIdRef.current = nodeId;
    });
  }, []);

  useEffect(() => {
    let connectTimer: ReturnType<typeof setTimeout> | null = null;

    if (targetDeviceId) {
      connectTimer = setTimeout(() => {
        void connectToPeer(targetDeviceId, targetDeviceName);
      }, 0);
    }

    return () => {
      if (connectTimer) {
        clearTimeout(connectTimer);
      }

      void disconnect();
    };
  }, [targetDeviceId, targetDeviceName, connectToPeer, disconnect]);

  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text.trim()) {
        return false;
      }

      const outgoingMessage = createChatMessage(localNodeIdRef.current, text);

      const receiverId =
        peerIdentityRef.current || targetDeviceName || targetDeviceId || 'peer';

      const peerKey =
        targetDeviceId || connectedCentralDeviceIdRef.current || receiverId;

      const jsonString = encodeMessage(outgoingMessage);

      const rawUtf8ByteLength = new TextEncoder().encode(jsonString).byteLength;

      /*
       * Reject permanently invalid messages before putting them
       * into the outbox.
       */
      if (rawUtf8ByteLength > SAHA_BLE_CONFIG.maxTransportPayloadBytes) {
        const message =
          `Message is too large for the current BLE payload limit ` +
          `(${rawUtf8ByteLength} bytes > ` +
          `${SAHA_BLE_CONFIG.maxTransportPayloadBytes} max)`;

        setErrorMessage(message);

        addMessage({
          id: outgoingMessage.id,
          senderId: outgoingMessage.senderId,
          receiverId,
          content: outgoingMessage.payload,
          isSelf: true,
          status: 'failed',
          timestamp: outgoingMessage.timestamp * 1000,
          peerDeviceId: targetDeviceId ?? undefined,
        });

        return false;
      }

      /*
       * The message enters the durable outbox BEFORE any transport
       * attempt is made.
       *
       * The same message ID will be retained for all future retries.
       */
      enqueueMessage({
        message: outgoingMessage,
        peerKey,
        receiverId,
        attemptCount: 0,
        createdAt: Date.now(),
        lastAttemptAt: null,
      });

      /*
       * Display the message immediately.
       *
       * "sending" means the message is locally created and is
       * awaiting application-level delivery confirmation.
       */
      addMessage({
        id: outgoingMessage.id,
        senderId: outgoingMessage.senderId,
        receiverId,
        content: outgoingMessage.payload,
        isSelf: true,
        status: 'sending',
        timestamp: outgoingMessage.timestamp * 1000,
        peerDeviceId: targetDeviceId ?? undefined,
      });

      /*
       * A connection that is still being established is not a
       * permanent failure anymore. The message is already safely
       * stored in the outbox.
       */
      if (
        connectionStateRef.current === 'connecting' ||
        connectionStateRef.current === 'discovering'
      ) {
        console.log(
          `[SAHA-OUTBOX] Message ${outgoingMessage.id} queued while connecting`,
        );

        return true;
      }

      /*
       * CENTRAL TRANSPORT
       */
      if (
        connectedDeviceRef.current &&
        connectionStateRef.current === 'connected'
      ) {
        try {
          const base64Payload = encodeBase64(jsonString);

          updateOutboxEntry(outgoingMessage.id, {
            attemptCount: 1,
            lastAttemptAt: Date.now(),
          });

          await connectedDeviceRef.current.writeCharacteristicWithResponseForService(
            SAHA_SERVICE_UUID,
            RX_CHARACTERISTIC_UUID,
            base64Payload,
          );

          /*
           * The GATT write succeeded, but this is NOT an ACK.
           *
           * Therefore:
           * - keep the message in the outbox
           * - keep UI state as "sending"
           *
           * Phase 3D will remove it after an application-level ACK.
           */
          console.log(
            `[SAHA-OUTBOX] BLE write completed for message ${outgoingMessage.id}; awaiting ACK`,
          );

          return true;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Failed to send RX write';

          setErrorMessage(`Send failed: ${message}`);

          /*
           * Do NOT remove the message from the outbox.
           *
           * The message remains durable for the future retry stage.
           */
          console.log(
            `[SAHA-OUTBOX] BLE write failed for ${outgoingMessage.id}; message retained`,
          );

          return false;
        }
      }

      /*
       * If a target device exists but we are currently disconnected,
       * keep the message queued rather than treating the temporary
       * lack of connection as permanent failure.
       */
      if (targetDeviceId) {
        console.log(
          `[SAHA-OUTBOX] Message ${outgoingMessage.id} queued; no active BLE connection`,
        );

        return true;
      }

      /*
       * PERIPHERAL TRANSPORT
       *
       * This device is acting as the GATT server and sends through
       * its TX notification characteristic.
       */
      if (sahaBlePeripheral.isAvailable()) {
        try {
          updateOutboxEntry(outgoingMessage.id, {
            attemptCount: 1,
            lastAttemptAt: Date.now(),
          });

          const success = await sahaBlePeripheral.sendNotification(jsonString);

          if (success) {
            console.log(
              `[SAHA-OUTBOX] TX notification queued for message ${outgoingMessage.id}; awaiting ACK`,
            );

            /*
             * Again, successful notification submission is not
             * application-level delivery confirmation.
             */
            return true;
          }

          setErrorMessage(
            'Failed to send TX notification (no connected Central)',
          );

          console.log(
            `[SAHA-OUTBOX] TX notification failed for ${outgoingMessage.id}; message retained`,
          );

          return false;
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to send TX notification';

          setErrorMessage(`Send failed: ${message}`);

          console.log(
            `[SAHA-OUTBOX] TX notification error for ${outgoingMessage.id}; message retained`,
          );

          return false;
        }
      }

      /*
       * No transport is currently available.
       *
       * The message is still safely stored in the outbox.
       */
      console.log(
        `[SAHA-OUTBOX] Message ${outgoingMessage.id} queued; no BLE transport available`,
      );

      return true;
    },
    [addMessage, targetDeviceId, targetDeviceName],
  );

  return {
    connectionState,
    messages,
    peerIdentity,
    errorMessage,
    sendMessage,
    connectToPeer,
    disconnect,
    isConnected:
      connectionState === 'connected' ||
      (!targetDeviceId && sahaBlePeripheral.isAvailable()),
  };
}
