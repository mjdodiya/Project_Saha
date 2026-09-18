/**
 * The SAHA BLE GATT contract. Native and JavaScript BLE implementations must
 * import these identifiers rather than declaring their own UUID values.
 */
export const SAHA_SERVICE_UUID = 'a3c8e001-4f1e-4d89-9a70-3c1d9f8e4b01';
export const IDENTITY_CHARACTERISTIC_UUID =
  'a3c8e002-4f1e-4d89-9a70-3c1d9f8e4b01';
export const RX_CHARACTERISTIC_UUID = 'a3c8e003-4f1e-4d89-9a70-3c1d9f8e4b01';
export const TX_CHARACTERISTIC_UUID = 'a3c8e004-4f1e-4d89-9a70-3c1d9f8e4b01';

export const SAHA_GATT_CONTRACT = {
  serviceUuid: SAHA_SERVICE_UUID,
  identity: {
    uuid: IDENTITY_CHARACTERISTIC_UUID,
    properties: ['read'],
  },
  rx: {
    uuid: RX_CHARACTERISTIC_UUID,
    properties: ['write', 'writeWithoutResponse'],
  },
  tx: {
    uuid: TX_CHARACTERISTIC_UUID,
    properties: ['notify'],
  },
} as const;

export const SAHA_BLE_CONFIG = {
  scanTimeoutMs: 10000,
  requestedMtu: 185,
  maxTransportPayloadBytes: 182,
} as const;
