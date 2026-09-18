import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import type {
  BleScannerStatus,
  BluetoothState,
  PeripheralStatus,
} from '@/ble/types';
import { HomeDesign } from '@/design/HomeDesign';
import { useBleContext } from '@/hooks/BleContext';

export default function HomeScreen() {
  const router = useRouter();
  const { scanner, peripheral, chat } = useBleContext();
  const [locationLabel, setLocationLabel] = useState(
    'Finding your location...',
  );
  const {
    bluetoothState,
    status: scannerStatus,
    devices,
    totalDeviceCount,
    isScanning,
    startScan,
  } = scanner;
  const { status: peripheralStatus, nodeId } = peripheral;
  const { messages } = chat;

  useEffect(() => {
    let isMounted = true;

    async function loadLocation() {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!isMounted) return;

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationLabel('Location permission is off');
        return;
      }

      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const addresses = await Location.reverseGeocodeAsync(current.coords);
        const address = addresses[0];

        if (isMounted) {
          setLocationLabel(formatLocationLabel(address));
        }
      } catch {
        if (isMounted) setLocationLabel('Location unavailable');
      }
    }

    void loadLocation();
    return () => {
      isMounted = false;
    };
  }, []);

  const nearbyCount = devices.filter((device) => device.isSahaDevice).length;
  const recentMessages = messages.slice(-2).reverse();
  const connectionStatus = getConnectionStatus(
    bluetoothState,
    scannerStatus,
    peripheralStatus,
    isScanning,
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeDesign
        nodeId={nodeId || 'N7'}
        nearbyCount={nearbyCount}
        messageCount={messages.length}
        totalBleSignals={totalDeviceCount}
        locationLabel={locationLabel}
        recentMessages={recentMessages}
        connectionLabel={connectionStatus.label}
        connectionColor={connectionStatus.color}
        isScanning={isScanning}
        onOpenNearby={() => router.push('/nearby')}
        onOpenMessages={() => router.push('/chat')}
        onOpenMessage={(message) =>
          router.push({
            pathname: '/conversation',
            params: {
              deviceId: message.peerDeviceId,
              deviceName: message.isSelf
                ? message.receiverId
                : message.senderId,
              transport: message.receivedVia ?? 'peripheral',
            },
          })
        }
        onDiagnose={() => router.push('/diagnostics')}
        onStartNearbyScan={() => {
          if (!isScanning) startScan();
          router.push('/nearby');
        }}
      />
    </>
  );
}

function getConnectionStatus(
  bluetoothState: BluetoothState,
  scannerStatus: BleScannerStatus,
  peripheralStatus: PeripheralStatus,
  isScanning: boolean,
) {
  if (isScanning) return { label: 'Scanning', color: '#3159DB' };
  if (scannerStatus === 'permission-denied') {
    return { label: 'Permission needed', color: '#E5A526' };
  }
  if (bluetoothState === 'PoweredOff' || scannerStatus === 'bluetooth-off') {
    return { label: 'Bluetooth off', color: '#E5A526' };
  }
  if (
    bluetoothState === 'Unavailable' ||
    scannerStatus === 'bluetooth-unavailable'
  ) {
    return { label: 'Unavailable', color: '#D94B4B' };
  }
  if (bluetoothState === 'PoweredOn') {
    return { label: 'Connected', color: '#1AB66A' };
  }
  if (peripheralStatus === 'Advertising' || peripheralStatus === 'Connected') {
    return { label: 'Connected', color: '#1AB66A' };
  }
  return { label: 'Checking', color: '#A0A09B' };
}

function formatLocationLabel(
  address: Location.LocationGeocodedAddress | undefined,
) {
  if (!address) return 'Current location';

  const street = [address.streetNumber, address.street]
    .filter(Boolean)
    .join(' ');
  const locality = address.city || address.subregion || address.region;
  const label = [street, locality].filter(Boolean).join(', ');

  return label || address.name || address.country || 'Current location ';
}
