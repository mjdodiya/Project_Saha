import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ChatMessage } from '@/ble/types';

export type HomeDesignProps = {
  nodeId: string;
  nearbyCount: number;
  messageCount: number;
  totalBleSignals: number;
  locationLabel: string;
  recentMessages: ChatMessage[];
  connectionLabel: string;
  connectionColor: string;
  isScanning: boolean;
  onOpenNearby: () => void;
  onOpenMessages: () => void;
  onOpenMessage: (message: ChatMessage) => void;
  onDiagnose: () => void;
  onStartNearbyScan: () => void;
};

export function HomeDesign({
  nodeId,
  nearbyCount,
  messageCount,
  totalBleSignals,
  locationLabel,
  recentMessages,
  connectionLabel,
  connectionColor,
  isScanning,
  onOpenNearby,
  onOpenMessages,
  onOpenMessage,
  onDiagnose,
  onStartNearbyScan,
}: HomeDesignProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.brand}>SAHA</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bluetooth connection status"
            onPress={onOpenNearby}
            style={styles.bluetoothButton}>
            <Ionicons
              name="bluetooth"
              size={17}
              color="#A3A39E"
            />
          </Pressable>
        </View>

        <View style={styles.connectionRow}>
          <View
            style={[styles.statusDot, { backgroundColor: connectionColor }]}
          />
          <Text style={[styles.connectionText, { color: connectionColor }]}>
            {connectionLabel}
          </Text>
          <Text style={styles.nodeIdentity}>{nodeId}</Text>
        </View>

        <View style={styles.statsRow}>
          <StatTile
            value={nearbyCount}
            label="Nearby nodes"
            active
            onPress={onOpenNearby}
          />
          <StatTile
            value={messageCount}
            label="Messages"
            onPress={onOpenMessages}
          />
        </View>

        <SectionLabel title="Recent" />
        <View style={styles.recentList}>
          {recentMessages.length > 0 ? (
            recentMessages.map((message) => (
              <Pressable
                key={message.id}
                onPress={() => onOpenMessage(message)}
                style={({ pressed }) => [
                  styles.messageRow,
                  pressed && styles.pressed,
                ]}>
                <View
                  style={[
                    styles.messageIcon,
                    message.isSelf && styles.messageIconSelf,
                  ]}>
                  <Ionicons
                    name={message.isSelf ? 'arrow-up' : 'chatbubble-outline'}
                    size={15}
                    color="#5270DC"
                  />
                </View>
                <View style={styles.messageCopy}>
                  <Text
                    style={styles.messageSender}
                    numberOfLines={1}>
                    {message.senderId}
                  </Text>
                  <Text
                    style={styles.messagePreview}
                    numberOfLines={1}>
                    {message.text}
                  </Text>
                </View>
                <Text style={styles.messageTime}>
                  {formatTime(message.timestamp)}
                </Text>
              </Pressable>
            ))
          ) : (
            <Pressable
              onPress={onOpenMessages}
              style={({ pressed }) => [
                styles.messageRow,
                pressed && styles.pressed,
              ]}>
              <View style={styles.messageIcon}>
                <Ionicons
                  name="chatbubble-outline"
                  size={15}
                  color="#5270DC"
                />
              </View>
              <View style={styles.messageCopy}>
                <Text style={styles.messageSender}>No recent messages</Text>
                <Text style={styles.messagePreview}>
                  Start a local conversation
                </Text>
              </View>
              <Text style={styles.messageTime}>-</Text>
            </Pressable>
          )}
        </View>

        <SectionLabel title="Quick" />
        <View style={styles.quickRow}>
          <QuickAction
            icon={
              isScanning ? (
                <ActivityIndicator color="#3159DB" />
              ) : (
                <Ionicons
                  name="bluetooth-outline"
                  size={20}
                  color="#3159DB"
                />
              )
            }
            label={isScanning ? 'Scanning' : 'Nearby'}
            onPress={onStartNearbyScan}
          />
          <QuickAction
            icon={
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color="#3159DB"
              />
            }
            label="Messages"
            onPress={onOpenMessages}
          />
          <QuickAction
            icon={
              <Ionicons
                name="medical-outline"
                size={20}
                color="#3159DB"
              />
            }
            label="Diagnose"
            onPress={onDiagnose}
          />
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerNumber}>{totalBleSignals}</Text>
          <Text style={styles.footerText}>SAHA nodes in local range</Text>
        </View>
        <View style={styles.locationTag}>
          <Ionicons
            name="location-outline"
            size={13}
            color="#3159DB"
          />
          <Text
            style={styles.locationText}
            numberOfLines={1}>
            {locationLabel}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({
  value,
  label,
  active,
  onPress,
}: {
  value: number;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.statTile,
        active && styles.statTileActive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.statValue, active && styles.statValueActive]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, active && styles.statLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      {icon}
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F6F2' },
  content: { paddingHorizontal: 35, paddingTop: 22, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#10202D',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bluetoothButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEBE7',
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { color: '#16804F', fontSize: 11, fontWeight: '700' },
  nodeIdentity: { marginLeft: 4, color: '#A3A39E', fontSize: 11 },
  statsRow: { flexDirection: 'row', gap: 7, marginTop: 21 },
  statTile: {
    flex: 1,
    minHeight: 77,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: '#ECEBE9',
  },
  statTileActive: {
    backgroundColor: '#E8EBF6',
    borderWidth: 1,
    borderColor: '#C9D2F3',
  },
  statValue: {
    color: '#111820',
    fontSize: 31,
    fontWeight: '500',
    lineHeight: 34,
  },
  statValueActive: { color: '#3159DB' },
  statLabel: { marginTop: 5, color: '#9B9B99', fontSize: 10 },
  statLabelActive: { color: '#5872D4' },
  sectionLabel: {
    marginTop: 25,
    marginBottom: 9,
    color: '#A1A19B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  recentList: {
    overflow: 'hidden',
    borderRadius: 13,
    backgroundColor: '#ECEBE9',
  },
  messageRow: {
    minHeight: 59,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 9,
  },
  messageIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0E1E5',
  },
  messageIconSelf: { backgroundColor: '#DCE4FF' },
  messageCopy: { flex: 1 },
  messageSender: { color: '#1E2730', fontSize: 10, fontWeight: '800' },
  messagePreview: { marginTop: 3, color: '#656A6E', fontSize: 10 },
  messageTime: { color: '#B3B3AF', fontSize: 9 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickAction: {
    flex: 1,
    minHeight: 61,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#ECEBE9',
  },
  quickLabel: { marginTop: 5, color: '#767A7B', fontSize: 10 },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    gap: 5,
  },
  footerNumber: { color: '#3159DB', fontSize: 11, fontWeight: '800' },
  footerText: { color: '#A0A09B', fontSize: 10 },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
  },
  locationText: { flexShrink: 1, color: '#8C8E8B', fontSize: 10 },
  pressed: { opacity: 0.65 },
});
