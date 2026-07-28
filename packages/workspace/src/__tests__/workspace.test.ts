import { describe, it, expect, beforeEach } from "vitest";
import { DefaultWorkspaceSensor } from "../impl/default-workspace-sensor.js";

describe("DefaultWorkspaceSensor", () => {
  let sensor: DefaultWorkspaceSensor;

  beforeEach(() => {
    sensor = new DefaultWorkspaceSensor();
  });

  it("should take a snapshot", async () => {
    const snapshot = await sensor.snapshot();
    expect(snapshot.timestamp).toBeGreaterThan(0);
    expect(snapshot.openApplications).toBeDefined();
    expect(snapshot.browserTabs).toBeDefined();
  });

  it("should report availability", () => {
    expect(sensor.isAvailable()).toBe(true);
  });

  it("should track last snapshot", async () => {
    expect(sensor.getLastSnapshot()).toBeNull();
    await sensor.snapshot();
    expect(sensor.getLastSnapshot()).not.toBeNull();
  });

  it("should notify on change", async () => {
    let called = false;
    sensor.onChange(() => { called = true; });
    await sensor.snapshot();
    expect(called).toBe(true);
  });

  it("should return empty applications by default", async () => {
    const apps = await sensor.getOpenApplications();
    expect(apps.length).toBe(0);
  });
});
