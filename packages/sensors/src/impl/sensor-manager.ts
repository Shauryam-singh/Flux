import type {
  Sensor,
  SensorCategory,
  SensorEvent,
  SensorId,
  SensorManager,
  SensorManagerState,
} from "../types/sensor.js";

export class DefaultSensorManager implements SensorManager {
  private sensors: Map<SensorId, Sensor<unknown>> = new Map();
  private eventHandlers: Array<(event: SensorEvent<unknown>) => void> = [];
  private sensorUnsubscribers: Map<SensorId, Array<() => void>> = new Map();
  private startTime: number;
  private totalEvents = 0;

  constructor() {
    this.startTime = Date.now();
  }

  register<T>(sensor: Sensor<T>): void {
    this.sensors.set(sensor.metadata.id, sensor as Sensor<unknown>);
  }

  get<T>(id: SensorId): Sensor<T> | null {
    return (this.sensors.get(id) as Sensor<T>) ?? null;
  }

  async startAll(): Promise<void> {
    const startPromises = [...this.sensors.values()].map(async (sensor) => {
      if (sensor.isAvailable()) {
        try {
          await sensor.start();
          this.subscribeToSensor(sensor);
        } catch {
          // Sensor start errors are non-fatal
        }
      }
    });
    await Promise.allSettled(startPromises);
  }

  async stopAll(): Promise<void> {
    const stopPromises = [...this.sensors.values()].map(async (sensor) => {
      this.unsubscribeFromSensor(sensor.metadata.id);
      try {
        await sensor.stop();
      } catch {
        // Sensor stop errors are non-fatal
      }
    });
    await Promise.allSettled(stopPromises);
  }

  async startSensor(id: SensorId): Promise<void> {
    const sensor = this.sensors.get(id);
    if (!sensor) return;
    if (!sensor.isAvailable()) return;

    try {
      await sensor.start();
      this.subscribeToSensor(sensor);
    } catch {
      // Non-fatal
    }
  }

  async stopSensor(id: SensorId): Promise<void> {
    const sensor = this.sensors.get(id);
    if (!sensor) return;

    this.unsubscribeFromSensor(id);
    try {
      await sensor.stop();
    } catch {
      // Non-fatal
    }
  }

  getAll(): ReadonlyArray<Sensor<unknown>> {
    return [...this.sensors.values()];
  }

  getByCategory(category: SensorCategory): ReadonlyArray<Sensor<unknown>> {
    return [...this.sensors.values()].filter(
      (s) => s.metadata.category === category,
    );
  }

  getState(): SensorManagerState {
    const sensors = [...this.sensors.values()];
    const running = sensors.filter(
      (s) => s.getState().status === "running",
    ).length;
    const errors = sensors.filter(
      (s) => s.getState().status === "error",
    ).length;

    return {
      totalSensors: sensors.length,
      runningSensors: running,
      errorSensors: errors,
      totalEvents: this.totalEvents,
      uptime: Date.now() - this.startTime,
    };
  }

  onEvent(handler: (event: SensorEvent<unknown>) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) this.eventHandlers.splice(idx, 1);
    };
  }

  private subscribeToSensor(sensor: Sensor<unknown>): void {
    const id = sensor.metadata.id;
    const unsub = sensor.onChange((event) => {
      this.totalEvents++;
      for (const handler of this.eventHandlers) {
        try {
          handler(event);
        } catch {
          // Handler errors are non-fatal
        }
      }
    });

    if (!this.sensorUnsubscribers.has(id)) {
      this.sensorUnsubscribers.set(id, []);
    }
    this.sensorUnsubscribers.get(id)!.push(unsub);
  }

  private unsubscribeFromSensor(id: SensorId): void {
    const unsubs = this.sensorUnsubscribers.get(id);
    if (unsubs) {
      for (const unsub of unsubs) {
        unsub();
      }
      this.sensorUnsubscribers.delete(id);
    }
  }
}
