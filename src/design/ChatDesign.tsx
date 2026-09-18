import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ChatMessage } from '@/ble/types';

export type ConversationPreview = {
  id: string;
  name: string;
  preview: string;
  time: string;
  isActive: boolean;
  onPress: () => void;
};

export function MessagesDesign({
  conversations,
}: {
  conversations: ConversationPreview[];
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.inboxScreen}>
        <Text style={styles.inboxTitle}>Messages</Text>
        <View style={styles.conversationList}>
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <Pressable
                key={conversation.id}
                onPress={conversation.onPress}
                style={({ pressed }) => [
                  styles.previewRow,
                  pressed && styles.pressed,
                ]}>
                <View
                  style={[
                    styles.previewIcon,
                    conversation.isActive && styles.previewIconActive,
                  ]}>
                  <Ionicons
                    name="bluetooth"
                    size={16}
                    color={conversation.isActive ? '#3159DB' : '#B5B5B1'}
                  />
                </View>
                <View style={styles.previewCopy}>
                  <Text style={styles.previewName}>{conversation.name}</Text>
                  <Text
                    style={styles.previewText}
                    numberOfLines={1}>
                    {conversation.preview}
                  </Text>
                </View>
                <Text style={styles.previewTime}>{conversation.time}</Text>
              </Pressable>
            ))
          ) : (
            <View style={styles.emptyInbox}>
              <Ionicons
                name="chatbubbles-outline"
                size={25}
                color="#3159DB"
              />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Connect to a nearby node to start chatting.
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export type ConversationDesignProps = {
  displayName: string;
  connectionLabel: string;
  connectionColor: string;
  messages: ChatMessage[];
  inputText: string;
  isSending: boolean;
  isConnecting: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  onInputChange: (text: string) => void;
  onSend: (submittedText?: string) => void;
};

export function ConversationDesign({
  displayName,
  connectionLabel,
  connectionColor,
  messages,
  inputText,
  isSending,
  isConnecting,
  errorMessage,
  onBack,
  onDisconnect,
  onReconnect,
  onInputChange,
  onSend,
}: ConversationDesignProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.conversationScreen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.conversationHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name="chevron-back"
              size={20}
              color="#3159DB"
            />
          </Pressable>
          <View style={styles.conversationIdentity}>
            <Text
              style={styles.conversationName}
              numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.connectionRow}>
              <View
                style={[
                  styles.connectionDot,
                  { backgroundColor: connectionColor },
                ]}
              />
              <Text style={styles.connectionText}>
                {connectionLabel} via Bluetooth
              </Text>
            </View>
          </View>
          {connectionLabel === 'Disconnected' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reconnect"
              onPress={onReconnect}
              style={({ pressed }) => [
                styles.reconnectButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.reconnectText}>Reconnect</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Disconnect"
              onPress={onDisconnect}
              style={styles.moreButton}>
              <Ionicons
                name="ellipsis-vertical"
                size={17}
                color="#A0A09B"
              />
            </Pressable>
          )}
        </View>
        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        {isConnecting && (
          <View style={styles.connectingRow}>
            <ActivityIndicator color="#3159DB" />
            <Text style={styles.connectingText}>
              Connecting to {displayName}...
            </Text>
          </View>
        )}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => <Bubble message={item} />}
          ListEmptyComponent={
            <Text style={styles.emptyConversation}>
              Messages sent over the local SAHA network appear here.
            </Text>
          }
        />
        <View style={styles.encryptionNote}>
          <Ionicons
            name="lock-closed-outline"
            size={10}
            color="#B1B1AC"
          />
          <Text style={styles.encryptionText}>
            Delivered locally · end-to-end encrypted
          </Text>
        </View>
        <View style={styles.composerRow}>
          <TextInput
            value={inputText}
            onChangeText={onInputChange}
            onSubmitEditing={(e) => onSend(e.nativeEvent.text)}
            editable={!isSending}
            returnKeyType="send"
            placeholder="Type a message..."
            placeholderTextColor="#B0B0AB"
            style={styles.composer}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={() => onSend(inputText)}
            disabled={!inputText.trim() || isSending}
            style={({ pressed }) => [
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}>
            {isSending ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Ionicons
                name="paper-plane"
                size={15}
                color="#FFFFFF"
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View
      style={[
        styles.bubbleRow,
        message.isSelf ? styles.bubbleRowSelf : styles.bubbleRowPeer,
      ]}>
      <View
        style={[
          styles.bubble,
          message.isSelf ? styles.bubbleSelf : styles.bubblePeer,
        ]}>
        <Text
          style={[styles.bubbleText, message.isSelf && styles.bubbleTextSelf]}>
          {message.content}
        </Text>
        <View style={styles.bubbleMeta}>
          <Text
            style={[
              styles.bubbleTime,
              message.isSelf && styles.bubbleTimeSelf,
            ]}>
            {time}
          </Text>
          {message.isSelf && (
            <Text
              style={[
                styles.bubbleStatus,
                message.isSelf && styles.bubbleTimeSelf,
              ]}>
              {message.status === 'sent' ? 'Delivered locally' : message.status}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F6F2' },
  inboxScreen: { flex: 1, paddingHorizontal: 34, paddingTop: 22 },
  inboxTitle: {
    color: '#111820',
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 20,
  },
  conversationList: {
    overflow: 'hidden',
    borderRadius: 13,
    backgroundColor: '#ECEBE9',
  },
  previewRow: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  previewIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#DEDEDC',
  },
  previewIconActive: { backgroundColor: '#DDE4FF' },
  previewCopy: { flex: 1 },
  previewName: { color: '#18212A', fontSize: 11, fontWeight: '800' },
  previewText: { marginTop: 4, color: '#777A7A', fontSize: 10 },
  previewTime: { color: '#B1B1AC', fontSize: 9 },
  emptyInbox: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  emptyTitle: {
    marginTop: 10,
    color: '#18212A',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 5,
    color: '#898B87',
    fontSize: 11,
    textAlign: 'center',
  },
  conversationScreen: { flex: 1, backgroundColor: '#F7F6F2' },
  conversationHeader: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 29,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
  },
  backButton: { width: 28, height: 34, justifyContent: 'center' },
  conversationIdentity: { flex: 1, marginHorizontal: 5 },
  conversationName: { color: '#18212A', fontSize: 12, fontWeight: '700' },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { color: '#A0A09B', fontSize: 9 },
  moreButton: { width: 28, alignItems: 'flex-end' },
  reconnectButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#DDE4FF',
  },
  reconnectText: { color: '#3159DB', fontSize: 9, fontWeight: '700' },
  errorText: {
    paddingHorizontal: 30,
    paddingVertical: 8,
    color: '#B91C1C',
    fontSize: 11,
    backgroundColor: '#FEE2E2',
  },
  connectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  connectingText: { color: '#898B87', fontSize: 11 },
  messagesList: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 34,
    paddingVertical: 20,
    gap: 8,
  },
  bubbleRow: { flexDirection: 'row', marginBottom: 2 },
  bubbleRowSelf: { justifyContent: 'flex-end' },
  bubbleRowPeer: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
  },
  bubbleSelf: { backgroundColor: '#3D5BDD', borderBottomRightRadius: 4 },
  bubblePeer: { backgroundColor: '#ECEBE9', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#30363B', fontSize: 12, lineHeight: 17 },
  bubbleTextSelf: { color: '#FFFFFF' },
  bubbleMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 5,
    marginTop: 4,
  },
  bubbleTime: { color: '#979994', fontSize: 8 },
  bubbleTimeSelf: { color: '#D8E0FF' },
  bubbleStatus: { fontSize: 8 },
  emptyConversation: {
    alignSelf: 'center',
    color: '#B1B1AC',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
  },
  encryptionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 9,
  },
  encryptionText: { color: '#B1B1AC', fontSize: 9 },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 18 : 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
  },
  composer: {
    flex: 1,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ECEBE9',
    color: '#18212A',
    fontSize: 11,
  },
  sendButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#3D5BDD',
  },
  sendButtonDisabled: { backgroundColor: '#D4D3D0' },
  pressed: { opacity: 0.68 },
});
