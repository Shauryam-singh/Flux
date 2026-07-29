import type {
  ObservationPriority,
  ObservationSource,
} from "@ai-agent/attention";
import { describe, expect, it } from "vitest";
import { BaseSensor } from "../impl/base-sensor.js";
import { DefaultSensorManager } from "../impl/sensor-manager.js";
import { DockerSensor } from "../impl/sensors/docker-sensor.js";
import { FileSystemSensor } from "../impl/sensors/filesystem-sensor.js";
import { GitSensor } from "../impl/sensors/git-sensor.js";
import type { SensorMetadata } from "../types/sensor.js";

class TestSensor extends BaseSensor<string> {
  private testData = "test";

  constructor() {
    super({
      id: "test",
      name: "Test Sensor",
      description: "A test sensor",
      category: "linux",
      platform: "all",
      version: "1.0.0",
    });
  }

  protected async onStart(): Promise<void> {}
  protected async onStop(): Promise<void> {}
  protected async onSnapshot(): Promise<string> {
    return this.testData;
  }
  protected async onRefresh(): Promise<string | null> {
    return this.testData;
  }
  protected getEventSource(): ObservationSource {
    return "system";
  }
  protected getEventPriority(): ObservationPriority {
    return "low";
  }
}

describe("SensorManager", () => {
  it("should register and retrieve sensors", () => {
    const manager = new DefaultSensorManager();
    const sensor = new TestSensor();
    manager.register(sensor);

    expect(manager.getAll()).toHaveLength(1);
    expect(manager.get("test")).toBeTruthy();
    expect(manager.get("nonexistent")).toBeNull();
  });

  it("should get sensors by category", () => {
    const manager = new DefaultSensorManager();
    const sensor = new TestSensor();
    manager.register(sensor);

    const linuxSensors = manager.getByCategory("linux");
    expect(linuxSensors).toHaveLength(1);
    expect(linuxSensors[0]!.metadata.id).toBe("test");
  });

  it("should track state", () => {
    const manager = new DefaultSensorManager();
    const state = manager.getState();

    expect(state.totalSensors).toBe(0);
    expect(state.runningSensors).toBe(0);
    expect(state.errorSensors).toBe(0);
    expect(state.totalEvents).toBe(0);
    expect(state.uptime).toBeGreaterThanOrEqual(0);
  });

  it("should subscribe to events", () => {
    const manager = new DefaultSensorManager();
    let eventReceived = false;
    manager.onEvent(() => {
      eventReceived = true;
    });
    expect(eventReceived).toBe(false);
  });
});

describe("BaseSensor", () => {
  it("should check availability", () => {
    const sensor = new TestSensor();
    expect(sensor.isAvailable()).toBe(true); // "all" platform
  });

  it("should track state", async () => {
    const sensor = new TestSensor();
    expect(sensor.getState().status).toBe("idle");

    await sensor.start();
    expect(sensor.getState().status).toBe("running");

    await sensor.stop();
    expect(sensor.getState().status).toBe("idle");
  });

  it("should get snapshots", async () => {
    const sensor = new TestSensor();
    const snapshot = await sensor.snapshot();
    expect(snapshot).toBe("test");
  });
});

describe("GitSensor", () => {
  it("should have correct metadata", () => {
    const sensor = new GitSensor("/tmp");
    expect(sensor.metadata.id).toBe("git");
    expect(sensor.metadata.name).toBe("Git Sensor");
    expect(sensor.metadata.category).toBe("git");
  });
});

describe("FileSystemSensor", () => {
  it("should have correct metadata", () => {
    const sensor = new FileSystemSensor(["/tmp"]);
    expect(sensor.metadata.id).toBe("filesystem");
    expect(sensor.metadata.name).toBe("File System Sensor");
    expect(sensor.metadata.category).toBe("filesystem");
  });
});

describe("DockerSensor", () => {
  it("should have correct metadata", () => {
    const sensor = new DockerSensor();
    expect(sensor.metadata.id).toBe("docker");
    expect(sensor.metadata.name).toBe("Docker Sensor");
    expect(sensor.metadata.category).toBe("process");
  });
});
