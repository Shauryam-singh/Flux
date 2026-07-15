import type { SessionMessage } from "../session/store.js";
import { formatDuration, formatTokens } from "../session/store.js";
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

function parseJsonToolCall(text: string): { tool: string; message?: string } | null {
  try {
    const parsed = JSON.parse(text) as { tool?: string; input?: { message?: string } };
    if (typeof parsed.tool === "string") {
      const msg = parsed.input?.message;
      return {
        tool: parsed.tool,
        ...(msg !== undefined && { message: msg }),
      };
    }
  } catch {
    // Not JSON
  }
  return null;
}

function formatContent(content: string, toolUsed?: string): string {
  // Check if content is a JSON tool call
  const toolCall = parseJsonToolCall(content);

  if (toolCall) {
    if (toolCall.tool === "echo" && toolCall.message) {
      return toolCall.message;
    }
    // For other tools, show a brief summary
    return `${paint(toolCall.tool, theme.accent)}`;
  }

  return content;
}

export function renderUserMessage(msg: SessionMessage): string {
  return `${paint(">", theme.accent)} ${msg.content}`;
}

export function renderAssistantMessage(msg: SessionMessage): string {
  const lines: string[] = [];

  const content = formatContent(msg.content || "(empty response)", msg.toolUsed);
  lines.push(content);

  // Metadata footer
  const meta: string[] = [];
  if (msg.durationMs !== undefined) {
    meta.push(`${formatDuration(msg.durationMs)}`);
  }
  if (msg.inputTokens !== undefined || msg.outputTokens !== undefined) {
    const parts: string[] = [];
    if (msg.inputTokens !== undefined) parts.push(`${formatTokens(msg.inputTokens)} in`);
    if (msg.outputTokens !== undefined) parts.push(`${formatTokens(msg.outputTokens)} out`);
    meta.push(parts.join(" · "));
  } else if (msg.totalTokens !== undefined) {
    meta.push(`${formatTokens(msg.totalTokens)} tokens`);
  }
  if (msg.provider && msg.model) {
    meta.push(`${msg.provider}/${msg.model}`);
  }
  if (msg.toolUsed) {
    meta.push(`used ${msg.toolUsed}`);
  }

  if (meta.length > 0) {
    lines.push(paint(`  ${meta.join(" · ")}`, theme.muted));
  }

  return lines.join("\n");
}

export function renderMessage(msg: SessionMessage): string {
  if (msg.role === "user") {
    return renderUserMessage(msg);
  }
  return renderAssistantMessage(msg);
}
