import type { SessionMessage } from "../session/store.js";
import { formatDuration } from "../session/store.js";
import { paint, theme } from "../ui/theme.js";

export function extractText(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.output === "string") return obj.output;
  }
  return "";
}

export function renderMessage(msg: SessionMessage): string {
  const lines: string[] = [];

  if (msg.role === "user") {
    lines.push(`${paint("❯", theme.accent)} ${paint(msg.content, theme.text)}`);
  } else {
    const content = msg.content || "(empty response)";
    lines.push(content);

    const meta: string[] = [];
    if (msg.provider) meta.push(msg.provider);
    if (msg.model) meta.push(msg.model);
    if (msg.durationMs !== undefined) meta.push(formatDuration(msg.durationMs));
    if (msg.toolUsed) meta.push(`tool: ${msg.toolUsed}`);

    if (meta.length > 0) {
      lines.push(paint(`  ${meta.join(" • ")}`, theme.dim));
    }
  }

  return lines.join("\n");
}
