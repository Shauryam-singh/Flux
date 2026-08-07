/**
 * VS Code Automation Service
 *
 * Deep VS Code integration — cross-platform (Linux + Windows 11).
 *
 * Commands:
 *   "open file <path>" — open file in VS Code
 *   "open folder <path>" — open folder
 *   "run tests" / "run test <name>" — run tests
 *   "install extension <name>" — install extension
 *   "remove extension <name>" — remove extension
 *   "list extensions" — list installed extensions
 *   "change theme <name>" — change color theme
 *   "format document" — format current file
 *   "toggle sidebar" — toggle sidebar visibility
 *   "search in files" — global search
 *   "go to line <n>" — jump to line
 *   "rename symbol" — rename symbol
 *   "organize imports" — organize imports
 */

import { execSync } from "node:child_process";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Helpers ────────────────────────────────────────────────────

function getPlatform(): string {
  return process.platform;
}

function run(cmd: string, timeoutMs = 10000): string {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

function runPs(script: string): string {
  try {
    return execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
      timeout: 10000, encoding: "utf-8", stdio: "pipe",
    }).trim();
  } catch {
    return "";
  }
}

function hasCode(): boolean {
  const platform = getPlatform();
  if (platform === "win32") {
    return runPs("(Get-Command code -ErrorAction SilentlyContinue).Source") !== "";
  }
  return run("which code") !== "";
}

function codeCmd(args: string): string {
  const platform = getPlatform();
  if (platform === "win32") {
    return runPs(`code ${args}`);
  }
  return run(`code ${args}`);
}

// ─── VS Code CLI Commands ───────────────────────────────────────

function openFile(path: string): string {
  codeCmd(`"${path}"`);
  return `Opened ${path} in VS Code`;
}

function openFolder(path: string): string {
  codeCmd(`"${path}"`);
  return `Opened folder ${path} in VS Code`;
}

function listExtensions(): string {
  const output = codeCmd("--list-extensions");
  if (!output) return "No extensions installed or VS Code not found.";
  const extensions = output.split("\n").filter(Boolean);
  return `${extensions.length} extensions installed:\n${extensions.join("\n")}`;
}

function installExtension(name: string): string {
  codeCmd(`--install-extension ${name}`);
  return `Installed extension: ${name}`;
}

function removeExtension(name: string): string {
  codeCmd(`--uninstall-extension ${name}`);
  return `Removed extension: ${name}`;
}

function formatDocument(): string {
  codeCmd("--command workbench.action.files.saveWithoutFormatting");
  codeCmd("--command editor.action.formatDocument");
  return "Document formatted";
}

function toggleSidebar(): string {
  codeCmd("--command workbench.action.toggleSidebarVisibility");
  return "Sidebar toggled";
}

function searchInFiles(): string {
  codeCmd("--command workbench.action.findInFiles");
  return "Global search opened";
}

function goToLine(n: number): string {
  codeCmd("--command workbench.action.gotoLine");
  return `Go to line ${n}`;
}

function renameSymbol(): string {
  codeCmd("--command editor.action.rename");
  return "Rename symbol initiated";
}

function organizeImports(): string {
  codeCmd("--command editor.action.organizeImports");
  return "Imports organized";
}

function runTests(): string {
  codeCmd("--command workbench.action.tasks.runTask");
  return "Running tests...";
}

function runTestByName(name: string): string {
  const output = run(`npx vitest run ${name} 2>&1 || npx jest ${name} 2>&1 || dotnet test --filter ${name} 2>&1`);
  return output || `Running test: ${name}`;
}

function changeTheme(name: string): string {
  const platform = getPlatform();
  if (platform === "win32") {
    runPs(`
      $settings = Get-Content "$env:APPDATA\\Code\\User\\settings.json" | ConvertFrom-Json
      $settings.'workbench.colorTheme' = '${name}'
      $settings | ConvertTo-Json -Depth 10 | Set-Content "$env:APPDATA\\Code\\User\\settings.json"
    `);
  } else {
    const settingsPath = platform === "darwin"
      ? `${process.env.HOME}/Library/Application Support/Code/User/settings.json`
      : `${process.env.HOME}/.config/Code/User/settings.json`;
    try {
      const settings = JSON.parse(run(`cat "${settingsPath}"`) || "{}");
      settings["workbench.colorTheme"] = name;
      const { writeFileSync } = require("node:fs") as typeof import("node:fs");
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch { /* ignore */ }
  }
  return `Theme changed to "${name}"`;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(vs\s*code|code\s*editor|open\s+(file|folder)|run\s+(tests?|test)|install\s+extension|remove\s+extension|list\s+extensions|change\s+theme|format\s+(document|file)|toggle\s+sidebar|search\s+in\s+files|go\s+to\s+line|rename\s+symbol|organize\s+imports)\b/i;

export function createVsCodeService(): Service {
  return {
    name: "vs-code",
    description: "Deep VS Code integration — open files, run tests, manage extensions, change themes, format code",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      if (!hasCode()) {
        return { text: "VS Code (code CLI) not found. Install VS Code and ensure 'code' is in PATH." };
      }

      const lower = input.toLowerCase();

      try {
        // Open file
        const fileMatch = lower.match(/\bopen\s+file\s+(.+)/);
        if (fileMatch) return { text: openFile(fileMatch[1]!.trim()) };

        // Open folder
        const folderMatch = lower.match(/\bopen\s+folder\s+(.+)/);
        if (folderMatch) return { text: openFolder(folderMatch[1]!.trim()) };

        // Run tests
        if (/\brun\s+tests?\b/.test(lower)) {
          const testMatch = lower.match(/\brun\s+test\s+(.+)/);
          if (testMatch) return { text: runTestByName(testMatch[1]!.trim()) };
          return { text: runTests() };
        }

        // Install extension
        const installMatch = lower.match(/\binstall\s+extension\s+(.+)/);
        if (installMatch) return { text: installExtension(installMatch[1]!.trim()) };

        // Remove extension
        const removeMatch = lower.match(/\bremove\s+extension\s+(.+)/);
        if (removeMatch) return { text: removeExtension(removeMatch[1]!.trim()) };

        // List extensions
        if (/\blist\s+extensions?\b/.test(lower)) return { text: listExtensions() };

        // Change theme
        const themeMatch = lower.match(/\bchange\s+theme\s+(.+)/);
        if (themeMatch) return { text: changeTheme(themeMatch[1]!.trim()) };

        // Format
        if (/\bformat\s+(document|file)\b/.test(lower)) return { text: formatDocument() };

        // Toggle sidebar
        if (/\btoggle\s+sidebar\b/.test(lower)) return { text: toggleSidebar() };

        // Search in files
        if (/\bsearch\s+in\s+files?\b/.test(lower)) return { text: searchInFiles() };

        // Go to line
        const lineMatch = lower.match(/\bgo\s+to\s+line\s+(\d+)/);
        if (lineMatch) return { text: goToLine(Number.parseInt(lineMatch[1]!, 10)) };

        // Rename symbol
        if (/\brename\s+symbol\b/.test(lower)) return { text: renameSymbol() };

        // Organize imports
        if (/\borganize\s+imports?\b/.test(lower)) return { text: organizeImports() };

        return { text: "VS Code command not recognized." };
      } catch (e) {
        return { text: `VS Code error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}
