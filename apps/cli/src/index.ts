#!/usr/bin/env node

import { DefaultAgent, DefaultPlanner, DefaultSession } from "@ai-agent/agent";
import {
  DefaultToolExecutor,
  DefaultToolRegistry,
  echoTool,
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createListDirectoryTool,
  createRunCommandTool,
} from "@ai-agent/tools";
import { execSync } from "child_process";
import * as fs from "fs";
import * as readline from "readline";

/* -------------------------------------------------
   App identity
   ------------------------------------------------- */
const APP_NAME = "Flux";
const APP_VERSION = "v0.0.18";
const SESSION_FILE = ".flux-session.json";
const COMMAND_NAMES = [
  "help",
  "history",
  "suggest",
  "clear",
  "save",
  "load",
  "exit",
  "quit",
];

/* -------------------------------------------------
   Setup core components
   ------------------------------------------------- */
const registry = new DefaultToolRegistry();
registry.register(echoTool);
registry.register(createReadFileTool());
registry.register(createWriteFileTool());
registry.register(createEditFileTool());
registry.register(createListDirectoryTool());
registry.register(createRunCommandTool());

const executor = new DefaultToolExecutor(registry);
const planner = new DefaultPlanner();
const agent = new DefaultAgent(planner, executor);
const session = new DefaultSession("cli-interactive");

/* -------------------------------------------------
   Theme — 256-color palette + truecolor gradients
   ------------------------------------------------- */
const reset = "\x1b[0m";
const bold = "\x1b[1m";
const dim = "\x1b[2m";

const theme = {
  primary: "\x1b[38;5;39m", // blue
  accent: "\x1b[38;5;213m", // pink
  success: "\x1b[38;5;42m", // green
  warning: "\x1b[38;5;220m", // yellow
  error: "\x1b[38;5;196m", // red
  muted: "\x1b[38;5;245m", // gray
  text: "\x1b[38;5;255m", // white
};

function paint(text: string, color: string): string {
  return `${color}${text}${reset}`;
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleLength(s: string): number {
  return stripAnsi(s).length;
}

function padLine(text: string, width: number): string {
  const pad = Math.max(0, width - visibleLength(text));
  return text + " ".repeat(pad);
}

function centerLine(text: string, width: number): string {
  const pad = Math.max(0, width - visibleLength(text));
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

/* -------------------------------------------------
   Cat logo (Flux's mascot)
   ------------------------------------------------- */
const FLUX_ART = ["╭──╮ ", "╰╮╭╯", " ╰╯ ", "╭╯╰╮", "╰──╯"];
const FLUX_WIDTH = 11;

function fluxBlock(): string[] {
  return FLUX_ART.map((line) => paint(padLine(line, FLUX_WIDTH), theme.accent));
}

/** Wraps plain content lines in a box border, returned as separate rows. */
function boxLinesArr(
  lines: string[],
  borderColor: string,
  width: number,
): string[] {
  const top = `${borderColor}╭${"─".repeat(width)}╮${reset}`;
  const bottom = `${borderColor}╰${"─".repeat(width)}╯${reset}`;
  const body = lines.map(
    (l) =>
      `${borderColor}│${reset} ${padLine(l, width - 2)} ${borderColor}│${reset}`,
  );
  return [top, ...body, bottom];
}

/** Centers a block of same-width lines within a taller block, padding with blank lines. */
function padVertical(
  lines: string[],
  targetHeight: number,
  width: number,
): string[] {
  const extra = Math.max(0, targetHeight - lines.length);
  const top = Math.floor(extra / 2);
  const bottom = extra - top;
  const blank = " ".repeat(width);
  return [...Array(top).fill(blank), ...lines, ...Array(bottom).fill(blank)];
}

/** Joins two blocks of lines side by side, vertically centering the shorter one. */
function sideBySide(
  left: string[],
  leftWidth: number,
  right: string[],
  rightWidth: number,
  gap = 3,
): string[] {
  const height = Math.max(left.length, right.length);
  const l = padVertical(left, height, leftWidth);
  const r = padVertical(right, height, rightWidth);
  const gapStr = " ".repeat(gap);
  return l.map((line, i) => line + gapStr + (r[i] ?? ""));
}

/* -------------------------------------------------
   Terminal layout: pinned header, scrolling output, pinned footer
   ------------------------------------------------- */
const FOOTER_HEIGHT = 3; // divider line, input line, tip line
const INFO_BOX_WIDTH = 45;

let termRows = process.stdout.rows || 24;
let termCols = process.stdout.columns || 80;
let HEADER_HEIGHT = 7;
let headerRows: string[] = [];
let scrollTop = HEADER_HEIGHT + 2;
let scrollBottom = termRows - FOOTER_HEIGHT;

let cachedBranch = "";
let cachedCwd = "";

/** Builds the pinned header (cat on the left, info box on the right) for the current width. */
function buildHeader(): void {
  if (!cachedBranch) {
    cachedBranch = execSync(
      "git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'main'",
      {
        stdio: "pipe",
      },
    )
      .toString()
      .trim();
    cachedCwd = process.cwd();
  }

  const cols = process.stdout.columns || 80;
  const gap = 3;
  const minBoxWidth = 30;
  const boxWidth = Math.max(
    minBoxWidth,
    Math.min(INFO_BOX_WIDTH, cols - FLUX_WIDTH - gap - 4),
  );

  const infoLines = [
    `${paint(`⚡${APP_NAME} ${APP_VERSION}`, `${bold}${theme.primary}`)}`,
    paint("Default • API", theme.muted),
    paint(cachedCwd, theme.text),
    `${paint("Branch:", theme.muted)} ${paint(cachedBranch, theme.success)}`,
    paint("Type /help to see available commands", theme.muted),
  ];

  const flux = fluxBlock();
  const box = boxLinesArr(infoLines, theme.primary, boxWidth);
  headerRows = sideBySide(flux, FLUX_WIDTH, box, boxWidth + 2, gap);
  HEADER_HEIGHT = headerRows.length;
}

/** Paints the pinned header at the very top of the terminal (rows never touched by scrolling). */
function drawHeader(): void {
  headerRows.forEach((row, i) => {
    moveTo(i + 1, 1);
    clearLine();
    process.stdout.write(row);
  });
  moveTo(HEADER_HEIGHT + 1, 1);
  clearLine();
  process.stdout.write(paint("─".repeat(termCols), theme.muted));
}

function updateDims(): void {
  termRows = process.stdout.rows || 24;
  termCols = process.stdout.columns || 80;
  scrollTop = HEADER_HEIGHT + 2;
  scrollBottom = Math.max(scrollTop, termRows - FOOTER_HEIGHT);
}

function moveTo(row: number, col: number): void {
  process.stdout.write(`\x1b[${row};${col}H`);
}
function clearLine(): void {
  process.stdout.write("\x1b[2K");
}
function setScrollRegion(): void {
  process.stdout.write(`\x1b[${scrollTop};${scrollBottom}r`);
}
function resetScrollRegion(): void {
  process.stdout.write("\x1b[r");
}

function hideCursor(): void {
  process.stdout.write("\x1b[?25l");
}
function showCursor(): void {
  process.stdout.write("\x1b[?25h");
}

let cleanedUp = false;
function cleanupTerminal(): void {
  if (cleanedUp) return;
  cleanedUp = true;
  resetScrollRegion();
  showCursor();
  moveTo(termRows, 1);
  process.stdout.write("\n");
}
process.on("exit", cleanupTerminal);

/** Moves into the scroll region, re-asserting the DECSTBM margins first.
 *  Some operations (notably console.clear()) silently reset the terminal's
 *  scroll region on many emulators — reasserting here guards against that
 *  so the chat area never starts scrolling the whole screen. */
function gotoContentBottom(): void {
  setScrollRegion();
  moveTo(scrollBottom, 1);
}

/** Appends a finished line to the scrolling output region. */
function printLine(text = ""): void {
  gotoContentBottom();
  clearLine();
  process.stdout.write(text + "\n");
}

/** Overwrites the current bottom output row in-place (for spinners, bars). */
function printRaw(text: string): void {
  gotoContentBottom();
  clearLine();
  process.stdout.write(text);
}

/** Clears only the scrolling chat area, leaving the pinned header/footer untouched. */
function clearChatArea(): void {
  setScrollRegion();
  for (let row = scrollTop; row <= scrollBottom; row++) {
    moveTo(row, 1);
    clearLine();
  }
  moveTo(scrollBottom, 1);
}

/* -------------------------------------------------
   Animation primitives
   ------------------------------------------------- */
const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/**
 * Reveals a box line-by-line, top border first, so content
 * appears to stream in rather than popping onto the screen at once.
 */
async function revealBox(
  lines: string[],
  borderColor: string,
  width = 45,
  lineDelay = 28,
): Promise<void> {
  printLine(`${borderColor}╭${"─".repeat(width)}╮${reset}`);
  for (const l of lines) {
    printLine(
      `${borderColor}│${reset} ${padLine(l, width - 2)} ${borderColor}│${reset}`,
    );
    if (lineDelay) await sleep(lineDelay);
  }
  printLine(`${borderColor}╰${"─".repeat(width)}╯${reset}`);
}

function progressBar(percent: number, width = 24): string {
  const filled = Math.max(
    0,
    Math.min(width, Math.round((percent / 100) * width)),
  );
  const bar =
    paint("█".repeat(filled), theme.primary) +
    paint("░".repeat(width - filled), theme.muted);
  return `${bar} ${paint(percent + "%", theme.muted)}`;
}

/** Animated init bar shown once at startup for a bit of ceremony. */
async function animateBootBar(label: string, ms = 500): Promise<void> {
  const steps = 20;
  const stepDelay = ms / steps;
  for (let i = 0; i <= steps; i++) {
    const pct = Math.round((i / steps) * 100);
    printRaw(`${paint(label, theme.muted)} ${progressBar(pct)}`);
    await sleep(stepDelay);
  }
  printRaw("");
}

/** Reveals a numbered/checked step list one item at a time. */
async function animateSteps(steps: string[]): Promise<void> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  for (const step of steps) {
    let f = 0;
    const spin = setInterval(() => {
      printRaw(
        `${paint(frames[f++ % frames.length]!, theme.warning)} ${paint(step, theme.muted)}`,
      );
    }, 60);
    await sleep(260);
    clearInterval(spin);
    printLine(`${paint("✓", theme.success)} ${paint(step, theme.text)}`);
  }
}

/**
 * A rotating braille spinner that also cycles through status phrases,
 * so long-running calls feel alive instead of stuck.
 */
class Spinner {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private frameIdx = 0;
  private phraseIdx = 0;
  private timer?: NodeJS.Timeout;
  private phraseTimer?: NodeJS.Timeout;
  private phrases: string[];

  constructor(phrases: string[] = ["Thinking"]) {
    this.phrases = phrases;
  }

  start(): void {
    this.render();
    this.timer = setInterval(() => this.render(), 80);
    if (this.phrases.length > 1) {
      this.phraseTimer = setInterval(() => {
        this.phraseIdx = (this.phraseIdx + 1) % this.phrases.length;
      }, 1600);
    }
  }

  private render(): void {
    const frame = this.frames[this.frameIdx++ % this.frames.length];
    const phrase = this.phrases[this.phraseIdx];
    printRaw(
      `${paint(frame!, theme.warning)} ${paint(phrase + "…", theme.muted)}`,
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.phraseTimer) clearInterval(this.phraseTimer);
    printRaw("");
  }
}

/** Types text out character-by-character without splitting ANSI escapes. */
async function typeOut(text: string, delayMs = 12): Promise<void> {
  gotoContentBottom();
  clearLine();
  const tokens = text.match(/\x1b\[[0-9;]*m|[\s\S]/g) ?? [];
  for (const t of tokens) {
    process.stdout.write(t);
    if (!t.startsWith("\x1b")) await sleep(delayMs);
  }
  process.stdout.write("\n");
}

/* -------------------------------------------------
   UI: boot sequence (header is already pinned by main())
   ------------------------------------------------- */
async function runBootSequence(): Promise<void> {
  printLine();
  await animateBootBar("Initializing tools", 400);
  printLine(
    paint("Ready — type a message or /help to see commands", theme.muted),
  );
  printLine();
}

/* -------------------------------------------------
   UI: error card
   ------------------------------------------------- */
async function showErrorCard(
  error: Error & { suggestion?: string; docLink?: string },
): Promise<void> {
  const lines = [
    paint(`🔴 Error`, `${bold}${theme.error}`),
    paint(error.message, theme.text),
  ];

  if (error.suggestion) {
    lines.push("");
    lines.push(`${paint("Suggested fix:", theme.warning)} ${error.suggestion}`);
  }
  if (error.docLink) {
    lines.push(
      `${paint("Docs:", theme.muted)} ${paint(error.docLink, theme.primary)}`,
    );
  }

  printLine();
  await revealBox(lines, theme.error, 45, 18);
  printLine();
}

/* -------------------------------------------------
   UI: tool card (used when a tool call is rendered)
   ------------------------------------------------- */
interface ToolCard {
  name: string;
  description: string;
  duration?: number;
  steps?: string[];
  files?: string[];
  diff?: string;
}

async function renderToolCard(card: ToolCard): Promise<void> {
  const header = [
    `${paint("⚙", theme.accent)}  ${paint(card.name, `${bold}${theme.primary}`)}`,
    paint(card.description, theme.warning),
  ];

  if (card.duration !== undefined) {
    header.push(`⏱  ${paint(card.duration + "ms", theme.success)}`);
  }

  printLine();
  await revealBox(header, theme.accent, 45, 18);

  if (card.steps?.length) {
    printLine();
    await animateSteps(card.steps);
  }

  const footer: string[] = [];
  if (card.files?.length) {
    footer.push(paint(`Files changed: ${card.files.length}`, theme.warning));
    card.files.forEach((f) => footer.push(paint(`  • ${f}`, theme.text)));
  }
  if (card.diff) {
    footer.push(paint("Diff preview:", theme.accent));
    footer.push(paint(card.diff, theme.text));
  }
  if (footer.length) {
    printLine();
    await revealBox(footer, theme.accent, 45, 18);
  }
  printLine();
}

/* -------------------------------------------------
   Session persistence (/save, /load)
   ------------------------------------------------- */
async function saveSession(history: string[]): Promise<void> {
  const spinner = new Spinner(["Saving session"]);
  spinner.start();
  await sleep(300);
  try {
    fs.writeFileSync(
      SESSION_FILE,
      JSON.stringify({ history, savedAt: new Date().toISOString() }, null, 2),
    );
    spinner.stop();
    printLine();
    await revealBox(
      [
        paint("💾 Session saved", `${bold}${theme.success}`),
        paint(SESSION_FILE, theme.text),
      ],
      theme.success,
      45,
      18,
    );
  } catch (err) {
    spinner.stop();
    printLine();
    await revealBox(
      [
        paint("Could not save session", theme.error),
        paint(String(err), theme.text),
      ],
      theme.error,
      45,
      18,
    );
  }
  printLine();
}

async function loadSession(): Promise<string[]> {
  const spinner = new Spinner(["Loading session"]);
  spinner.start();
  await sleep(300);
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf-8");
    const data = JSON.parse(raw);
    const loaded: string[] = Array.isArray(data.history) ? data.history : [];
    spinner.stop();
    printLine();
    await revealBox(
      [
        paint("📂 Session loaded", `${bold}${theme.success}`),
        paint(`${loaded.length} history entries restored`, theme.text),
      ],
      theme.success,
      45,
      18,
    );
    printLine();
    return loaded;
  } catch {
    spinner.stop();
    printLine();
    await revealBox(
      [
        paint("No saved session found", theme.warning),
        paint(SESSION_FILE, theme.muted),
      ],
      theme.warning,
      45,
      18,
    );
    printLine();
    return [];
  }
}

/* -------------------------------------------------
   UI: help / history / suggestions
   ------------------------------------------------- */
async function showHelp(): Promise<void> {
  const lines = [
    `${paint(`🆘 Help — ${APP_NAME} ${APP_VERSION}`, `${bold}${theme.primary}`)}`,
    "",
    paint("Commands:", theme.accent),
    `  ${paint("/help", theme.primary)}      Show this help`,
    `  ${paint("/history", theme.primary)}   Show command log`,
    `  ${paint("/suggest", theme.primary)}   Show smart tips`,
    `  ${paint("/clear", theme.primary)}     Clear the screen`,
    `  ${paint("/save", theme.primary)}      Save current session`,
    `  ${paint("/load", theme.primary)}      Load saved session`,
    `  ${paint("/exit", theme.primary)}      Quit ${APP_NAME}`,
    "",
    paint("Tools:", theme.accent),
    `  ${paint("read_file", theme.primary)}     Read file contents`,
    `  ${paint("write_file", theme.primary)}    Create or overwrite a file`,
    `  ${paint("edit_file", theme.primary)}     Edit a file (search & replace)`,
    `  ${paint("list_directory", theme.primary)} List files in a directory`,
    `  ${paint("run_command", theme.primary)}   Execute a shell command`,
    "",
    paint("Anything else is sent to the agent as a chat message.", theme.muted),
    "",
    paint("Keyboard shortcuts:", theme.accent),
    "  Ctrl+C   Exit",
    "  Tab      Autocomplete a / command",
    "  ↑ / ↓    Browse input history",
  ];
  printLine();
  await revealBox(lines, theme.primary, 45, 14);
  printLine();
}

async function showHistory(history: string[]): Promise<void> {
  const lines = [paint("📜 Command History", `${bold}${theme.success}`), ""];
  if (history.length === 0) {
    lines.push(paint("No commands yet.", theme.muted));
  } else {
    history.forEach((h, i) =>
      lines.push(`${paint((i + 1).toString(), theme.muted)}. ${h}`),
    );
  }
  printLine();
  await revealBox(lines, theme.success, 45, 14);
  printLine();
}

async function showSuggestions(): Promise<void> {
  const suggestions = [
    "Explain this repository",
    "Fix failing tests",
    "Refactor src/router.ts",
    "Generate API docs",
    "Add error handling",
  ];
  const lines = [
    paint("💡 Smart Suggestions", `${bold}${theme.accent}`),
    "",
    ...suggestions.map((s) => `${paint("•", theme.accent)} ${s}`),
  ];
  printLine();
  await revealBox(lines, theme.accent, 45, 20);
  printLine();
}

/* -------------------------------------------------
   Fixed bottom input bar
   ------------------------------------------------- */
const TIPS = [
  "Tip: /suggest shows smart prompt ideas",
  "Tip: /save keeps this session for later",
  "Tip: ↑ / ↓ browse your command history",
  "Tip: /clear wipes the screen",
  "Tip: Tab autocompletes / commands",
  "Tip: Ctrl+C exits anytime",
];
let tipIdx = 0;

function currentFooterHint(buffer: string): string {
  if (buffer.startsWith("/")) {
    const partial = buffer.slice(1).toLowerCase();
    const matches = partial
      ? COMMAND_NAMES.filter((c) => c.startsWith(partial))
      : COMMAND_NAMES;
    if (matches.length) return `→ ${matches.map((m) => "/" + m).join("  ")}`;
    return paint("No matching command", theme.error);
  }
  return TIPS[tipIdx % TIPS.length]!;
}

function drawFooter(buffer: string, cursorPos: number): void {
  const dividerRow = termRows - 2;
  const inputRow = termRows - 1;
  const tipRow = termRows;

  moveTo(dividerRow, 1);
  clearLine();
  process.stdout.write(paint("─".repeat(termCols), theme.muted));

  moveTo(inputRow, 1);
  clearLine();
  const prompt = `${paint("❯", theme.accent)} `;
  process.stdout.write(prompt + paint(buffer, theme.text));

  moveTo(tipRow, 1);
  clearLine();
  process.stdout.write(paint(currentFooterHint(buffer), dim + theme.muted));

  moveTo(inputRow, 3 + cursorPos);
}

/* -------------------------------------------------
   Main interactive loop
   ------------------------------------------------- */
async function animatedExit(): Promise<never> {
  printLine();
  await typeOut(paint("Goodbye 👋", `${bold}${theme.accent}`), 20);
  cleanupTerminal();
  process.exit(0);
}

async function main(): Promise<void> {
  readline.emitKeypressEvents(process.stdin as any);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
  buildHeader();
  updateDims();
  setScrollRegion();
  drawHeader();

  await runBootSequence();

  let history: string[] = [];
  let buffer = "";
  let cursorPos = 0;
  let historyPointer = -1;
  let draftBuffer = "";

  const redraw = () => drawFooter(buffer, cursorPos);

  const pushHistory = (entry: string) => {
    history.unshift(entry);
    if (history.length > 20) history.pop();
  };

  const commands: Record<string, (args: string) => void | Promise<void>> = {
    help: () => showHelp(),
    history: () => showHistory(history),
    clear: () => clearChatArea(),
    suggest: () => showSuggestions(),
    save: () => saveSession(history),
    load: async () => {
      history = await loadSession();
    },
    exit: () => animatedExit(),
    quit: () => animatedExit(),
  };

  async function handleSubmit(): Promise<void> {
    const input = buffer.trim();
    buffer = "";
    cursorPos = 0;
    historyPointer = -1;
    redraw();
    if (!input) return;

    printLine(`${paint("❯", theme.accent)} ${paint(input, theme.text)}`);

    if (input.startsWith("/")) {
      pushHistory(input);
      const [rawCmd, ...rest] = input.slice(1).trim().split(/\s+/);
      const cmd = (rawCmd || "").toLowerCase();
      if (cmd in commands) {
        await commands[cmd]!(rest.join(" "));
      } else {
        printLine();
        await revealBox(
          [
            paint(`Unknown command: /${cmd}`, theme.error),
            paint("Type /help to see available commands", theme.muted),
          ],
          theme.error,
          45,
          18,
        );
        printLine();
      }
      redraw();
      return;
    }

    if (input.toLowerCase() === "exit") {
      await animatedExit();
      return;
    }

    pushHistory(input);
    const spinner = new Spinner([
      "Thinking",
      "Reasoning",
      "Drafting response",
      "Double-checking",
    ]);
    spinner.start();

    try {
      const result = await agent.run(session, {
        input: { message: input, type: "chat" },
      });

      spinner.stop();
      printLine();

      const badge = result.success
        ? paint("✓ Success", `${bold}${theme.success}`)
        : paint("✗ Failed", `${bold}${theme.error}`);
      printLine(`${badge} — ${result.success ? "Completed" : "Error"}`);
      printLine();

      const output = result.result?.output;
      const outStr =
        typeof output === "string"
          ? output
          : output !== undefined
            ? JSON.stringify(output, null, 2)
            : "";

      await typeOut(paint(outStr, theme.text), 6);
      printLine();
    } catch (err: unknown) {
      spinner.stop();
      printLine();
      const error = err instanceof Error ? err : new Error(String(err));
      await showErrorCard(
        error as Error & { suggestion?: string; docLink?: string },
      );
    } finally {
      redraw();
    }
  }

  process.stdin.on(
    "keypress",
    (str: string, key: readline.Key & { sequence?: string }) => {
      if (!key) return;

      if (key.ctrl && key.name === "c") {
        void animatedExit();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        void handleSubmit();
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
        if (history.length === 0) return;
        if (historyPointer === -1) draftBuffer = buffer;
        historyPointer = Math.min(historyPointer + 1, history.length - 1);
        buffer = history[historyPointer] ?? "";
        cursorPos = buffer.length;
        redraw();
        return;
      }
      if (key.name === "down") {
        if (historyPointer === -1) return;
        historyPointer--;
        buffer =
          historyPointer === -1 ? draftBuffer : (history[historyPointer] ?? "");
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
      if (str && !key.ctrl && !key.meta) {
        buffer = buffer.slice(0, cursorPos) + str + buffer.slice(cursorPos);
        cursorPos += str.length;
        historyPointer = -1;
        redraw();
      }
    },
  );

  process.stdout.on("resize", () => {
    buildHeader();
    updateDims();
    setScrollRegion();
    drawHeader();
    redraw();
  });

  const tipTimer = setInterval(() => {
    tipIdx = (tipIdx + 1) % TIPS.length;
    redraw();
  }, 4000);
  tipTimer.unref();

  redraw();
}

/* -------------------------------------------------
   Kick off
   ------------------------------------------------- */
main().catch((e: Error) => {
  cleanupTerminal();
  console.error(`${paint("Fatal error:", theme.error)} ${e.message}`);
  process.exit(1);
});
