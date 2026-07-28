import type { EmailSensor, EmailConfig } from "../interfaces/email-sensor.js";
import type { EmailMessage, EmailState } from "@ai-agent/ambient-types";

const DEFAULT_CONFIG: EmailConfig = {
  provider: "mock",
  pollIntervalMs: 30000,
  enabled: true,
  importantSenders: [],
  replyDeadlineHours: 24,
};

export class DefaultEmailSensor implements EmailSensor {
  private config: EmailConfig;
  private emails: EmailMessage[] = [];
  private handlers: Array<(state: EmailState) => void> = [];

  constructor(config?: Partial<EmailConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async getState(): Promise<EmailState> {
    const unread = this.emails.filter((e) => !e.isRead);
    const urgent = unread.filter((e) => e.priority === "urgent" || e.priority === "high");
    const starred = this.emails.filter((e) => e.isStarred);

    const senderMap = new Map<string, { count: number; latest: number }>();
    for (const email of unread) {
      const existing = senderMap.get(email.from) ?? { count: 0, latest: 0 };
      senderMap.set(email.from, {
        count: existing.count + 1,
        latest: Math.max(existing.latest, email.timestamp),
      });
    }

    const unreadBySender = Array.from(senderMap.entries())
      .map(([sender, data]) => ({ sender, ...data }))
      .sort((a, b) => b.count - a.count);

    const pendingReplies = this.emails.filter(
      (e) => e.replyDeadline !== null && e.replyDeadline! > Date.now() && !e.isRead,
    );

    return {
      unreadCount: unread.length,
      urgentCount: urgent.length,
      starredCount: starred.length,
      recentEmails: this.emails.slice(-20),
      unreadBySender,
      pendingReplies,
      lastChecked: Date.now(),
    };
  }

  async getUnread(): Promise<ReadonlyArray<EmailMessage>> {
    return this.emails.filter((e) => !e.isRead);
  }

  async getUrgent(): Promise<ReadonlyArray<EmailMessage>> {
    return this.emails.filter((e) => !e.isRead && (e.priority === "urgent" || e.priority === "high"));
  }

  async getPendingReplies(): Promise<ReadonlyArray<EmailMessage>> {
    return this.emails.filter(
      (e) => e.replyDeadline !== null && e.replyDeadline! > Date.now(),
    );
  }

  async markRead(emailId: string): Promise<void> {
    const email = this.emails.find((e) => e.id === emailId);
    if (email) {
      this.emails = this.emails.map((e) =>
        e.id === emailId ? { ...e, isRead: true } : e,
      );
    }
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  async refresh(): Promise<void> {
    for (const handler of this.handlers) {
      handler(await this.getState());
    }
  }

  onChange(handler: (state: EmailState) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  addEmail(email: EmailMessage): void {
    this.emails.push(email);
    this.emails.sort((a, b) => b.timestamp - a.timestamp);
  }
}
