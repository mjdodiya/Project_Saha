import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { ConversationDesign } from '@/design/ChatDesign';
import { useBleContext } from '@/hooks/BleContext';

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    deviceId?: string;
    deviceName?: string;
    transport?: 'central' | 'peripheral';
  }>();
  const { peripheral, chat, connectToPeer, disconnect } = useBleContext();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const isCentralConversation =
    params.transport !== 'peripheral' && Boolean(params.deviceId);

  useEffect(() => {
    if (isCentralConversation && params.deviceId) {
      void connectToPeer(params.deviceId, params.deviceName);
    }
  }, [connectToPeer, isCentralConversation, params.deviceId, params.deviceName]);

  const displayName = chat.peerIdentity
    ? `Node ${chat.peerIdentity}`
    : params.deviceName ||
      (params.deviceId ? `Device (${params.deviceId.slice(-5)})` : 'SAHA peer');
  const connectionLabel = getConnectionLabel(
    isCentralConversation,
    chat.connectionState,
    peripheral.status,
    peripheral.nodeId,
  );
  const connectionColor =
    chat.connectionState === 'error'
      ? '#D94B4B'
      : connectionLabel.startsWith('Connected')
        ? '#19B66A'
        : '#E5A526';

  const handleSend = async (submittedText?: string) => {
    const textToSend =
      submittedText !== undefined && typeof submittedText === 'string'
        ? submittedText
        : inputText;
    if (!textToSend.trim() || isSending) return;
    setInputText('');
    setIsSending(true);
    console.log(
      `[BOUNDARY-A][TextInput] text="${textToSend}", chars=${textToSend.length}`,
    );
    await chat.sendMessage(textToSend);
    setIsSending(false);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConversationDesign
        displayName={displayName}
        connectionLabel={connectionLabel}
        connectionColor={connectionColor}
        messages={chat.messages}
        inputText={inputText}
        isSending={isSending}
        isConnecting={
          isCentralConversation &&
          (chat.connectionState === 'connecting' ||
            chat.connectionState === 'discovering')
        }
        errorMessage={chat.errorMessage}
        onBack={() => router.back()}
        onDisconnect={() =>
          isCentralConversation ? void disconnect() : router.back()
        }
        onReconnect={() => {
          if (isCentralConversation && params.deviceId) {
            void connectToPeer(params.deviceId, params.deviceName);
          }
        }}
        onInputChange={setInputText}
        onSend={(text) => void handleSend(text)}
      />
    </>
  );
}

function getConnectionLabel(
  isCentralConversation: boolean,
  connectionState: ReturnType<typeof useBleContext>['chat']['connectionState'],
  peripheralStatus: ReturnType<typeof useBleContext>['peripheral']['status'],
  nodeId: string,
) {
  if (!isCentralConversation) {
    return peripheralStatus === 'Connected'
      ? `Connected as ${nodeId || 'Me'}`
      : 'Waiting for peer';
  }
  if (connectionState === 'connected') return `Connected as ${nodeId || 'Me'}`;
  if (connectionState === 'connecting') return 'Connecting';
  if (connectionState === 'discovering') return 'Discovering';
  return 'Disconnected';
}
