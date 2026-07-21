import { paint, theme } from "./theme.js";

export class Spinner {
  private readonly frames = [
    "⠋",
    "⠙",
    "⠹",
    "⠸",
    "⠼",
    "⠴",
    "⠦",
    "⠧",
    "⠇",
    "⠏",
  ];

  private frameIdx = 0;
  private phraseIdx = 0;

  private timer?: NodeJS.Timeout;
  private phraseTimer?: NodeJS.Timeout;

  constructor(
    private readonly phrases: string[] = ["Thinking"],
    private readonly onFrame?: (frame: string) => void,
  ) {}

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
    const frame =
      `${paint(this.frames[this.frameIdx++ % this.frames.length]!, theme.warning)} ` +
      paint(`${this.phrases[this.phraseIdx]}…`, theme.muted);

    if (this.onFrame) {
      this.onFrame(frame);
    } else {
      process.stdout.write(`\r${frame}`);
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.phraseTimer) clearInterval(this.phraseTimer);

    if (this.onFrame) {
      this.onFrame("");
    } else {
      process.stdout.write("\r" + " ".repeat(60) + "\r");
    }
  }
}