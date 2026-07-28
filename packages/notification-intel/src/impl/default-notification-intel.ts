import type { NotificationClassifier, NotificationIntel, NotificationIntelConfig } from "../interfaces/notification-intel.js";
import type { AmbientNotification, NotificationClassification, NotificationState } from "@ai-agent/ambient-types";

const DEFAULT_CONFIG: NotificationIntelConfig = {
  enabled: true,
  maxHistory: 200,
  batchWindowMs: 300000,
  suppressionRules: [],
};

const CLASSIFICATION_RULES: Array<{
  match: (n: AmbientNotification) => boolean;
  classification: NotificationClassification;
  confidence: number;
}> = [
  {
    match: (n) => n.app === "system" || n.title.toLowerCase().includes("critical"),
    classification: "critical",
    confidence: 0.9,
  },
  {
    match: (n) => n.app === "calendar" || n.app === "email",
    classification: "relevant",
    confidence: 0.8,
  },
  {
    match: (n) => n.app === "slack" || n.app === "teams" || n.app === "discord",
    classification: "relevant",
    confidence: 0.7,
  },
  {
    match: (n) => n.app === "spotify" || n.app === "media",
    classification: "ignore",
    confidence: 0.8,
  },
  {
    match: (n) => n.app === "update" || n.app === "backup",
    classification: "batch",
    confidence: 0.7,
  },
];

export class DefaultNotificationClassifier implements NotificationClassifier {
  classify(notification: AmbientNotification): NotificationClassification {
    for (const rule of CLASSIFICATION_RULES) {
      if (rule.match(notification)) return rule.classification;
    }
    return "informational";
  }

  shouldSuppress(notification: AmbientNotification): boolean {
    return notification.classification === "ignore";
  }

  getBatchGroup(notification: AmbientNotification): string | null {
    if (notification.classification === "batch") return notification.app;
    if (notification.groupingKey) return notification.groupingKey;
    return null;
  }
}

export class DefaultNotificationIntel implements NotificationIntel {
  private classifier: DefaultNotificationClassifier;
  private history: AmbientNotification[] = [];
  private config: NotificationIntelConfig;

  constructor(config?: Partial<NotificationIntelConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.classifier = new DefaultNotificationClassifier();
  }

  process(notification: AmbientNotification): AmbientNotification {
    const classification = this.classifier.classify(notification);
    const processed: AmbientNotification = { ...notification, classification };

    this.history.push(processed);
    if (this.history.length > this.config.maxHistory) {
      this.history = this.history.slice(-this.config.maxHistory);
    }

    return processed;
  }

  getState(): NotificationState {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const recent = this.history.filter((n) => n.timestamp > oneHourAgo);
    const critical = recent.filter((n) => n.classification === "critical");
    const batched = this.groupBatched(recent);
    const suppressionCount = this.history.filter((n) => n.classification === "ignore").length;

    return {
      recent,
      critical,
      batched,
      suppressionCount,
      lastHour: recent.length,
    };
  }

  getRecent(count: number): ReadonlyArray<AmbientNotification> {
    return this.history.slice(-count);
  }

  getCritical(): ReadonlyArray<AmbientNotification> {
    return this.history.filter((n) => n.classification === "critical");
  }

  getBatched(): ReadonlyArray<ReadonlyArray<AmbientNotification>> {
    return this.groupBatched(this.history);
  }

  getSuppressionCount(): number {
    return this.history.filter((n) => n.classification === "ignore").length;
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  private groupBatched(notifications: ReadonlyArray<AmbientNotification>): ReadonlyArray<ReadonlyArray<AmbientNotification>> {
    const groups = new Map<string, AmbientNotification[]>();
    for (const n of notifications) {
      if (n.classification === "batch") {
        const key = n.groupingKey ?? n.app;
        const existing = groups.get(key) ?? [];
        existing.push(n);
        groups.set(key, existing);
      }
    }
    return Array.from(groups.values());
  }
}
