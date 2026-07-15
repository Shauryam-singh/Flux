import { paint, theme } from "./theme.js";

export class Spinner {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private frameIdx = 0;
  private phraseIdx = 0;
  private timer?: NodeJS.Timeout;
  private phraseTimer?: NodeJS.Timeout;
  private phrases: string[];

  constructor(phrases: string[] = ["Thinking"]) {
    this.phrases = phrases;
  }

  start(): void {
    this.render();
    this.timer = setInterval(() => this.render(), 80);
    if (this.phrases.length > 1) {
      this.phraseTimer = setInterval(() => {
        this.phraseIdx = (this.phraseIdx + 1) % this.phrases.length;
      }, 1600);
    }
  }

  private render(): void {
    const frame = this.frames[this.frameIdx++ % this.frames.length];
    const phrase = this.phrases[this.phraseIdx];
    process.stdout.write(
      `\r${paint(frame!, theme.warning)} ${paint(phrase + "…", theme.muted)}`,
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.phraseTimer) clearInterval(this.phraseTimer);
    process.stdout.write("\r" + " ".repeat(60) + "\r");
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export async function typeOut(text: string, delayMs = 4): Promise<void> {
  const tokens = text.match(/\x1b\[[0-9;]*m|[\s\S]/g) ?? [];
  for (const t of tokens) {
    process.stdout.write(t);
    if (!t.startsWith("\x1b") && delayMs > 0) await sleep(delayMs);
  }
  process.stdout.write("\n");
}

export function progressBar(percent: number, width = 24): string {
  const filled = Math.max(
    0,
    Math.min(width, Math.round((percent / 100) * width)),
  );
  const bar =
    paint("█".repeat(filled), theme.primary) +
    paint("░".repeat(width - filled), theme.muted);
  return `${bar} ${paint(percent + "%", theme.muted)}`;
}

export async function animateBootBar(label: string, ms = 400): Promise<void> {
  const steps = 16;
  const stepDelay = ms / steps;
  for (let i = 0; i <= steps; i++) {
    const pct = Math.round((i / steps) * 100);
    process.stdout.write(
      `\r${paint(label, theme.muted)} ${progressBar(pct)}`,
    );
    await sleep(stepDelay);
  }
  process.stdout.write("\r" + " ".repeat(60) + "\r");
}
