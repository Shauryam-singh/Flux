/**
 * Session Summary Store
 *
 * Persists conversation summaries to ~/.flux/session-summaries.json.
 * Each summary has a `consumed` flag — once presented in a morning briefing,
 * it is marked consumed and never shown again.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface SessionSummary {
  readonly id: string;
  readonly timestamp: number;
  readonly summary: string;
  readonly conversationId: string;
  readonly messageCount: number;
  readonly consumed: boolean;
  readonly consumedAt: number | null;
}

interface StoredData {
  summaries: SessionSummary[];
}

export class SessionSummaryStore {
  private summaries: SessionSummary[] = [];
  private filePath: string;

  constructor(filePath = `${process.env.HOME ?? "."}/.flux/session-summaries.json`) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      const data: StoredData = JSON.parse(raw);
      this.summaries = data.summaries.map((s) => ({
        ...s,
        consumed: s.consumed ?? false,
        consumedAt: s.consumedAt ?? null,
      }));
    } catch {
      this.summaries = [];
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(
        this.filePath,
        JSON.stringify({ summaries: this.summaries }, null, 2),
        "utf-8",
      );
    } catch {
      // Best effort
    }
  }

  /** Store a new conversation summary (unconsumed by default). */
  add(params: {
    summary: string;
    conversationId: string;
    messageCount: number;
  }): SessionSummary {
    const entry: SessionSummary = {
      id: randomUUID(),
      timestamp: Date.now(),
      summary: params.summary,
      conversationId: params.conversationId,
      messageCount: params.messageCount,
      consumed: false,
      consumedAt: null,
    };
    this.summaries.push(entry);
    this.save();
    return entry;
  }

  /** Get all unconsumed summaries, oldest first. */
  getUnconsumed(): ReadonlyArray<SessionSummary> {
    return this.summaries
      .filter((s) => !s.consumed)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Mark a summary as consumed. */
  markConsumed(id: string): boolean {
    const idx = this.summaries.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    const old = this.summaries[idx]!;
    this.summaries[idx] = {
      id: old.id,
      timestamp: old.timestamp,
      summary: old.summary,
      conversationId: old.conversationId,
      messageCount: old.messageCount,
      consumed: true,
      consumedAt: Date.now(),
    };
    this.save();
    return true;
  }

  /** Mark all currently unconsumed summaries as consumed. */
  markAllConsumed(): number {
    let count = 0;
    for (let i = 0; i < this.summaries.length; i++) {
      const old = this.summaries[i]!;
      if (!old.consumed) {
        this.summaries[i] = {
          id: old.id,
          timestamp: old.timestamp,
          summary: old.summary,
          conversationId: old.conversationId,
          messageCount: old.messageCount,
          consumed: true,
          consumedAt: Date.now(),
        };
        count++;
      }
    }
    if (count > 0) this.save();
    return count;
  }

  /** Get all summaries (for debugging/API). */
  getAll(): ReadonlyArray<SessionSummary> {
    return this.summaries;
  }

  /** Prune old consumed summaries beyond maxAgeMs. */
  prune(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    const before = this.summaries.length;
    this.summaries = this.summaries.filter(
      (s) => (s.consumed && s.consumedAt !== null ? s.consumedAt > cutoff : true),
    );
    const pruned = before - this.summaries.length;
    if (pruned > 0) this.save();
    return pruned;
  }

  get count(): number {
    return this.summaries.length;
  }

  get unconsumedCount(): number {
    return this.summaries.filter((s) => !s.consumed).length;
  }
}
