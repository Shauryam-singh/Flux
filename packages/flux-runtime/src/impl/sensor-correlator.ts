/**
 * Cross-Sensor Correlation Engine
 *
 * Correlates signals from multiple sensors to produce higher-order insights.
 * Example: Docker container died + you're in VS Code editing that project = offer to check logs.
 */

export interface Correlation {
  readonly id: string;
  readonly type: string;
  readonly sensors: ReadonlyArray<string>;
  readonly insight: string;
  readonly confidence: number;
  readonly priority: "low" | "medium" | "high";
  readonly suggestedAction: string;
  readonly timestamp: number;
  readonly context: Record<string, unknown>;
}

export class SensorCorrelator {
  private readonly correlations: Correlation[] = [];
  private readonly recentCorrelations: Map<string, number> = new Map();
  private readonly correlationTTL = 600_000; // 10 minutes

  /**
   * Analyze sensor snapshots and return correlations.
   */
  analyze(snapshots: Record<string, unknown>): Correlation[] {
    const now = Date.now();
    const results: Correlation[] = [];

    const window = snapshots.window as { app?: string; title?: string; isCoding?: boolean } | undefined;
    const git = snapshots.git as { branch?: string; isDirty?: boolean } | undefined;
    const docker = snapshots.docker as { recentEvents?: ReadonlyArray<{ type: string; containerName: string; image: string }>; runningCount?: number } | undefined;
    const k8s = snapshots.kubernetes as { failedCount?: number; pods?: ReadonlyArray<{ name: string; status: string; restarts: number }> } | undefined;
    const health = snapshots["system-health"] as { cpuUsagePercent?: number; memoryUsagePercent?: number } | undefined;
    const spotify = snapshots.spotify as { isPlaying?: boolean; track?: string | null } | undefined;
    const audio = snapshots.audio as { isMuted?: boolean; outputVolume?: number } | undefined;
    const battery = snapshots.battery as { level?: number; isCharging?: boolean } | undefined;
    const clipboard = snapshots.clipboard as { text?: string } | undefined;
    const ssh = snapshots.ssh as { activeSessions?: ReadonlyArray<{ host: string; connectedAt: number }> } | undefined;
    const idle = snapshots.idle as { isIdle?: boolean; idleSeconds?: number } | undefined;
    const notifications = snapshots.notifications as { recentNotifications?: ReadonlyArray<{ app: string; summary: string; urgency: string }> } | undefined;
    const browser = snapshots.browser as { isGitHub?: boolean; isStackOverflow?: boolean; isDocs?: boolean } | undefined;

    // ── Correlation: Docker died + IDE open = check logs ──
    if (docker?.recentEvents && window?.isCoding) {
      const dieEvents = docker.recentEvents.filter((e) => e.type === "die" || e.type === "restart");
      for (const evt of dieEvents.slice(0, 1)) {
        results.push(this.createCorrelation(
          "docker_ide_correlation",
          "docker + coding",
          ["docker", "window"],
          `Container "${evt.containerName}" ${evt.type} while you're coding — likely related to your project`,
          0.85,
          "high",
          `Check logs for ${evt.containerName}: docker logs ${evt.containerName}`,
          { container: evt.containerName, image: evt.image },
        ));
      }
    }

    // ── Correlation: CPU high + coding = heavy build/test ──
    if (health?.cpuUsagePercent != null && health.cpuUsagePercent > 80 && window?.isCoding) {
      results.push(this.createCorrelation(
        "cpu_coding_correlation",
        "cpu + coding",
        ["system-health", "window"],
        "High CPU while coding — might be a build or test running in background",
        0.7,
        "medium",
        "Check what's using CPU: htop or ps aux --sort=-%cpu",
        { cpu: health.cpuUsagePercent },
      ));
    }

    // ── Correlation: Memory rising + many docker containers = resource pressure ──
    if (health?.memoryUsagePercent != null && health.memoryUsagePercent > 80 && docker?.runningCount != null && docker.runningCount > 5) {
      results.push(this.createCorrelation(
        "memory_docker_correlation",
        "memory + docker",
        ["system-health", "docker"],
        `${docker.runningCount} containers running with ${health.memoryUsagePercent}% memory — containers may be the cause`,
        0.8,
        "high",
        "Review container resource usage: docker stats --no-stream",
        { memory: health.memoryUsagePercent, containers: docker.runningCount },
      ));
    }

    // ── Correlation: K8s crash-loop + clipboard error = deployment issue ──
    if (k8s?.pods) {
      const crashLoop = k8s.pods.filter((p) => p.restarts > 5);
      if (crashLoop.length > 0 && clipboard?.text && /(error|exception|crash)/i.test(clipboard.text)) {
        results.push(this.createCorrelation(
          "k8s_clipboard_correlation",
          "k8s + clipboard",
          ["kubernetes", "clipboard"],
          `Pod "${crashLoop[0]!.name}" is crash-looping and you have an error in clipboard — likely the same issue`,
          0.9,
          "high",
          `Inspect pod: kubectl describe pod ${crashLoop[0]!.name}`,
          { pod: crashLoop[0]!.name, restarts: crashLoop[0]!.restarts },
        ));
      }
    }

    // ── Correlation: Flow state (music + coding) + high CPU = intensive work ──
    if (spotify?.isPlaying && window?.isCoding && health?.cpuUsagePercent != null && health.cpuUsagePercent > 70) {
      results.push(this.createCorrelation(
        "flow_intensity_correlation",
        "flow + cpu",
        ["spotify", "window", "system-health"],
        "You're in flow state with high CPU — intense coding session detected",
        0.75,
        "low",
        "Stay focused — I'll minimize interruptions",
        { cpu: health.cpuUsagePercent, track: spotify.track },
      ));
    }

    // ── Correlation: Git dirty + idle = should commit ──
    if (git?.isDirty && idle?.isIdle && idle.idleSeconds != null && idle.idleSeconds > 300) {
      results.push(this.createCorrelation(
        "git_idle_correlation",
        "git + idle",
        ["git", "idle"],
        "You have uncommitted changes and have been idle for 5+ minutes — good time to commit",
        0.6,
        "low",
        "Review changes and commit before forgetting",
        { branch: git.branch },
      ));
    }

    // ── Correlation: SSH stale + K8s issues = remote debugging ──
    if (ssh?.activeSessions && ssh.activeSessions.length > 0 && k8s?.failedCount != null && k8s.failedCount > 0) {
      const staleThreshold = now - 3600_000;
      const staleSessions = ssh.activeSessions.filter((s) => s.connectedAt < staleThreshold);
      if (staleSessions.length > 0) {
        results.push(this.createCorrelation(
          "ssh_k8s_correlation",
          "ssh + k8s",
          ["ssh", "kubernetes"],
          `Stale SSH session to ${staleSessions[0]!.host} + K8s failures — might need attention on remote cluster`,
          0.8,
          "high",
          `Check remote cluster: kubectl get pods --all-namespaces`,
          { host: staleSessions[0]!.host, failures: k8s.failedCount },
        ));
      }
    }

    // ── Correlation: Notification error + coding = build failure ──
    if (notifications?.recentNotifications && window?.isCoding) {
      const errorNotifs = notifications.recentNotifications.filter(
        (n) => /(error|fail|build|test)/i.test(`${n.summary} ${n.app}`),
      );
      if (errorNotifs.length > 0) {
        results.push(this.createCorrelation(
          "notification_coding_correlation",
          "notification + coding",
          ["notifications", "window"],
          `Error notification from ${errorNotifs[0]!.app} while coding — likely a build/test failure`,
          0.75,
          "medium",
          `Check ${errorNotifs[0]!.app} for details`,
          { app: errorNotifs[0]!.app, summary: errorNotifs[0]!.summary },
        ));
      }
    }

    // ── Correlation: Battery low + no charger + coding = wrap up ──
    if (battery?.level != null && battery.level < 15 && !battery.isCharging && window?.isCoding) {
      results.push(this.createCorrelation(
        "battery_coding_correlation",
        "battery + coding",
        ["battery", "window"],
        "Battery critically low while coding — consider plugging in soon",
        0.9,
        "high",
        "Plug in charger to avoid losing work",
        { level: battery.level },
      ));
    }

    // ── Correlation: Browser docs + coding = learning phase ──
    if (browser?.isDocs && window?.isCoding) {
      results.push(this.createCorrelation(
        "docs_coding_correlation",
        "docs + coding",
        ["browser", "window"],
        "Reading docs while coding — learning about a new API or library",
        0.6,
        "low",
        "Want me to summarize the docs or help apply what you're learning?",
        {},
      ));
    }

    // Filter out recently seen correlations
    return results.filter((c) => {
      const lastSeen = this.recentCorrelations.get(c.id);
      if (lastSeen && now - lastSeen < this.correlationTTL) return false;
      this.recentCorrelations.set(c.id, now);
      return true;
    });
  }

  /**
   * Get recent correlations for streaming.
   */
  getRecent(limit = 10): ReadonlyArray<Correlation> {
    return this.correlations.slice(-limit);
  }

  /**
   * Get all active correlations.
   */
  getAll(): ReadonlyArray<Correlation> {
    return this.correlations;
  }

  private createCorrelation(
    id: string,
    type: string,
    sensors: string[],
    insight: string,
    confidence: number,
    priority: "low" | "medium" | "high",
    suggestedAction: string,
    context: Record<string, unknown>,
  ): Correlation {
    const correlation: Correlation = {
      id,
      type,
      sensors,
      insight,
      confidence,
      priority,
      suggestedAction,
      timestamp: Date.now(),
      context,
    };

    this.correlations.push(correlation);
    if (this.correlations.length > 50) {
      this.correlations.splice(0, this.correlations.length - 50);
    }

    return correlation;
  }
}
