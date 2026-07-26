import { paint, bold, theme } from "../ui/theme.js";
import { printBox } from "../ui/banner.js";
import { formatTimestamp, formatDuration, formatDate, listSessions, loadSessionByName, saveSessionAs, type SessionMessage, type SessionData } from "../session/store.js";
import type { ProviderName } from "@ai-agent/providers";
import { handleUndo, handleRedo } from "../tools/undo.js";

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
    `  ${paint("/undo", theme.primary)}      Undo last file operation`,
    `  ${paint("/redo", theme.primary)}      Redo last undone operation`,
    `  ${paint("/scaffold", theme.primary)}  Create project from template`,
    `  ${paint("/commit", theme.primary)}    Auto-commit with AI message`,
    `  ${paint("/exit", theme.primary)}      Quit ${APP_NAME}`,
    "",
    paint("Key bindings:", theme.accent),
    `  ${paint("Shift+Tab", theme.primary)}     Cycle mode (normal → plan → auto)`,
    "",
    paint("Tools available to the agent:", theme.accent),
    `  read_file, write_file, edit_file, list_directory`,
    `  run_command, git_status, git_diff, git_log`,
    `  undo, redo, edit_function, scaffold, auto_commit`,
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

export async function cmdUndo(printFn?: PrintFn): Promise<void> {
  await handleUndo(printFn);
}

export async function cmdRedo(printFn?: PrintFn): Promise<void> {
  await handleRedo(printFn);
}

export async function cmdScaffold(args: string, printFn?: PrintFn): Promise<void> {
  const { getSupportedFrameworks, generateProjectFromDescription, formatScaffoldResult } = await import("../tools/scaffold.js");
  
  if (!args) {
    const frameworks = getSupportedFrameworks();
    const lines = [
      paint("Available Frameworks", `${bold}${theme.primary}`),
      "",
      ...frameworks.map((f) => `${paint("•", theme.accent)} ${f}`),
      "",
      `${paint("/scaffold react my-app", theme.primary)}  Quick scaffold`,
      `${paint('/scaffold react my-app "A todo app with auth"', theme.primary)}  With description`,
    ];
    printBox(lines, theme.primary, 50, printFn);
    return;
  }

  const parts = args.split(/\s+/);
  const framework = parts[0] || "";
  const name = parts[1] || "my-project";
  const description = parts.slice(2).join(" ") || `${framework} project`;

  const result = generateProjectFromDescription(framework, name, description, process.cwd());
  const output = formatScaffoldResult(name, result);
  printBox(output.split("\n"), result.success ? theme.success : theme.error, 50, printFn);
}

export async function cmdCommit(args: string, printFn?: PrintFn): Promise<void> {
  const { autoCommit, formatCommitResult } = await import("../tools/git-commit.js");
  
  const message = args.trim() || undefined;
  const defaultGenerator = async (diff: string): Promise<string> => {
    const added = diff.split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++")).length;
    const removed = diff.split("\n").filter(l => l.startsWith("-") && !l.startsWith("---")).length;
    const files = diff.split("diff --git").length - 1;
    const type = added > 0 && removed === 0 ? "feat" : added === 0 && removed > 0 ? "chore" : "refactor";
    return `${type}: update ${files} file${files !== 1 ? 's' : ''}`;
  };
  
  const result = await autoCommit(defaultGenerator, message);
  const output = formatCommitResult(result);
  printBox(output.split("\n"), result.success ? theme.success : theme.error, 50, printFn);
}

export function cmdSaveAs(args: string, currentData: SessionData, printFn?: PrintFn): void {
  const name = args.trim();
  if (!name) {
    printBox(
      [
        paint("Usage:", theme.primary),
        `  ${paint("/saveas my-session", theme.primary)}`,
      ],
      theme.warning,
      40,
      printFn
    );
    return;
  }

  saveSessionAs(currentData, name);
  printBox(
    [
      paint("Session saved", `${bold}${theme.success}`),
      `${paint("Name:", theme.muted)} ${paint(name, theme.primary)}`,
      `${paint("Messages:", theme.muted)} ${currentData.messages.length}`,
    ],
    theme.success,
    40,
    printFn
  );
}

export function cmdLoad(printFn?: PrintFn): void {
  const sessions = listSessions();
  
  if (sessions.length === 0) {
    printBox(
      [
        paint("No saved sessions", `${bold}${theme.warning}`),
        "",
        `${paint("/saveas name", theme.primary)}  Save current session`,
      ],
      theme.warning,
      40,
      printFn
    );
    return;
  }

  const lines = [
    paint("Saved Sessions", `${bold}${theme.primary}`),
    "",
  ];

  for (const session of sessions.slice(0, 10)) {
    const date = formatDate(session.data.updatedAt || session.data.createdAt);
    const msgs = session.data.messages.length;
    const preview = session.data.messages[0]?.content.slice(0, 30) || "empty";
    lines.push(`${paint(session.name, theme.accent)}  ${date}  ${msgs} msgs`);
    lines.push(`  ${paint(preview, theme.dim)}`);
  }

  lines.push("");
  lines.push(`${paint("/load name", theme.primary)}  Load a session`);

  printBox(lines, theme.primary, 55, printFn);
}

export function cmdLoadByName(args: string, printFn?: PrintFn): SessionData | null {
  const name = args.trim();
  if (!name) {
    cmdLoad(printFn);
    return null;
  }

  const session = loadSessionByName(name);
  if (!session) {
    printBox(
      [
        paint("Session not found", `${bold}${theme.error}`),
        `${paint("Name:", theme.muted)} ${name}`,
        "",
        `${paint("/load", theme.primary)}  List available sessions`,
      ],
      theme.error,
      40,
      printFn
    );
    return null;
  }

  printBox(
    [
      paint("Session loaded", `${bold}${theme.success}`),
      `${paint("Name:", theme.muted)} ${paint(name, theme.primary)}`,
      `${paint("Messages:", theme.muted)} ${session.messages.length}`,
      `${paint("Provider:", theme.muted)} ${session.provider}/${session.model}`,
    ],
    theme.success,
    40,
    printFn
  );

  return session;
}

export function cmdResume(printFn?: PrintFn): SessionData | null {
  const sessions = listSessions();
  
  if (sessions.length === 0) {
    printBox(
      [
        paint("No sessions to resume", `${bold}${theme.warning}`),
      ],
      theme.warning,
      40,
      printFn
    );
    return null;
  }

  const latest = sessions[0];
  if (!latest) {
    return null;
  }

  printBox(
    [
      paint("Resumed session", `${bold}${theme.success}`),
      `${paint("Name:", theme.muted)} ${paint(latest.name, theme.primary)}`,
      `${paint("Messages:", theme.muted)} ${latest.data.messages.length}`,
      `${paint("Provider:", theme.muted)} ${latest.data.provider}/${latest.data.model}`,
    ],
    theme.success,
    40,
    printFn
  );

  return latest.data;
}