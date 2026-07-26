import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

interface Reminder {
  id: string;
  text: string;
  createdAt: string;
  completed: boolean;
}

function getStoragePath(): string {
  const dir = join(homedir(), ".flux");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "reminders.json");
}

function loadReminders(): Reminder[] {
  const path = getStoragePath();
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Reminder[];
  } catch {
    return [];
  }
}

function saveReminders(reminders: Reminder[]): void {
  writeFileSync(getStoragePath(), JSON.stringify(reminders, null, 2), "utf-8");
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function addReminder(text: string): Reminder {
  const reminders = loadReminders();
  const reminder: Reminder = {
    id: generateId(),
    text,
    createdAt: new Date().toISOString(),
    completed: false,
  };
  reminders.push(reminder);
  saveReminders(reminders);
  return reminder;
}

function listReminders(): Reminder[] {
  return loadReminders().filter((r) => !r.completed);
}

function completeReminder(idOrText: string): string {
  const reminders = loadReminders();
  const match = reminders.find(
    (r) =>
      r.id === idOrText ||
      r.text.toLowerCase().includes(idOrText.toLowerCase()),
  );
  if (!match) return `Reminder not found: "${idOrText}"`;
  match.completed = true;
  saveReminders(reminders);
  return `Completed: "${match.text}"`;
}

function deleteReminder(idOrText: string): string {
  const reminders = loadReminders();
  const idx = reminders.findIndex(
    (r) =>
      r.id === idOrText ||
      r.text.toLowerCase().includes(idOrText.toLowerCase()),
  );
  if (idx === -1) return `Reminder not found: "${idOrText}"`;
  const removed = reminders.splice(idx, 1)[0];
  saveReminders(reminders);
  return `Deleted: "${removed?.text}"`;
}

function formatReminders(reminders: Reminder[]): string {
  if (reminders.length === 0) return "No active reminders.";
  const lines = reminders.map(
    (r, i) => `${i + 1}. [${r.id}] ${r.text} (${new Date(r.createdAt).toLocaleDateString()})`,
  );
  return `Reminders (${reminders.length}):\n${lines.join("\n")}`;
}

export function createRemindersService(): Service {
  return {
    name: "reminders",
    description: "Manage reminders, notes, and tasks",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "remind", "note", "task", "todo", "schedule", "alarm",
        "remember", "save note", "list tasks", "delete note",
        "add task", "complete task", "show reminders", "my notes",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();
      let result: string;

      if (lower.startsWith("add ") || lower.startsWith("create ") || lower.startsWith("new ")) {
        const text = input.replace(/^(add|create|new)\s+(reminder|note|task|todo)?\s*/i, "").trim();
        if (!text) {
          result = "What would you like to add?";
        } else {
          const reminder = addReminder(text);
          result = `Added reminder: "${reminder.text}" (ID: ${reminder.id})`;
        }
      } else if (lower.includes("list") || lower.includes("show") || lower.includes("my ") || lower.startsWith("what")) {
        const reminders = listReminders();
        result = formatReminders(reminders);
      } else if (lower.includes("complete") || lower.includes("done") || lower.includes("finish")) {
        const text = input.replace(/^(complete|done|finish)\s+(task|reminder|todo)?\s*/i, "").trim();
        result = completeReminder(text || input);
      } else if (lower.includes("delete") || lower.includes("remove")) {
        const text = input.replace(/^(delete|remove)\s+(task|reminder|note|todo)?\s*/i, "").trim();
        result = deleteReminder(text || input);
      } else {
        const reminder = addReminder(input);
        result = `Saved note: "${reminder.text}"`;
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}
