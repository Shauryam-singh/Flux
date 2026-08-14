import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Memory } from "./memory.js";

type Message = {
  role: string;
  content: string;
};

const MEMORY_DIR = join(process.env.HOME ?? process.env.USERPROFILE ?? "/tmp", ".flux");
const MEMORY_FILE = join(MEMORY_DIR, "session-memory.json");
const MAX_MESSAGES = 200;

export class DefaultMemory implements Memory {
  private messages: Message[] = [];
  private dirty = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false; // Prevent concurrent flushes

  constructor() {
    this.load();
    // Flush to disk every 10 seconds if dirty (non-blocking)
    this.flushTimer = setInterval(() => {
      if (this.dirty && !this.flushing) {
        void this.flushAsync();
      }
    }, 10000);
  }

  public async add(role: string, content: string): Promise<void> {
    this.messages.push({ role, content });
    // Trim to max
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }
    this.dirty = true;
    // Non-blocking flush - don't await, just fire and forget
    // The 10-second timer will catch it if this fails
    void this.flushAsync();
  }

  public async history(): Promise<Message[]> {
    return [...this.messages];
  }

  public async clear(): Promise<void> {
    this.messages = [];
    this.dirty = true;
    await this.flushAsync();
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Final flush - use sync version to ensure data is written
    this.flushSync();
  }

  private load(): void {
    try {
      if (existsSync(MEMORY_FILE)) {
        const raw = readFileSync(MEMORY_FILE, "utf-8");
        const data = JSON.parse(raw) as { messages?: Message[] };
        if (Array.isArray(data.messages)) {
          this.messages = data.messages.slice(-MAX_MESSAGES);
        }
      }
    } catch {
      // Start fresh
      this.messages = [];
    }
  }

  /**
   * Async flush - non-blocking, uses writeFile instead of writeFileSync
   */
  private async flushAsync(): Promise<void> {
    if (!this.dirty || this.flushing) return;
    
    this.flushing = true;
    try {
      if (!existsSync(MEMORY_DIR)) {
        mkdirSync(MEMORY_DIR, { recursive: true });
      }
      await writeFile(
        MEMORY_FILE,
        JSON.stringify({ messages: this.messages }, null, 2),
      );
      this.dirty = false;
    } catch {
      // Best-effort persistence - will retry on next interval
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Sync flush - used only on destroy() to ensure data is written
   */
  private flushSync(): void {
    try {
      if (!existsSync(MEMORY_DIR)) {
        mkdirSync(MEMORY_DIR, { recursive: true });
      }
      const { writeFileSync } = require("node:fs");
      writeFileSync(
        MEMORY_FILE,
        JSON.stringify({ messages: this.messages }, null, 2),
      );
      this.dirty = false;
    } catch {
      // Best-effort persistence
    }
  }
}
