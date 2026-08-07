/**
 * Desktop Control Service
 *
 * Advanced desktop-level operations for Linux (Hyprland/Wayland) and Windows 11:
 *
 *   WINDOW MANAGEMENT
 *     "list windows"           — show all open windows with title, app, workspace
 *     "focus kitty"            — activate a window by app name or title
 *     "close window"           — close the focused window
 *     "minimize window"        — minimize the focused window
 *     "maximize window"        — maximize/restore the focused window
 *     "move window left"       — move focused window to adjacent position
 *     "resize window wider"    — resize the focused window
 *     "float window"           — toggle floating mode
 *     "fullscreen"             — toggle fullscreen
 *     "tile left/right/top/bottom" — snap window to screen edge
 *     "pin window"             — keep window visible on all workspaces
 *
 *   WORKSPACE MANAGEMENT
 *     "list workspaces"        — show all workspaces with window counts
 *     "switch to workspace 3"  — switch to workspace by number or name
 *     "move window to workspace 2" — move focused window to another workspace
 *     "create workspace"       — create a new workspace
 *     "delete workspace 5"     — remove an empty workspace
 *
 *   APP CONTROL
 *     "open firefox"           — launch an application
 *     "launch vs code"         — launch by friendly name
 *     "kill firefox"           — kill an application
 *     "switch to firefox"      — focus window by app name
 *
 *   SYSTEM CONTROL
 *     "volume up/down"         — adjust volume
 *     "set volume 50"          — set exact volume
 *     "mute/unmute"            — toggle mute
 *     "brightness up/down"     — adjust screen brightness
 *     "set brightness 80"      — set exact brightness
 *     "screenshot"             — full screen screenshot
 *     "screenshot selection"   — select area screenshot
 *     "record screen"          — start screen recording
 *     "stop recording"         — stop screen recording
 *     "do not disturb on/off"  — toggle DND
 *
 *   CLIPBOARD
 *     "copy to clipboard X"    — copy text to clipboard
 *     "paste from clipboard"   — read clipboard contents
 *     "clear clipboard"        — clear clipboard
 *
 *   DESKTOP
 *     "show desktop"           — minimize all windows
 *     "lock screen"            — lock the screen
 *     "app launcher"           — open app launcher (rofi/wofi)
 *     "window overview"        — show all windows (hyprctl overview)
 */

import { execSync, spawn } from "node:child_process";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Platform detection & execution ─────────────────────────────

type Platform = "linux" | "win32" | "darwin";
type WM = "hyprland" | "sway" | "unknown";

function getPlatform(): Platform {
  return process.platform as Platform;
}

function getWM(): WM {
  if (process.env["HYPRLAND_INSTANCE_SIGNATURE"]) return "hyprland";
  if (process.env["SWAYSOCK"]) return "sway";
  return "unknown";
}

function run(cmd: string, timeoutMs = 10000): string {
  try {
    return execSync(cmd, { timeout: timeoutMs, stdio: "pipe", encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function runPs(script: string): string {
  try {
    return execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
      timeout: 15000,
      stdio: "pipe",
      encoding: "utf-8",
    }).trim();
  } catch {
    return "";
  }
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── Hyprland implementations ───────────────────────────────────

interface HyprWindow {
  address: string;
  title: string;
  class: string;
  pid: number;
  workspace: { id: number; name: string };
  floating: boolean;
  monitor: number;
  mapped: boolean;
  hidden: boolean;
  fullscreen: boolean;
  size: [number, number];
  at: [number, number];
  pinned: boolean;
}

interface HyprWorkspace {
  id: number;
  name: string;
  monitor: string;
  windows: number;
  hasfullscreen: boolean;
}

function hyprDispatch(cmd: string): string {
  return run(`hyprctl dispatch ${cmd}`);
}

function hyprGetJson<T>(cmd: string): T[] {
  const raw = run(`hyprctl ${cmd} -j`);
  return parseJson<T[]>(raw) ?? [];
}

function hyprActiveWindow(): HyprWindow | null {
  const raw = run("hyprctl activewindow -j");
  return parseJson<HyprWindow>(raw);
}

function hyprAllWindows(): HyprWindow[] {
  return hyprGetJson<HyprWindow>("clients");
}

function hyprAllWorkspaces(): HyprWorkspace[] {
  return hyprGetJson<HyprWorkspace>("workspaces");
}

// ─── Windows implementations ────────────────────────────────────

interface WinWindow {
  hwnd: number;
  title: string;
  process: string;
  visible: boolean;
  minimized: boolean;
  maximized: boolean;
}

function winListWindows(): WinWindow[] {
  const raw = runPs(`
    Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object Id, MainWindowTitle, ProcessName, MainWindowHandle | ConvertTo-Json
  `);
  const arr = parseJson<WinWindow[] | WinWindow>(raw);
  if (!arr) return [];
  return Array.isArray(arr) ? arr : [arr];
}

function winFocusWindow(processName: string): string {
  const result = runPs(`
    $p = Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
    if ($p) {
      [void][Win32Interop]::SetForegroundWindow($p.MainWindowHandle)
      "Focused: $($p.ProcessName)"
    } else { "Process not found: ${processName}" }
  `);
  return result || runPs(`
    Add-Type @"
    using System; using System.Runtime.InteropServices;
    public class Win32 { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }
"@
    $p = Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
    if ($p) { [Win32]::SetForegroundWindow($p.MainWindowHandle); "Focused" } else { "Not found" }
  `);
}

function winCloseWindow(processName: string): string {
  runPs(`Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | Stop-Process -Force`);
  return `Killed ${processName}`;
}

function winMinimizeWindow(processName: string): string {
  runPs(`
    Add-Type @"
    using System; using System.Runtime.InteropServices;
    public class Win32 {
      [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@
    $p = Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
    if ($p) { [Win32]::ShowWindow($p.MainWindowHandle, 6); "Minimized" } else { "Not found" }
  `);
  return `Minimized ${processName}`;
}

function winMaximizeWindow(processName: string): string {
  runPs(`
    Add-Type @"
    using System; using System.Runtime.InteropServices;
    public class Win32 {
      [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@
    $p = Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
    if ($p) { [Win32]::ShowWindow($p.MainWindowHandle, 3); "Maximized" } else { "Not found" }
  `);
  return `Maximized ${processName}`;
}

function winSnapWindow(direction: "left" | "right" | "top" | "bottom"): string {
  const cmds: Record<string, string> = {
    left: "Win+Left",
    right: "Win+Right",
    top: "Win+Up",
    bottom: "Win+Down",
  };
  runPs(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${cmds[direction]}")`);
  return `Snapped ${direction}`;
}

function winShowDesktop(): string {
  runPs(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^{ESC}")`);
  return "Show desktop";
}

function winSwitchDesktop(direction: "left" | "right"): string {
  // Windows 11 virtual desktops via Win+Ctrl+Left/Right
  const key = direction === "left" ? "^({LEFT})" : "^({RIGHT})";
  runPs(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${key}")`);
  return `Switched desktop ${direction}`;
}

function winLaunchApp(app: string): string {
  runPs(`Start-Process "${app}"`);
  return `Launched ${app}`;
}

// ─── System control (cross-platform) ────────────────────────────

function getVolume(): number {
  const raw = run("pamixer --get-volume");
  return Number.parseInt(raw, 10) || 0;
}

function setVolume(level: number): string {
  run(`pamixer --set-volume ${Math.max(0, Math.min(100, level))}`);
  return `Volume set to ${level}%`;
}

function adjustVolume(delta: number): string {
  const current = getVolume();
  const next = Math.max(0, Math.min(100, current + delta));
  run(`pamixer --set-volume ${next}`);
  return `Volume: ${current}% → ${next}%`;
}

function toggleMute(): string {
  run("pamixer -t");
  const muted = run("pamixer --get-mute");
  return muted === "true" ? "Muted" : "Unmuted";
}

function getBrightness(): number {
  const raw = run("brightnessctl -m | cut -d, -f4 | tr -d '%'");
  return Number.parseInt(raw, 10) || 0;
}

function setBrightness(level: number): string {
  run(`brightnessctl set ${Math.max(1, Math.min(100, level))}%`);
  return `Brightness set to ${level}%`;
}

function adjustBrightness(delta: number): string {
  const current = getBrightness();
  const next = Math.max(1, Math.min(100, current + delta));
  run(`brightnessctl set ${next}%`);
  return `Brightness: ${current}% → ${next}%`;
}

function takeScreenshot(area?: "selection" | "window"): Promise<string> {
  const ts = Date.now();
  const path = `${process.env.HOME}/Pictures/screenshot_${ts}.png`;
  if (area === "selection") {
    return new Promise((resolve) => {
      // grim + slurp for region selection
      const proc = execSync(`grim -g "$(slurp)" ${path}`, { timeout: 15000, stdio: "pipe" });
      resolve(`Screenshot saved: ${path}`);
    });
  }
  run(`grim ${path}`);
  return Promise.resolve(`Screenshot saved: ${path}`);
}

let recordingProcess: ReturnType<typeof execSync> | null = null;
let recordingPath = "";

function startRecording(): string {
  if (recordingProcess) return "Already recording.";
  recordingPath = `${process.env.HOME}/Videos/recording_${Date.now()}.mp4`;
  try {
    execSync(`ffmpeg -f x11grab -framerate 30 -i :0 -c:v libx264 -preset ultrafast "${recordingPath}" &`, {
      timeout: 5000,
      stdio: "pipe",
    });
    return `Recording started: ${recordingPath}`;
  } catch {
    return "Screen recording requires ffmpeg with x11grab support.";
  }
}

function stopRecording(): string {
  if (!recordingProcess) return "Not recording.";
  try {
    execSync("pkill -f ffmpeg", { timeout: 5000, stdio: "pipe" });
    recordingProcess = null;
    return `Recording saved: ${recordingPath}`;
  } catch {
    return "Could not stop recording.";
  }
}

function lockScreen(): string {
  const wm = getWM();
  if (wm === "hyprland") {
    run("hyprctl dispatch exit");
    return "Locking screen...";
  }
  run("loginctl lock-session");
  return "Screen locked";
}

function appLauncher(): string {
  try {
    spawn("rofi", ["-show", "drun"], { detached: true, stdio: "ignore", env: process.env }).unref();
  } catch {
    // rofi not available
  }
  return "App launcher opened";
}

function showAllWindows(): string {
  const wm = getWM();
  if (wm === "hyprland") {
    hyprDispatch("overview:toggle");
    return "Window overview opened";
  }
  return "Window overview not supported on this WM";
}

// ─── Natural Language Parser ────────────────────────────────────

interface DesktopIntent {
  category: "window" | "workspace" | "app" | "system" | "clipboard" | "desktop";
  action: string;
  target: string;
  direction: string;
  value: number;
  extra: string;
}

function parseDesktopIntent(input: string): DesktopIntent | null {
  const lower = input.toLowerCase();

  // ─── WINDOW ──
  if (/\b(list|show)\s+(windows?|open apps?)\b/.test(lower)) {
    return { category: "window", action: "list", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(focus|activate|switch to|bring)\s+(.+)/.test(lower)) {
    const m = lower.match(/\b(?:focus|activate|switch to|bring)\s+(.+)/);
    return { category: "window", action: "focus", target: m?.[1]?.trim() ?? "", direction: "", value: 0, extra: "" };
  }
  if (/\b(close|kill)\s+(window|this|focused)\b/.test(lower)) {
    return { category: "window", action: "close", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(minimize|hide)\s+(window|this|focused)\b/.test(lower)) {
    return { category: "window", action: "minimize", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(maximize|restore)\s+(window|this|focused)\b/.test(lower)) {
    return { category: "window", action: "maximize", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(fullscreen|full\s*screen)\b/.test(lower)) {
    return { category: "window", action: "fullscreen", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(float|floating)\s+(window|this|toggle)\b/.test(lower)) {
    return { category: "window", action: "float", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(pin|pinned)\s+(window|this)\b/.test(lower)) {
    return { category: "window", action: "pin", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(tile|snap|move)\s+(window\s+)?(left|right|up|down|top|bottom)\b/.test(lower)) {
    const m = lower.match(/\b(?:tile|snap|move)\s+(?:window\s+)?(left|right|up|down|top|bottom)\b/);
    return { category: "window", action: "tile", target: "", direction: m?.[1] ?? "", value: 0, extra: "" };
  }
  if (/\b(resize)\s+(window\s+)?(wider|narrower|taller|shorter|bigger|smaller)\b/.test(lower)) {
    const dir = lower.match(/(wider|narrower|taller|shorter|bigger|smaller)/);
    return { category: "window", action: "resize", target: "", direction: dir?.[1] ?? "", value: 0, extra: "" };
  }
  if (/\b(move)\s+(window\s+)?(left|right|up|down)\b/.test(lower)) {
    const m = lower.match(/\bmove\b.*\b(left|right|up|down)\b/);
    return { category: "window", action: "move", target: "", direction: m?.[1] ?? "", value: 0, extra: "" };
  }

  // ─── WORKSPACE ──
  if (/\b(list|show)\s+workspaces?\b/.test(lower)) {
    return { category: "workspace", action: "list", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(switch|go)\s+(to\s+)?(workspace|desk)\s+(\w+)/.test(lower)) {
    const m = lower.match(/\b(?:switch|go)\s+(?:to\s+)?(?:workspace|desk)\s+(\w+)/);
    return { category: "workspace", action: "switch", target: m?.[1] ?? "", direction: "", value: 0, extra: "" };
  }
  if (/\b(move)\s+(window\s+)?(to\s+)?(workspace|desk)\s+(\w+)/.test(lower)) {
    const m = lower.match(/\bmove\b.*(?:to\s+)?(?:workspace|desk)\s+(\w+)/);
    return { category: "workspace", action: "move_window", target: m?.[1] ?? "", direction: "", value: 0, extra: "" };
  }
  if (/\b(create|new)\s+(workspace|desk)\b/.test(lower)) {
    return { category: "workspace", action: "create", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(delete|remove|close)\s+(workspace|desk)\s+(\w+)/.test(lower)) {
    const m = lower.match(/\b(?:delete|remove|close)\s+(?:workspace|desk)\s+(\w+)/);
    return { category: "workspace", action: "delete", target: m?.[1] ?? "", direction: "", value: 0, extra: "" };
  }
  if (/\b(next|right)\s+(workspace|desk)\b/.test(lower)) {
    return { category: "workspace", action: "next", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(prev|previous|left)\s+(workspace|desk)\b/.test(lower)) {
    return { category: "workspace", action: "prev", target: "", direction: "", value: 0, extra: "" };
  }

  // ─── APP ──
  if (/\b(open|launch|start|run)\s+(.+)/.test(lower)) {
    const m = lower.match(/\b(?:open|launch|start|run)\s+(.+)/);
    return { category: "app", action: "launch", target: m?.[1]?.trim() ?? "", direction: "", value: 0, extra: "" };
  }
  if (/\b(kill|close|terminate)\s+(app|application|process)\s+(.+)/.test(lower)) {
    const m = lower.match(/\b(?:kill|close|terminate)\s+(?:app|application|process)\s+(.+)/);
    return { category: "app", action: "kill", target: m?.[1]?.trim() ?? "", direction: "", value: 0, extra: "" };
  }
  if (/\b(switch to|focus)\s+(app|application)\s+(.+)/.test(lower)) {
    const m = lower.match(/\b(?:switch to|focus)\s+(?:app|application)\s+(.+)/);
    return { category: "app", action: "switch", target: m?.[1]?.trim() ?? "", direction: "", value: 0, extra: "" };
  }

  // ─── SYSTEM ──
  if (/\bvolume\s+(up|down|\d+)/.test(lower)) {
    const m = lower.match(/\bvolume\s+(up|down|\d+)/);
    const v = m?.[1] ?? "";
    const val = v === "up" ? 5 : v === "down" ? -5 : Number.parseInt(v, 10);
    return { category: "system", action: v === "up" || v === "down" ? "volume_adjust" : "volume_set", target: "", direction: "", value: val, extra: "" };
  }
  if (/\bset\s+volume\s+(\d+)/.test(lower)) {
    const m = lower.match(/\bset\s+volume\s+(\d+)/);
    return { category: "system", action: "volume_set", target: "", direction: "", value: Number.parseInt(m?.[1] ?? "50", 10), extra: "" };
  }
  if (/\b(mute|unmute|toggle\s+mute)\b/.test(lower)) {
    return { category: "system", action: "mute", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\bbrightness\s+(up|down|\d+)/.test(lower)) {
    const m = lower.match(/\bbrightness\s+(up|down|\d+)/);
    const v = m?.[1] ?? "";
    const val = v === "up" ? 10 : v === "down" ? -10 : Number.parseInt(v, 10);
    return { category: "system", action: v === "up" || v === "down" ? "brightness_adjust" : "brightness_set", target: "", direction: "", value: val, extra: "" };
  }
  if (/\bset\s+brightness\s+(\d+)/.test(lower)) {
    const m = lower.match(/\bset\s+brightness\s+(\d+)/);
    return { category: "system", action: "brightness_set", target: "", direction: "", value: Number.parseInt(m?.[1] ?? "50", 10), extra: "" };
  }
  if (/\b(screenshot|screen\s*shot|capture)\s*(selection|area|region|window)?\b/.test(lower)) {
    const area = lower.includes("select") || lower.includes("area") || lower.includes("region")
      ? "selection"
      : lower.includes("window")
        ? "window"
        : "full";
    return { category: "system", action: "screenshot", target: area, direction: "", value: 0, extra: "" };
  }
  if (/\b(record\s+screen|start\s+recording|screen\s+record)\b/.test(lower)) {
    return { category: "system", action: "record_start", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(stop\s+recording|recording\s+stop)\b/.test(lower)) {
    return { category: "system", action: "record_stop", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\bdo\s+not\s+disturb|dnd|quiet\s+mode\b/.test(lower)) {
    const on = /\b(on|enable|start)\b/.test(lower);
    const off = /\b(off|disable|stop)\b/.test(lower);
    return { category: "system", action: "dnd", target: on ? "on" : off ? "off" : "toggle", direction: "", value: 0, extra: "" };
  }

  // ─── CLIPBOARD ──
  if (/\b(copy|clipboard)\s+(.+)/.test(lower)) {
    const m = lower.match(/\b(?:copy|clipboard)\s+(.+)/);
    return { category: "clipboard", action: "copy", target: "", direction: "", value: 0, extra: m?.[1]?.trim() ?? "" };
  }
  if (/\b(paste|clipboard\s+contents?|what('s| is) in clipboard)\b/.test(lower)) {
    return { category: "clipboard", action: "paste", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(clear|empty)\s+clipboard\b/.test(lower)) {
    return { category: "clipboard", action: "clear", target: "", direction: "", value: 0, extra: "" };
  }

  // ─── DESKTOP ──
  if (/\b(show\s+desktop|minimize\s+all|hide\s+all)\b/.test(lower)) {
    return { category: "desktop", action: "show_desktop", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(lock\s+screen|lock\s+the\s+screen)\b/.test(lower)) {
    return { category: "desktop", action: "lock", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(app\s+launcher|launcher|start\s+menu|all\s+apps)\b/.test(lower)) {
    return { category: "desktop", action: "launcher", target: "", direction: "", value: 0, extra: "" };
  }
  if (/\b(window\s+overview|overview|all\s+windows|task\s*view)\b/.test(lower)) {
    return { category: "desktop", action: "overview", target: "", direction: "", value: 0, extra: "" };
  }

  return null;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(window|windows|workspace|workspaces|desk|desktop|focus|minimize|maximize|fullscreen|float|pin|tile|snap|resize|volume|brightness|screenshot|screen\s*shot|record|recording|mute|clipboard|copy|paste|launch|open|kill|close|lock|launcher|overview|show\s+desktop|dnd|do\s+not\s+disturb|switch)\b/i;

export function createDesktopControlService(): Service {
  return {
    name: "desktop-control",
    description:
      "Advanced desktop control: windows, workspaces, apps, system settings, clipboard — works on Linux (Hyprland) and Windows 11",

    canHandle(input: string): boolean {
      return MATCH.test(input);
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const intent = parseDesktopIntent(input);
      if (!intent) {
        return { text: getHelp() };
      }

      const platform = getPlatform();
      const wm = getWM();

      try {
        // ─── WINDOW ──
        if (intent.category === "window") {
          if (wm === "hyprland") return handleHyprWindow(intent);
          if (platform === "win32") return handleWinWindow(intent);
          return { text: "Window management requires Hyprland (Linux) or Windows 11." };
        }

        // ─── WORKSPACE ──
        if (intent.category === "workspace") {
          if (wm === "hyprland") return handleHyprWorkspace(intent);
          if (platform === "win32") return handleWinDesktop(intent);
          return { text: "Workspace management requires Hyprland (Linux) or Windows 11." };
        }

        // ─── APP ──
        if (intent.category === "app") {
          if (wm === "hyprland") return handleHyprApp(intent);
          if (platform === "win32") return handleWinApp(intent);
          return { text: "App control requires Hyprland (Linux) or Windows 11." };
        }

        // ─── SYSTEM ──
        if (intent.category === "system") {
          return handleSystem(intent);
        }

        // ─── CLIPBOARD ──
        if (intent.category === "clipboard") {
          return handleClipboard(intent);
        }

        // ─── DESKTOP ──
        if (intent.category === "desktop") {
          if (wm === "hyprland") return handleHyprDesktop(intent);
          if (platform === "win32") return handleWinDesktop(intent);
          return { text: "Desktop operations require Hyprland (Linux) or Windows 11." };
        }

        return { text: getHelp() };
      } catch (e) {
        return { text: `Desktop error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}

// ─── Hyprland Window Handler ────────────────────────────────────

function handleHyprWindow(intent: DesktopIntent): ServiceResponse {
  switch (intent.action) {
    case "list": {
      const windows = hyprAllWindows();
      if (windows.length === 0) return { text: "No windows open." };
      const lines = windows.map((w, i) => {
        const mode = w.floating ? "floating" : "tiled";
        const fs = w.fullscreen ? " [FULLSCREEN]" : "";
        const pinned = w.pinned ? " [PINNED]" : "";
        return `${i + 1}. ${w.class} — ${w.title.slice(0, 60)} [WS ${w.workspace.name}] ${mode}${fs}${pinned}`;
      });
      return { text: `Windows (${windows.length}):\n${lines.join("\n")}` };
    }
    case "focus": {
      const windows = hyprAllWindows();
      const target = intent.target.toLowerCase();
      const match = windows.find(
        (w) =>
          w.class.toLowerCase().includes(target) ||
          w.title.toLowerCase().includes(target) ||
          w.pid.toString() === target,
      );
      if (!match) return { text: `No window matching "${intent.target}".` };
      hyprDispatch(`focuswindow address:${match.address}`);
      return { text: `Focused: ${match.class} — ${match.title}` };
    }
    case "close": {
      hyprDispatch("closewindow");
      return { text: "Window closed." };
    }
    case "minimize": {
      hyprDispatch("minimize");
      return { text: "Window minimized." };
    }
    case "maximize": {
      hyprDispatch("togglefloating");
      hyprDispatch("fullscreen 0");
      return { text: "Window maximized/toggled." };
    }
    case "fullscreen": {
      hyprDispatch("fullscreen 0");
      return { text: "Fullscreen toggled." };
    }
    case "float": {
      hyprDispatch("togglefloating");
      return { text: "Floating mode toggled." };
    }
    case "pin": {
      hyprDispatch("pin");
      return { text: "Window pin toggled." };
    }
    case "tile": {
      const dir = intent.direction === "top" ? "up" : intent.direction === "bottom" ? "down" : intent.direction;
      hyprDispatch(`movewindow ${dir}`);
      return { text: `Window moved ${dir}.` };
    }
    case "resize": {
      const dir = intent.direction;
      if (dir === "wider" || dir === "bigger") hyprDispatch("resizeactive 100 0");
      else if (dir === "narrower" || dir === "smaller") hyprDispatch("resizeactive -100 0");
      else if (dir === "taller") hyprDispatch("resizeactive 0 100");
      else if (dir === "shorter") hyprDispatch("resizeactive 0 -100");
      return { text: `Window resized ${dir}.` };
    }
    case "move": {
      const dir = intent.direction;
      if (dir === "left") hyprDispatch("movewindow l");
      else if (dir === "right") hyprDispatch("movewindow r");
      else if (dir === "up") hyprDispatch("movewindow u");
      else if (dir === "down") hyprDispatch("movewindow d");
      return { text: `Window moved ${dir}.` };
    }
  }
  return { text: "Unknown window action." };
}

// ─── Hyprland Workspace Handler ─────────────────────────────────

function handleHyprWorkspace(intent: DesktopIntent): ServiceResponse {
  switch (intent.action) {
    case "list": {
      const wss = hyprAllWorkspaces();
      const lines = wss.map((ws) => {
        const active = ws.id === 1 ? " [ACTIVE]" : "";
        return `${ws.id} (${ws.name}) — ${ws.windows} window(s) ${ws.hasfullscreen ? "[FS] " : ""}${active}`;
      });
      return { text: `Workspaces (${wss.length}):\n${lines.join("\n")}` };
    }
    case "switch": {
      const id = intent.target;
      if (!id) return { text: "Specify a workspace number or name." };
      hyprDispatch(`workspace ${id}`);
      return { text: `Switched to workspace ${id}.` };
    }
    case "move_window": {
      const id = intent.target;
      if (!id) return { text: "Specify a workspace number." };
      hyprDispatch(`movetoworkspace ${id}`);
      return { text: `Window moved to workspace ${id}.` };
    }
    case "create": {
      const wss = hyprAllWorkspaces();
      const newId = Math.max(...wss.map((w) => w.id), 0) + 1;
      hyprDispatch(`workspace ${newId}`);
      return { text: `Created workspace ${newId}.` };
    }
    case "delete": {
      const id = intent.target;
      if (!id) return { text: "Specify a workspace to delete." };
      hyprDispatch(`deleteworkspace ${id}`);
      return { text: `Deleted workspace ${id}.` };
    }
    case "next": {
      hyprDispatch("workspace +1");
      return { text: "Switched to next workspace." };
    }
    case "prev": {
      hyprDispatch("workspace -1");
      return { text: "Switched to previous workspace." };
    }
  }
  return { text: "Unknown workspace action." };
}

// ─── Hyprland App Handler ───────────────────────────────────────

function handleHyprApp(intent: DesktopIntent): ServiceResponse {
  switch (intent.action) {
    case "launch": {
      const app = intent.target ?? "";
      // Map friendly names to binary names
      const appMap: Record<string, string> = {
        "vs code": "code",
        "visual studio code": "code",
        "chrome": "google-chrome-stable",
        "firefox": "firefox",
        "terminal": "kitty",
        "kitty": "kitty",
        "alacritty": "alacritty",
        "file manager": "dolphin",
        "nautilus": "nautilus",
        "thunar": "thunar",
        "discord": "discord",
        "slack": "slack",
        "spotify": "spotify",
        "obsidian": "obsidian",
        "notion": "notion-app",
        "browser": "brave-browser",
        "brave": "brave-browser",
        "vim": "kitty vim",
        "nvim": "kitty nvim",
        "htop": "kitty htop",
        "btop": "kitty btop",
      };
      const binary = appMap[app] ?? app;
      run(`${binary} &`);
      return { text: `Launched: ${app}` };
    }
    case "kill": {
      const app = intent.target ?? "";
      run(`pkill -f "${app}"`);
      return { text: `Killed: ${app}` };
    }
    case "switch": {
      const windows = hyprAllWindows();
      const target = intent.target.toLowerCase();
      const match = windows.find(
        (w) => w.class.toLowerCase().includes(target) || w.title.toLowerCase().includes(target),
      );
      if (!match) return { text: `No running app matching "${intent.target}".` };
      hyprDispatch(`focuswindow address:${match.address}`);
      return { text: `Switched to: ${match.class}` };
    }
  }
  return { text: "Unknown app action." };
}

// ─── Hyprland Desktop Handler ───────────────────────────────────

function handleHyprDesktop(intent: DesktopIntent): ServiceResponse {
  switch (intent.action) {
    case "show_desktop": {
      // Minimize all windows on current workspace
      const windows = hyprAllWindows();
      const currentWs = hyprActiveWindow()?.workspace.id;
      const onCurrent = windows.filter((w) => w.workspace.id === currentWs && !w.floating);
      for (const w of onCurrent) {
        hyprDispatch(`togglespecialworkspace minimize`);
      }
      return { text: `Minimized ${onCurrent.length} windows.` };
    }
    case "lock": {
      run("loginctl lock-session");
      return { text: "Screen locked." };
    }
    case "launcher": {
      try {
        spawn("rofi", ["-show", "drun"], { detached: true, stdio: "ignore", env: process.env }).unref();
      } catch {
        // rofi not available
      }
      return { text: "App launcher opened." };
    }
    case "overview": {
      hyprDispatch("overview:toggle");
      return { text: "Window overview toggled." };
    }
  }
  return { text: "Unknown desktop action." };
}

// ─── Windows Handlers ───────────────────────────────────────────

function handleWinWindow(intent: DesktopIntent): ServiceResponse {
  switch (intent.action) {
    case "list": {
      const windows = winListWindows();
      if (windows.length === 0) return { text: "No windows open." };
      const lines = windows.map((w, i) => {
        const state = w.maximized ? " [MAX]" : w.minimized ? " [MIN]" : "";
        return `${i + 1}. ${w.process} — ${w.title.slice(0, 60)}${state}`;
      });
      return { text: `Windows (${windows.length}):\n${lines.join("\n")}` };
    }
    case "focus": {
      const result = winFocusWindow(intent.target ?? "");
      return { text: result };
    }
    case "close": {
      const result = winCloseWindow(intent.target ?? "");
      return { text: result };
    }
    case "minimize": {
      return { text: winMinimizeWindow(intent.target ?? "") };
    }
    case "maximize": {
      return { text: winMaximizeWindow(intent.target ?? "") };
    }
    case "tile": {
      return { text: winSnapWindow(intent.direction as "left" | "right" | "top" | "bottom") };
    }
  }
  return { text: "Unknown window action on Windows." };
}

function handleWinApp(intent: DesktopIntent): ServiceResponse {
  switch (intent.action) {
    case "launch": {
      return { text: winLaunchApp(intent.target ?? "") };
    }
    case "kill": {
      return { text: winCloseWindow(intent.target ?? "") };
    }
    case "switch": {
      return { text: winFocusWindow(intent.target ?? "") };
    }
  }
  return { text: "Unknown app action on Windows." };
}

function handleWinDesktop(intent: DesktopIntent): ServiceResponse {
  switch (intent.action) {
    case "show_desktop":
      return { text: winShowDesktop() };
    case "switch":
      return { text: winSwitchDesktop("right") };
    case "next":
      return { text: winSwitchDesktop("right") };
    case "prev":
      return { text: winSwitchDesktop("left") };
    case "list": {
      const windows = winListWindows();
      if (windows.length === 0) return { text: "No windows open." };
      const lines = windows.map((w, i) => `${i + 1}. ${w.process} — ${w.title.slice(0, 60)}`);
      return { text: `Windows (${windows.length}):\n${lines.join("\n")}` };
    }
    case "launcher": {
      runPs("Start-Process shell:AppsFolder");
      return { text: "App launcher opened." };
    }
    case "lock": {
      runPs("rundll32.exe user32.dll,LockWorkStation");
      return { text: "Screen locked." };
    }
  }
  return { text: "Unknown desktop action on Windows." };
}

// ─── System Handler ─────────────────────────────────────────────

function handleSystem(intent: DesktopIntent): ServiceResponse {
  switch (intent.action) {
    case "volume_adjust": {
      return { text: adjustVolume(intent.value ?? 5) };
    }
    case "volume_set": {
      return { text: setVolume(intent.value ?? 50) };
    }
    case "mute": {
      return { text: toggleMute() };
    }
    case "brightness_adjust": {
      return { text: adjustBrightness(intent.value ?? 10) };
    }
    case "brightness_set": {
      return { text: setBrightness(intent.value ?? 50) };
    }
    case "screenshot": {
      const path = `${process.env.HOME}/Pictures/screenshot_${Date.now()}.png`;
      if (intent.target === "selection") {
        run(`grim -g "$(slurp)" ${path}`);
      } else {
        run(`grim ${path}`);
      }
      return { text: `Screenshot saved: ${path}` };
    }
    case "record_start": {
      return { text: startRecording() };
    }
    case "record_stop": {
      return { text: stopRecording() };
    }
    case "dnd": {
      // Toggle mako (notification daemon) DND
      const state = intent.target;
      if (state === "on") {
        run("makoctl set-mode do-not-disturb");
        return { text: "Do Not Disturb: ON" };
      } else if (state === "off") {
        run("makoctl set-mode normal");
        return { text: "Do Not Disturb: OFF" };
      }
      // Toggle
      const current = run("makoctl mode");
      if (current.includes("do-not-disturb")) {
        run("makoctl set-mode normal");
        return { text: "Do Not Disturb: OFF" };
      }
      run("makoctl set-mode do-not-disturb");
      return { text: "Do Not Disturb: ON" };
    }
  }
  return { text: "Unknown system action." };
}

// ─── Clipboard Handler ──────────────────────────────────────────

function handleClipboard(intent: DesktopIntent): ServiceResponse {
  switch (intent.action) {
    case "copy": {
      const text = intent.extra ?? "";
      const escaped = text.replace(/"/g, '\\"').replace(/\$/g, "\\$");
      run(`printf '%s' "${escaped}" | timeout 3 wl-copy --no-newline 2>/dev/null || true`);
      return { text: `Copied to clipboard: "${text.slice(0, 100)}"` };
    }
    case "paste": {
      const content = run("timeout 3 wl-paste 2>/dev/null || true");
      return { text: content ? `Clipboard: ${content.slice(0, 2000)}` : "Clipboard is empty." };
    }
    case "clear": {
      run("timeout 3 wl-copy -c 2>/dev/null || true");
      return { text: "Clipboard cleared." };
    }
  }
  return { text: "Unknown clipboard action." };
}

// ─── Help ───────────────────────────────────────────────────────

function getHelp(): string {
  return [
    "**Desktop Control** — full desktop automation (Hyprland + Windows 11):",
    "",
    "**Windows:**",
    "  list windows, focus <app>, close window, minimize window, maximize window",
    "  fullscreen, float window, pin window, tile left/right/top/bottom",
    "  resize wider/narrower, move left/right/up/down",
    "",
    "**Workspaces:**",
    "  list workspaces, switch to workspace <N>, move window to workspace <N>",
    "  create workspace, delete workspace <N>, next workspace, prev workspace",
    "",
    "**Apps:**",
    "  open/launch <app>, kill <app>, switch to <app>",
    "  (supports: firefox, chrome, code, kitty, discord, spotify, etc.)",
    "",
    "**System:**",
    "  volume up/down/set <N>, mute/unmute",
    "  brightness up/down/set <N>",
    "  screenshot, screenshot selection, record screen, stop recording",
    "  do not disturb on/off",
    "",
    "**Clipboard:**",
    "  copy <text> to clipboard, paste from clipboard, clear clipboard",
    "",
    "**Desktop:**",
    "  show desktop, lock screen, app launcher, window overview",
  ].join("\n");
}
