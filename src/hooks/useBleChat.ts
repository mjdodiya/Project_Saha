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
  createChatMessage,
  decodeMessage,
  encodeMessage,
} from '@/ble/SahaProtocol';
import type { ChatConnectionState, ChatMessage } from '@/ble/types';

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

  const updateConnectionState = useCallback((state: ChatConnectionState) => {
    connectionStateRef.current = state;
    setConnectionState(state);
  }, []);

  const resetChatSession = useCallback(() => {
    seenMessageIdsRef.current.clear();
    setMessages([]);
    peerIdentityRef.current = null;
    setPeerIdentity(null);
    setErrorMessage(null);
  }, []);

  // Helper to add a message to chat history state with debugging log
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
      if (seenMessageIdsRef.current.has(id)) return;
      seenMessageIdsRef.current.add(id);

      console.log(
        `[BOUNDARY-K][ReactState] Adding message - id=${id}, senderId=${senderId}, receiverId=${receiverId}, peerDeviceId=${peerDeviceId ?? 'none'}, isSelf=${isSelf}, chars=${content.length}, text="${content}"`,
      );
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
      setMessages((prev) => [...prev, newMessage]);
    },
    [],
  );

  // Disconnect central session cleanly
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

  // Connect as Central to target peripheral device
  const connectToPeer = useCallback(
    async (deviceId: string, deviceName?: string | null) => {
      if (connectionInFlightRef.current || connectedDeviceRef.current) {
        return;
      }

      const attemptId = connectionAttemptRef.current + 1;
      connectionAttemptRef.current = attemptId;
      connectionInFlightRef.current = true;
      resetChatSession();
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

        // Read identity characteristic if available
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

        // Subscribe to TX characteristic for incoming Peripheral -> Central notifications
        console.log(
          `[SAHA-BLE][CENTRAL][TX] Subscribing to TX notifications (${TX_CHARACTERISTIC_UUID})...`,
        );
        txSubscriptionRef.current?.remove();
        txSubscriptionRef.current = device.monitorCharacteristicForService(
          SAHA_SERVICE_UUID,
          TX_CHARACTERISTIC_UUID,
          (error, characteristic) => {
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
                `[SAHA-BLE][CENTRAL][TX] notification Base64 chars=${characteristic.value.length}, raw bytes=${characteristic.value.length / 4 * 3 - paddingBytes}, decoded JSON chars=${decodedText.length}`,
              );
              const protocolMessage = decodeMessage(decodedText);
              if (protocolMessage.type !== 'message') return;
              console.log(
                `[BOUNDARY-I][Central-TX-Notification] rawBytes=${characteristic.value.length / 4 * 3 - paddingBytes}, decodedChars=${decodedText.length}`,
              );
              console.log(
                `[BOUNDARY-J][DecodedMessage-Central-TX] id=${protocolMessage.id}, payloadChars=${protocolMessage.payload.length}, text="${protocolMessage.payload}"`,
              );
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
            if (connectionAttemptRef.current !== attemptId) return;
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
    [addMessage, resetChatSession, updateConnectionState],
  );

  useEffect(() => {
    const centralSub = sahaBlePeripheral.onCentralConnected((event) => {
      console.log(`[SAHA-BLE][PERIPHERAL] Central ${event.deviceId} connection status: ${event.connected}`);
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

  // Handle incoming Peripheral RX write data (Central -> Peripheral)
  useEffect(() => {
    const dataSub = sahaBlePeripheral.onDataReceived((event) => {
      // Incoming message written by a Central to our local Peripheral RX characteristic
      if (event.payload) {
        connectedCentralDeviceIdRef.current = event.deviceId;
        console.log(
          `[SAHA-BLE][PERIPHERAL][RX] Peripheral received RX payload from Central (${event.deviceId}): "${event.payload}"`,
        );
        console.log(
          `[SAHA-BLE][PERIPHERAL][CHAT] Forwarding RX payload to React Native chat state: "${event.payload}"`,
        );
        try {
          const protocolMessage = decodeMessage(event.payload);
          if (protocolMessage.type !== 'message') return;
          console.log(
            `[BOUNDARY-J][DecodedMessage-Peripheral-RX] id=${protocolMessage.id}, payloadChars=${protocolMessage.payload.length}, text="${protocolMessage.payload}"`,
          );
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

  // Connect to target device on mount if provided
  useEffect(() => {
    let connectTimer: ReturnType<typeof setTimeout> | null = null;

    if (targetDeviceId) {
      connectTimer = setTimeout(() => {
        void connectToPeer(targetDeviceId, targetDeviceName);
      }, 0);
    }

    return () => {
      if (connectTimer) clearTimeout(connectTimer);
      void disconnect();
    };
  }, [targetDeviceId, targetDeviceName, connectToPeer, disconnect]);

  // Send message over BLE
  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text.trim()) {
        return false;
      }

      const outgoingMessage = createChatMessage(
        localNodeIdRef.current,
        text,
      );
      const receiverId =
        peerIdentityRef.current || targetDeviceName || targetDeviceId || 'peer';
      const addFailedMessage = (message: string) => {
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
      };

      if (
        connectionStateRef.current === 'connecting' ||
        connectionStateRef.current === 'discovering'
      ) {
        addFailedMessage('Cannot send while connecting');
        return false;
      }

      // If connected as Central to target device (Central -> Peripheral via RX write)
      if (
        connectedDeviceRef.current &&
        connectionStateRef.current === 'connected'
      ) {
        try {
          const jsonString = encodeMessage(outgoingMessage);
          const rawUtf8ByteLength = new TextEncoder().encode(jsonString).byteLength;
          const base64Payload = encodeBase64(jsonString);

          console.log(`[BOUNDARY-B][sendMessage] text="${text}", chars=${text.length}`);
          console.log(`[BOUNDARY-C][protocolJson] id=${outgoingMessage.id}, chars=${jsonString.length}, json="${jsonString}"`);
          console.log(`[BOUNDARY-D][UTF-8] utf8Bytes=${rawUtf8ByteLength}`);
          console.log(`[BOUNDARY-E][Base64] base64Chars=${base64Payload.length}`);

          if (rawUtf8ByteLength > SAHA_BLE_CONFIG.maxTransportPayloadBytes) {
            addFailedMessage(
              `Message is too large for the current BLE payload limit (${rawUtf8ByteLength} bytes > ${SAHA_BLE_CONFIG.maxTransportPayloadBytes} max)`,
            );
            return false;
          }

          console.log(
            `[BOUNDARY-F][Central-RX-Write] Writing ${rawUtf8ByteLength} raw bytes (${base64Payload.length} Base64 chars) to RX characteristic (${RX_CHARACTERISTIC_UUID})`,
          );

          await connectedDeviceRef.current.writeCharacteristicWithResponseForService(
            SAHA_SERVICE_UUID,
            RX_CHARACTERISTIC_UUID,
            base64Payload,
          );
          console.log(
            '[SAHA-BLE][CENTRAL][RX] RX characteristic write completed successfully',
          );
          addMessage({
            id: outgoingMessage.id,
            senderId: outgoingMessage.senderId,
            receiverId:
              peerIdentityRef.current ||
              targetDeviceName ||
              targetDeviceId ||
              'peer',
            content: outgoingMessage.payload,
            isSelf: true,
            status: 'sent',
            timestamp: outgoingMessage.timestamp * 1000,
            peerDeviceId: targetDeviceId ?? undefined,
          });
          return true;
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Failed to send RX write';
          console.log(`[SAHA-BLE][CENTRAL][RX] RX write error: ${msg}`);
          addFailedMessage(`Send failed: ${msg}`);
          return false;
        }
      }

      if (targetDeviceId) {
        addFailedMessage('No active BLE connection to send message');
        return false;
      }

      // Fallback or Peripheral Mode: send TX notification to connected Centrals (Peripheral -> Central via TX notification)
      if (sahaBlePeripheral.isAvailable()) {
        const jsonString = encodeMessage(outgoingMessage);
        const rawUtf8ByteLength = new TextEncoder().encode(jsonString).byteLength;
        const encodedPayload = encodeBase64(jsonString);

        console.log(`[BOUNDARY-B][sendMessage-Peripheral] text="${text}", chars=${text.length}`);
        console.log(`[BOUNDARY-C][protocolJson-Peripheral] id=${outgoingMessage.id}, chars=${jsonString.length}, json="${jsonString}"`);
        console.log(`[BOUNDARY-D][UTF-8-Peripheral] utf8Bytes=${rawUtf8ByteLength}`);
        console.log(`[BOUNDARY-E][Base64-Peripheral] base64Chars=${encodedPayload.length}`);

        if (rawUtf8ByteLength > SAHA_BLE_CONFIG.maxTransportPayloadBytes) {
          addFailedMessage(
            `Message is too large for the current BLE payload limit (${rawUtf8ByteLength} bytes > ${SAHA_BLE_CONFIG.maxTransportPayloadBytes} max)`,
          );
          return false;
        }

        console.log(
          `[BOUNDARY-F][Peripheral-TX-Notify] Peripheral dispatching TX notification for ${rawUtf8ByteLength} UTF-8 bytes`,
        );

        const success =
          await sahaBlePeripheral.sendNotification(jsonString);
        if (success) {
          console.log(
            '[SAHA-BLE][PERIPHERAL][TX] TX notification queued/delivered successfully',
          );
          const peerAddress = connectedCentralDeviceIdRef.current || targetDeviceId;
          addMessage({
            id: outgoingMessage.id,
            senderId: outgoingMessage.senderId,
            receiverId: peerIdentityRef.current || peerAddress || 'connected-peer',
            peerDeviceId: peerAddress ?? undefined,
            content: outgoingMessage.payload,
            isSelf: true,
            status: 'sent',
            timestamp: outgoingMessage.timestamp * 1000,
            receivedVia: 'peripheral',
          });
          return true;
        } else {
          console.log(
            '[SAHA-BLE][PERIPHERAL][TX] Failed to send TX notification (no connected Central)',
          );
          addFailedMessage(
            'Failed to send TX notification (no connected Central)',
          );
          return false;
        }
      }

      console.log(
        '[SAHA-BLE][CHAT] Error: No active BLE connection available to send message',
      );
      addFailedMessage('No active BLE connection to send message');
      return false;
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
