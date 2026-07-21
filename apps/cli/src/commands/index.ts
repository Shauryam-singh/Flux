import { paint, bold, theme } from "../ui/theme.js";
import { printBox } from "../ui/banner.js";
import { formatTimestamp, formatDuration, type SessionMessage } from "../session/store.js";
import type { ProviderName } from "@ai-agent/providers";

const APP_NAME = "Flux";

type PrintFn = (text: string) => void;

export function cmdHelp(printFn?: PrintFn): void {
  const lines = [
    `${paint(`Help — ${APP_NAME} v0.1.0`, `${bold}${theme.primary}`)}`,
    "",
    paint("Commands:", theme.accent),
    `  ${paint("/help", theme.primary)}      Show this help`,
    `  ${paint("/history", theme.primary)}   Show message history`,
    `  ${paint("/suggest", theme.primary)}   Show prompt ideas`,
    `  ${paint("/models", theme.primary)}    Configure providers & models`,
    `  ${paint("/mode", theme.primary)}      Switch mode (plan/auto/normal)`,
    `  ${paint("/clear", theme.primary)}     Clear the screen`,
    `  ${paint("/save", theme.primary)}      Save session now`,
    `  ${paint("/saveas", theme.primary)}    Save session with a name`,
    `  ${paint("/load", theme.primary)}      Load a saved session`,
    `  ${paint("/resume", theme.primary)}    Resume last session`,
    `  ${paint("/exit", theme.primary)}      Quit ${APP_NAME}`,
    "",
    paint("Key bindings:", theme.accent),
    `  ${paint("Shift+Tab", theme.primary)}     Cycle mode (normal → plan → auto)`,
    "",
    paint("Tools available to the agent:", theme.accent),
    `  read_file, write_file, edit_file, list_directory`,
    `  run_command, git_status, git_diff, git_log`,
    "",
    paint("Type anything to chat with the AI.", theme.muted),
  ];
  printBox(lines, theme.primary, 48, printFn);
}

export function cmdHistory(messages: SessionMessage[], printFn?: PrintFn): void {
  const lines = [paint("Message History", `${bold}${theme.success}`), ""];

  if (messages.length === 0) {
    lines.push(paint("No messages yet.", theme.muted));
  } else {
    for (const msg of messages) {
      const time = formatTimestamp(msg.timestamp);
      const role =
        msg.role === "user"
          ? paint("you", theme.primary)
          : paint("ai", theme.accent);
      const preview =
        msg.content.length > 60
          ? msg.content.slice(0, 60) + "…"
          : msg.content;
      const meta =
        msg.durationMs !== undefined ? ` (${formatDuration(msg.durationMs)})` : "";
      lines.push(`${paint(time, theme.dim)} ${role}${meta} ${preview}`);
    }
  }

  printBox(lines, theme.success, 65, printFn);
}

export function cmdSuggest(printFn?: PrintFn): void {
  const suggestions = [
    "Explain this repository",
    "Fix the failing tests in src/",
    "Refactor the router to use middleware",
    "Add error handling to the API layer",
    "Generate TypeScript types from this JSON",
    "Write unit tests for the auth module",
    "Review this code for security issues",
  ];

  const lines = [
    paint("Prompt Ideas", `${bold}${theme.accent}`),
    "",
    ...suggestions.map((s) => `${paint("•", theme.accent)} ${s}`),
  ];

  printBox(lines, theme.accent, 50, printFn);
}

export async function cmdModels(
  args: string,
  currentProvider: ProviderName,
  currentModel: string,
  listModels: (p: ProviderName) => Promise<string[]>,
  setModel: (p: ProviderName, m: string) => void,
  printFn?: PrintFn,
): Promise<void> {
  const available: ProviderName[] = [
    "ollama",
    "openai",
    "anthropic",
    "openrouter",
  ];

  if (args) {
    const parts = args.split(/\s+/);
    const sub = parts[0]?.toLowerCase();

    if (sub === "set" || sub === "select") {
      const p = parts[1] as ProviderName | undefined;
      const m = parts[2];

      if (p && available.includes(p)) {
        const model = m ?? (await listModels(p))[0] ?? "unknown";
        setModel(p, model);
        printBox(
          [
            paint("Model updated", `${bold}${theme.success}`),
            `${paint("Provider:", theme.muted)} ${paint(p, theme.primary)}`,
            `${paint("Model:", theme.muted)} ${paint(model, theme.primary)}`,
          ],
          theme.success,
          40,
          printFn
        );
        return;
      }

      printBox(
        [
          paint("Invalid provider", theme.error),
          `${paint("Available:", theme.muted)} ${available.join(", ")}`,
        ],
        theme.error,
        40,
        printFn
      );
      return;
    }
  }

  const models = await listModels(currentProvider);
  const lines = [
    `${paint(`Models — ${currentProvider}`, `${bold}${theme.primary}`)}`,
    "",
    `${paint("Current:", theme.muted)} ${paint(currentModel, theme.success)}`,
    "",
    paint("Available:", theme.accent),
    ...models.map(
      (m) =>
        `${m === currentModel ? paint("●", theme.success) : paint("○", theme.muted)} ${m === currentModel ? paint(m, theme.success) : paint(m, theme.text)}`,
    ),
    "",
    `${paint("/models set ollama mistral", theme.primary)}  Switch`,
  ];

  printBox(lines, theme.primary, 50, printFn);
}