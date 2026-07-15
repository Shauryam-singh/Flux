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
  formatTimestamp,
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
import { Spinner, sleep, animateBootBar, typeOut } from "./ui/spinners.js";
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

const TIPS = [
  "Tip: /models to switch provider or model",
  "Tip: /suggest for prompt ideas",
  "Tip: /save to checkpoint your session",
  "Tip: ↑ / ↓ browse command history",
  "Tip: Tab autocompletes / commands",
];
let tipIdx = 0;

async function main(): Promise<void> {
  const { app, providerConfigs } = loadAppConfig();
  const factory = new DefaultProviderFactory(providerConfigs);

  let currentProvider: ProviderName = "ollama";
  let currentModel = app.providers.ollama.defaultModel ?? "qwen2.5:0.5b";

  // Load or create session
  let sessionData: SessionData = (() => {
    const existing = loadSession();
    if (existing) {
      currentProvider = existing.provider;
      currentModel = existing.model;
      return existing;
    }
    return createSession(currentProvider, currentModel);
  })();

  // Print header
  let branch = "main";
  let cwd = process.cwd();
  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main", {
      stdio: "pipe",
    }).toString().trim();
  } catch {}

  clearScreen();
  printHeader(currentProvider, currentModel, cwd, branch);
  await animateBootBar("Initializing", 300);

  // Print previous conversation
  if (sessionData.messages.length > 0) {
    process.stdout.write(
      paint(`\nRestored ${sessionData.messages.length} messages\n\n`, theme.muted),
    );
    for (const msg of sessionData.messages) {
      if (msg.role === "user") {
        process.stdout.write(renderMessage(msg) + "\n\n");
      } else {
        process.stdout.write(renderMessage(msg) + "\n\n");
      }
    }
  }

  process.stdout.write(
    paint("Ready — type a message or /help\n\n", theme.muted),
  );

  // Input state
  let buffer = "";
  let cursorPos = 0;
  let historyPointer = -1;
  let draftBuffer = "";
  const inputHistory: string[] = [];

  const redraw = () => {
    const prompt = `${paint("❯", theme.accent)} `;
    process.stdout.write(`\r\x1b[2K${prompt}${paint(buffer, theme.text)}`);
    const { cols } = getTerminalSize();
    const tip = buffer.startsWith("/")
      ? (() => {
          const partial = buffer.slice(1).toLowerCase();
          const matches = COMMAND_NAMES.filter((c) => c.startsWith(partial));
          return matches.length
            ? `→ ${matches.map((m) => "/" + m).join("  ")}`
            : "No match";
        })()
      : TIPS[tipIdx % TIPS.length]!;
    process.stdout.write(
      `\n${paint(tip, dim + theme.muted)}\x1b[A`,
    );
    process.stdout.write(`\x1b[${getTerminalSize().rows};${3 + cursorPos}H`);
  };

  async function listModelsForProvider(p: ProviderName): Promise<string[]> {
    const prov = factory.create(p);
    const models = await prov.listModels();
    return [...models];
  }

  function setModel(p: ProviderName, m: string): void {
    currentProvider = p;
    currentModel = m;
    sessionData.provider = p;
    sessionData.model = m;
    saveSession(sessionData);
  }

  async function handleInput(input: string): Promise<void> {
    if (!input.trim()) return;

    // Commands
    if (input.startsWith("/")) {
      const [rawCmd, ...rest] = input.slice(1).trim().split(/\s+/);
      const cmd = (rawCmd || "").toLowerCase();
      const args = rest.join(" ");

      switch (cmd) {
        case "help":
          cmdHelp();
          return;
        case "history":
          cmdHistory(sessionData.messages);
          return;
        case "suggest":
          cmdSuggest();
          return;
        case "models":
          await cmdModels(
            args,
            currentProvider,
            currentModel,
            listModelsForProvider,
            setModel,
          );
          return;
        case "clear":
          clearScreen();
          printHeader(currentProvider, currentModel, cwd, branch);
          return;
        case "save":
          saveSession(sessionData);
          process.stdout.write(
            paint("\n✓ Session saved\n\n", theme.success),
          );
          return;
        case "load": {
          const loaded = loadSession();
          if (loaded) {
            sessionData = loaded;
            currentProvider = loaded.provider;
            currentModel = loaded.model;
            clearScreen();
            printHeader(currentProvider, currentModel, cwd, branch);
            for (const msg of sessionData.messages) {
              process.stdout.write(renderMessage(msg) + "\n\n");
            }
            process.stdout.write(
              paint(`\n✓ Loaded ${loaded.messages.length} messages\n\n`, theme.success),
            );
          } else {
            process.stdout.write(paint("\nNo saved session\n\n", theme.warning));
          }
          return;
        }
        case "exit":
        case "quit":
          saveSession(sessionData);
          process.stdout.write(
            paint("\nSession saved. Goodbye! 👋\n", `${bold}${theme.accent}`),
          );
          cleanupTerminal();
          process.exit(0);
        default:
          process.stdout.write(
            paint(`\nUnknown command: /${cmd}\n\n`, theme.error),
          );
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
    process.stdout.write(renderMessage(userMsg) + "\n\n");

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

      const text = extractText(result.result?.output) || JSON.stringify(result.result?.output, null, 2);

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
      process.stdout.write(paint(`\nError: ${msg}\n\n`, theme.error));
    }
  }

  setupStdinRaw();
  onExit(() => {
    saveSession(sessionData);
    cleanupTerminal();
  });

  process.stdout.on("resize", () => {
    clearScreen();
    printHeader(currentProvider, currentModel, cwd, branch);
    for (const msg of sessionData.messages.slice(-20)) {
      process.stdout.write(renderMessage(msg) + "\n");
    }
  });

  redraw();

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
        const input = buffer.trim();
        buffer = "";
        cursorPos = 0;
        historyPointer = -1;
        process.stdout.write("\n");
        void handleInput(input);
        redraw();
        return;
      }

      if (key.name === "backspace") {
        if (cursorPos > 0) {
          buffer = buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos);
          cursorPos--;
        }
        redraw();
        return;
      }

      if (key.name === "delete") {
        buffer = buffer.slice(0, cursorPos) + buffer.slice(cursorPos + 1);
        redraw();
        return;
      }

      if (key.name === "left") {
        if (cursorPos > 0) cursorPos--;
        redraw();
        return;
      }

      if (key.name === "right") {
        if (cursorPos < buffer.length) cursorPos++;
        redraw();
        return;
      }

      if (key.name === "up") {
        if (inputHistory.length === 0) return;
        if (historyPointer === -1) draftBuffer = buffer;
        historyPointer = Math.min(historyPointer + 1, inputHistory.length - 1);
        buffer = inputHistory[inputHistory.length - 1 - historyPointer] ?? "";
        cursorPos = buffer.length;
        redraw();
        return;
      }

      if (key.name === "down") {
        if (historyPointer === -1) return;
        historyPointer--;
        buffer =
          historyPointer === -1
            ? draftBuffer
            : (inputHistory[inputHistory.length - 1 - historyPointer] ?? "");
        cursorPos = buffer.length;
        redraw();
        return;
      }

      if (key.name === "tab") {
        if (buffer.startsWith("/")) {
          const partial = buffer.slice(1).toLowerCase();
          const match = COMMAND_NAMES.find((c) => c.startsWith(partial));
          if (match) {
            buffer = "/" + match;
            cursorPos = buffer.length;
          }
        }
        redraw();
        return;
      }

      if (_str && !key.ctrl && !key.meta) {
        buffer = buffer.slice(0, cursorPos) + _str + buffer.slice(cursorPos);
        cursorPos += _str.length;
        historyPointer = -1;
        inputHistory.push(buffer);
        redraw();
      }
    },
  );

  const tipTimer = setInterval(() => {
    tipIdx = (tipIdx + 1) % TIPS.length;
    redraw();
  }, 5000);
  tipTimer.unref();
}

main().catch((e: Error) => {
  cleanupTerminal();
  console.error(`${paint("Fatal:", theme.error)} ${e.message}`);
  process.exit(1);
});
