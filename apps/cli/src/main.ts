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
  countTokens,
  type SessionData,
  type SessionMessage,
} from "./session/store.js";
import {
  cmdHelp,
  cmdHistory,
  cmdSuggest,
  cmdModels,
} from "./commands/index.js";
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
  "clear",
  "save",
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
  if (!input.startsWith("/")) return null;
  const partial = input.slice(1).toLowerCase();
  if (!partial) return null;
  const matches = COMMAND_NAMES.filter((c) => c.startsWith(partial));
  if (matches.length === 1) return matches[0] ?? null;
  return null;
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

  const PROMPT = `${paint(">", theme.accent)} `;

  function printPrompt() {
    const suggestion = getCommandSuggestion(buffer);
    const dimPart = suggestion ? suggestion.slice(buffer.length - 1) : "";
    process.stdout.write(`${PROMPT}${paint(buffer, theme.text)}${dimPart ? paint(dimPart, theme.dim) : ""}`);
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
        case "load": {
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
              `\nLoaded ${sessionData.messages.length} messages\n\n`,
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
      const result = await agent.run(agentSession, {
        input: { message: input, type: "chat" },
      });

      const durationMs = Date.now() - start;
      spinner.stop();

      const text =
        extractText(result.result?.output) ||
        JSON.stringify(result.result?.output, null, 2);

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

      process.stdout.write("\n" + renderMessage(assistantMsg) + "\n\n");

      saveSession(sessionData);
    } catch (err) {
      spinner.stop();
      const msg = err instanceof Error ? err.message : String(err);
      printToChat("");
      printToChat(paint(`Error: ${msg}`, theme.error));
      printToChat("");
    }

    printPrompt();
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
  });

  printPrompt();

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
          process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
          process.stdout.write(`\x1b[${3 + cursorPos}G`);
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
          process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
          process.stdout.write(`\x1b[${3 + cursorPos}G`);
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

      if (key.name === "return" || key.name === "enter") {
        const input = buffer;
        buffer = "";
        cursorPos = 0;
        historyIdx = -1;
        // Clear input line and show submitted command
        process.stdout.write(`\r\x1b[2K`);
        void handleInput(input);
        return;
      }

      if (key.name === "backspace") {
        if (cursorPos > 0) {
          buffer = buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos);
          cursorPos--;
        }
        process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
        return;
      }

      if (key.name === "delete") {
        buffer = buffer.slice(0, cursorPos) + buffer.slice(cursorPos + 1);
        process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
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
        process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
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
        process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
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
        process.stdout.write(`\r\x1b[2K${PROMPT}${paint(buffer, theme.text)}`);
        process.stdout.write(`\x1b[${3 + cursorPos}G`);
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
