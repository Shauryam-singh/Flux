import { describe, it, expect, beforeEach } from "vitest";
import { DefaultMultiDeviceSensor } from "../impl/default-multi-device-sensor.js";

describe("DefaultMultiDeviceSensor", () => {
  let sensor: DefaultMultiDeviceSensor;

  beforeEach(() => {
    sensor = new DefaultMultiDeviceSensor();
  });

  it("should have local device registered", async () => {
    const devices = await sensor.getDevices();
    expect(devices.length).toBe(1);
    expect(devices[0]!.deviceId).toBe("local");
  });

  it("should get primary device", async () => {
    const primary = await sensor.getPrimaryDevice();
    expect(primary).not.toBeNull();
    expect(primary!.deviceType).toBe("desktop");
  });

  it("should register new devices", async () => {
    sensor.registerDevice({
      deviceId: "mobile",
      deviceType: "mobile",
      name: "iPhone",
      platform: "ios",
      isOnline: true,
      lastSeen: Date.now(),
      batteryLevel: 0.8,
      networkType: "wifi",
      capabilities: { hasCamera: true, hasMicrophone: true, hasGPS: true, hasAccelerometer: true, hasBiometrics: true, hasTouchscreen: true, hasKeyboard: false },
      currentActivity: null,
      focusState: "background",
    });
    const devices = await sensor.getDevices();
    expect(devices.length).toBe(2);
  });

  it("should update device state", async () => {
    await sensor.updateDevice("local", { batteryLevel: 0.5 });
    const device = await sensor.getDevice("local");
    expect(device!.batteryLevel).toBe(0.5);
  });

  it("should report multi-device state", async () => {
    const state = await sensor.getState();
    expect(state.primaryDevice).not.toBeNull();
    expect(state.devices.length).toBe(1);
  });

  it("should report availability", () => {
    expect(sensor.isAvailable()).toBe(true);
  });
});
