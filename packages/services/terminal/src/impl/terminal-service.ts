/**
 * Terminal Automation Service
 *
 * Deep terminal integration — cross-platform (Linux + Windows 11).
 *
 * Commands:
 *   "run <command>" — execute shell command
 *   "run in <dir> <command>" — execute in directory
 *   "ssh <host>" — SSH to host
 *   "tmux new <name>" — new tmux session
 *   "tmux attach <name>" — attach to session
 *   "tmux kill <name>" — kill session
 *   "tmux list" — list sessions
 *   "tmux split" — split pane
 *   "tmux next/prev" — switch pane
 *   "run background <command>" — run in background
 *   "list processes" — list running processes
 *   "kill process <name>" — kill process
 */

import { execSync, spawn } from "node:child_process";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Helpers ────────────────────────────────────────────────────

function getPlatform(): string {
  return process.platform;
}

function run(cmd: string, timeoutMs = 15000, cwd?: string): string {
  try {
    return execSync(cmd, {
      timeout: timeoutMs,
      encoding: "utf-8",
      stdio: "pipe",
      ...(cwd ? { cwd } : {}),
    }).trim();
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function runPs(script: string, timeoutMs = 15000): string {
  try {
    return execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
      timeout: timeoutMs, encoding: "utf-8", stdio: "pipe",
    }).trim();
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ─── Command Execution ──────────────────────────────────────────

function execCommand(command: string, cwd?: string): string {
  const platform = getPlatform();
  if (platform === "win32") {
    const output = runPs(command);
    return output || "Command executed (no output)";
  }
  const output = run(command, 30000, cwd);
  return output || "Command executed (no output)";
}

function execInBackground(command: string): string {
  const platform = getPlatform();
  try {
    if (platform === "win32") {
      spawn("powershell", ["-NoProfile", "-Command", `Start-Process -WindowStyle Hidden -FilePath cmd -ArgumentList "/c ${command}"`], {
        detached: true, stdio: "ignore",
      }).unref();
    } else {
      spawn("sh", ["-c", `nohup ${command} > /dev/null 2>&1 &`], {
        detached: true, stdio: "ignore",
      }).unref();
    }
    return `Running in background: ${command}`;
  } catch {
    return "Failed to start background process";
  }
}

// ─── SSH ────────────────────────────────────────────────────────

function sshHost(host: string): string {
  const platform = getPlatform();
  if (platform === "win32") {
    return runPs(`ssh ${host}`);
  }
  return run(`ssh -o ConnectTimeout=5 ${host} echo "Connected to ${host}"`, 10000);
}

// ─── tmux ───────────────────────────────────────────────────────

function tmuxNew(name: string): string {
  return run(`tmux new-session -d -s ${name}`, 5000);
}

function tmuxAttach(name: string): string {
  return run(`tmux attach -t ${name}`, 5000);
}

function tmuxKill(name: string): string {
  return run(`tmux kill-session -t ${name}`, 5000);
}

function tmuxList(): string {
  const output = run("tmux list-sessions 2>/dev/null");
  return output || "No tmux sessions.";
}

function tmuxSplit(): string {
  return run("tmux split-window", 5000);
}

function tmuxNextPane(): string {
  return run("tmux select-pane -t :.+ 2>/dev/null", 5000);
}

function tmuxPrevPane(): string {
  return run("tmux select-pane -t :.- 2>/dev/null", 5000);
}

// ─── Process Management ─────────────────────────────────────────

function listProcesses(): string {
  const platform = getPlatform();
  if (platform === "win32") {
    return runPs("Get-Process | Select-Object -First 20 Name, Id, CPU | Format-Table -AutoSize");
  }
  return run("ps aux --sort=-%cpu | head -20", 5000);
}

function killProcess(name: string): string {
  const platform = getPlatform();
  if (platform === "win32") {
    runPs(`Stop-Process -Name "${name}" -Force -ErrorAction SilentlyContinue`);
    return `Killed process: ${name}`;
  }
  run(`pkill -f ${name}`, 5000);
  return `Killed process: ${name}`;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(run\s+\S|run\s+in|ssh\s|tmux|list\s+process|kill\s+process|run\s+background|execute\s|terminal|shell\s|command\s)/i;

export function createTerminalService(): Service {
  return {
    name: "terminal",
    description: "Terminal automation — run commands, tmux sessions, SSH, process management",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      try {
        // tmux commands
        if (/\btmux\b/.test(lower)) {
          if (/\btmux\s+(new|create)\s+(\w+)/.test(lower)) {
            const m = lower.match(/\btmux\s+(?:new|create)\s+(\w+)/);
            return { text: tmuxNew(m?.[1] ?? "session") };
          }
          if (/\btmux\s+attach\s+(\w+)/.test(lower)) {
            const m = lower.match(/\btmux\s+attach\s+(\w+)/);
            return { text: tmuxAttach(m?.[1] ?? "0") };
          }
          if (/\btmux\s+kill\s+(\w+)/.test(lower)) {
            const m = lower.match(/\btmux\s+kill\s+(\w+)/);
            return { text: tmuxKill(m?.[1] ?? "0") };
          }
          if (/\btmux\s+list\b/.test(lower)) return { text: tmuxList() };
          if (/\btmux\s+split\b/.test(lower)) return { text: tmuxSplit() };
          if (/\btmux\s+next\b/.test(lower)) return { text: tmuxNextPane() };
          if (/\btmux\s+prev\b/.test(lower)) return { text: tmuxPrevPane() };
          return { text: "tmux command not recognized. Try: tmux new <name>, tmux attach <name>, tmux list, tmux split" };
        }

        // SSH
        const sshMatch = lower.match(/\bssh\s+(\S+)/);
        if (sshMatch) return { text: sshHost(sshMatch[1]!) };

        // Kill process
        const killMatch = lower.match(/\bkill\s+process\s+(.+)/);
        if (killMatch) return { text: killProcess(killMatch[1]!.trim()) };

        // List processes
        if (/\blist\s+process(es)?\b/.test(lower)) return { text: listProcesses() };

        // Run background
        const bgMatch = lower.match(/\brun\s+background\s+(.+)/);
        if (bgMatch) return { text: execInBackground(bgMatch[1]!.trim()) };

        // Run in directory
        const dirMatch = input.match(/\brun\s+in\s+(\S+)\s+(.+)/i);
        if (dirMatch) return { text: execCommand(dirMatch[2]!.trim(), dirMatch[1]!.trim()) };

        // Run command
        const runMatch = input.match(/\b(?:run|execute|shell|command)\s+(.+)/i);
        if (runMatch) return { text: execCommand(runMatch[1]!.trim()) };

        return { text: "Terminal command not recognized. Try: run <command>, ssh <host>, tmux new <name>" };
      } catch (e) {
        return { text: `Terminal error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}
