export function createMockPaymentRequest(deviceId: string = 'test_device_123'): { amount: number; deviceType: string; deviceId: string; description: string; } {
  return {
    amount: 25.99,
    deviceType: 'smartphone',
    deviceId: deviceId,
    description: 'Test payment'
  };
}

export function createMockDeviceRegistration() {
  return {
    deviceType: 'smartphone',
    capabilities: { 
      internet_connection: true, 
      nfc: true, 
      camera: true,
      display: 'touchscreen'
    },
    fingerprint: `test_fingerprint_${Math.random().toString(36).substring(2)}`
  };
}