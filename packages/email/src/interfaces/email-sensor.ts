import type { EmailMessage, EmailState } from "@ai-agent/ambient-types";

export interface EmailSensor {
  getState(): Promise<EmailState>;
  getUnread(): Promise<ReadonlyArray<EmailMessage>>;
  getUrgent(): Promise<ReadonlyArray<EmailMessage>>;
  getPendingReplies(): Promise<ReadonlyArray<EmailMessage>>;
  markRead(emailId: string): Promise<void>;
  isAvailable(): boolean;
  refresh(): Promise<void>;
  onChange(handler: (state: EmailState) => void): () => void;
}

export interface EmailConfig {
  readonly provider: "imap" | "gmail" | "mock";
  readonly pollIntervalMs: number;
  readonly enabled: boolean;
  readonly importantSenders: ReadonlyArray<string>;
  readonly replyDeadlineHours: number;
}
