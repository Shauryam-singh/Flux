import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface AutomationChain {
  id: string;
  name: string;
  trigger: {
    type: "time" | "event" | "condition" | "command";
    value: string;
    cron?: string;
  };
  actions: Array<{
    type: "run" | "notify" | "speak" | "open" | "email" | "webhook";
    value: string;
  }>;
  enabled: boolean;
  lastTriggered?: string;
  triggerCount: number;
}

const AUTOMATIONS_DIR = path.join(os.homedir(), ".ai-agent", "automations");
const AUTOMATIONS_FILE = path.join(AUTOMATIONS_DIR, "chains.json");

function ensureDir(): void {
  if (!fs.existsSync(AUTOMATIONS_DIR)) {
    fs.mkdirSync(AUTOMATIONS_DIR, { recursive: true });
  }
}

function loadChains(): AutomationChain[] {
  try {
    ensureDir();
    if (fs.existsSync(AUTOMATIONS_FILE)) {
      return JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveChains(chains: AutomationChain[]): void {
  ensureDir();
  fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(chains, null, 2));
}

export function createAutomationService(): Service {
  return {
    name: "automations",
    description: "Automation chains: create trigger→action rules. Examples: 'every morning speak weather', 'when disk > 90% notify me', 'at 9am open chrome'",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "automate", "automation", "chain", "every ",
        "when ", "at ", "trigger", "always ",
        "whenever", "on ", "schedule",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();
      let result: string;

      if (/^(show|list|get|what)\s+(my\s+)?(automations?|chains?|rules?)/i.test(lower)) {
        const chains = loadChains();
        if (chains.length === 0) {
          result = "No automations set. Create one with: `automate every morning speak good morning`";
        } else {
          const list = chains.map((c, i) => {
            const status = c.enabled ? "✅" : "⏸️";
            const triggerDesc = c.trigger.type === "time"
              ? `at ${c.trigger.value}`
              : c.trigger.type === "command"
                ? `when "${c.trigger.value}"`
                : c.trigger.value;
            const actionDesc = c.actions.map((a) => `${a.type} "${a.value}"`).join(" → ");
            return `${i + 1}. ${status} **${c.name}**: ${triggerDesc} → ${actionDesc} (triggered ${c.triggerCount}x)`;
          }).join("\n");
          result = `**Automation Chains:**\n\n${list}`;
        }
      } else if (/^(add|create|new|set)\s+(an?\s+)?automation/i.test(lower)) {
        // Parse: automate [trigger] [actions]
        // Examples:
        //   automate every morning speak good morning
        //   automate at 9am open chrome
        //   automate when disk above 90 notify me
        const triggerMatch = input.match(/(?:add|create|new|set)\s+(?:an?\s+)?automation\s+(.+)/i);

        if (!triggerMatch) {
          result = "Usage: `automate [trigger] [action]`\nExamples:\n- `automate every morning speak good morning`\n- `automate at 9am open chrome`\n- `automate when disk above 90 notify me`";
        } else {
          const rest = triggerMatch[1] ?? "";
          let trigger: AutomationChain["trigger"] = { type: "command", value: rest };
          let actions: AutomationChain["actions"] = [];
          let name = "";

          // Parse trigger
          if (/^every\s+/i.test(rest)) {
            const timePart = rest.match(/^every\s+(\w+)/i)?.[1] || "day";
            trigger = { type: "time", value: timePart };
            name = `Every ${timePart}`;
            const actionPart = rest.replace(/^every\s+\w+\s*/i, "");
            if (/^speak\s+/i.test(actionPart)) {
              actions.push({ type: "speak", value: actionPart.replace(/^speak\s+/i, "") });
            } else if (/^open\s+/i.test(actionPart)) {
              actions.push({ type: "open", value: actionPart.replace(/^open\s+/i, "") });
            } else if (/^run\s+/i.test(actionPart)) {
              actions.push({ type: "run", value: actionPart.replace(/^run\s+/i, "") });
            } else {
              actions.push({ type: "speak", value: actionPart });
            }
          } else if (/^at\s+/i.test(rest)) {
            const time = rest.match(/^at\s+(\S+)/i)?.[1] || "9am";
            trigger = { type: "time", value: time };
            name = `At ${time}`;
            const actionPart = rest.replace(/^at\s+\S+\s*/i, "");
            if (/^speak\s+/i.test(actionPart)) {
              actions.push({ type: "speak", value: actionPart.replace(/^speak\s+/i, "") });
            } else if (/^open\s+/i.test(actionPart)) {
              actions.push({ type: "open", value: actionPart.replace(/^open\s+/i, "") });
            } else {
              actions.push({ type: "speak", value: actionPart });
            }
          } else if (/^when\s+/i.test(rest)) {
            const condition = rest.match(/^when\s+(.+)/i)?.[1] || "";
            trigger = { type: "condition", value: condition };
            name = `When ${condition.split(" ").slice(0, 3).join(" ")}`;
            // Parse actions after condition
            const actionMatch = condition.match(/\s+(speak|notify|run|open)\s+(.+)/i);
            if (actionMatch) {
              const actionType = (actionMatch[1] ?? "notify").toLowerCase() as AutomationChain["actions"][0]["type"];
              const actionValue = actionMatch[2] ?? "Condition met";
              actions.push({ type: actionType, value: actionValue });
            } else {
              actions.push({ type: "notify", value: "Condition met" });
            }
          } else {
            // Default: treat as command trigger
            trigger = { type: "command", value: rest };
            name = `Command: ${rest.split(" ").slice(0, 3).join(" ")}`;
            actions.push({ type: "speak", value: `Executing: ${rest}` });
          }

          if (actions.length === 0) {
            actions.push({ type: "speak", value: "Automation triggered" });
          }

          const chain: AutomationChain = {
            id: `chain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name,
            trigger,
            actions,
            enabled: true,
            triggerCount: 0,
          };

          const chains = loadChains();
          chains.push(chain);
          saveChains(chains);

          result = `Automation created: **${name}**\nTrigger: ${trigger.type} "${trigger.value}"\nAction: ${actions.map((a) => `${a.type} "${a.value}"`).join(", ")}`;
        }
      } else if (/^(remove|delete|disable)\s+(automation|chain|rule)\s*(\d+)?/i.test(lower)) {
        const chains = loadChains();
        const match = input.match(/(\d+)$/);
        const index = match ? parseInt(match[1]!) - 1 : -1;

        if (index >= 0 && index < chains.length) {
          const removed = chains.splice(index, 1)[0];
          saveChains(chains);
          result = `Removed automation: **${removed?.name ?? "unknown"}**`;
        } else {
          result = "Usage: `remove automation [number]`";
        }
      } else if (/^(enable|disable)\s+(automation|chain|rule)\s*(\d+)?/i.test(lower)) {
        const chains = loadChains();
        const match = input.match(/(\d+)$/);
        const index = match ? parseInt(match[1]!) - 1 : -1;
        const enable = /^enable/i.test(lower);

        if (index >= 0 && index < chains.length) {
          const chain = chains[index]!;
          chain.enabled = enable;
          saveChains(chains);
          result = `${enable ? "Enabled" : "Disabled"} automation: **${chain.name}**`;
        } else {
          result = "Usage: `enable/disable automation [number]`";
        }
      } else if (/^(run|trigger|execute)\s+(automation|chain|rule)\s*(\d+)?/i.test(lower)) {
        const chains = loadChains();
        const match = input.match(/(\d+)$/);
        const index = match ? parseInt(match[1]!) - 1 : -1;

        if (index >= 0 && index < chains.length) {
          const chain = chains[index]!;
          chain.triggerCount++;
          chain.lastTriggered = new Date().toISOString();
          saveChains(chains);

          // Execute actions
          const results: string[] = [];
          for (const action of chain.actions) {
            switch (action.type) {
              case "speak":
                ctx.speak(action.value);
                results.push(`Spoke: "${action.value}"`);
                break;
              case "notify":
                ctx.emit("notification", { message: action.value });
                results.push(`Notified: "${action.value}"`);
                break;
              case "run":
                results.push(`Would run: "${action.value}"`);
                break;
              case "open":
                results.push(`Would open: "${action.value}"`);
                break;
              default:
                results.push(`Action: ${action.type} "${action.value}"`);
            }
          }

          result = `**Automation "${chain.name}" triggered:**\n${results.join("\n")}`;
        } else {
          result = "Usage: `run automation [number]`";
        }
      } else {
        result = "I can create automations. Try:\n- `automate every morning speak good morning`\n- `automate at 9am open chrome`\n- `automate when disk above 90 notify me`\n- `show automations`\n- `run automation 1`";
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}
