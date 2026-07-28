import type { DeviceState, DeviceType, DeviceCapabilities, MultiDeviceState } from "@ai-agent/ambient-types";

export interface MultiDeviceSensor {
  getState(): Promise<MultiDeviceState>;
  getDevices(): Promise<ReadonlyArray<DeviceState>>;
  getDevice(deviceId: string): Promise<DeviceState | null>;
  getPrimaryDevice(): Promise<DeviceState | null>;
  registerDevice(device: DeviceState): void;
  updateDevice(deviceId: string, update: Partial<DeviceState>): void;
  isAvailable(): boolean;
  onChange(handler: (state: MultiDeviceState) => void): () => void;
}

export interface MultiDeviceConfig {
  readonly enabled: boolean;
  readonly deviceId: string;
  readonly deviceType: DeviceType;
  readonly deviceName: string;
  readonly syncIntervalMs: number;
}
