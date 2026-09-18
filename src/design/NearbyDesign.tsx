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

import type {
  BleScannerStatus,
  BluetoothState,
  DiscoveredDevice,
} from '@/ble/types';

export type NearbyDesignProps = {
  devices: DiscoveredDevice[];
  bluetoothState: BluetoothState;
  status: BleScannerStatus;
  errorMessage: string;
  isScanning: boolean;
  onScanAgain: () => void;
  onConnect: (device: DiscoveredDevice) => void;
};

export function NearbyDesign({
  devices,
  bluetoothState,
  status,
  errorMessage,
  isScanning,
  onScanAgain,
  onConnect,
}: NearbyDesignProps) {
  const bluetoothReady =
    bluetoothState !== 'PoweredOff' && bluetoothState !== 'Unavailable';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Nearby</Text>
          <View style={styles.bluetoothBadge}>
            <View
              style={[
                styles.badgeDot,
                { backgroundColor: bluetoothReady ? '#19B66A' : '#E5A526' },
              ]}
            />
            <Text style={styles.badgeText}>
              {bluetoothReady ? 'Bluetooth' : 'Bluetooth off'}
            </Text>
          </View>
        </View>

        {devices.length > 0 ? (
          <View style={styles.deviceList}>
            {devices.map((device, index) => (
              <DeviceRow
                key={device.id}
                device={device}
                isLast={index === devices.length - 1}
                onConnect={() => onConnect(device)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            isScanning={isScanning}
            status={status}
            errorMessage={errorMessage}
          />
        )}

        <Pressable
          accessibilityRole="button"
          onPress={onScanAgain}
          disabled={isScanning}
          style={({ pressed }) => [
            styles.scanButton,
            isScanning && styles.scanButtonActive,
            pressed && styles.pressed,
          ]}>
          {isScanning && (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          )}
          <Text style={styles.scanButtonText}>
            {isScanning ? 'Scanning...' : 'Scan Again'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function DeviceRow({
  device,
  isLast,
  onConnect,
}: {
  device: DiscoveredDevice;
  isLast: boolean;
  onConnect: () => void;
}) {
  const name = device.name ?? 'SAHA Node';
  const isStrong = device.rssi != null && device.rssi >= -75;

  return (
    <View style={[styles.deviceRow, !isLast && styles.deviceRowBorder]}>
      <View
      style={[styles.deviceIcon, styles.deviceIconActive]}>
        <Ionicons
          name="bluetooth"
          size={17}
          color="#3159DB"
        />
      </View>
      <View style={styles.deviceCopy}>
        <Text
          style={styles.deviceName}
          numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.stateRow}>
          <View
            style={[
              styles.stateDot,
              { backgroundColor: isStrong ? '#19B66A' : '#E5A526' },
            ]}
          />
          <Text style={styles.stateText}>
            {isStrong ? 'Available' : 'Available'}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Connect to ${name}`}
        onPress={onConnect}
        style={({ pressed }) => [
          styles.connectButton,
          pressed && styles.pressed,
        ]}>
        <Text style={styles.connectText}>Connect</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({
  isScanning,
  status,
  errorMessage,
}: {
  isScanning: boolean;
  status: BleScannerStatus;
  errorMessage: string;
}) {
  let message = 'Scan for nearby SAHA nodes.';
  if (isScanning) message = 'Looking for nearby SAHA nodes...';
  if (status === 'permission-denied')
    message = errorMessage || 'Bluetooth permission is required.';
  if (status === 'bluetooth-off')
    message = 'Turn on Bluetooth to discover nearby devices.';
  if (status === 'bluetooth-unavailable')
    message = 'A native development build is required for BLE scanning.';
  if (status === 'error')
    message = errorMessage || 'Unable to scan for nearby devices.';

  return (
    <View style={styles.emptyState}>
      <Ionicons
        name={isScanning ? 'radio-outline' : 'bluetooth-outline'}
        size={28}
        color="#3159DB"
      />
      <Text style={styles.emptyTitle}>
        {isScanning ? 'Scanning nearby' : 'No devices found'}
      </Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F6F2' },
  content: { paddingHorizontal: 34, paddingTop: 22, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { color: '#111820', fontSize: 24, fontWeight: '500' },
  bluetoothBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#E2F3E9',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { color: '#16804F', fontSize: 9, fontWeight: '700' },
  deviceList: {
    overflow: 'hidden',
    borderRadius: 13,
    paddingHorizontal: 12,
    backgroundColor: '#ECEBE9',
  },
  deviceRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceRowBorder: { borderBottomWidth: 1, borderBottomColor: '#D8D7D3' },
  deviceIcon: {
    width: 33,
    height: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  deviceIconActive: { backgroundColor: '#DDE4FF' },
  deviceCopy: { flex: 1 },
  deviceName: { color: '#18212A', fontSize: 11, fontWeight: '700' },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  stateText: { color: '#A0A09B', fontSize: 9 },
  connectButton: {
    minWidth: 53,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 7,
  },
  connectText: { color: '#18212A', fontSize: 10, fontWeight: '600' },
  emptyState: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    borderRadius: 13,
    backgroundColor: '#ECEBE9',
  },
  emptyTitle: {
    marginTop: 10,
    color: '#18212A',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyMessage: {
    marginTop: 6,
    color: '#898B87',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  scanButton: {
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 21,
    borderRadius: 9,
    backgroundColor: '#3D5BDD',
  },
  scanButtonActive: { backgroundColor: '#6B7FE2' },
  scanButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.68 },
});
