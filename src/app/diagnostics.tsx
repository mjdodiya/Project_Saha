import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SAHA_SERVICE_UUID } from '@/ble/config';
import type { DiscoveredDevice, PeripheralInfo } from '@/ble/types';
import { useBleContext } from '@/hooks/BleContext';

export default function DiagnosticsScreen() {
  const router = useRouter();
  const { peripheral, scanner } = useBleContext();

  useEffect(() => {
    void peripheral.refreshStatus();
  }, [peripheral.refreshStatus]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.backButton}>
            <Text style={styles.backButtonText}>{'<'}</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>BLE Diagnostics</Text>
            <Text style={styles.subtitle}>Peripheral and central state</Text>
          </View>
        </View>

        <Section title="Peripheral / Advertiser">
          <DiagnosticRow
            label="Native module"
            value={peripheral.isAvailable ? 'Available' : 'Unavailable'}
          />
          <DiagnosticRow label="Bluetooth" value={formatBluetoothState(scanner.bluetoothState)} />
          <DiagnosticRow label="State" value={peripheral.status} />
          <DiagnosticRow
            label="Service registration"
            value={formatServiceRegistration(peripheral.info)}
          />
          <DiagnosticRow
            label="Advertising"
            value={formatAdvertising(peripheral.info)}
          />
          <DiagnosticRow label="Node ID" value={peripheral.nodeId || 'Unavailable'} />
          <DiagnosticRow
            label="Configured SAHA Service UUID"
            value={SAHA_SERVICE_UUID}
            compact
          />
          <DiagnosticRow
            label="Error"
            value={peripheral.errorMessage || 'None reported'}
            error={Boolean(peripheral.errorMessage)}
          />
        </Section>

        <Section title="Central / Scanner">
          <DiagnosticRow label="Scanning" value={scanner.isScanning ? 'true' : 'false'} />
          <DiagnosticRow label="SAHA nodes found" value={String(scanner.totalDeviceCount)} />
          <DiagnosticRow label="Scanner status" value={scanner.status} />
          <DiagnosticRow
            label="Scanner error"
            value={scanner.errorMessage || 'None reported'}
            error={Boolean(scanner.errorMessage)}
          />
        </Section>

        <Section title="Discovered advertisements">
          {scanner.devices.length > 0 ? (
            scanner.devices.map((device) => (
              <DeviceDiagnostic key={device.id} device={device} />
            ))
          ) : (
            <Text style={styles.emptyText}>No advertisements currently discovered.</Text>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function DiagnosticRow({
  label,
  value,
  compact = false,
  error = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
  error?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, compact && styles.compactValue, error && styles.errorValue]}>
        {value}
      </Text>
    </View>
  );
}

function DeviceDiagnostic({ device }: { device: DiscoveredDevice }) {
  const serviceUuids = device.serviceUUIDs == null
    ? 'unavailable'
    : device.serviceUUIDs.length > 0
      ? device.serviceUUIDs.join(', ')
      : '[]';

  return (
    <View style={styles.deviceBlock}>
      <DiagnosticRow label="Name" value={device.name || 'Unnamed'} />
      <DiagnosticRow label="Device ID" value={device.id} compact />
      <DiagnosticRow label="RSSI" value={device.rssi == null ? 'unavailable' : `${device.rssi} dBm`} />
      <DiagnosticRow label="Service UUIDs" value={serviceUuids} compact />
      <DiagnosticRow label="SAHA match" value={device.isSahaDevice ? 'true' : 'false'} />
    </View>
  );
}

function formatBluetoothState(state: string) {
  if (state === 'PoweredOn') return 'On';
  if (state === 'PoweredOff') return 'Off';
  return 'Unknown';
}

function formatServiceRegistration(info: PeripheralInfo) {
  if (info.serviceRegistrationState === 'pending' || info.serviceRegistrationPending) {
    return 'Pending';
  }
  if (info.serviceRegistrationState === 'registered' || info.serviceRegistered) {
    return 'Success';
  }
  if (info.serviceRegistrationState === 'failed' || info.status === 'Service Registration Failed') {
    return info.serviceRegistrationStatusCode == null
      ? 'Failed'
      : `Failed (code ${info.serviceRegistrationStatusCode})`;
  }
  return 'Idle';
}

function formatAdvertising(info: PeripheralInfo) {
  if (info.advertisingState === 'pending' || info.advertisingStartPending || info.status === 'Advertising Pending') {
    return 'Pending';
  }
  if (info.advertisingState === 'active' || info.advertisingStarted || info.status === 'Advertising' || info.status === 'Connected') {
    return 'Started';
  }
  if (info.advertisingState === 'failed' || info.status === 'Advertising Failed') {
    return info.advertisingFailureCode == null
      ? 'Failed'
      : `Failed (code ${info.advertisingFailureCode})`;
  }
  return 'Idle';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F6F2' },
  content: { paddingHorizontal: 34, paddingTop: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEBE7',
  },
  backButtonText: { color: '#3159DB', fontSize: 27, lineHeight: 30 },
  headerCopy: { flex: 1 },
  title: { color: '#111820', fontSize: 24, fontWeight: '500' },
  subtitle: { marginTop: 4, color: '#9B9B99', fontSize: 11 },
  section: { marginTop: 24 },
  sectionTitle: {
    marginBottom: 9,
    color: '#A1A19B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  card: { overflow: 'hidden', borderRadius: 13, backgroundColor: '#ECEBE9' },
  row: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCDCD8',
  },
  label: { flex: 1, color: '#767A7B', fontSize: 10 },
  value: { flex: 1.5, color: '#18212A', fontSize: 10, textAlign: 'right' },
  compactValue: { fontFamily: 'monospace', fontSize: 9 },
  errorValue: { color: '#C23D3D' },
  deviceBlock: { paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCDCD8' },
  emptyText: { padding: 14, color: '#9B9B99', fontSize: 10 },
});
