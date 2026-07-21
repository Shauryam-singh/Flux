#!/usr/bin/env node

import type { ProviderName } from "@ai-agent/providers";
import { DefaultProviderFactory } from "@ai-agent/providers";
import { DefaultSession, type AgentMode } from "@ai-agent/agent";
import { loadAppConfig } from "./config.js";
import { createAgent } from "./chat/agent.js";
import { extractText, renderMessage } from "./chat/format.js";
import {
  loadSession,
  saveSession,
  saveSessionAs,
  createSession,
  addMessage,
  countTokens,
  formatDuration,
  formatTokens,
  formatDate,
  listSessions,
  loadSessionByName,
  type SessionData,
  type SessionMessage,
} from "./session/store.js";
import {
  cmdHelp,
  cmdHistory,
  cmdSuggest,
  cmdModels,
} from "./commands/index.js";
import {
  MODES,
  getNextMode,
  getModeColor,
  getModeSymbol,
} from "./modes/index.js";
import { paint, bold, theme } from "./ui/theme.js";
import { printHeader } from "./ui/banner.js";
import { Spinner, animateBootBar } from "./ui/spinners.js";
import {
  clearScreen,
  cleanupTerminal,
  setupStdinRaw,
  onExit,
} from "./ui/terminal.js";
import * as readline from "node:readline";
import { execSync } from "node:child_process";

const COMMAND_NAMES = [
  "help",
  "history",
  "suggest",
  "models",
  "mode",
  "clear",
  "save",
  "saveas",
  "load",
  "resume",
  "exit",
  "quit",
];

function wordBoundaryLeft(buffer: string, pos: number): number {
  let i = pos - 1;
  while (i >= 0 && !/\w/.test(buffer[i] ?? "")) i--;
  while (i >= 0 && /\w/.test(buffer[i] ?? "")) i--;
  return i + 1;
}

function wordBoundaryRight(buffer: string, pos: number): number {
  let i = pos;
  while (i < buffer.length && /\w/.test(buffer[i] ?? "")) i++;
  while (i < buffer.length && !/\w/.test(buffer[i] ?? "")) i++;
  return i;
}

function getCommandSuggestion(input: string): string | null {
  const trimmed = input.trimStart();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) {
    const partial = trimmed.slice(1).toLowerCase();
    if (!partial) return null;
    const matches = COMMAND_NAMES.filter((c) => c.startsWith(partial));
    if (matches.length === 1) return matches[0] ?? null;
    return null;
  }
  // Also suggest commands when typing
  const lower = trimmed.toLowerCase();
  for (const name of COMMAND_NAMES) {
    if (name.startsWith(lower) && name !== lower) {
      return `/${name}`;
    }
  }
  return null;
}

function parseToolCall(text: string): { tool: string; input: Record<string, unknown> } | null {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { tool?: string; input?: Record<string, unknown> };
    if (typeof parsed.tool === "string") {
      return {
        tool: parsed.tool,
        input: typeof parsed.input === "object" && parsed.input !== null ? parsed.input : {},
      };
    }
  } catch {
    // Not JSON
  }
  return null;
}

function getToolStatusMessage(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "echo":
      return "";
    case "read_file":
      return paint(`Read ${(input as { path?: string }).path ?? "file"}`, theme.accent);
    case "write_file":
      return paint(`Created ${(input as { path?: string }).path ?? "file"}`, theme.accent);
    case "edit_file":
      return paint(`Edited ${(input as { path?: string }).path ?? "file"}`, theme.accent);
    case "list_directory":
      return paint(`Listed ${(input as { path?: string }).path ?? "directory"}`, theme.accent);
    case "run_command":
      return paint(`Ran command`, theme.accent);
    case "git_status":
      return paint(`Checked git status`, theme.accent);
    case "git_diff":
      return paint(`Showed git diff`, theme.accent);
    case "git_log":
      return paint(`Showed git log`, theme.accent);
    case "git_add":
      return paint(`Staged ${(input as { files?: string }).files ?? "files"}`, theme.accent);
    case "git_commit":
      return paint(`Committed changes`, theme.accent);
    case "git_branch":
      return paint(`Listed branches`, theme.accent);
    case "git_checkout":
      return paint(`Switched to ${(input as { branch?: string }).branch ?? "branch"}`, theme.accent);
    case "git_push":
      return paint(`Pushed to remote`, theme.accent);
    case "git_pull":
      return paint(`Pulled from remote`, theme.accent);
    default:
      return paint(`Used ${toolName}`, theme.accent);
  }
}

function formatToolResult(toolName: string, input: Record<string, unknown>, result: unknown): string {
  if (toolName === "echo") {
    const msg = (input as { message?: string }).message ?? String(result);
    return msg;
  }

  const lines: string[] = [];

  if (toolName === "read_file") {
    lines.push(String(result));
  } else if (toolName === "write_file") {
    const r = result as { path?: string; bytesWritten?: number } | string;
    if (typeof r === "object" && r !== null) {
      if (r.bytesWritten !== undefined) {
        lines.push(paint(`${r.bytesWritten} bytes written`, theme.muted));
      }
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "edit_file") {
    const r = result as { path?: string; bytesWritten?: number } | string;
    if (typeof r === "object" && r !== null) {
      lines.push(paint(`Updated`, theme.muted));
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "list_directory") {
    const r = result as { path?: string; entries?: string[] } | string;
    if (typeof r === "object" && r !== null && r.entries) {
      for (const entry of r.entries) {
        lines.push(`  ${entry}`);
      }
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "run_command") {
    lines.push(String(result));
  } else if (toolName === "git_status") {
    const r = result as { branch?: string; files?: Array<{ status: string; file: string }>; summary?: string };
    if (typeof r === "object" && r !== null) {
      if (r.branch) lines.push(paint(`Branch: ${r.branch}`, theme.accent));
      if (r.files && r.files.length > 0) {
        for (const f of r.files) {
          const statusColor = f.status === "modified" ? theme.warning : f.status === "staged" ? theme.success : f.status === "untracked" ? theme.muted : theme.text;
          lines.push(`  ${paint(f.status, statusColor)} ${f.file}`);
        }
      }
      if (r.summary) lines.push(paint(r.summary, theme.muted));
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "git_diff") {
    const r = result as { diff?: string; file?: string; staged?: boolean };
    if (typeof r === "object" && r !== null && r.diff) {
      lines.push(r.diff);
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "git_log") {
    const r = result as { commits?: Array<{ hash: string; message: string }>; count?: number };
    if (typeof r === "object" && r !== null && r.commits) {
      for (const c of r.commits) {
        lines.push(`  ${paint(c.hash.slice(0, 7), theme.accent)} ${c.message}`);
      }
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "git_add") {
    const r = result as { files?: string; message?: string };
    if (typeof r === "object" && r !== null) {
      lines.push(paint(r.message || `Staged ${r.files}`, theme.success));
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "git_commit") {
    const r = result as { message?: string; output?: string };
    if (typeof r === "object" && r !== null) {
      lines.push(paint(`Committed: ${r.message}`, theme.success));
      if (r.output) lines.push(r.output);
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "git_branch") {
    const r = result as { branches?: Array<{ name: string; current: boolean }>; current?: string };
    if (typeof r === "object" && r !== null && r.branches) {
      for (const b of r.branches) {
        const marker = b.current ? paint("* ", theme.success) : "  ";
        const name = b.current ? paint(b.name, theme.success) : b.name;
        lines.push(`${marker}${name}`);
      }
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "git_checkout") {
    const r = result as { branch?: string; message?: string };
    if (typeof r === "object" && r !== null) {
      lines.push(paint(r.message || `Switched to ${r.branch}`, theme.success));
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "git_push") {
    const r = result as { remote?: string; branch?: string; output?: string };
    if (typeof r === "object" && r !== null) {
      lines.push(paint(`Pushed to ${r.remote}/${r.branch}`, theme.success));
      if (r.output) lines.push(r.output);
    } else {
      lines.push(String(result));
    }
  } else if (toolName === "git_pull") {
    const r = result as { remote?: string; output?: string };
    if (typeof r === "object" && r !== null) {
      lines.push(paint(`Pulled from ${r.remote}`, theme.success));
      if (r.output) lines.push(r.output);
    } else {
      lines.push(String(result));
    }
  } else {
    lines.push(String(result));
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const { app, providerConfigs } = loadAppConfig();
  const factory = new DefaultProviderFactory(providerConfigs);

  let currentProvider: ProviderName = "ollama";
  let currentModel = app.providers.ollama.defaultModel || "qwen2.5:0.5b";

  let sessionData: SessionData = createSession(currentProvider, currentModel);

  const savedSession = loadSession();
  let hasResumableSession = false;
  if (savedSession && savedSession.messages.length > 0) {
    hasResumableSession = true;
  }

  let branch = "main";
  let cwd = process.cwd();
  try {
    branch = execSync(
      "git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main",
      { stdio: "pipe" },
    )
      .toString()
      .trim();
  } catch {}

  clearScreen();
  printHeader(currentProvider, currentModel, cwd, branch);
  await animateBootBar("Initializing", 200);

  if (hasResumableSession) {
    const count = savedSession!.messages.length;
    process.stdout.write(
      paint(
        `\nFound saved session (${count} messages). Type /load to resume.\n\n`,
        theme.muted,
      ),
    );
  }

  process.stdout.write(paint("Ready — type a message or /help\n\n", theme.muted));

  let buffer = "";
  let cursorPos = 0;
  let historyIdx = -1;
  let draft = "";
  const inputHistory: string[] = [];
  let currentMode: AgentMode = "normal";
  let promptLine = 0; // Track which line the prompt is on

  const PROMPT = `${paint(">", theme.accent)} `;

  function getModeIndicator(): string {
    const color = getModeColor(currentMode);
    const symbol = getModeSymbol(currentMode);
    return paint(`${symbol} ${currentMode}`, color);
  }

  function printStatusLine() {
    const suggestion = getCommandSuggestion(buffer);
    const mode = getModeIndicator();
    let status = `  ${mode}`;
    if (suggestion) {
      status += `  ${paint(suggestion, theme.dim)}`;
    }
    process.stdout.write(status);
  }

  function reprintPrompt() {
    // Go back to prompt line, clear both lines, reprint
    process.stdout.write("\x1b[2A"); // Up 2 lines
    process.stdout.write("\x1b[2K"); // Clear prompt line
    process.stdout.write(`${PROMPT}${paint(buffer, theme.text)}`);
    process.stdout.write(`\x1b[${3 + cursorPos}G`); // Position cursor
    process.stdout.write("\n"); // Down to status line
    process.stdout.write("\x1b[2K"); // Clear status line
    printStatusLine();
    process.stdout.write("\n"); // Down to next line (consistent with initial state)
  }

  function printPrompt() {
    process.stdout.write(`${PROMPT}${paint(buffer, theme.text)}`);
  }

  function printToChat(text: string) {
    process.stdout.write(text + "\n");
  }

  async function handleInput(input: string): Promise<void> {
    if (!input.trim()) return;

    if (input.startsWith("/")) {
      const [rawCmd, ...rest] = input.slice(1).trim().split(/\s+/);
      const cmd = (rawCmd || "").toLowerCase();
      const args = rest.join(" ");

      switch (cmd) {
        case "help":
          cmdHelp();
          printPrompt();
          return;
        case "history":
          cmdHistory(sessionData.messages);
          printPrompt();
          return;
        case "suggest":
          cmdSuggest();
          printPrompt();
          return;
        case "models":
          await cmdModels(
            args,
            currentProvider,
            currentModel,
            async (p) => [...(await factory.create(p).listModels())],
            (p, m) => {
              currentProvider = p;
              currentModel = m;
              sessionData.provider = p;
              sessionData.model = m;
              saveSession(sessionData);
            },
          );
          printPrompt();
          return;
        case "clear":
          clearScreen();
          printHeader(currentProvider, currentModel, cwd, branch);
          process.stdout.write(paint("\n", theme.muted));
          printPrompt();
          return;
        case "save":
          saveSession(sessionData);
          printToChat(paint("Session saved", theme.success));
          printToChat("");
          printPrompt();
          return;
        case "saveas": {
          const sessionName = args.trim();
          if (!sessionName) {
            printToChat(paint("Usage: /saveas <session-name>", theme.warning));
            printToChat("");
            printPrompt();
            return;
          }
          saveSessionAs(sessionData, sessionName);
          printToChat(paint(`Session saved as "${sessionName}"`, theme.success));
          printToChat("");
          printPrompt();
          return;
        }
        case "load": {
          const sessions = listSessions();

          // Also add current session if it has messages
          if (savedSession && savedSession.messages.length > 0) {
            const currentExists = sessions.some(s => s.name === "current");
            if (!currentExists) {
              sessions.unshift({ name: "current", path: "", data: savedSession });
            }
          }

          if (sessions.length === 0) {
            printToChat(paint("No saved sessions found", theme.warning));
            printToChat("");
            printPrompt();
            return;
          }

          // Show session list
          printToChat("");
          printToChat(paint("Available sessions:", theme.accent));
          printToChat("");

          for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i]!;
            const msgCount = session.data.messages.length;
            const date = formatDate(session.data.updatedAt || session.data.createdAt);
            const provider = session.data.provider;
            const model = session.data.model;
            printToChat(
              `  ${paint(`${i + 1}.`, theme.primary)} ${paint(session.name, theme.text)} — ${msgCount} messages, ${date} (${provider}/${model})`
            );
          }

          printToChat("");
          printToChat(paint("Enter session number to load:", theme.muted));
          printToChat("");

          // Read user input for selection using keypress handler
          process.stdout.write(`${PROMPT}`);

          const answer = await new Promise<string>((resolve) => {
            let inputBuffer = "";

            const handler = (_str: string, key: readline.Key) => {
              if (!key) return;

              if (key.name === "return" || key.name === "enter") {
                process.stdin.removeListener("keypress", handler);
                process.stdout.write("\n");
                resolve(inputBuffer);
                return;
              }

              if (key.name === "backspace") {
                if (inputBuffer.length > 0) {
                  inputBuffer = inputBuffer.slice(0, -1);
                  process.stdout.write("\r\x1b[2K" + PROMPT + paint(inputBuffer, theme.text));
                }
                return;
              }

              if (_str && !key.ctrl && !key.meta) {
                inputBuffer += _str;
                process.stdout.write(paint(_str, theme.text));
              }
            };

            process.stdin.on("keypress", handler);
          });

          const idx = parseInt(answer, 10) - 1;
          if (isNaN(idx) || idx < 0 || idx >= sessions.length) {
            printToChat(paint("Invalid selection", theme.error));
            printToChat("");
            printPrompt();
            return;
          }

          const selected = sessions[idx]!;
          sessionData = selected.data;
          currentProvider = selected.data.provider;
          currentModel = selected.data.model;
          hasResumableSession = false;

          clearScreen();
          printHeader(currentProvider, currentModel, cwd, branch);
          process.stdout.write(
            paint(
              `\nLoaded session "${selected.name}" with ${sessionData.messages.length} messages\n\n`,
              theme.success,
            ),
          );
          for (const msg of sessionData.messages) {
            process.stdout.write(renderMessage(msg) + "\n");
          }
          process.stdout.write("\n");
          printPrompt();
          return;
        }
        case "resume": {
          if (!savedSession || savedSession.messages.length === 0) {
            printToChat(paint("No saved session found", theme.warning));
            printToChat("");
            printPrompt();
            return;
          }
          sessionData = savedSession;
          currentProvider = savedSession.provider;
          currentModel = savedSession.model;
          hasResumableSession = false;
          clearScreen();
          printHeader(currentProvider, currentModel, cwd, branch);
          process.stdout.write(
            paint(
              `\nResumed ${sessionData.messages.length} messages\n\n`,
              theme.success,
            ),
          );
          for (const msg of sessionData.messages) {
            process.stdout.write(renderMessage(msg) + "\n");
          }
          process.stdout.write("\n");
          printPrompt();
          return;
        }
        case "exit":
        case "quit":
          saveSession(sessionData);
          printToChat(paint("Session saved. Goodbye!", `${bold}${theme.accent}`));
          cleanupTerminal();
          process.exit(0);
        case "mode": {
          const modeArg = args.trim().toLowerCase();
          if (!modeArg || !["plan", "auto", "normal"].includes(modeArg)) {
            printToChat(paint("Available modes:", theme.accent));
            printToChat(`  ${paint("plan", theme.primary)} — Show plan only, no execution`);
            printToChat(`  ${paint("auto", theme.primary)} — Execute without approval`);
            printToChat(`  ${paint("normal", theme.primary)} — Ask before file edits (default)`);
            printToChat("");
            printToChat(paint(`Current mode: ${getModeSymbol(currentMode)} ${currentMode}`, theme.success));
            printToChat("");
            printToChat(paint(`Usage: /mode <plan|auto|normal>`, theme.muted));
            printToChat(paint(`Key binding: Ctrl+M to cycle modes`, theme.muted));
            printToChat("");
            printPrompt();
            return;
          }
          currentMode = modeArg as AgentMode;
          printToChat(paint(`Switched to ${getModeSymbol(currentMode)} ${currentMode} mode`, theme.success));
          printToChat("");
          printPrompt();
          return;
        }
        default:
          printToChat(paint(`Unknown command: /${cmd}`, theme.error));
          printToChat("");
          printPrompt();
          return;
      }
    }

    // Print user message
    process.stdout.write(`${PROMPT}${paint(input, theme.text)}\n`);

    // Chat with agent
    const userMsg: SessionMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };
    addMessage(sessionData, userMsg);

    const spinner = new Spinner(["Thinking", "Reasoning", "Planning"]);
    spinner.start();
    const start = Date.now();

    try {
      const agent = createAgent({
        provider: currentProvider,
        model: currentModel,
        providerConfigs,
      });
      const agentSession = new DefaultSession("chat-" + Date.now());

      let fullText = "";
      let firstToken = true;
      let lastToolResult: unknown = null;
      let lastToolName = "";
      let lastToolInput: Record<string, unknown> = {};

      await agent.runStream(agentSession, {
        input: { message: input, type: "chat" },
        mode: currentMode,
      }, {
        onToken: (token) => {
          fullText += token;
          if (firstToken) {
            spinner.stop();
            firstToken = false;
          }
        },
        onToolResult: (toolName, toolInput, result) => {
          // Extract output from ToolResult
          const toolResult = result as { success?: boolean; output?: unknown };
          lastToolResult = toolResult.output ?? result;
          lastToolName = toolName;
          lastToolInput = toolInput;
        },
        onPlanOnly: (toolName, toolInput) => {
          // Show what would be done in plan mode
          const statusMsg = getToolStatusMessage(toolName, toolInput);
          if (statusMsg) {
            process.stdout.write(statusMsg + "\n");
          }
        },
        onApprovalRequired: async (toolName, toolInput) => {
          // Ask for approval in normal mode
          const statusMsg = getToolStatusMessage(toolName, toolInput);
          if (statusMsg) {
            process.stdout.write(statusMsg + "\n");
          }
          process.stdout.write(paint("  Approve? (y/n): ", theme.warning));
          const answer = await new Promise<string>((resolve) => {
            let inputBuffer = "";
            const handler = (_str: string, key: readline.Key) => {
              if (!key) return;
              if (key.name === "return" || key.name === "enter") {
                process.stdin.removeListener("keypress", handler);
                process.stdout.write("\n");
                resolve(inputBuffer);
                return;
              }
              if (_str && !key.ctrl && !key.meta) {
                inputBuffer += _str;
                process.stdout.write(paint(_str, theme.text));
              }
            };
            process.stdin.on("keypress", handler);
          });
          return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
        },
        onDone: (response) => {
          const durationMs = Date.now() - start;

          if (firstToken) {
            spinner.stop();
            firstToken = false;
          }

          // Show "Thought for Xms" message
          process.stdout.write("\n");
          process.stdout.write(paint(`  Thought for ${formatDuration(durationMs)}`, theme.dim) + "\n");

          // Format display text
          let displayText: string;

          if (lastToolName) {
            // Show tool status message
            const statusMsg = getToolStatusMessage(lastToolName, lastToolInput);
            if (statusMsg) {
              process.stdout.write(statusMsg + "\n");
            }
            displayText = formatToolResult(lastToolName, lastToolInput, lastToolResult);
          } else {
            displayText = fullText;
          }

          const inputTokens = countTokens(input);
          const outputTokens = countTokens(fullText);

          const assistantMsg: SessionMessage = {
            role: "assistant",
            content: displayText,
            timestamp: new Date().toISOString(),
            provider: currentProvider,
            model: currentModel,
            durationMs,
            inputTokens,
            outputTokens,
            ...(lastToolName ? { toolUsed: lastToolName } : {}),
          };
          addMessage(sessionData, assistantMsg);

          process.stdout.write(displayText + "\n");
          process.stdout.write(paint(`  ${formatTokens(inputTokens)} in · ${formatTokens(outputTokens)} out · ${currentProvider}/${currentModel}`, theme.muted) + "\n\n");

          saveSession(sessionData);
        },
        onError: (error) => {
          spinner.stop();
          process.stdout.write("\n");
          printToChat(paint(`Error: ${error.message}`, theme.error));
          printToChat("");
        },
      });
    } catch (err) {
      spinner.stop();
      const msg = err instanceof Error ? err.message : String(err);
    printToChat("");
    printToChat(paint(`Error: ${msg}`, theme.error));
    printToChat("");
    }

    printPrompt();
    printStatusLine();
    process.stdout.write("\n");
  }

  setupStdinRaw();
  onExit(() => {
    saveSession(sessionData);
    cleanupTerminal();
  });

  process.stdout.on("resize", () => {
    clearScreen();
    printHeader(currentProvider, currentModel, cwd, branch);
    for (const msg of sessionData.messages.slice(-30)) {
      process.stdout.write(renderMessage(msg) + "\n");
    }
    process.stdout.write("\n");
    printPrompt();
    printStatusLine();
    process.stdout.write("\n");
  });

  printPrompt();
  printStatusLine();
  process.stdout.write("\n");

  // Bracketed paste tracking
  const PASTE_START = "\x1b[200~";
  const PASTE_END = "\x1b[201~";
  let inPaste = false;
  let pasteBuffer = "";

  process.stdin.on(
    "data",
    (data: Buffer) => {
      const str = data.toString();

      if (inPaste) {
        if (str.includes(PASTE_END)) {
          const endIdx = str.indexOf(PASTE_END);
          pasteBuffer += str.slice(0, endIdx);
          inPaste = false;
          buffer = buffer.slice(0, cursorPos) + pasteBuffer + buffer.slice(cursorPos);
          cursorPos += pasteBuffer.length;
          reprintPrompt();
          pasteBuffer = "";
        } else {
          pasteBuffer += str;
        }
        return;
      }

      if (str.includes(PASTE_START)) {
        inPaste = true;
        pasteBuffer = "";
        const afterStart = str.slice(str.indexOf(PASTE_START) + PASTE_START.length);
        if (afterStart.includes(PASTE_END)) {
          const endIdx = afterStart.indexOf(PASTE_END);
          pasteBuffer = afterStart.slice(0, endIdx);
          inPaste = false;
          buffer = buffer.slice(0, cursorPos) + pasteBuffer + buffer.slice(cursorPos);
          cursorPos += pasteBuffer.length;
          reprintPrompt();
          pasteBuffer = "";
        } else {
          pasteBuffer += afterStart;
        }
        return;
      }
    },
  );

  process.stdin.on(
    "keypress",
    (_str: string, key: readline.Key & { sequence?: string }) => {
      if (!key) return;

      if (inPaste) return;

      if (key.ctrl && key.name === "c") {
        saveSession(sessionData);
        cleanupTerminal();
        process.exit(0);
      }

      // Mode switching - cycles through: normal -> plan -> auto -> normal
      if (key.ctrl && key.name === "m") {
        currentMode = getNextMode(currentMode);
        reprintPrompt();
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        const input = buffer;
        buffer = "";
        cursorPos = 0;
        historyIdx = -1;
        process.stdout.write(`\r\x1b[2K`);
        void handleInput(input);
        return;
      }

      if (key.name === "backspace") {
        if (cursorPos > 0) {
          buffer = buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos);
          cursorPos--;
        }
        reprintPrompt();
        return;
      }

      if (key.name === "delete") {
        buffer = buffer.slice(0, cursorPos) + buffer.slice(cursorPos + 1);
        reprintPrompt();
        return;
      }

      if (key.name === "left" && key.ctrl) {
        cursorPos = wordBoundaryLeft(buffer, cursorPos);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.name === "right" && key.ctrl) {
        cursorPos = wordBoundaryRight(buffer, cursorPos);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.name === "left") {
        if (cursorPos > 0) cursorPos--;
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.name === "right") {
        if (cursorPos < buffer.length) cursorPos++;
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.name === "up") {
        if (inputHistory.length === 0) return;
        if (historyIdx === -1) draft = buffer;
        historyIdx = Math.min(historyIdx + 1, inputHistory.length - 1);
        buffer = inputHistory[inputHistory.length - 1 - historyIdx] ?? "";
        cursorPos = buffer.length;
        reprintPrompt();
        return;
      }

      if (key.name === "down") {
        if (historyIdx === -1) return;
        historyIdx--;
        buffer =
          historyIdx === -1
            ? draft
            : (inputHistory[inputHistory.length - 1 - historyIdx] ?? "");
        cursorPos = buffer.length;
        reprintPrompt();
        return;
      }

      if (key.name === "tab") {
        if (buffer.startsWith("/")) {
          const p = buffer.slice(1).toLowerCase();
          const match = COMMAND_NAMES.find((c) => c.startsWith(p));
          if (match) {
            buffer = "/" + match;
            cursorPos = buffer.length;
          }
        }
        reprintPrompt();
        return;
      }

      if (key.name === "home") {
        cursorPos = 0;
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.name === "end") {
        cursorPos = buffer.length;
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.ctrl && key.name === "a") {
        cursorPos = 0;
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.ctrl && key.name === "e") {
        cursorPos = buffer.length;
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.ctrl && key.name === "w") {
        const newPos = wordBoundaryLeft(buffer, cursorPos);
        buffer = buffer.slice(0, newPos) + buffer.slice(cursorPos);
        cursorPos = newPos;
        process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.ctrl && key.name === "u") {
        buffer = buffer.slice(cursorPos);
        cursorPos = 0;
        process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.ctrl && key.name === "k") {
        buffer = buffer.slice(0, cursorPos);
        process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      // Regular characters
      if (_str && !key.ctrl && !key.meta && !key.sequence?.includes("\x1b")) {
        buffer = buffer.slice(0, cursorPos) + _str + buffer.slice(cursorPos);
        cursorPos += _str.length;
        historyIdx = -1;
        inputHistory.push(buffer);
        process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
      }
    },
  );
}

main().catch((e: Error) => {
  cleanupTerminal();
  console.error(`${paint("Fatal:", theme.error)} ${e.message}`);
  process.exit(1);
});
