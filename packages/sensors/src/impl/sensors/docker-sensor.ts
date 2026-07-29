import type {
  ObservationPriority,
  ObservationSource,
} from "@ai-agent/attention";
import type { SensorEvent, SensorMetadata } from "../../types/sensor.js";
import { BaseSensor } from "../base-sensor.js";

export interface DockerContainer {
  readonly id: string;
  readonly name: string;
  readonly image: string;
  readonly status:
    | "running"
    | "stopped"
    | "exited"
    | "created"
    | "paused"
    | "restarting";
  readonly state: string;
  readonly ports: string;
  readonly created: number;
  readonly startedAt: number | null;
}

export interface DockerEvent {
  readonly type:
    | "start"
    | "stop"
    | "die"
    | "create"
    | "pause"
    | "unpause"
    | "restart";
  readonly containerId: string;
  readonly containerName: string;
  readonly image: string;
  readonly timestamp: number;
}

export interface DockerState {
  readonly containers: ReadonlyArray<DockerContainer>;
  readonly runningCount: number;
  readonly stoppedCount: number;
  readonly totalContainers: number;
  readonly recentEvents: ReadonlyArray<DockerEvent>;
}

const METADATA: SensorMetadata = {
  id: "docker",
  name: "Docker Sensor",
  description: "Monitors Docker container state changes",
  category: "process",
  platform: "all",
  version: "1.0.0",
};

export class DockerSensor extends BaseSensor<DockerState> {
  private lastContainers: Map<string, DockerContainer> = new Map();
  private recentEvents: DockerEvent[] = [];

  constructor(pollIntervalMs = 5000) {
    super(METADATA, pollIntervalMs);
  }

  protected async onStart(): Promise<void> {
    // Initial container list
    const containers = await this.listContainers();
    for (const c of containers) {
      this.lastContainers.set(c.id, c);
    }
  }

  protected async onStop(): Promise<void> {
    this.lastContainers.clear();
    this.recentEvents = [];
  }

  protected async onSnapshot(): Promise<DockerState | null> {
    const containers = await this.listContainers();
    const running = containers.filter((c) => c.status === "running").length;
    const stopped = containers.filter((c) => c.status !== "running").length;

    return {
      containers,
      runningCount: running,
      stoppedCount: stopped,
      totalContainers: containers.length,
      recentEvents: [...this.recentEvents],
    };
  }

  protected async onRefresh(): Promise<DockerState | null> {
    const containers = await this.listContainers();
    const newContainers = new Map(containers.map((c) => [c.id, c]));

    // Detect changes
    for (const [id, newC] of newContainers) {
      const oldC = this.lastContainers.get(id);
      if (!oldC) {
        // New container
        this.addEvent("create", newC);
      } else if (oldC.status !== newC.status) {
        // Status change
        if (newC.status === "running") {
          this.addEvent("start", newC);
        } else if (newC.status === "stopped" || newC.status === "exited") {
          this.addEvent("stop", newC);
        } else if (newC.status === "paused") {
          this.addEvent("pause", newC);
        }
      }
    }

    // Detect removed containers
    for (const [id, oldC] of this.lastContainers) {
      if (!newContainers.has(id)) {
        this.addEvent("die", { ...oldC, status: "exited" as const });
      }
    }

    this.lastContainers = newContainers;

    const running = containers.filter((c) => c.status === "running").length;
    const stopped = containers.filter((c) => c.status !== "running").length;

    return {
      containers,
      runningCount: running,
      stoppedCount: stopped,
      totalContainers: containers.length,
      recentEvents: [...this.recentEvents],
    };
  }

  protected getEventSource(): ObservationSource {
    return "process";
  }

  protected getEventPriority(data: DockerState): ObservationPriority {
    if (data.recentEvents.some((e) => e.type === "die")) return "high";
    if (data.recentEvents.some((e) => e.type === "start" || e.type === "stop"))
      return "medium";
    return "background";
  }

  private addEvent(
    type: DockerEvent["type"],
    container: DockerContainer,
  ): void {
    const event: DockerEvent = {
      type,
      containerId: container.id,
      containerName: container.name,
      image: container.image,
      timestamp: Date.now(),
    };

    this.recentEvents.push(event);
    if (this.recentEvents.length > 20) {
      this.recentEvents = this.recentEvents.slice(-20);
    }

    this.emit({
      sensorId: this.metadata.id,
      timestamp: Date.now(),
      type,
      data: {
        containers: [...this.lastContainers.values()],
        runningCount: [...this.lastContainers.values()].filter(
          (c) => c.status === "running",
        ).length,
        stoppedCount: [...this.lastContainers.values()].filter(
          (c) => c.status !== "running",
        ).length,
        totalContainers: this.lastContainers.size,
        recentEvents: [...this.recentEvents],
      },
      priority:
        type === "die"
          ? "high"
          : type === "start" || type === "stop"
            ? "medium"
            : "low",
      source: "process",
    });
  }

  private async listContainers(): Promise<DockerContainer[]> {
    const output = this.execCommand(
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}" 2>/dev/null',
    );
    if (!output) return [];

    return output
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [id, name, image, status, ports, created] = line.split("|");
        const statusParts = (status ?? "").split(" ");
        const statusKey = statusParts[0]?.toLowerCase() ?? "unknown";

        let containerStatus: DockerContainer["status"] = "created";
        if (statusKey === "up") containerStatus = "running";
        else if (statusKey === "exited") containerStatus = "exited";
        else if (statusKey === "created") containerStatus = "created";
        else if (statusKey === "restarting") containerStatus = "restarting";

        return {
          id: id ?? "",
          name: name ?? "",
          image: image ?? "",
          status: containerStatus,
          state: status ?? "",
          ports: ports ?? "",
          created: Date.parse(created ?? "") || Date.now(),
          startedAt: statusKey === "up" ? Date.now() : null,
        };
      });
  }
}
