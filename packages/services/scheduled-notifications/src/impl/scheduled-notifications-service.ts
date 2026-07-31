/**
 * Scheduled Notifications Service
 *
 * Schedules OS-native notifications (notify-send / PowerShell toast / osascript)
 * that fire at a specified time. Managed via natural language:
 *   "notify me in 30 minutes to take a break"
 *   "remind me at 3pm to stand up"
 *   "schedule a notification every hour"
 */

import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Types ──────────────────────────────────────────────────────

export interface ScheduledNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly scheduledAt: number;    // Unix ms
  readonly repeatMs: number | null; // null = one-shot
  readonly createdAt: number;
  readonly fired: boolean;
  readonly platform: "linux" | "win32" | "darwin";
}

interface StoredData {
  notifications: ScheduledNotification[];
}

// ─── Platform detection ─────────────────────────────────────────

function getPlatform(): "linux" | "win32" | "darwin" {
  return process.platform as "linux" | "win32" | "darwin";
}

// ─── OS-native notification sending ─────────────────────────────

function sendNativeNotification(title: string, body: string): void {
  const platform = getPlatform();
  try {
    if (platform === "linux") {
      execSync(`notify-send "${esc(title)}" "${esc(body)}" -t 10000`, {
        timeout: 5000,
        stdio: "pipe",
      });
    } else if (platform === "win32") {
      // PowerShell BurntToast or Windows Toast
      const psScript = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName("text")
        $textNodes.Item(0).AppendChild($template.CreateTextNode("${esc(title)}")) | Out-Null
        $textNodes.Item(1).AppendChild($template.CreateTextNode("${esc(body)}")) | Out-Null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Flux").Show($toast)
      `.trim();
      execSync(`powershell -NoProfile -Command "${esc(psScript)}"`, {
        timeout: 10000,
        stdio: "pipe",
      });
    } else if (platform === "darwin") {
      execSync(
        `osascript -e 'display notification "${esc(body)}" with title "${esc(title)}" sound name "default"'`,
        { timeout: 5000, stdio: "pipe" },
      );
    }
  } catch {
    // Notification failed — best effort
  }
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/'/g, "\\'");
}

// ─── Natural language parser ────────────────────────────────────

interface ParsedSchedule {
  title: string;
  body: string;
  delayMs: number;
  repeatMs: number | null;
}

function parseScheduleInput(input: string): ParsedSchedule | null {
  const lower = input.toLowerCase();

  // Extract delay: "in 30 minutes", "in 2 hours", "in 15 min"
  const inMatch = lower.match(/\bin\s+(\d+)\s+(minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/);
  let delayMs = 0;
  if (inMatch) {
    const n = Number.parseInt(inMatch[1]!, 10);
    const unit = inMatch[2]!;
    if (unit.startsWith("hour") || unit.startsWith("hr")) delayMs = n * 60 * 60 * 1000;
    else if (unit.startsWith("min")) delayMs = n * 60 * 1000;
    else delayMs = n * 1000;
  }

  // Extract time: "at 3pm", "at 15:00"
  const atMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (atMatch) {
    let hour = Number.parseInt(atMatch[1]!, 10);
    const minute = atMatch[2] ? Number.parseInt(atMatch[2], 10) : 0;
    const ampm = atMatch[3];
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    const now = new Date();
    const target = new Date(now);
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    delayMs = target.getTime() - now.getTime();
  }

  if (delayMs === 0) return null;

  // Extract repeat: "every hour", "every 30 minutes"
  let repeatMs: number | null = null;
  const everyMatch = lower.match(/\bevery\s+(\d+)\s+(minutes?|mins?|hours?|hrs?)\b/);
  if (everyMatch) {
    const n = Number.parseInt(everyMatch[1]!, 10);
    const unit = everyMatch[2]!;
    repeatMs = unit.startsWith("hour") || unit.startsWith("hr")
      ? n * 60 * 60 * 1000
      : n * 60 * 1000;
  }

  // Extract message: everything after "to" or the whole input minus scheduling words
  let message = input
    .replace(/\b(notify|remind|schedule|send|create|me|a|an|notification|alert|reminder)\b/gi, "")
    .replace(/\bin\s+\d+\s+\w+/gi, "")
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, "")
    .replace(/\bevery\s+\d+\s+\w+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Try to extract "to <message>"
  const toMatch = input.match(/\bto\s+(.+)/i);
  if (toMatch) message = toMatch[1]!.trim();

  if (!message) message = "Flux reminder";

  return {
    title: "Flux Reminder",
    body: message,
    delayMs,
    repeatMs,
  };
}

// ─── Persistence ────────────────────────────────────────────────

function loadNotifications(filePath: string): ScheduledNotification[] {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const data: StoredData = JSON.parse(raw);
    return data.notifications;
  } catch {
    return [];
  }
}

function saveNotifications(filePath: string, notifications: ScheduledNotification[]): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify({ notifications }, null, 2), "utf-8");
  } catch {
    // Best effort
  }
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(schedule|set|create|send|notify|remind|notification|alert|reminder)\b/i;
const LIST_MATCH = /\b(show|list|view|get|what('s|\s+are)|my)\b.*\b(notifications?|alerts?|reminders?|scheduled)\b/i;
const CANCEL_MATCH = /\b(cancel|remove|delete|clear)\b.*\b(notification|alert|reminder|all)\b/i;
const FIRE_MATCH = /\b(fire|trigger|test)\b.*\b(notification|alert|reminder)\b/i;

export function createScheduledNotificationsService(): Service {
  const filePath = `${process.env.HOME ?? "."}/.flux/scheduled-notifications.json`;
  return createScheduledNotificationsServiceAt(filePath);
}

export function createScheduledNotificationsServiceAt(filePath: string): Service {
  const timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  let notifications = loadNotifications(filePath);

  // Re-arm existing non-fired notifications on startup
  for (const n of notifications) {
    if (!n.fired) armTimer(n);
  }

  function armTimer(n: ScheduledNotification): void {
    const remaining = n.scheduledAt - Date.now();
    if (remaining <= 0) {
      fireNotification(n);
      return;
    }
    const timer = setTimeout(() => fireNotification(n), remaining);
    timers.set(n.id, timer);
  }

  function fireNotification(n: ScheduledNotification): void {
    sendNativeNotification(n.title, n.body);
    // Update state
    notifications = notifications.map((x) =>
      x.id === n.id ? { ...x, fired: true } : x,
    );
    saveNotifications(filePath, notifications);
    timers.delete(n.id);
    // Re-arm if repeating
    if (n.repeatMs) {
      const next: ScheduledNotification = {
        ...n,
        id: randomUUID(),
        scheduledAt: Date.now() + n.repeatMs,
        fired: false,
      };
      notifications = [...notifications, next];
      saveNotifications(filePath, notifications);
      armTimer(next);
    }
  }

  return {
    name: "scheduled-notifications",
    description: "Schedule OS-native notifications with natural language (time, repeat, cancellation)",

    canHandle(input: string): boolean {
      return MATCH.test(input) || LIST_MATCH.test(input) || CANCEL_MATCH.test(input) || FIRE_MATCH.test(input);
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      // ─── List ──
      if (LIST_MATCH.test(input)) {
        const pending = notifications.filter((n) => !n.fired);
        if (pending.length === 0) {
          return { text: "No scheduled notifications." };
        }
        const lines = pending.map((n) => {
          const when = new Date(n.scheduledAt).toLocaleString();
          const repeat = n.repeatMs ? ` (every ${formatMs(n.repeatMs)})` : "";
          return `- "${n.body}" at ${when}${repeat} [${n.id.slice(0, 8)}]`;
        });
        return { text: `Scheduled notifications:\n${lines.join("\n")}` };
      }

      // ─── Cancel ──
      if (CANCEL_MATCH.test(input)) {
        const idMatch = input.match(/\b([0-9a-f]{8,})\b/);
        if (idMatch) {
          const id = idMatch[1]!;
          const found = notifications.find((n) => n.id.startsWith(id) && !n.fired);
          if (found) {
            const timer = timers.get(found.id);
            if (timer) clearTimeout(timer);
            timers.delete(found.id);
            notifications = notifications.filter((n) => n.id !== found.id);
            saveNotifications(filePath, notifications);
            return { text: `Cancelled notification: "${found.body}"` };
          }
          return { text: `No pending notification with ID ${id}.` };
        }
        // Cancel all
        for (const [, timer] of timers) clearTimeout(timer);
        timers.clear();
        notifications = notifications.filter((n) => n.fired);
        saveNotifications(filePath, notifications);
        return { text: "All scheduled notifications cancelled." };
      }

      // ─── Fire / test ──
      if (FIRE_MATCH.test(input)) {
        sendNativeNotification("Flux Test", "This is a test notification from Flux.");
        return { text: "Test notification sent." };
      }

      // ─── Schedule ──
      const parsed = parseScheduleInput(input);
      if (!parsed) {
        return { text: "I couldn't parse the schedule. Try: \"notify me in 30 minutes to take a break\" or \"remind me at 3pm to stand up\"." };
      }

      const n: ScheduledNotification = {
        id: randomUUID(),
        title: parsed.title,
        body: parsed.body,
        scheduledAt: Date.now() + parsed.delayMs,
        repeatMs: parsed.repeatMs,
        createdAt: Date.now(),
        fired: false,
        platform: getPlatform(),
      };

      notifications = [...notifications, n];
      saveNotifications(filePath, notifications);
      armTimer(n);

      const when = new Date(n.scheduledAt).toLocaleString();
      const repeat = n.repeatMs ? ` repeating every ${formatMs(n.repeatMs)}` : "";
      return { text: `Scheduled: "${n.body}" at ${when}${repeat}. ID: ${n.id.slice(0, 8)}` };
    },
  };
}

function formatMs(ms: number): string {
  if (ms >= 3600000) return `${Math.round(ms / 3600000)}h`;
  if (ms >= 60000) return `${Math.round(ms / 60000)}min`;
  return `${Math.round(ms / 1000)}s`;
}
