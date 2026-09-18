import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import type { DiscoveredDevice } from '@/ble/types';
import { NearbyDesign } from '@/design/NearbyDesign';
import { useBleContext } from '@/hooks/BleContext';

export default function NearbyScreen() {
  const router = useRouter();
  const { scanner } = useBleContext();
  const {
    bluetoothState,
    status,
    devices,
    errorMessage,
    isScanning,
    startScan,
  } = scanner;

  useEffect(() => {
    startScan();
  }, [startScan]);

  const handleConnect = (device: DiscoveredDevice) => {
    router.push({
      pathname: '/conversation',
      params: {
        deviceId: device.id,
        deviceName:
          device.name ?? 'SAHA Node',
        transport: 'central',
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NearbyDesign
        devices={devices}
        bluetoothState={bluetoothState}
        status={status}
        errorMessage={errorMessage}
        isScanning={isScanning}
        onScanAgain={startScan}
        onConnect={handleConnect}
      />
    </>
  );
}
