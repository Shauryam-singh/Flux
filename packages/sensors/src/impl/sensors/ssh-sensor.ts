import { BaseSensor } from "../base-sensor.js";
import type { SensorMetadata, SensorEvent } from "../../types/sensor.js";
import type { ObservationSource, ObservationPriority } from "@ai-agent/attention";

export interface SSHSession {
  readonly pid: number;
  readonly user: string;
  readonly host: string;
  readonly port: number;
  readonly connectedAt: number;
  readonly command: string | null;
}

export interface SSHState {
  readonly activeSessions: ReadonlyArray<SSHSession>;
  readonly sessionCount: number;
  readonly recentConnections: ReadonlyArray<{
    readonly host: string;
    readonly timestamp: number;
    readonly success: boolean;
  }>;
}

const METADATA: SensorMetadata = {
  id: "ssh",
  name: "SSH Sensor",
  description: "Monitors SSH sessions and connections",
  category: "process",
  platform: "all",
  version: "1.0.0",
};

export class SSHSensor extends BaseSensor<SSHState> {
  private recentConnections: SSHState["recentConnections"] = [];

  constructor(pollIntervalMs = 10000) {
    super(METADATA, pollIntervalMs);
  }

  protected async onStart(): Promise<void> {
    // No initialization needed
  }

  protected async onStop(): Promise<void> {
    this.recentConnections = [];
  }

  protected async onSnapshot(): Promise<SSHState> {
    const sessions = await this.listSessions();
    return {
      activeSessions: sessions,
      sessionCount: sessions.length,
      recentConnections: [...this.recentConnections],
    };
  }

  protected async onRefresh(): Promise<SSHState | null> {
    const sessions = await this.listSessions();
    return {
      activeSessions: sessions,
      sessionCount: sessions.length,
      recentConnections: [...this.recentConnections],
    };
  }

  protected getEventSource(): ObservationSource {
    return "process";
  }

  protected getEventPriority(data: SSHState): ObservationPriority {
    if (data.sessionCount > 0) return "medium";
    return "background";
  }

  private async listSessions(): Promise<SSHSession[]> {
    const output = this.execCommand(
      'ps aux | grep "[s]sh " | grep -v grep 2>/dev/null',
    );
    if (!output) return [];

    const sessions: SSHSession[] = [];
    for (const line of output.split("\n").filter(Boolean)) {
      const parts = line.split(/\s+/);
      const pid = parseInt(parts[1] ?? "0", 10);
      const user = parts[0] ?? "";

      // Parse SSH command to extract host
      const sshIdx = line.indexOf("ssh ");
      if (sshIdx === -1) continue;

      const sshCmd = line.slice(sshIdx);
      const hostMatch = sshCmd.match(/(?:-l\s+\S+\s+)?(\S+@?\S+)/);
      const host = hostMatch ? hostMatch[1] : "unknown";

      // Check for port
      const portMatch = sshCmd.match(/-p\s+(\d+)/);
      const port = portMatch ? parseInt(portMatch[1]!, 10) : 22;

      sessions.push({
        pid,
        user,
        host: host ?? "unknown",
        port,
        connectedAt: Date.now(), // Approximation
        command: sshCmd,
      });
    }

    return sessions;
  }
}
