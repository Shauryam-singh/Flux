import { execFileSync } from "node:child_process";

let resolved: string | null = null;

function detectPowershell(): string {
  if (resolved) return resolved;
  try {
    execFileSync("where", ["pwsh"], { stdio: "ignore" });
    resolved = "pwsh";
  } catch {
    resolved = "powershell";
  }
  return resolved;
}

/**
 * Returns the PowerShell executable for the current platform.
 * Prefers pwsh (PowerShell 7) when available, otherwise falls back
 * to powershell (Windows PowerShell 5.1, always present on Windows).
 */
export function powershell(): string {
  if (process.platform === "win32") return detectPowershell();
  return "powershell";
}

/**
 * Runs a PowerShell script directly (no shell/cmd involved), so embedded
 * quotes and $ variables are never mangled by cmd.exe on Windows.
 * Returns trimmed stdout, or null if the command failed.
 */
export function runPowerShell(script: string, timeout = 5000): string | null {
  try {
    return execFileSync(
      powershell(),
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf-8", timeout, stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
  } catch {
    return null;
  }
}
