import type { MultiDeviceSensor, MultiDeviceConfig } from "../interfaces/multi-device-sensor.js";
import type { DeviceState, MultiDeviceState, DeviceCapabilities } from "@ai-agent/ambient-types";

const DEFAULT_CAPABILITIES: DeviceCapabilities = {
  hasCamera: false,
  hasMicrophone: false,
  hasGPS: false,
  hasAccelerometer: false,
  hasBiometrics: false,
  hasTouchscreen: false,
  hasKeyboard: true,
};

const DEFAULT_CONFIG: MultiDeviceConfig = {
  enabled: true,
  deviceId: "local",
  deviceType: "desktop",
  deviceName: "Local Machine",
  syncIntervalMs: 5000,
};

export class DefaultMultiDeviceSensor implements MultiDeviceSensor {
  private config: MultiDeviceConfig;
  private devices: Map<string, DeviceState> = new Map();
  private handlers: Array<(state: MultiDeviceState) => void> = [];

  constructor(config?: Partial<MultiDeviceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registerDevice({
      deviceId: this.config.deviceId,
      deviceType: this.config.deviceType,
      name: this.config.deviceName,
      platform: process.platform,
      isOnline: true,
      lastSeen: Date.now(),
      batteryLevel: null,
      networkType: "ethernet",
      capabilities: { ...DEFAULT_CAPABILITIES },
      currentActivity: null,
      focusState: "focused",
    });
  }

  async getState(): Promise<MultiDeviceState> {
    const devices = Array.from(this.devices.values());
    const primary = devices.find((d) => d.deviceId === this.config.deviceId) ?? null;
    return {
      devices,
      primaryDevice: primary,
      allDevicesOnline: devices.every((d) => d.isOnline),
      crossDeviceContinuity: devices.length > 1,
    };
  }

  async getDevices(): Promise<ReadonlyArray<DeviceState>> {
    return Array.from(this.devices.values());
  }

  async getDevice(deviceId: string): Promise<DeviceState | null> {
    return this.devices.get(deviceId) ?? null;
  }

  async getPrimaryDevice(): Promise<DeviceState | null> {
    return this.devices.get(this.config.deviceId) ?? null;
  }

  registerDevice(device: DeviceState): void {
    this.devices.set(device.deviceId, device);
    this.emit();
  }

  updateDevice(deviceId: string, update: Partial<DeviceState>): void {
    const existing = this.devices.get(deviceId);
    if (existing) {
      this.devices.set(deviceId, { ...existing, ...update });
      this.emit();
    }
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  onChange(handler: (state: MultiDeviceState) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  private emit(): void {
    this.getState().then((state) => {
      for (const handler of this.handlers) {
        handler(state);
      }
    });
  }
}
