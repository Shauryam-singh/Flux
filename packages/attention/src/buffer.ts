import type { Observation } from "./types.js";

/**
 * Buffers observations and manages batching
 */
export class ObservationBuffer {
  private buffer: Observation[] = [];
  private readonly maxBuffer: number;
  private readonly flushInterval: number;
  private lastFlush = 0;

  constructor(options?: { maxBuffer?: number; flushInterval?: number }) {
    this.maxBuffer = options?.maxBuffer ?? 100;
    this.flushInterval = options?.flushInterval ?? 60000; // 1 minute
  }

  /**
   * Add an observation to the buffer
   */
  add(observation: Observation): void {
    if (this.buffer.length >= this.maxBuffer) {
      // Evict lowest priority observations
      this.evictLowest();
    }
    this.buffer.push(observation);
  }

  /**
   * Get all buffered observations (and optionally clear)
   */
  drain(clear = false): Observation[] {
    const result = [...this.buffer];
    if (clear) {
      this.buffer = [];
      this.lastFlush = Date.now();
    }
    return result;
  }

  /**
   * Check if it's time to auto-flush
   */
  shouldFlush(): boolean {
    if (this.lastFlush === 0) return false;
    return Date.now() - this.lastFlush >= this.flushInterval;
  }

  /**
   * Get observations by priority
   */
  getByPriority(priority: Observation["priority"]): Observation[] {
    return this.buffer.filter((o) => o.priority === priority);
  }

  /**
   * Get high/critical observations (need immediate attention)
   */
  getUrgent(): Observation[] {
    return this.buffer.filter(
      (o) => o.priority === "high" || o.priority === "critical",
    );
  }

  /**
   * Get unmerged observations (can be summarized)
   */
  getMergeable(): Observation[] {
    return this.buffer.filter((o) => o.mergeable && !o.consumed);
  }

  /**
   * Mark observations as consumed
   */
  consume(ids: string[]): void {
    for (const obs of this.buffer) {
      if (ids.includes(obs.id)) {
        obs.consumed = true;
      }
    }
  }

  /**
   * Remove consumed observations
   */
  gc(): number {
    const before = this.buffer.length;
    this.buffer = this.buffer.filter((o) => !o.consumed);
    return before - this.buffer.length;
  }

  /**
   * Current buffer size
   */
  get size(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is empty
   */
  get isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  private evictLowest(): void {
    // Remove the lowest priority non-critical observations
    const priorityOrder = ["background", "low", "medium", "high", "critical"];

    for (const priority of priorityOrder) {
      const candidates = this.buffer.filter(
        (o) => o.priority === priority && o.priority !== "critical",
      );
      if (candidates.length > 0) {
        // Remove the oldest one
        const oldest = candidates.sort((a, b) => a.timestamp - b.timestamp)[0];
        if (oldest) {
          const idx = this.buffer.indexOf(oldest);
          if (idx !== -1) this.buffer.splice(idx, 1);
        }
        return;
      }
    }
  }
}
