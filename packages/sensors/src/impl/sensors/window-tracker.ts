import { execSync } from "node:child_process";
import type { ObservationSource } from "@ai-agent/attention";

/**
 * Tracks window focus history, app usage patterns, and context switching.
 * Works on Windows 11 (PowerShell) and CachyOS + HyDE (hyprctl).
 */
export interface WindowInfo {
  readonly app: string;
  readonly title: string;
  readonly className: string;
  readonly pid: number | null;
  readonly timestamp: number;
}

export interface AppSession {
  readonly app: string;
  readonly totalFocusMs: number;
  readonly sessions: number;
  readonly lastUsed: number;
}

export interface WindowTrackingState {
  readonly current: WindowInfo | null;
  readonly previous: WindowInfo | null;
  readonly focusTimeMs: number;
  readonly appSessions: ReadonlyArray<AppSession>;
  readonly switchesLast5Min: number;
  readonly totalSwitches: number;
  readonly isCoding: boolean;
  readonly isBrowsing: boolean;
  readonly isTerminal: boolean;
}

const CODING_APPS = new Set([
  "code",
  "visual studio code",
  "vscode",
  "idea",
  "intellij",
  "pycharm",
  "webstorm",
  "vim",
  "nvim",
  "neovim",
  "emacs",
  "sublime text",
  "atom",
  "zed",
  "helix",
  "cursor",
]);

const BROWSER_APPS = new Set([
  "firefox",
  "chrome",
  "brave",
  "chromium",
  "edge",
  "opera",
  "vivaldi",
  "waterfox",
  "librewolf",
  "qutebrowser",
]);

const TERMINAL_APPS = new Set([
  "kitty",
  "alacritty",
  "wezterm",
  "foot",
  "ghostty",
  "tilix",
  "konsole",
  "gnome-terminal",
  "xfce4-terminal",
  "yakuake",
  "cmd",
  "powershell",
  "windows terminal",
  "wt",
]);

export class WindowTracker {
  private currentWindow: WindowInfo | null = null;
  private previousWindow: WindowInfo | null = null;
  private windowFocusStart = Date.now();
  private appSessions: Map<string, AppSession> = new Map();
  private switchTimestamps: number[] = [];
  private readonly isWindows: boolean;

  constructor() {
    this.isWindows = process.platform === "win32";
  }

  /**
   * Poll current window. Returns new window info if changed, null otherwise.
   */
  poll(): WindowInfo | null {
    const info = this.getActiveWindow();
    if (!info) return null;

    if (
      this.currentWindow &&
      info.app === this.currentWindow.app &&
      info.title === this.currentWindow.title
    ) {
      return null; // No change
    }

    // Window changed — record focus time for old window
    if (this.currentWindow) {
      const focusMs = Date.now() - this.windowFocusStart;
      this.recordFocus(this.currentWindow.app, focusMs);
    }

    this.previousWindow = this.currentWindow;
    this.currentWindow = info;
    this.windowFocusStart = Date.now();

    // Track switches
    this.switchTimestamps.push(Date.now());
    this.switchTimestamps = this.switchTimestamps.filter(
      (t) => Date.now() - t < 300_000,
    );

    return info;
  }

  getState(): WindowTrackingState {
    const focusTimeMs = Date.now() - this.windowFocusStart;
    const appSessions = Array.from(this.appSessions.values())
      .sort((a, b) => b.totalFocusMs - a.totalFocusMs)
      .slice(0, 10);

    const currentApp = this.currentWindow?.app.toLowerCase() ?? "";

    return {
      current: this.currentWindow,
      previous: this.previousWindow,
      focusTimeMs,
      appSessions,
      switchesLast5Min: this.switchTimestamps.length,
      totalSwitches: this.switchTimestamps.length,
      isCoding: CODING_APPS.has(currentApp),
      isBrowsing: BROWSER_APPS.has(currentApp),
      isTerminal: TERMINAL_APPS.has(currentApp),
    };
  }

  getMostUsedApps(limit: number = 5): ReadonlyArray<AppSession> {
    return Array.from(this.appSessions.values())
      .sort((a, b) => b.totalFocusMs - a.totalFocusMs)
      .slice(0, limit);
  }

  getCodingSessionDuration(): number {
    let total = 0;
    for (const [app, session] of this.appSessions) {
      if (CODING_APPS.has(app)) {
        total += session.totalFocusMs;
      }
    }
    return total;
  }

  private recordFocus(app: string, focusMs: number): void {
    const existing = this.appSessions.get(app);
    if (existing) {
      this.appSessions.set(app, {
        ...existing,
        totalFocusMs: existing.totalFocusMs + focusMs,
        sessions: existing.sessions + 1,
        lastUsed: Date.now(),
      });
    } else {
      this.appSessions.set(app, {
        app,
        totalFocusMs: focusMs,
        sessions: 1,
        lastUsed: Date.now(),
      });
    }
  }

  private getActiveWindow(): WindowInfo | null {
    try {
      if (this.isWindows) {
        return this.getWindowWindows();
      }
      return this.getWindowLinux();
    } catch {
      return null;
    }
  }

  private getWindowWindows(): WindowInfo | null {
    // Use PowerShell to get foreground window
    const raw = execSync(
      `pwsh -NoProfile -Command "` +
        `$sig = Add-Type -TypeDefinition 'using System.Runtime.InteropServices; [DllImport(\\"user32.dll\\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\\"user32.dll\\", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); [DllImport(\\"user32.dll\\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);' -Name User32 -Namespace Native -PassThru;` +
        `$hwnd = [Native.User32]::GetForegroundWindow(); ` +
        `$sb = New-Object System.Text.StringBuilder 256; ` +
        `[Native.User32]::GetWindowText($hwnd, $sb, 256) | Out-Null; ` +
        `$pid = 0; [Native.User32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null; ` +
        `$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue; ` +
        `$appName = if($proc){$proc.ProcessName}else{'unknown'}; ` +
        `$title = $sb.ToString(); ` +
        `Write-Output \\"$appName|$title|$pid\\" ` +
        `"`,
      { encoding: "utf-8", timeout: 3000 },
    ).trim();

    const [app, title, pidStr] = raw.split("|");
    if (!app) return null;

    return {
      app: app.toLowerCase(),
      title: title ?? "",
      className: app,
      pid: pidStr ? parseInt(pidStr, 10) : null,
      timestamp: Date.now(),
    };
  }

  private getWindowLinux(): WindowInfo | null {
    // Try Hyprland first (CachyOS + HyDE)
    try {
      const raw = execSync("hyprctl activewindow -j 2>/dev/null", {
        encoding: "utf-8",
        timeout: 2000,
      }).trim();
      if (raw) {
        const data = JSON.parse(raw) as {
          class?: string;
          title?: string;
          address?: string;
          pid?: number;
        };
        if (data.class) {
          return {
            app: data.class.toLowerCase(),
            title: data.title ?? "",
            className: data.class,
            pid: data.pid ?? null,
            timestamp: Date.now(),
          };
        }
      }
    } catch {
      // Not on Hyprland
    }

    // Fallback to xdotool (X11)
    try {
      const windowId = execSync("xdotool getactivewindow 2>/dev/null", {
        encoding: "utf-8",
        timeout: 1000,
      }).trim();

      if (windowId) {
        const title = execSync(
          `xdotool getwindowname ${windowId} 2>/dev/null`,
          { encoding: "utf-8", timeout: 1000 },
        ).trim();

        const className = execSync(
          `xdotool getwindowclassname ${windowId} 2>/dev/null`,
          { encoding: "utf-8", timeout: 1000 },
        ).trim();

        return {
          app: ((className || title.split(" — ")[0]) ?? "").toLowerCase(),
          title,
          className: (className || title.split(" — ")[0]) ?? "",
          pid: null,
          timestamp: Date.now(),
        };
      }
    } catch {
      // xdotool not available
    }

    return null;
  }
}
