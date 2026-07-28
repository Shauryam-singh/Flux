import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface ProactiveRule {
  id: string;
  name: string;
  trigger: "window_change" | "time" | "idle" | "context_change" | "always";
  condition: string;
  response: string;
  cooldown: number; // milliseconds
  lastTriggered?: string;
  enabled: boolean;
}

const PROACTIVE_DIR = path.join(os.homedir(), ".ai-agent", "proactive");
const RULES_FILE = path.join(PROACTIVE_DIR, "rules.json");
const STATE_FILE = path.join(PROACTIVE_DIR, "state.json");

interface ProactiveState {
  lastWindow: string;
  lastContext: string;
  lastSuggestion: string;
  lastSuggestionTime: number;
  idleSince?: number;
}

function ensureDir(): void {
  if (!fs.existsSync(PROACTIVE_DIR)) {
    fs.mkdirSync(PROACTIVE_DIR, { recursive: true });
  }
}

function loadRules(): ProactiveRule[] {
  try {
    ensureDir();
    if (fs.existsSync(RULES_FILE)) {
      return JSON.parse(fs.readFileSync(RULES_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  return getDefaultRules();
}

function getDefaultRules(): ProactiveRule[] {
  return [
    {
      id: "welcome",
      name: "Welcome back",
      trigger: "context_change",
      condition: "session_start",
      response: "Hey! Good to see you again. What are we working on today?",
      cooldown: 3600000,
      enabled: true,
    },
    {
      id: "coding_help",
      name: "Coding assistance",
      trigger: "window_change",
      condition: "coding",
      response: "I see you're coding. Need me to run tests, check for errors, or help with anything?",
      cooldown: 600000,
      enabled: true,
    },
    {
      id: "terminal_help",
      name: "Terminal assistance",
      trigger: "window_change",
      condition: "terminal",
      response: "Terminal time! Want me to run a command or check system status?",
      cooldown: 600000,
      enabled: true,
    },
    {
      id: "idle_check",
      name: "Idle check",
      trigger: "idle",
      condition: "30",
      response: "You've been quiet for a bit. Need anything? I'm here if you do.",
      cooldown: 900000,
      enabled: true,
    },
    {
      id: "disk_warning",
      name: "Disk space warning",
      trigger: "always",
      condition: "disk > 90",
      response: "Heads up — your disk is getting pretty full. Want me to clean up some space?",
      cooldown: 3600000,
      enabled: true,
    },
    {
      id: "memory_warning",
      name: "Memory warning",
      trigger: "always",
      condition: "memory > 85",
      response: "Memory is running high. Want me to check what's using the most?",
      cooldown: 1800000,
      enabled: true,
    },
  ];
}

function loadState(): ProactiveState {
  try {
    ensureDir();
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  return {
    lastWindow: "",
    lastContext: "",
    lastSuggestion: "",
    lastSuggestionTime: 0,
  };
}

function saveState(state: ProactiveState): void {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function checkCondition(condition: string): boolean {
  try {
    if (condition.startsWith("disk >")) {
      const threshold = parseInt(condition.split(">")[1]?.trim() ?? "90");
      const { execSync } = require("node:child_process");
      const output = execSync("df / | tail -1 | awk '{print $5}'", {
        encoding: "utf-8",
        timeout: 5000,
      });
      const usage = parseInt(output.replace("%", "").trim());
      return usage > threshold;
    }
    if (condition.startsWith("memory >")) {
      const threshold = parseInt(condition.split(">")[1]?.trim() ?? "85");
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usage = ((totalMem - freeMem) / totalMem) * 100;
      return usage > threshold;
    }
    if (condition === "session_start") {
      return true; // Always trigger on session start
    }
  } catch {
    // ignore
  }
  return false;
}

function detectContextFromApp(app: string): string {
  const lower = app.toLowerCase();
  if (lower.includes("code") || lower.includes("vim") || lower.includes("studio")) return "coding";
  if (lower.includes("terminal") || lower.includes("konsole")) return "terminal";
  if (lower.includes("chrome") || lower.includes("firefox") || lower.includes("safari")) return "browsing";
  if (lower.includes("slack") || lower.includes("discord")) return "communicating";
  if (lower.includes("word") || lower.includes("docs") || lower.includes("notion")) return "writing";
  return "other";
}

export function createProactiveService(): Service {
  return {
    name: "proactive",
    description: "Proactive assistant: watches what you're doing and suggests help automatically. Like having a friend always ready to assist.",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "proactive", "auto", "suggest", "suggestion",
        "watch", "watching", "monitor", "always on",
        "background", "auto-suggest",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();
      let result: string;

      if (/^(show|list|get)\s+(my\s+)?(proactive\s+)?(rules?|suggestions?)/i.test(lower)) {
        const rules = loadRules();
        const list = rules.map((r, i) => {
          const status = r.enabled ? "✅" : "⏸️";
          return `${i + 1}. ${status} **${r.name}**: ${r.trigger} → "${r.response.slice(0, 50)}..."`;
        }).join("\n");
        result = `**Proactive Rules:**\n\n${list}`;
      } else if (/^(add|create|set)\s+(a\s+)?proactive/i.test(lower)) {
        const match = input.match(/(?:add|create|set)\s+(?:a\s+)?proactive\s+(.+?)\s+when\s+(.+?)\s+say\s+(.+)/i);

        if (!match) {
          result = "Usage: `add proactive [name] when [condition] say [response]`\nExample: `add proactive CodeHelp when coding say Need me to run tests?`";
        } else {
          const rule: ProactiveRule = {
            id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: match[1]!,
            trigger: "window_change",
            condition: match[2]!,
            response: match[3]!,
            cooldown: 600000,
            enabled: true,
          };

          const rules = loadRules();
          rules.push(rule);
          fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));

          result = `Proactive rule created: **${rule.name}**\nWhen: ${rule.condition}\nSays: "${rule.response}"`;
        }
      } else if (/^(remove|delete|disable)\s+(proactive|rule)\s*(\d+)?/i.test(lower)) {
        const rules = loadRules();
        const match = input.match(/(\d+)$/);
        const index = match ? parseInt(match[1]!) - 1 : -1;

        if (index >= 0 && index < rules.length) {
          const removed = rules.splice(index, 1)[0];
          fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
          result = `Removed rule: **${removed?.name ?? "unknown"}**`;
        } else {
          result = "Usage: `remove rule [number]`";
        }
      } else if (/^(check|scan|what('s| is) happening)/i.test(lower)) {
        // Check all conditions and return suggestions
        const rules = loadRules().filter((r) => r.enabled);
        const state = loadState();
        const suggestions: string[] = [];

        for (const rule of rules) {
          if (rule.trigger === "always" && checkCondition(rule.condition)) {
            const now = Date.now();
            const lastTime = new Date(rule.lastTriggered ?? 0).getTime();
            if (now - lastTime > rule.cooldown) {
              suggestions.push(rule.response);
              rule.lastTriggered = new Date().toISOString();
            }
          }
        }

        if (suggestions.length > 0) {
          result = suggestions.join("\n\n");
          ctx.speak(suggestions[0]!);
        } else {
          result = "All systems normal. No suggestions right now. I'm here if you need me!";
        }

        // Save updated rules
        fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
      } else if (/^(enable|disable)\s+(proactive|rule)\s*(\d+)?/i.test(lower)) {
        const rules = loadRules();
        const match = input.match(/(\d+)$/);
        const index = match ? parseInt(match[1]!) - 1 : -1;
        const enable = /^enable/i.test(lower);

        if (index >= 0 && index < rules.length) {
          const rule = rules[index]!;
          rule.enabled = enable;
          fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
          result = `${enable ? "Enabled" : "Disabled"} rule: **${rule.name}**`;
        } else {
          result = "Usage: `enable/disable rule [number]`";
        }
      } else if (/^(start|begin)\s+proactive/i.test(lower)) {
        result = "Proactive mode activated! I'll watch what you're doing and offer help when it makes sense.\n\nI'll notice when you:\n- Switch to coding → offer to run tests\n- Open terminal → offer to run commands\n- Are idle → check if you need anything\n- Hit system limits → warn you";
      } else {
        result = "I can be proactive! Try:\n- `check` — scan for issues\n- `show rules` — see what I'm watching\n- `add proactive [name] when [condition] say [message]`\n- `start proactive` — enable auto-suggestions";
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}

// Export for background monitoring
export { loadRules, loadState, saveState, checkCondition, detectContextFromApp };
