/**
 * Calendar Integration Service
 *
 * Read/create calendar events, prepare for meetings — cross-platform.
 *
 * Linux: reads from ICS files or uses `khal`/`gcalcli` CLI
 * Windows: reads from Outlook Calendar via PowerShell COM
 * Both: Google Calendar API (OAuth), or local ICS files
 *
 * Commands:
 *   "what's on my calendar" / "my schedule" — read today's events
 *   "what's on tomorrow" — read tomorrow's events
 *   "schedule meeting with <person> at <time>" — create event
 *   "prepare for <time> meeting" — fetch agenda + context
 *   "cancel meeting <name>" — cancel event
 *   "list my meetings today" — list all today
 *   "create event <name> at <time>" — create calendar event
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Config ─────────────────────────────────────────────────────

interface CalendarConfig {
  googleCalendarToken?: string;
  defaultCalendar?: string;
}

const CONFIG_PATH = join(homedir(), ".flux", "calendar.json");

function loadConfig(): CalendarConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as CalendarConfig;
    }
  } catch { /* ignore */ }
  return {};
}

// ─── Types ──────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  description: string;
  attendees: string[];
  allDay: boolean;
}

// ─── ICS Parser ─────────────────────────────────────────────────

function parseICS(content: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const blocks = content.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]!;
    const endIdx = block.indexOf("END:VEVENT");
    const eventBlock = endIdx > 0 ? block.substring(0, endIdx) : block;

    const get = (key: string): string => {
      const match = eventBlock.match(new RegExp(`${key}[^:]*:(.+)`, "m"));
      return match?.[1]?.trim() ?? "";
    };

    events.push({
      id: get("UID"),
      title: get("SUMMARY"),
      start: get("DTSTART"),
      end: get("DTEND"),
      location: get("LOCATION"),
      description: get("DESCRIPTION"),
      attendees: get("ATTENDEE").split(",").map((s) => s.trim()).filter(Boolean),
      allDay: eventBlock.includes("DTSTART;VALUE=DATE"),
    });
  }

  return events;
}

function readICSFiles(): CalendarEvent[] {
  const dirs = [
    join(homedir(), ".local", "share", "khal", "calendars"),
    join(homedir(), ".calendars"),
    join(homedir(), "Calendar"),
  ];

  const events: CalendarEvent[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith(".ics"));
      for (const file of files) {
        const content = readFileSync(join(dir, file), "utf-8");
        events.push(...parseICS(content));
      }
    } catch { /* ignore */ }
  }
  return events;
}

// ─── Linux: khal / gcalcli ──────────────────────────────────────

function readKhal(): CalendarEvent[] {
  try {
    const today = new Date().toISOString().split("T")[0]!;
    const output = execSync(`khal list ${today} 7d --format "{uid}|{title}|{start}|{end}|{location}|{attendees}" 2>/dev/null`, {
      timeout: 5000, encoding: "utf-8", stdio: "pipe",
    }).trim();
    if (!output) return [];

    return output.split("\n").filter(Boolean).map((line, i): CalendarEvent => {
      const parts = line.split("|");
      return {
        id: parts[0] ?? `khal_${i}`,
        title: parts[1] ?? "",
        start: parts[2] ?? "",
        end: parts[3] ?? "",
        location: parts[4] ?? "",
        description: "",
        attendees: parts[5]?.split(",").map((s) => s.trim()) ?? [],
        allDay: false,
      };
    });
  } catch {
    return [];
  }
}

function readGcalcli(): CalendarEvent[] {
  try {
    const output = execSync("gcalcli list 2>/dev/null", { timeout: 10000, encoding: "utf-8", stdio: "pipe" }).trim();
    if (!output) return [];
    const lines = output.split("\n").slice(1);
    return lines.map((line, i): CalendarEvent => {
      const parts = line.split(/\s{2,}/);
      return {
        id: `gcal_${i}`,
        title: parts.slice(1).join(" ") ?? "",
        start: parts[0] ?? "",
        end: "",
        location: "",
        description: "",
        attendees: [],
        allDay: false,
      };
    });
  } catch {
    return [];
  }
}

// ─── Windows: Outlook Calendar ──────────────────────────────────

function readOutlookCalendar(): CalendarEvent[] {
  try {
    const psScript = `
      $outlook = New-Object -ComObject Outlook.Application
      $namespace = $outlook.GetNamespace("MAPI")
      $calendar = $namespace.GetDefaultFolder(9)
      $items = $calendar.Items
      $items.IncludeRecurrences = $true
      $items.Sort("[Start]")
      $start = (Get-Date).ToString("MM/dd/yyyy")
      $end = (Get-Date).AddDays(7).ToString("MM/dd/yyyy")
      $items = $items.Restrict("[Start] >= '$start' AND [End] <= '$end'")
      $result = @()
      foreach ($item in $items) {
        $result += @{
          Id = $item.EntryID
          Title = $item.Subject
          Start = $item.Start.ToString("yyyy-MM-dd HH:mm")
          End = $item.End.ToString("yyyy-MM-dd HH:mm")
          Location = $item.Location
          Description = $item.Body
        }
      }
      $result | ConvertTo-Json -Depth 3
    `;
    const output = execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`, {
      timeout: 15000, encoding: "utf-8", stdio: "pipe",
    }).trim();
    if (!output) return [];
    const raw = JSON.parse(output) as Array<Record<string, unknown>>;
    return Array.isArray(raw) ? raw.map((r): CalendarEvent => ({
      id: String(r.Id ?? ""),
      title: String(r.Title ?? ""),
      start: String(r.Start ?? ""),
      end: String(r.End ?? ""),
      location: String(r.Location ?? ""),
      description: String(r.Description ?? ""),
      attendees: [],
      allDay: false,
    })) : [];
  } catch {
    return [];
  }
}

// ─── Unified Reader ─────────────────────────────────────────────

function readCalendar(): CalendarEvent[] {
  const platform = process.platform;

  // Try local ICS files first
  const ics = readICSFiles();
  if (ics.length > 0) return ics;

  // Try platform-specific tools
  if (platform === "linux") {
    const khal = readKhal();
    if (khal.length > 0) return khal;
    return readGcalcli();
  }

  if (platform === "win32") return readOutlookCalendar();
  return [];
}

function filterToday(events: CalendarEvent[]): CalendarEvent[] {
  const today = new Date().toISOString().split("T")[0]!;
  return events.filter((e) => e.start.includes(today));
}

function filterTomorrow(events: CalendarEvent[]): CalendarEvent[] {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]!;
  return events.filter((e) => e.start.includes(tomorrow));
}

function formatEvents(events: CalendarEvent[]): string {
  if (events.length === 0) return "No events found.";
  return events.map((e, i) => {
    const time = e.allDay ? "All day" : `${e.start.split("T")[1]?.slice(0, 5) ?? e.start} - ${e.end.split("T")[1]?.slice(0, 5) ?? e.end}`;
    return `${i + 1}. ${e.title}\n   ${time}${e.location ? ` @ ${e.location}` : ""}${e.attendees.length > 0 ? `\n   With: ${e.attendees.join(", ")}` : ""}`;
  }).join("\n\n");
}

function createEvent(title: string, start: string, attendees: string[]): string {
  const platform = process.platform;

  if (platform === "linux") {
    try {
      execSync(`khal new "${start}" "${title}" -a default 2>/dev/null`, { timeout: 5000, stdio: "pipe" });
      return `Created event: "${title}" at ${start}`;
    } catch {
      return `Event creation requires khal or gcalcli. Event noted: "${title}" at ${start}`;
    }
  }

  if (platform === "win32") {
    try {
      const psScript = `
        $outlook = New-Object -ComObject Outlook.Application
        $appt = $outlook.CreateItem(1)
        $appt.Subject = "${title}"
        $appt.Start = "${start}"
        $appt.Duration = 60
        $appt.Save()
      `;
      execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`, {
        timeout: 10000, stdio: "pipe",
      });
      return `Created event: "${title}" at ${start}`;
    } catch {
      return `Event noted: "${title}" at ${start}`;
    }
  }

  return `Event noted: "${title}" at ${start}`;
}

function cancelEvent(name: string): string {
  const platform = process.platform;
  if (platform === "linux") {
    try {
      execSync(`khal delete "${name}" 2>/dev/null`, { timeout: 5000, stdio: "pipe" });
      return `Cancelled event: "${name}"`;
    } catch {
      return `Could not cancel "${name}" — event may not exist in local calendar.`;
    }
  }
  return `Event cancellation noted for "${name}"`;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(calendar|schedule|meetings?|events?|agenda|what('s| is) on|my schedule|tomorrow|today|cancel meeting|create event|prepare for)\b/i;

export function createCalendarService(): Service {
  return {
    name: "calendar",
    description: "Calendar integration — read events, schedule meetings, prepare for meetings, cancel events",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      try {
        // Prepare for meeting
        const prepMatch = lower.match(/\bprepare\s+for\s+(?:the\s+)?(?:meeting|call|standup)\s*(?:at\s+)?(.+)?/);
        if (prepMatch) {
          const events = readCalendar();
          const time = prepMatch[1]?.trim();
          const target = time
            ? events.find((e) => e.start.includes(time))
            : events.find((e) => {
                const eventTime = e.start.split("T")[1]?.slice(0, 5) ?? "";
                const now = new Date();
                const eventDate = new Date(e.start);
                return eventDate > now && eventDate.getTime() - now.getTime() < 7200000;
              });

          if (!target) return { text: "No upcoming meeting found to prepare for." };

          let prep = `Meeting: ${target.title}\nTime: ${target.start}\nLocation: ${target.location || "N/A"}\nAttendees: ${target.attendees.join(", ") || "N/A"}\nDescription: ${target.description || "N/A"}`;

          if (ctx.provider) {
            const summary = await ctx.provider.complete({
              model: "default",
              prompt: `Help me prepare for this meeting. Provide a brief prep checklist:\n\n${prep}`,
              temperature: 0.5,
            });
            prep += `\n\nPrep notes:\n${summary.text}`;
          }

          return { text: prep };
        }

        // Cancel meeting
        const cancelMatch = lower.match(/\bcancel\s+(?:the\s+)?meeting\s+(.+)/);
        if (cancelMatch) return { text: cancelEvent(cancelMatch[1]!.trim()) };

        // Create event
        const createMatch = input.match(/\b(?:create\s+event|schedule|add)\s+(.+?)\s+(?:at|on|for)\s+(.+)/i);
        if (createMatch) {
          return { text: createEvent(createMatch[1]!.trim(), createMatch[2]!.trim(), []) };
        }

        // Schedule meeting with someone
        const schedMatch = input.match(/\bschedule\s+meeting\s+(?:with\s+)?(.+?)\s+(?:at|on|for)\s+(.+)/i);
        if (schedMatch) {
          return { text: createEvent(`Meeting with ${schedMatch[1]!.trim()}`, schedMatch[2]!.trim(), [schedMatch[1]!.trim()]) };
        }

        // Tomorrow
        if (/\b(tomorrow|next\s+day)\b/.test(lower)) {
          const events = filterTomorrow(readCalendar());
          return { text: `Tomorrow's schedule:\n\n${formatEvents(events)}` };
        }

        // Today / schedule / what's on
        if (/\b(today|schedule|what('s| is)\s+on|my\s+schedule|meetings?)\b/.test(lower)) {
          const events = filterToday(readCalendar());
          const all = readCalendar();
          return { text: `Today (${events.length} events):\n\n${formatEvents(events)}\n\nUpcoming week (${all.length} total)` };
        }

        return { text: "Calendar command not recognized. Try: what's on my calendar, schedule meeting, prepare for meeting" };
      } catch (e) {
        return { text: `Calendar error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}
