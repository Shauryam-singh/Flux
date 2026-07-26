import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  timestamp: string;
  read: boolean;
  speak: boolean;
}

const NOTIFICATIONS_DIR = path.join(os.homedir(), ".ai-agent", "notifications");
const NOTIFICATIONS_FILE = path.join(NOTIFICATIONS_DIR, "notifications.json");

function ensureDir(): void {
  if (!fs.existsSync(NOTIFICATIONS_DIR)) {
    fs.mkdirSync(NOTIFICATIONS_DIR, { recursive: true });
  }
}

function loadNotifications(): Notification[] {
  try {
    ensureDir();
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveNotifications(notifications: Notification[]): void {
  ensureDir();
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
}

export function createNotificationService(): Service {
  return {
    name: "notifications",
    description: "JARVIS-like notification system: send alerts, view notifications, mark as read, speak notifications",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "notify", "notification", "alert", "alerts",
        "unread", "mark read", "clear notifications",
        "speak notifications", "read notifications",
        "what did i miss", "any alerts",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();
      let result: string;

      if (/^(send|create|new|add)\s+(a\s+)?(notification|alert|notify)/i.test(lower)) {
        // Extract the message after the pattern
        const match = input.match(/(?:send|create|new|add)\s+(?:a\s+)?(?:notification|alert|notify)\s*:?\s*(.+)/i);
        const message = match?.[1]?.trim() || input.replace(/^(send|create|new|add)\s+(a\s+)?(notification|alert|notify)\s*:?\s*/i, "").trim();

        if (!message) {
          result = "What would you like to notify about?";
        } else {
          const notification: Notification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: "Flux Alert",
            message,
            type: "info",
            timestamp: new Date().toISOString(),
            read: false,
            speak: true,
          };

          const notifications = loadNotifications();
          notifications.unshift(notification);
          saveNotifications(notifications);

          // Speak the notification
          ctx.speak(`New notification: ${message}`);

          result = `Notification sent: **${message}**`;
        }
      } else if (/^(show|list|view|get|what('s| did))\s*(my\s+)?(unread\s+)?(notifications?|alerts?|messages?)/i.test(lower) ||
                 /^(what did i miss|any alerts|unread)/i.test(lower)) {
        const notifications = loadNotifications();
        const unread = notifications.filter((n) => !n.read);

        if (unread.length === 0) {
          result = "No unread notifications. You're all caught up!";
        } else {
          const list = unread.slice(0, 10).map((n, i) => {
            const time = new Date(n.timestamp).toLocaleTimeString();
            return `${i + 1}. [${n.type.toUpperCase()}] ${n.message} (${time})`;
          }).join("\n");
          result = `**${unread.length} unread notifications:**\n\n${list}`;
        }
      } else if (/^(mark|set)\s+(all\s+)?(as\s+)?read/i.test(lower)) {
        const notifications = loadNotifications();
        let count = 0;
        for (const n of notifications) {
          if (!n.read) {
            n.read = true;
            count++;
          }
        }
        saveNotifications(notifications);
        result = `Marked **${count}** notifications as read.`;
      } else if (/^(clear|dismiss|delete)\s+(all\s+)?(notifications?|alerts?)/i.test(lower)) {
        saveNotifications([]);
        result = "All notifications cleared.";
      } else if (/^(speak|read aloud|tell me)\s+(my\s+)?(unread\s+)?(notifications?|alerts?)/i.test(lower)) {
        const notifications = loadNotifications();
        const unread = notifications.filter((n) => !n.read);

        if (unread.length === 0) {
          result = "No unread notifications.";
        } else {
          const speech = unread.slice(0, 5).map((n) => n.message).join(". Next: ");
          ctx.speak(speech);
          result = `Speaking ${Math.min(unread.length, 5)} notifications...`;
        }
      } else {
        result = "I can help with notifications. Try:\n- Send a notification: [message]\n- Show notifications\n- Mark all as read\n- Clear notifications\n- Speak notifications";
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}
