import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ConnectionTestResult } from '@/ble/BleConnection';
import { runSahaConnectionTest } from '@/ble/BleConnection';
import type { DiscoveredDevice } from '@/ble/types';
import { useBleContext } from '@/hooks/BleContext';

export function getRssiMetadata(rssi: number | null) {
  if (rssi === null) {
    return {
      label: 'Unknown',
      distance: 'Unknown range',
      bars: 1,
      color: '#9CA3AF',
    };
  }
  if (rssi >= -60) {
    return {
      label: 'Strong',
      distance: 'Immediate (< 2m)',
      bars: 4,
      color: '#10B981',
    };
  }
  if (rssi >= -75) {
    return {
      label: 'Moderate',
      distance: 'Near (2 - 5m)',
      bars: 3,
      color: '#3B82F6',
    };
  }
  if (rssi >= -88) {
    return {
      label: 'Weak',
      distance: 'Far (5 - 10m)',
      bars: 2,
      color: '#F59E0B',
    };
  }
  return {
    label: 'Very Weak',
    distance: 'Very Far (> 10m)',
    bars: 1,
    color: '#EF4444',
  };
}

export default function ScannerScreen() {
  const router = useRouter();
  const { scanner, peripheral, lastConnectionTest, setLastConnectionTest } =
    useBleContext();
  const { width } = useWindowDimensions();
  const isCompact = width < 370;

  const {
    bluetoothState,
    status,
    devices,
    errorMessage,
    isScanning,
    startScan,
    stopScan,
  } = scanner;

  const { status: peripheralStatus, advertisingName } = peripheral;

  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(
    null,
  );
  const [scanSeconds, setScanSeconds] = useState(0);

  // Auto-start scan on mount
  useEffect(() => {
    startScan();
  }, [startScan]);

  // Scan timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isScanning) {
      setScanSeconds(0);
      interval = setInterval(() => {
        setScanSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setScanSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isScanning]);

  const filteredDevices = devices;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0F172A"
      />

      {/* Navigation Top Header */}
      <View style={styles.topHeader}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.buttonPressed,
          ]}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Radar Scanner</Text>
          <Text style={styles.headerSubtitle}>
            {advertisingName} ({peripheralStatus})
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={isScanning ? stopScan : startScan}
          style={({ pressed }) => [
            styles.scanToggleButton,
            isScanning && styles.scanToggleButtonActive,
            pressed && styles.buttonPressed,
          ]}>
          <Text style={styles.scanToggleText}>
            {isScanning ? 'Stop' : 'Scan'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isCompact && styles.scrollContentCompact,
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Animated Radar Visual Component */}
        <RadarView
          isScanning={isScanning}
          devices={filteredDevices}
          onSelectDevice={setSelectedDevice}
        />

        {/* Status Indicator Banner */}
        <StatusBanner
          status={status}
          bluetoothState={bluetoothState}
          isScanning={isScanning}
          deviceCount={devices.length}
          sahaCount={devices.length}
          scanSeconds={scanSeconds}
          errorMessage={errorMessage}
          onStartScan={startScan}
        />

        {/* Discovered Devices List */}
        <View style={styles.devicesList}>
          {filteredDevices.length > 0 ? (
            filteredDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onPress={() => setSelectedDevice(device)}
              />
            ))
          ) : (
            <EmptyStateView
              isScanning={isScanning}
              status={status}
              errorMessage={errorMessage}
              onStartScan={startScan}
            />
          )}
        </View>
      </ScrollView>

      {/* Device Details Modal */}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          lastConnectionTest={lastConnectionTest}
          setLastConnectionTest={setLastConnectionTest}
          onClose={() => setSelectedDevice(null)}
        />
      )}
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/*                                RADAR VIEW                                  */
/* -------------------------------------------------------------------------- */

function RadarView({
  isScanning,
  devices,
  onSelectDevice,
}: {
  isScanning: boolean;
  devices: DiscoveredDevice[];
  onSelectDevice: (device: DiscoveredDevice) => void;
}) {
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let waveLoop: Animated.CompositeAnimation | null = null;
    let rotateLoop: Animated.CompositeAnimation | null = null;

    if (isScanning) {
      waveLoop = Animated.loop(
        Animated.parallel([
          Animated.timing(waveAnim1, {
            toValue: 1,
            duration: 2400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(1200),
            Animated.timing(waveAnim2, {
              toValue: 1,
              duration: 2400,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      );

      rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );

      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      rotateAnim.setValue(0);

      waveLoop.start();
      rotateLoop.start();
    } else {
      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      rotateAnim.setValue(0);
    }

    return () => {
      waveLoop?.stop();
      rotateLoop?.stop();
    };
  }, [isScanning, waveAnim1, waveAnim2, rotateAnim]);

  const scale1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1.3],
  });
  const opacity1 = waveAnim1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.7, 0.4, 0],
  });

  const scale2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1.3],
  });
  const opacity2 = waveAnim2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.7, 0.4, 0],
  });

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Calculate radar positions for devices based on index/id hash
  const RADAR_RADIUS = 95;
  const deviceMarkers = devices.slice(0, 8).map((device, index) => {
    const angle = index * (360 / Math.min(devices.length, 8)) * (Math.PI / 180);
    const rssiVal = device.rssi ?? -80;
    // Normalized distance multiplier (stronger RSSI = closer to center)
    const distanceMult = Math.min(Math.max((-rssiVal - 40) / 60, 0.35), 0.85);
    const x = Math.cos(angle) * RADAR_RADIUS * distanceMult;
    const y = Math.sin(angle) * RADAR_RADIUS * distanceMult;

    return { device, x, y };
  });

  return (
    <View style={styles.radarContainer}>
      {/* Outer concentric rings */}
      <View style={[styles.radarCircle, styles.radarOuterCircle]} />
      <View style={[styles.radarCircle, styles.radarMiddleCircle]} />
      <View style={[styles.radarCircle, styles.radarInnerCircle]} />

      {/* Axis crosslines */}
      <View style={styles.radarLineHorizontal} />
      <View style={styles.radarLineVertical} />

      {/* Pulsing wave animations */}
      {isScanning && (
        <>
          <Animated.View
            style={[
              styles.radarPulseWave,
              { transform: [{ scale: scale1 }], opacity: opacity1 },
            ]}
          />
          <Animated.View
            style={[
              styles.radarPulseWave,
              { transform: [{ scale: scale2 }], opacity: opacity2 },
            ]}
          />
          <Animated.View
            style={[
              styles.radarSweepLineContainer,
              { transform: [{ rotate: spin }] },
            ]}>
            <View style={styles.radarSweepBeam} />
          </Animated.View>
        </>
      )}

      {/* Self Center Node */}
      <View style={styles.centerNode}>
        <View style={styles.centerNodePulse} />
      </View>

      {/* Floating Device Markers */}
      {deviceMarkers.map(({ device, x, y }) => (
        <Pressable
          key={device.id}
          onPress={() => onSelectDevice(device)}
          style={({ pressed }) => [
            styles.deviceMarker,
            device.isSahaDevice
              ? styles.sahaDeviceMarker
              : styles.bleDeviceMarker,
            {
              transform: [{ translateX: x }, { translateY: y }],
            },
            pressed && styles.markerPressed,
          ]}>
          <View
            style={[
              styles.markerDot,
              { backgroundColor: device.isSahaDevice ? '#10B981' : '#3B82F6' },
            ]}
          />
        </Pressable>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                               STATUS BANNER                                */
/* -------------------------------------------------------------------------- */

function StatusBanner({
  status,
  bluetoothState,
  isScanning,
  deviceCount,
  sahaCount,
  scanSeconds,
  errorMessage,
  onStartScan,
}: {
  status: string;
  bluetoothState: string;
  isScanning: boolean;
  deviceCount: number;
  sahaCount: number;
  scanSeconds: number;
  errorMessage: string;
  onStartScan: () => void;
}) {
  let title = 'Ready to scan';
  let statusColor = '#10B981';
  let description = "Tap 'Scan' to search for nearby SAHA nodes & BLE signals.";

  if (isScanning) {
    title = 'Scanning for nearby devices...';
    statusColor = '#3B82F6';
    description = `Active scan running (${scanSeconds}s / 10s timeout)...`;
  } else if (status === 'permission-denied') {
    title = 'Bluetooth permission is required';
    statusColor = '#F59E0B';
    description =
      errorMessage ||
      'Bluetooth & Location permissions are required to scan nearby devices.';
  } else if (
    status === 'bluetooth-unavailable' ||
    bluetoothState === 'Unavailable'
  ) {
    title = 'Development build required';
    statusColor = '#EF4444';
    description =
      'SAHA BLE scanning requires the native development build (react-native-ble-plx is unavailable in Expo Go).';
  } else if (status === 'bluetooth-off' || bluetoothState === 'PoweredOff') {
    title = 'Bluetooth is turned off';
    statusColor = '#F59E0B';
    description = 'Turn on Bluetooth on your device to scan for nearby nodes.';
  } else if (status === 'scan-complete') {
    title =
      deviceCount > 0
        ? `${deviceCount} nearby device${deviceCount === 1 ? '' : 's'}`
        : 'No nearby devices found';
    statusColor = '#10B981';
    description = `Discovered ${sahaCount} SAHA node${
      sahaCount === 1 ? '' : 's'
    } and ${deviceCount} total BLE signals.`;
  } else if (status === 'error') {
    title = 'Unable to scan for nearby devices';
    statusColor = '#EF4444';
    description = errorMessage || 'Failed to execute BLE discovery.';
  }

  return (
    <View style={styles.statusBannerCard}>
      <View style={styles.statusHeaderRow}>
        <View style={styles.statusTitleGroup}>
          <View style={styles.statusDotContainer}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            {isScanning && (
              <ActivityIndicator
                size="small"
                color={statusColor}
              />
            )}
          </View>
          <Text style={styles.statusTitleText}>{title}</Text>
        </View>

        {!isScanning && (
          <Pressable
            onPress={onStartScan}
            style={({ pressed }) => [
              styles.rescanButton,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={styles.rescanButtonText}>Rescan</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.statusDescription}>{description}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                DEVICE CARD                                 */
/* -------------------------------------------------------------------------- */

function DeviceCard({
  device,
  onPress,
}: {
  device: DiscoveredDevice;
  onPress: () => void;
}) {
  const isSaha = device.isSahaDevice;
  const name = device.name ?? (isSaha ? 'SAHA Node' : 'Unknown BLE Device');
  const rssiMeta = getRssiMetadata(device.rssi);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.deviceCard,
        isSaha ? styles.sahaCardBorder : styles.bleCardBorder,
        pressed && styles.buttonPressed,
      ]}>
      <View
        style={[
          styles.deviceCardAccent,
          { backgroundColor: isSaha ? '#10B981' : '#3B82F6' },
        ]}
      />
      <View style={styles.deviceCardMain}>
        <View style={styles.deviceCardHeader}>
          <View style={styles.deviceTagGroup}>
            <Text
              style={[
                styles.deviceTypeTag,
                { color: isSaha ? '#059669' : '#2563EB' },
              ]}>
              {isSaha ? '● SAHA Node' : '○ BLE Signal'}
            </Text>
            <View
              style={[
                styles.proximityBadge,
                { backgroundColor: rssiMeta.color + '22' },
              ]}>
              <Text
                style={[styles.proximityBadgeText, { color: rssiMeta.color }]}>
                {rssiMeta.label}
              </Text>
            </View>
          </View>

          <Text style={styles.rssiText}>
            {device.rssi != null ? `${device.rssi} dBm` : '--'}
          </Text>
        </View>

        <Text
          style={styles.deviceNameText}
          numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.deviceSubRow}>
          <Text
            style={styles.deviceIdText}
            numberOfLines={1}>
            ID: {device.id}
          </Text>
          <Text style={styles.distanceEstimateText}>{rssiMeta.distance}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*                              EMPTY STATE VIEW                              */
/* -------------------------------------------------------------------------- */

function EmptyStateView({
  isScanning,
  status,
  errorMessage,
  onStartScan,
}: {
  isScanning: boolean;
  status: string;
  errorMessage: string;
  onStartScan: () => void;
}) {
  let title = 'No nearby devices found';
  let message =
    "No active Bluetooth devices detected in range. Tap 'Scan Again' to restart radar.";
  let actionText = 'Scan Again';

  if (isScanning) {
    title = 'Scanning for nearby devices...';
    message =
      'Scanning radio channels for SAHA compatible hardware & Bluetooth signals...';
    actionText = '';
  } else if (status === 'permission-denied') {
    title = 'Bluetooth permission is required';
    message =
      errorMessage ||
      'Bluetooth & Location permissions are required to scan nearby devices.';
    actionText = 'Grant Permissions';
  } else if (status === 'bluetooth-off') {
    title = 'Bluetooth is turned off';
    message = 'Turn on Bluetooth on your device to scan for nearby nodes.';
    actionText = 'Try Again';
  } else if (status === 'bluetooth-unavailable') {
    title = 'Development build required';
    message =
      'SAHA BLE scanning requires the native development build. Standard Expo Go does not include native BLE drivers.';
    actionText = 'Retry Scan';
  } else if (status === 'error') {
    title = 'Unable to scan for nearby devices';
    message = errorMessage || 'An unexpected error occurred while scanning.';
    actionText = 'Try Again';
  }

  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {!isScanning && (
        <Pressable
          onPress={onStartScan}
          style={({ pressed }) => [
            styles.emptyActionButton,
            pressed && styles.buttonPressed,
          ]}>
          <Text style={styles.emptyActionText}>{actionText}</Text>
        </Pressable>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                             DEVICE DETAIL MODAL                            */
/* -------------------------------------------------------------------------- */

function DeviceDetailModal({
  device,
  lastConnectionTest,
  setLastConnectionTest,
  onClose,
}: {
  device: DiscoveredDevice;
  lastConnectionTest: ConnectionTestResult | null;
  setLastConnectionTest: (result: ConnectionTestResult | null) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const rssiMeta = getRssiMetadata(device.rssi);

  const [testRunning, setTestRunning] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);

  const handleOpenChat = () => {
    onClose();
    router.push({
      pathname: '/conversation' as any,
      params: {
        deviceId: device.id,
        deviceName:
          device.name ?? 'SAHA Node',
        transport: 'central',
      },
    });
  };

  const handleRunTest = async () => {
    setTestRunning(true);
    setLastConnectionTest(null);
    setTestLogs([]);

    const result = await runSahaConnectionTest(device.id, (_state, logLine) => {
      setTestLogs((prev) => [...prev, logLine]);
    });

    setLastConnectionTest(result);
    setTestRunning(false);
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTag}>
                {device.isSahaDevice
                  ? 'SAHA Compatible Node'
                  : 'BLE Radio Beacon'}
              </Text>
              <Text style={styles.modalTitle}>
                {device.name ?? 'Unknown BLE Device'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.modalInfoGrid}>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Identifier (ID):</Text>
              <Text style={styles.modalInfoValue}>{device.id}</Text>
            </View>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Signal Strength:</Text>
              <Text style={[styles.modalInfoValue, { color: rssiMeta.color }]}>
                {device.rssi != null
                  ? `${device.rssi} dBm (${rssiMeta.label})`
                  : 'Unknown'}
              </Text>
            </View>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Proximity Estimate:</Text>
              <Text style={styles.modalInfoValue}>{rssiMeta.distance}</Text>
            </View>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>SAHA Mesh Capability:</Text>
              <Text
                style={[
                  styles.modalInfoValue,
                  { color: device.isSahaDevice ? '#10B981' : '#6B7280' },
                ]}>
                {device.isSahaDevice
                  ? 'Supported (Matching Service/Name)'
                  : 'Standard BLE Signal'}
              </Text>
            </View>
          </View>

          {/* Primary Chat Action */}
          <Pressable
            onPress={handleOpenChat}
            style={({ pressed }) => [
              styles.chatModalButton,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={styles.chatModalButtonText}>
              💬 Start BLE Chat Session
            </Text>
          </Pressable>

          {/* Test Connectivity Action (Ping / Pong) */}
          <View style={styles.testContainer}>
            <Pressable
              disabled={testRunning}
              onPress={handleRunTest}
              style={({ pressed }) => [
                styles.testButton,
                testRunning && styles.testButtonDisabled,
                pressed && styles.buttonPressed,
              ]}>
              {testRunning ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Text style={styles.testButtonText}>
                  {device.isSahaDevice
                    ? 'Connect & Test Ping/Pong'
                    : 'Connect & Read Device'}
                </Text>
              )}
            </Pressable>

            {testLogs.length > 0 && (
              <ScrollView
                style={styles.logsBox}
                nestedScrollEnabled>
                {testLogs.map((line, idx) => (
                  <Text
                    key={idx}
                    style={styles.logText}>
                    {line}
                  </Text>
                ))}
                {lastConnectionTest && (
                  <Text
                    style={[
                      styles.logResultText,
                      {
                        color: lastConnectionTest.success
                          ? '#10B981'
                          : '#EF4444',
                      },
                    ]}>
                    {lastConnectionTest.success
                      ? `SUCCESS! Read Identity: "${lastConnectionTest.readIdentity}", Received Notification: "${lastConnectionTest.receivedNotification}"`
                      : `FAILED: ${lastConnectionTest.errorMessage}`}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.modalDoneButton,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={styles.modalDoneText}>Close Details</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  scrollContentCompact: {
    paddingHorizontal: 14,
  },
  topHeader: {
    minHeight: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  scanToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#2563EB',
  },
  scanToggleButtonActive: {
    backgroundColor: '#DC2626',
  },
  scanToggleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  /* Radar visual */
  radarContainer: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 24,
  },
  radarCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  radarOuterCircle: {
    width: 240,
    height: 240,
  },
  radarMiddleCircle: {
    width: 160,
    height: 160,
  },
  radarInnerCircle: {
    width: 80,
    height: 80,
  },
  radarLineHorizontal: {
    position: 'absolute',
    width: 240,
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  radarLineVertical: {
    position: 'absolute',
    height: 240,
    width: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  radarPulseWave: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  radarSweepLineContainer: {
    position: 'absolute',
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarSweepBeam: {
    position: 'absolute',
    top: 0,
    width: 120,
    height: 120,
    borderTopRightRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  centerNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowRadius: 10,
    shadowOpacity: 0.8,
  },
  centerNodePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },

  /* Floating device marker on radar */
  deviceMarker: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sahaDeviceMarker: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowRadius: 8,
    shadowOpacity: 0.9,
  },
  bleDeviceMarker: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowRadius: 6,
    shadowOpacity: 0.7,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  markerPressed: {
    transform: [{ scale: 1.2 }],
  },

  /* Status Banner */
  statusBannerCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitleText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  statusDescription: {
    marginTop: 8,
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  rescanButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  rescanButtonText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Filter Tabs */
  filterTabsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: '#0F172A',
    borderColor: '#38BDF8',
  },
  filterTabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  filterTabTextActive: {
    color: '#38BDF8',
    fontWeight: '900',
  },

  /* Device List & Card */
  devicesList: {
    gap: 10,
  },
  deviceCard: {
    minHeight: 80,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderWidth: 1,
  },
  sahaCardBorder: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  bleCardBorder: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  deviceCardAccent: {
    width: 5,
  },
  deviceCardMain: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceTagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceTypeTag: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  proximityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proximityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  rssiText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  deviceNameText: {
    marginTop: 4,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  deviceSubRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceIdText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  distanceEstimateText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Empty State */
  emptyContainer: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyMessage: {
    marginTop: 6,
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  emptyActionButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#2563EB',
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTag: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalTitle: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  modalCloseButton: {
    padding: 6,
  },
  modalCloseText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '800',
  },
  modalInfoGrid: {
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalInfoLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalInfoValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 1,
  },
  chatModalButton: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatModalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  testContainer: {
    marginTop: 10,
  },
  testButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonDisabled: {
    backgroundColor: '#059669',
    opacity: 0.7,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  logsBox: {
    maxHeight: 140,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  logText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
  logResultText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalDoneButton: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  modalDoneText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
