#!/usr/bin/env node

import type { ProviderName } from "@ai-agent/providers";
import { DefaultProviderFactory } from "@ai-agent/providers";
import { DefaultSession } from "@ai-agent/agent";
import { loadAppConfig } from "./config.js";
import { createAgent } from "./chat/agent.js";
import { extractText, renderMessage } from "./chat/format.js";
import {
  loadSession,
  saveSession,
  createSession,
  addMessage,
  type SessionData,
  type SessionMessage,
} from "./session/store.js";
import {
  cmdHelp,
  cmdHistory,
  cmdSuggest,
  cmdModels,
} from "./commands/index.js";
import { paint, bold, theme, dim } from "./ui/theme.js";
import { printHeader } from "./ui/banner.js";
import { Spinner, animateBootBar } from "./ui/spinners.js";
import {
  clearScreen,
  getTerminalSize,
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
  "clear",
  "save",
  "load",
  "exit",
  "quit",
];

async function main(): Promise<void> {
  const { app, providerConfigs } = loadAppConfig();
  const factory = new DefaultProviderFactory(providerConfigs);

  let currentProvider: ProviderName = "ollama";
  let currentModel = app.providers.ollama.defaultModel ?? "qwen2.5:0.5b";

  let sessionData: SessionData = createSession(currentProvider, currentModel);

  // Check if there's a saved session to offer resuming
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

  // --- Terminal layout ---
  const { rows, cols } = getTerminalSize();
  const FOOTER_ROWS = 2; // divider + input line
  const scrollTop = 6; // below header
  const scrollBottom = rows - FOOTER_ROWS;

  let buffer = "";
  let cursorPos = 0;
  let historyIdx = -1;
  let draft = "";
  const inputHistory: string[] = [];

  const PROMPT = `${paint("❯", theme.accent)} `;

  function moveTo(row: number, col: number) {
    process.stdout.write(`\x1b[${row};${col}H`);
  }

  function clearRow(row: number) {
    moveTo(row, 1);
    process.stdout.write("\x1b[2K");
  }

  function drawFooter() {
    const r = rows;
    // Divider
    clearRow(r - 2);
    moveTo(r - 2, 1);
    process.stdout.write(paint("─".repeat(cols), theme.muted));
    // Input
    clearRow(r - 1);
    moveTo(r - 1, 1);
    process.stdout.write(`${PROMPT}${paint(buffer, theme.text)}`);
    // Cursor
    moveTo(r - 1, 3 + cursorPos);
  }

  function scrollUp() {
    // Move everything in the scroll region up by clearing and redrawing
    // For simplicity, just let stdout scroll naturally
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
          drawFooter();
          return;
        case "history":
          cmdHistory(sessionData.messages);
          drawFooter();
          return;
        case "suggest":
          cmdSuggest();
          drawFooter();
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
          drawFooter();
          return;
        case "clear":
          clearScreen();
          printHeader(currentProvider, currentModel, cwd, branch);
          process.stdout.write(paint("\n", theme.muted));
          drawFooter();
          return;
        case "save":
          saveSession(sessionData);
          printToChat(paint("✓ Session saved", theme.success));
          printToChat("");
          drawFooter();
          return;
        case "load": {
          if (!savedSession || savedSession.messages.length === 0) {
            printToChat(paint("No saved session found", theme.warning));
            printToChat("");
            drawFooter();
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
              `\nLoaded ${sessionData.messages.length} messages\n\n`,
              theme.success,
            ),
          );
          for (const msg of sessionData.messages) {
            process.stdout.write(renderMessage(msg) + "\n");
          }
          process.stdout.write("\n");
          drawFooter();
          return;
        }
        case "resume": {
          if (!savedSession || savedSession.messages.length === 0) {
            printToChat(paint("No saved session found", theme.warning));
            printToChat("");
            drawFooter();
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
          drawFooter();
          return;
        }
        case "exit":
        case "quit":
          saveSession(sessionData);
          printToChat(paint("Session saved. Goodbye! 👋", `${bold}${theme.accent}`));
          cleanupTerminal();
          process.exit(0);
        default:
          printToChat(paint(`Unknown command: /${cmd}`, theme.error));
          printToChat("");
          drawFooter();
          return;
      }
    }

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
      const result = await agent.run(agentSession, {
        input: { message: input, type: "chat" },
      });

      const durationMs = Date.now() - start;
      spinner.stop();

      const text =
        extractText(result.result?.output) ||
        JSON.stringify(result.result?.output, null, 2);

      const assistantMsg: SessionMessage = {
        role: "assistant",
        content: text,
        timestamp: new Date().toISOString(),
        provider: currentProvider,
        model: currentModel,
        durationMs,
      };
      addMessage(sessionData, assistantMsg);

      process.stdout.write(renderMessage(assistantMsg) + "\n\n");

      saveSession(sessionData);
    } catch (err) {
      spinner.stop();
      const msg = err instanceof Error ? err.message : String(err);
      printToChat(paint(`Error: ${msg}`, theme.error));
      printToChat("");
    }

    drawFooter();
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
    drawFooter();
  });

  drawFooter();

  process.stdin.on(
    "keypress",
    (_str: string, key: readline.Key & { sequence?: string }) => {
      if (!key) return;

      if (key.ctrl && key.name === "c") {
        saveSession(sessionData);
        cleanupTerminal();
        process.exit(0);
      }

      if (key.name === "return" || key.name === "enter") {
        const input = buffer;
        buffer = "";
        cursorPos = 0;
        historyIdx = -1;
        // Clear the input line before processing
        const r = rows;
        clearRow(r - 1);
        moveTo(r - 1, 1);
        process.stdout.write(`${PROMPT}${paint(input, theme.text)}\n`);
        void handleInput(input);
        return;
      }

      if (key.name === "backspace") {
        if (cursorPos > 0) {
          buffer = buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos);
          cursorPos--;
        }
        drawFooter();
        return;
      }

      if (key.name === "delete") {
        buffer = buffer.slice(0, cursorPos) + buffer.slice(cursorPos + 1);
        drawFooter();
        return;
      }

      if (key.name === "left") {
        if (cursorPos > 0) cursorPos--;
        drawFooter();
        return;
      }

      if (key.name === "right") {
        if (cursorPos < buffer.length) cursorPos++;
        drawFooter();
        return;
      }

      if (key.name === "up") {
        if (inputHistory.length === 0) return;
        if (historyIdx === -1) draft = buffer;
        historyIdx = Math.min(historyIdx + 1, inputHistory.length - 1);
        buffer = inputHistory[inputHistory.length - 1 - historyIdx] ?? "";
        cursorPos = buffer.length;
        drawFooter();
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
        drawFooter();
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
        drawFooter();
        return;
      }

      if (_str && !key.ctrl && !key.meta) {
        buffer = buffer.slice(0, cursorPos) + _str + buffer.slice(cursorPos);
        cursorPos += _str.length;
        historyIdx = -1;
        inputHistory.push(buffer);
        drawFooter();
      }
    },
  );
}

main().catch((e: Error) => {
  cleanupTerminal();
  console.error(`${paint("Fatal:", theme.error)} ${e.message}`);
  process.exit(1);
});
