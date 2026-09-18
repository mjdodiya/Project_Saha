import { Stack, useRouter } from 'expo-router';

import { MessagesDesign, type ConversationPreview } from '@/design/ChatDesign';
import { useBleContext } from '@/hooks/BleContext';

export default function ChatScreen() {
  const router = useRouter();
  const { chat } = useBleContext();

  const conversations = buildConversations(chat.messages, (conversation) => {
    router.push({
      pathname: '/conversation',
      params: {
        deviceId: conversation.deviceId,
        deviceName: conversation.name,
        transport: conversation.transport,
      },
    });
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MessagesDesign conversations={conversations} />
    </>
  );
}

function buildConversations(
  messages: ReturnType<typeof useBleContext>['chat']['messages'],
  onOpen: (conversation: {
    deviceId?: string;
    name: string;
    transport: 'central' | 'peripheral';
  }) => void,
): ConversationPreview[] {
  const latestByPeer = new Map<string, (typeof messages)[number]>();

  for (const message of messages) {
    const fallbackPeer = message.isSelf ? message.receiverId : message.senderId;
    const key = message.peerDeviceId ?? fallbackPeer;
    const current = latestByPeer.get(key);
    if (!current || current.timestamp < message.timestamp) {
      latestByPeer.set(key, message);
    }
  }

  return [...latestByPeer.entries()]
    .map(([key, message]) => {
      const name = message.isSelf ? message.receiverId : message.senderId;
      const transport = message.receivedVia ?? 'central';
      return {
        id: key,
        name: name.startsWith('SAHA-') ? `Node ${name.slice(5)}` : name,
        preview: message.text,
        time: formatTime(message.timestamp),
        isActive: true,
        onPress: () =>
          onOpen({
            deviceId: message.peerDeviceId,
            name,
            transport,
          }),
      };
    })
    .sort((left, right) => right.time.localeCompare(left.time));
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}
