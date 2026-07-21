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
  createSession,
  addMessage,
  countTokens,
  formatDuration,
  formatTokens,
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
  getModeColor,
  getModeSymbol,
  getNextMode,
} from "./modes/index.js";
import { highlightMarkdown } from "./ui/highlight.js";
import { formatDiffPreview } from "./ui/diff.js";

function getToolStatusMessage(toolName: string, input: Record<string, unknown>): string | null {
  switch (toolName) {
    case "write_file":
      return paint(`  Writing to ${input.path || "file"}...`, theme.primary);
    case "edit_file":
      return paint(`  Editing ${input.path || "file"}...`, theme.primary);
    case "read_file":
      return paint(`  Reading ${input.path || "file"}...`, theme.dim);
    case "list_directory":
      return paint(`  Listing ${input.path || "directory"}...`, theme.dim);
    case "run_command":
      return paint(`  Running: ${input.command || "command"}`, theme.dim);
    case "git_status":
      return paint(`  Checking git status...`, theme.dim);
    case "git_diff":
      return paint(`  Getting git diff...`, theme.dim);
    case "git_log":
      return paint(`  Getting git log...`, theme.dim);
    case "git_add":
      return paint(`  Staging ${input.files || "files"}...`, theme.primary);
    case "git_commit":
      return paint(`  Committing: ${input.message || "changes"}...`, theme.primary);
    case "echo":
      return null; // Don't show status for echo
    default:
      return paint(`  Using ${toolName}...`, theme.dim);
  }
}

function extractResponseText(text: string): string {
  // Try to extract all echo messages from response
  const messages: string[] = [];
  
  // Match JSON objects with tool: "echo"
  const jsonRegex = /\{"tool":\s*"echo",\s*"input":\s*\{"message":\s*"([^"]*(?:\\.[^"]*)*)"\s*\}\}/g;
  let match;
  
  while ((match = jsonRegex.exec(text)) !== null) {
    if (match[1]) {
      const msg = match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      messages.push(msg);
    }
  }
  
  if (messages.length > 0) {
    return messages.join("\n\n");
  }
  
  // Try to parse as single JSON
  try {
    const parsed = JSON.parse(text);
    if (parsed.tool === "echo" && parsed.input?.message) {
      return parsed.input.message;
    }
  } catch {
    // Not valid JSON
  }
  
  // Return as-is if no echo messages found
  return text;
}
import { paint, bold, theme, dim, visibleLength } from "./ui/theme.js";
import { printHeader } from "./ui/banner.js";
import { Spinner } from "./ui/spinners.js";
import {
  clearScreen,
  cleanupTerminal,
  setupStdinRaw,
  onExit,
  moveTo,
  clearLine,
} from "./ui/terminal.js";
import * as readline from "node:readline";
import { execSync } from "node:child_process";

const COMMAND_NAMES = [
  "help", "history", "suggest", "models", "mode", "clear", "save", "saveas", "load", "resume", "exit", "quit",
];

const FOOTER_HEIGHT = 7;

// Claude Theme Palette Overlay
const claudeTheme = {
  coral: "\x1b[38;5;208m",      // Main accent (Claude Coral/Orange)
  userBadge: "\x1b[38;5;75m",   // Soft blue for user
  agentBadge: "\x1b[38;5;208m",  // Orange for assistant
  text: "\x1b[38;5;253m",       // Off-white crisp text
  dim: "\x1b[38;5;241m",        // Muted gray
  border: "\x1b[38;5;238m",     // Subtle box border
};

function getTermSize(): { rows: number; cols: number } {
  return { rows: process.stdout.rows || 24, cols: process.stdout.columns || 80 };
}

function setScrollRegion(topRow: number, bottomRow: number) {
  process.stdout.write(`\x1b[${topRow};${bottomRow}r`);
}

function resetScrollRegion() {
  process.stdout.write("\x1b[r");
}

function drawInputBox(buffer: string, cursorPos: number, mode: AgentMode, cols: number) {
  const boxWidth = Math.max(30, cols - 4);
  const modeStr = `${getModeSymbol(mode)} ${mode.toUpperCase()}`;
  const modeColor = getModeColor(mode);

  // Top border
  const topBorder = `${paint("┌", claudeTheme.border)}${paint("─".repeat(boxWidth - 2), claudeTheme.border)}${paint("┐", claudeTheme.border)}`;
  process.stdout.write(`\r${topBorder}\n`);

  // Input line with prompt and buffer
  const promptText = `${paint("❯", claudeTheme.coral)} `;
  const promptVisLen = visibleLength(promptText);
  const innerWidth = boxWidth - 4;
  const availableWidth = innerWidth - promptVisLen;

  const displayBuffer = buffer.length > availableWidth 
    ? "…" + buffer.slice(-(availableWidth - 1))
    : buffer;

  const contentLine = promptText + paint(displayBuffer, claudeTheme.text);
  const paddingNeeded = Math.max(0, innerWidth - visibleLength(contentLine));
  const line = `${paint("│", claudeTheme.border)} ${contentLine}${" ".repeat(paddingNeeded)} ${paint("│", claudeTheme.border)}`;
  process.stdout.write(`${line}\n`);

  // Status line
  const statusFormatted = paint(modeStr, modeColor);
  const statusPadding = Math.max(0, innerWidth - visibleLength(statusFormatted));
  const statusLine = `${paint("│", claudeTheme.border)} ${statusFormatted}${" ".repeat(statusPadding)} ${paint("│", claudeTheme.border)}`;
  process.stdout.write(`${statusLine}\n`);

  // Bottom border
  const bottomBorder = `${paint("└", claudeTheme.border)}${paint("─".repeat(boxWidth - 2), claudeTheme.border)}${paint("┘", claudeTheme.border)}`;
  process.stdout.write(`${bottomBorder}\n`);

  // Replace the hint line inside drawInputBox with:
const hintText = paint(" Shift+Tab mode • Tab autocomplete • /help commands", claudeTheme.dim);
process.stdout.write(` ${hintText}`);
}

async function main(): Promise<void> {
  const { app, providerConfigs } = loadAppConfig();
  const factory = new DefaultProviderFactory(providerConfigs);

  let currentProvider: ProviderName = "ollama";
  let currentModel = app.providers.ollama.defaultModel || "qwen2.5:0.5b";

  let sessionData: SessionData = createSession(currentProvider, currentModel);

  let branch = "main";
  let cwd = process.cwd();
  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main", { stdio: "pipe" })
      .toString().trim();
  } catch {}

  clearScreen();
  printHeader(currentProvider, currentModel, cwd, branch);
  const spinner = new Spinner(["Initializing"]);
  spinner.start();
  await new Promise((resolve) => setTimeout(resolve, 200));
  spinner.stop();

  process.stdout.write(paint(" Ready — type a message or /help\n\n", claudeTheme.dim));

  let buffer = "";
  let cursorPos = 0;
  let historyIdx = -1;
  let draft = "";
  const inputHistory: string[] = [];
  let currentMode: AgentMode = "normal";

  function redrawFooter() {
    const { rows, cols } = getTermSize();
    const startRow = rows - FOOTER_HEIGHT + 1;

    for (let i = 0; i < FOOTER_HEIGHT; i++) {
      moveTo(startRow + i, 1);
      clearLine();
    }

    moveTo(startRow, 1);
    drawInputBox(buffer, cursorPos, currentMode, cols);

    const boxWidth = Math.max(30, cols - 4);
    const innerWidth = boxWidth - 4;
    const promptVisLen = 2; // "❯ "
    const availableWidth = innerWidth - promptVisLen;

    const hiddenChars = buffer.length > availableWidth ? buffer.length - availableWidth + 1 : 0;
    const visibleCursorPos = Math.max(0, cursorPos - hiddenChars);

    const inputRow = startRow + 1;
    const cursorCol = 3 + promptVisLen + visibleCursorPos;

    moveTo(inputRow, cursorCol);
  }

  function printToChatArea(text: string) {
    const { rows } = getTermSize();
    const chatBottom = rows - FOOTER_HEIGHT;
    
    // Move to chat area bottom and output standard scrolled text
    moveTo(chatBottom, 1);
    process.stdout.write("\n" + text + "\n");
  }

  function printFormattedMessage(role: "user" | "assistant", content: string, meta?: string) {
    const cols = getTermSize().cols;
    const divider = paint("─".repeat(Math.min(60, cols - 4)), claudeTheme.dim);

    if (role === "user") {
      printToChatArea(`${paint("● You", bold + claudeTheme.userBadge)}\n` + content.split("\n").map(l => `  ${l}`).join("\n") + `\n  ${divider}`);
    } else {
      let msg = `${paint("✦ Agent", bold + claudeTheme.coral)}\n` + content.split("\n").map(l => `  ${l}`).join("\n");
      if (meta) {
        msg += `\n${paint(`  ${meta}`, claudeTheme.dim)}`;
      }
      msg += `\n  ${divider}`;
      printToChatArea(msg);
    }
  }

  function writeStatusLine(text: string) {
    const { rows } = getTermSize();
    const statusRow = rows - FOOTER_HEIGHT + 3;

    moveTo(statusRow, 3);
    process.stdout.write(paint(text, claudeTheme.coral));
  }

  // Create persistent agent session for conversation history
  const agent = createAgent({
    provider: currentProvider,
    model: currentModel,
    providerConfigs,
  });
  const agentSession = new DefaultSession("cli-session");

  async function handleInput(input: string): Promise<void> {
    if (!input.trim()) {
      redrawFooter();
      return;
    }
    inputHistory.push(input);

    if (input.startsWith("/")) {
      const [rawCmd, ...rest] = input.slice(1).trim().split(/\s+/);
      const cmd = (rawCmd || "").toLowerCase();
      const args = rest.join(" ");

      switch (cmd) {
        case "help":
          cmdHelp(printToChatArea);
          redrawFooter();
          return;
        case "history":
          cmdHistory(sessionData.messages, printToChatArea);
          redrawFooter();
          return;
        case "suggest":
          cmdSuggest(printToChatArea);
          redrawFooter();
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
            printToChatArea
          );
          redrawFooter();
          return;
        case "clear":
          clearScreen();
          printHeader(currentProvider, currentModel, cwd, branch);
          process.stdout.write("\n");
          redrawFooter();
          return;
        case "save":
          saveSession(sessionData);
          printToChatArea(paint("✓ Session saved", theme.success));
          redrawFooter();
          return;
        case "exit":
        case "quit":
          saveSession(sessionData);
          cleanupTerminal();
          process.exit(0);
        case "mode": {
          const modeArg = args.trim().toLowerCase();
          if (!["plan", "auto", "normal"].includes(modeArg)) {
            printToChatArea(paint(`Available modes: plan, auto, normal`, claudeTheme.coral));
            redrawFooter();
            return;
          }
          currentMode = modeArg as AgentMode;
          redrawFooter();
          return;
        }
        default:
          printToChatArea(paint(`Unknown command: /${cmd}`, theme.error));
          redrawFooter();
          return;
      }
    }

    printFormattedMessage("user", input);

    const userMsg: SessionMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };
    addMessage(sessionData, userMsg);

    const spinner = new Spinner(["Thinking", "Reasoning", "Planning"], (frame) => {
      writeStatusLine(frame);
    });

    spinner.start();
    const start = Date.now();

    try {
      let fullText = "";
      let toolCalled = false;
      let toolInput: Record<string, unknown> = {};
      let toolResult: unknown = null;

      await agent.runStream(agentSession, {
        input: { message: input, type: "chat" },
        mode: currentMode,
      }, {
        onToken: (token) => {
          fullText += token;
        },
        onToolResult: (name, inp, res) => {
          toolCalled = true;
          toolInput = inp;
          toolResult = res;
        },
        onPlanOnly: (name, inp) => {
          // In plan mode, show what would be done with diff preview
          const statusMsg = getToolStatusMessage(name, inp);
          if (statusMsg) {
            printToChatArea(statusMsg);
          }
          
          // Show diff preview for file operations
          if (name === "write_file" || name === "edit_file") {
            const diffPreview = formatDiffPreview(name, inp);
            if (diffPreview) {
              printToChatArea(diffPreview);
            }
          }
        },
        onApprovalRequired: async (name, inp) => {
          // Ask for approval
          const statusMsg = getToolStatusMessage(name, inp);
          if (statusMsg) {
            printToChatArea(statusMsg);
          }
          printToChatArea(paint("  Approve? (y/n): ", theme.warning));
          // For now, auto-approve in non-interactive mode
          return true;
        },
        onOptionsPresented: async (options) => {
          // Present options to user and get selection
          printToChatArea(paint("\n  Select an option:", theme.primary));
          options.forEach((opt, i) => {
            printToChatArea(paint(`    ${i + 1}. ${opt}`, theme.text));
          });
          printToChatArea(paint("  Or type your own choice:", theme.dim));
          
          // Wait for user input (simplified - in real impl would need proper input handling)
          return options[0] || "";
        },
        onDone: (response) => {
          // Done
        },
      });

      spinner.stop();
      const durationMs = Date.now() - start;

      let text: string;
      if (toolCalled) {
        // For echo tool, extract the message
        if (toolInput && typeof toolInput.message === "string") {
          text = toolInput.message;
        } else {
          const resultObj = toolResult as { output?: string };
          text = resultObj.output || JSON.stringify(toolResult, null, 2);
        }
      } else {
        // Parse response - handle multiple JSON objects and mixed content
        text = extractResponseText(fullText);
      }

      // Apply syntax highlighting to code blocks
      const highlightedText = highlightMarkdown(text);

      const inputTokens = countTokens(input);
      const outputTokens = countTokens(text);

      const assistantMsg: SessionMessage = {
        role: "assistant",
        content: text,
        timestamp: new Date().toISOString(),
        provider: currentProvider,
        model: currentModel,
        durationMs,
        inputTokens,
        outputTokens,
      };
      addMessage(sessionData, assistantMsg);

      const metaText = `${formatTokens(inputTokens)} in · ${formatTokens(outputTokens)} out · ${formatDuration(durationMs)} · ${currentProvider}/${currentModel}`;
      printFormattedMessage("assistant", highlightedText, metaText);

      saveSession(sessionData);
    } catch (err) {
      spinner.stop();
      const msg = err instanceof Error ? err.message : String(err);
      printToChatArea(paint(`Error: ${msg}`, theme.error));
    }

    redrawFooter();
  }

  setupStdinRaw();
  onExit(() => {
    resetScrollRegion();
    saveSession(sessionData);
    cleanupTerminal();
  });

  process.stdout.on("resize", () => {
    clearScreen();
    printHeader(currentProvider, currentModel, cwd, branch);
    
    const recentMsgs = sessionData.messages.slice(-20);
    for (const msg of recentMsgs) {
      process.stdout.write(renderMessage(msg) + "\n");
    }
    process.stdout.write("\n");
    
    const { rows } = getTermSize();
    setScrollRegion(1, rows - FOOTER_HEIGHT);
    
    redrawFooter();
  });

  const { rows: termRows } = getTermSize();
  setScrollRegion(1, termRows - FOOTER_HEIGHT);

  redrawFooter();

  process.stdin.on("keypress", (_str: string, key: readline.Key) => {
    if (!key) return;

    if (key.ctrl && key.name === "c") {
      saveSession(sessionData);
      cleanupTerminal();
      process.exit(0);
    }

    // 1. Shift+Tab OR Ctrl+O cycles mode
    // Node.js identifies Shift+Tab as key.name === "tab" + key.shift === true,
    // or as sequence "\x1b[Z"
    const isShiftTab = 
      (key.name === "tab" && key.shift) || 
      key.sequence === "\x1b[Z";

    const isModeShortcut = isShiftTab || (key.ctrl && key.name === "o");

    if (isModeShortcut) {
      currentMode = getNextMode(currentMode);
      redrawFooter();
      return;
    }

    // 2. Standard Tab (without Shift) triggers autocompletion
    if (key.name === "tab" && !key.shift) {
      if (buffer.startsWith("/")) {
        const partial = buffer.slice(1).toLowerCase();
        const match = COMMAND_NAMES.find((c) => c.startsWith(partial));
        if (match) {
          buffer = "/" + match;
          cursorPos = buffer.length;
        }
      }
      redrawFooter();
      return;
    }

    // 3. Submit message on Enter
    if (key.name === "return" || key.name === "enter") {
      const input = buffer;
      buffer = "";
      cursorPos = 0;
      historyIdx = -1;
      void handleInput(input);
      return;
    }

    if (key.name === "backspace") {
      if (cursorPos > 0) {
        buffer = buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos);
        cursorPos--;
      }
      redrawFooter();
      return;
    }

    if (key.name === "delete") {
      buffer = buffer.slice(0, cursorPos) + buffer.slice(cursorPos + 1);
      redrawFooter();
      return;
    }

    if (key.name === "left") {
      if (cursorPos > 0) cursorPos--;
      redrawFooter();
      return;
    }

    if (key.name === "right") {
      if (cursorPos < buffer.length) cursorPos++;
      redrawFooter();
      return;
    }

    if (key.name === "up") {
      if (inputHistory.length === 0) return;
      if (historyIdx === -1) draft = buffer;
      historyIdx = Math.min(historyIdx + 1, inputHistory.length - 1);
      buffer = inputHistory[inputHistory.length - 1 - historyIdx] ?? "";
      cursorPos = buffer.length;
      redrawFooter();
      return;
    }

    if (key.name === "down") {
      if (historyIdx === -1) return;
      historyIdx--;
      buffer = historyIdx === -1 ? draft : (inputHistory[inputHistory.length - 1 - historyIdx] ?? "");
      cursorPos = buffer.length;
      redrawFooter();
      return;
    }

    if (key.name === "home") {
      cursorPos = 0;
      redrawFooter();
      return;
    }

    if (key.name === "end") {
      cursorPos = buffer.length;
      redrawFooter();
      return;
    }

    if (_str && !key.ctrl && !key.meta && !key.sequence?.includes("\x1b")) {
      buffer = buffer.slice(0, cursorPos) + _str + buffer.slice(cursorPos);
      cursorPos += _str.length;
      historyIdx = -1;
      redrawFooter();
    }
  });
}

main().catch((e: Error) => {
  cleanupTerminal();
  console.error(`${paint("Fatal:", theme.error)} ${e.message}`);
  process.exit(1);
});