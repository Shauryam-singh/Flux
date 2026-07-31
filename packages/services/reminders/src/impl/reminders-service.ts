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
    (r, i) => `${i + 1}. \`${r.id}\` ${r.text} _(${new Date(r.createdAt).toLocaleDateString()})_`,
  );
  return `**Reminders** (${reminders.length}):\n${lines.join("\n")}`;
}

export function createRemindersService(): Service {
  return {
    name: "reminders",
    description: "Manage reminders, notes, tasks, and todos",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "remind", "note", "task", "todo", "schedule", "alarm",
        "remember", "save note", "list tasks", "delete note",
        "add task", "complete task", "show reminders", "my notes",
        "my tasks", "my todos", "my notes", "open tasks",
        "pending tasks", "add a todo", "add todo", "new todo",
        "add a task", "new task", "create a task",
        "show my", "list my",
        "my goal", "my goals", "my project", "my projects",
        "my progress", "my plan", "my schedule",
        "what is my", "what are my", "how is my", "how are my",
        "any update", "how's my",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();
      let result: string;

      // Check if asking about goals specifically
      const isGoalQuery = /\b(goals?|project|progress|plan|schedule|overview|status)\b/i.test(lower);
      const isTaskQuery = /\b(tasks?|todos?|reminders?|notes?|open)\b/i.test(lower);

      // Add/Create patterns
      if (/^(add|create|new|save)\s+/i.test(lower)) {
        const text = input.replace(/^(add|create|new|save)\s+(a\s+)?(reminder|note|task|todo)?\s*/i, "").trim();
        if (!text) {
          result = "What would you like to add?";
        } else {
          const reminder = addReminder(text);
          result = `✅ Added: **${reminder.text}** (ID: \`${reminder.id}\`)`;
        }
      }
      // Complete patterns
      else if (/^(complete|done|finish|mark)\s+/i.test(lower)) {
        const text = input.replace(/^(complete|done|finish|mark)\s+(task|reminder|todo)?\s*/i, "").trim();
        result = completeReminder(text || input);
      }
      // Delete patterns
      else if (/^(delete|remove|clear)\s+/i.test(lower)) {
        const text = input.replace(/^(delete|remove|clear)\s+(task|reminder|note|todo)?\s*/i, "").trim();
        result = deleteReminder(text || input);
      }
      // Remind me pattern
      else if (/^(remind\s+me|remember)\s+/i.test(lower)) {
        const text = input.replace(/^(remind\s+me|remember)\s+(to\s+)?/i, "").trim();
        if (text) {
          const reminder = addReminder(text);
          result = `✅ Added: **${reminder.text}** (ID: \`${reminder.id}\`)`;
        } else {
          result = "What would you like me to remind you about?";
        }
      }
      // List/Show/Query patterns — fetch from system context + local reminders
      else if (/^(list|show|show\s+me|what('s| are)|my\s+|open\s+|how)/i.test(lower) ||
               isGoalQuery || isTaskQuery ||
               /reminders?|notes?|tasks?|todos?/i.test(lower)) {
        const parts: string[] = [];

        // Fetch goals from system context
        if (isGoalQuery && ctx.getSystemContext) {
          try {
            const sys = await ctx.getSystemContext();
            if (sys.goals && sys.goals.length > 0) {
              const goalLines = sys.goals.map(
                (g, i) => `${i + 1}. **${g.name}** — ${g.progress}% (${g.status})`,
              );
              parts.push(`**Goals** (${sys.goals.length}):\n${goalLines.join("\n")}`);
            } else {
              parts.push("No active goals yet. I'll create goals as I observe your work.");
            }
          } catch {
            // Fall through to local reminders
          }
        }

        // Always show local reminders/tasks
        const reminders = listReminders();
        if (reminders.length > 0 || !isGoalQuery) {
          parts.push(formatReminders(reminders));
        }

        result = parts.join("\n\n") || "Nothing to show yet.";
      }
      // Fallback: treat as a new note
      else {
        const reminder = addReminder(input);
        result = `📝 Saved note: **${reminder.text}** (ID: \`${reminder.id}\`)`;
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}
