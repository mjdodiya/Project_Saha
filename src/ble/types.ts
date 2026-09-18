import type { State } from 'react-native-ble-plx';

export type BluetoothState = State | 'Unavailable';

export type DiscoveredDevice = {
  id: string;
  name: string | null;
  rssi: number | null;
  isSahaDevice: boolean;
  serviceUUIDs?: string[] | null;
};

export type BleScannerStatus =
  | 'idle'
  | 'checking'
  | 'permission-denied'
  | 'bluetooth-unavailable'
  | 'bluetooth-off'
  | 'scanning'
  | 'scan-complete'
  | 'error';

export type BleScanResult = {
  devices: DiscoveredDevice[];
  totalDeviceCount: number;
};

export type PeripheralStatus =
  | 'Stopped'
  | 'Initializing'
  | 'Service Registration Pending'
  | 'Service Registration Failed'
  | 'Advertising Pending'
  | 'Advertising'
  | 'Advertising Failed'
  | 'Connected'
  | 'Bluetooth Off'
  | 'Unavailable';

export type PeripheralInfo = {
  status: PeripheralStatus;
  nodeId: string;
  advertisingName: string;
  errorMessage?: string | null;
  serviceRegistrationState?: 'idle' | 'pending' | 'registered' | 'failed';
  serviceRegistrationStatusCode?: number | null;
  advertisingState?: 'idle' | 'pending' | 'active' | 'failed';
  serviceRegistrationPending?: boolean;
  serviceRegistered?: boolean;
  advertisingStartPending?: boolean;
  advertisingStarted?: boolean;
  advertisingFailureCode?: number | null;
  advertisingFailureReason?: string | null;
};

export type ConnectionTestState =
  | 'idle'
  | 'connecting'
  | 'discovering'
  | 'reading_identity'
  | 'subscribing_tx'
  | 'writing_ping'
  | 'ping_pong_success'
  | 'error';

export type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  /** Bluetooth identifier for the peer that carried this message. */
  peerDeviceId?: string;
  /** The local BLE role used to receive this message. */
  receivedVia?: 'central' | 'peripheral';
  content: string;
  text: string;
  timestamp: number;
  isSelf: boolean;
  status: 'sending' | 'sent' | 'received' | 'failed';
};

export type ChatConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'discovering'
  | 'connected'
  | 'error';
