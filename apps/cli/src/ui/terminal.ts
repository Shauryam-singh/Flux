import * as readline from "node:readline";

export function moveTo(row: number, col: number): void {
  process.stdout.write(`\x1b[${row};${col}H`);
}

export function clearLine(): void {
  process.stdout.write("\x1b[2K");
}

export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
}

export function hideCursor(): void {
  process.stdout.write("\x1b[?25l");
}

export function showCursor(): void {
  process.stdout.write("\x1b[?25h");
}

export function getTerminalSize(): { rows: number; cols: number } {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
  };
}

let cleanedUp = false;
export function cleanupTerminal(): void {
  if (cleanedUp) return;
  cleanedUp = true;
  showCursor();
  moveTo(getTerminalSize().rows, 1);
  process.stdout.write("\n");
}

export function setupStdinRaw(): void {
  readline.emitKeypressEvents(process.stdin as unknown as NodeJS.ReadStream);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
}

export function onExit(fn: () => void): void {
  process.on("exit", fn);
  process.on("SIGINT", () => {
    fn();
    process.exit(0);
  });
}
