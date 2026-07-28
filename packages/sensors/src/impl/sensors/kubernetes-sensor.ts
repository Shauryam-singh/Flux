import { BaseSensor } from "../base-sensor.js";
import type { SensorMetadata, SensorEvent } from "../../types/sensor.js";
import type { ObservationSource, ObservationPriority } from "@ai-agent/attention";

export interface K8sPod {
  readonly name: string;
  readonly namespace: string;
  readonly status: "Running" | "Pending" | "Succeeded" | "Failed" | "Unknown";
  readonly ready: boolean;
  readonly restarts: number;
  readonly age: string;
  readonly node: string | null;
}

export interface K8sEvent {
  readonly type: "pod_created" | "pod_deleted" | "pod_failed" | "pod_ready" | "pod_restarted";
  readonly podName: string;
  readonly namespace: string;
  readonly timestamp: number;
}

export interface KubernetesState {
  readonly pods: ReadonlyArray<K8sPod>;
  readonly runningCount: number;
  readonly failedCount: number;
  readonly pendingCount: number;
  readonly recentEvents: ReadonlyArray<K8sEvent>;
  readonly context: string | null;
  readonly namespace: string;
}

const METADATA: SensorMetadata = {
  id: "kubernetes",
  name: "Kubernetes Sensor",
  description: "Monitors Kubernetes pod state via kubectl",
  category: "process",
  platform: "all",
  version: "1.0.0",
};

export class KubernetesSensor extends BaseSensor<KubernetesState> {
  private lastPods: Map<string, K8sPod> = new Map();
  private recentEvents: K8sEvent[] = [];
  private readonly namespace: string;

  constructor(namespace = "default", pollIntervalMs = 10000) {
    super(METADATA, pollIntervalMs);
    this.namespace = namespace;
  }

  protected async onStart(): Promise<void> {
    const pods = await this.listPods();
    for (const p of pods) {
      this.lastPods.set(p.name, p);
    }
  }

  protected async onStop(): Promise<void> {
    this.lastPods.clear();
    this.recentEvents = [];
  }

  protected async onSnapshot(): Promise<KubernetesState | null> {
    const pods = await this.listPods();
    const context = this.execCommand("kubectl config current-context 2>/dev/null");

    return {
      pods,
      runningCount: pods.filter((p) => p.status === "Running").length,
      failedCount: pods.filter((p) => p.status === "Failed").length,
      pendingCount: pods.filter((p) => p.status === "Pending").length,
      recentEvents: [...this.recentEvents],
      context: context || null,
      namespace: this.namespace,
    };
  }

  protected async onRefresh(): Promise<KubernetesState | null> {
    const pods = await this.listPods();
    const newPods = new Map(pods.map((p) => [p.name, p]));
    const context = this.execCommand("kubectl config current-context 2>/dev/null");

    // Detect changes
    for (const [name, newP] of newPods) {
      const oldP = this.lastPods.get(name);
      if (!oldP) {
        this.addEvent("pod_created", name);
      } else if (oldP.status !== newP.status) {
        if (newP.status === "Failed") {
          this.addEvent("pod_failed", name);
        } else if (newP.status === "Running" && newP.ready) {
          this.addEvent("pod_ready", name);
        }
      }
      if (newP.restarts > (oldP?.restarts ?? 0)) {
        this.addEvent("pod_restarted", name);
      }
    }

    // Detect deleted pods
    for (const [name] of this.lastPods) {
      if (!newPods.has(name)) {
        this.addEvent("pod_deleted", name);
      }
    }

    this.lastPods = newPods;

    return {
      pods,
      runningCount: pods.filter((p) => p.status === "Running").length,
      failedCount: pods.filter((p) => p.status === "Failed").length,
      pendingCount: pods.filter((p) => p.status === "Pending").length,
      recentEvents: [...this.recentEvents],
      context: context || null,
      namespace: this.namespace,
    };
  }

  protected getEventSource(): ObservationSource {
    return "process";
  }

  protected getEventPriority(data: KubernetesState): ObservationPriority {
    if (data.failedCount > 0) return "high";
    if (data.recentEvents.some((e) => e.type === "pod_failed")) return "high";
    if (data.pendingCount > 0) return "medium";
    return "background";
  }

  private addEvent(type: K8sEvent["type"], podName: string): void {
    const event: K8sEvent = {
      type,
      podName,
      namespace: this.namespace,
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
        pods: [...this.lastPods.values()],
        runningCount: [...this.lastPods.values()].filter((p) => p.status === "Running").length,
        failedCount: [...this.lastPods.values()].filter((p) => p.status === "Failed").length,
        pendingCount: [...this.lastPods.values()].filter((p) => p.status === "Pending").length,
        recentEvents: [...this.recentEvents],
        context: this.execCommand("kubectl config current-context 2>/dev/null") || null,
        namespace: this.namespace,
      },
      priority: type.includes("failed") ? "high" : type.includes("created") || type.includes("deleted") ? "medium" : "low",
      source: "process",
    });
  }

  private async listPods(): Promise<K8sPod[]> {
    const output = this.execCommand(
      `kubectl get pods -n ${this.namespace} --no-headers 2>/dev/null`,
    );
    if (!output) return [];

    return output.split("\n").filter(Boolean).map((line) => {
      const parts = line.split(/\s+/);
      const name = parts[0] ?? "";
      const ready = parts[1] ?? "";
      const status = parts[2] ?? "";
      const restarts = parseInt(parts[3] ?? "0", 10);
      const age = parts[4] ?? "";
      const node = parts.length > 5 ? parts.slice(5).join(" ") : null;

      const readyCount = ready.split("/");
      const isReady = readyCount[0] === readyCount[1];

      return {
        name,
        namespace: this.namespace,
        status: status as K8sPod["status"],
        ready: isReady,
        restarts: isNaN(restarts) ? 0 : restarts,
        age,
        node,
      };
    });
  }
}
