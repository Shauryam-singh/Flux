import type { Intent } from "./intent.js";

export interface Expression {
  readonly text: string;
  readonly intent: Intent;
  readonly personality: string;
  readonly tone: string;
  readonly length: "short" | "medium" | "long";
  readonly timestamp: number;
}
