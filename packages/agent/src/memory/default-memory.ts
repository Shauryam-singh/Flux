import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Memory } from "./memory.js";

type Message = {
  role: string;
  content: string;
};

const MEMORY_DIR = join(process.env.HOME ?? "/tmp", ".flux");
const MEMORY_FILE = join(MEMORY_DIR, "session-memory.json");
const MAX_MESSAGES = 200;

export class DefaultMemory implements Memory {
  private messages: Message[] = [];
  private dirty = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.load();
    // Flush to disk every 10 seconds if dirty
    this.flushTimer = setInterval(() => {
      if (this.dirty) this.flush();
    }, 10000);
  }

  public async add(role: string, content: string): Promise<void> {
    this.messages.push({ role, content });
    // Trim to max
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }
    this.dirty = true;
    // Flush immediately on add to survive crashes
    this.flush();
  }

  public async history(): Promise<Message[]> {
    return [...this.messages];
  }

  public async clear(): Promise<void> {
    this.messages = [];
    this.dirty = true;
    this.flush();
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
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

  private flush(): void {
    try {
      if (!existsSync(MEMORY_DIR)) {
        mkdirSync(MEMORY_DIR, { recursive: true });
      }
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
