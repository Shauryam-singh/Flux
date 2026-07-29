import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type {
  Service,
  ServiceContext,
  ServiceResponse,
} from "@ai-agent/services-core";

export interface MonitorRule {
  id: string;
  name: string;
  type: "cpu" | "memory" | "disk" | "process" | "custom";
  threshold?: number;
  condition: "above" | "below" | "equals" | "contains" | "not_contains";
  value: string | number;
  action: "alert" | "speak" | "log" | "notify";
  message: string;
  enabled: boolean;
  lastTriggered?: string;
}

const MONITOR_DIR = path.join(os.homedir(), ".ai-agent", "monitor");
const RULES_FILE = path.join(MONITOR_DIR, "rules.json");
const LOG_FILE = path.join(MONITOR_DIR, "monitor.log");

function ensureDir(): void {
  if (!fs.existsSync(MONITOR_DIR)) {
    fs.mkdirSync(MONITOR_DIR, { recursive: true });
  }
}

function loadRules(): MonitorRule[] {
  try {
    ensureDir();
    if (fs.existsSync(RULES_FILE)) {
      return JSON.parse(fs.readFileSync(RULES_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveRules(rules: MonitorRule[]): void {
  ensureDir();
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
}

function logEvent(message: string): void {
  ensureDir();
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

function getSystemMetrics(): {
  cpu: number;
  memory: { used: number; total: number; percent: number };
  disk: { used: string; percent: number };
  load: number[];
} {
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // CPU usage from /proc/stat (Linux)
  let cpuPercent = 0;
  try {
    const stat = fs.readFileSync("/proc/stat", "utf-8");
    const lines = stat.split("\n");
    const cpuLine = lines[0] ?? "";
    const parts = cpuLine.split(/\s+/).slice(1).map(Number);
    const idle = parts[3] ?? 0;
    const total = parts.reduce((a, b) => a + b, 0);
    if (total > 0) {
      cpuPercent = Math.round(((total - idle) / total) * 100);
    }
  } catch {
    cpuPercent = Math.round((loadAvg[0]! / cpus.length) * 100);
  }

  return {
    cpu: cpuPercent,
    memory: {
      used: Math.round(usedMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percent: Math.round((usedMem / totalMem) * 100),
    },
    disk: { used: "", percent: 0 },
    load: loadAvg,
  };
}

function checkRule(
  rule: MonitorRule,
  metrics: ReturnType<typeof getSystemMetrics>,
): boolean {
  const threshold = rule.threshold ?? 80;
  switch (rule.type) {
    case "cpu":
      return rule.condition === "above"
        ? metrics.cpu > threshold
        : metrics.cpu < threshold;
    case "memory":
      return rule.condition === "above"
        ? metrics.memory.percent > threshold
        : metrics.memory.percent < threshold;
    case "disk":
      return rule.condition === "above"
        ? metrics.disk.percent > threshold
        : metrics.disk.percent < threshold;
    default:
      return false;
  }
}

export function createMonitorService(): Service {
  return {
    name: "monitor",
    description:
      "Proactive system monitor: watch CPU, memory, disk, processes. Set thresholds to auto-alert when limits are exceeded.",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "monitor",
        "watch",
        "track",
        "watching",
        "cpu usage",
        "memory usage",
        "disk usage",
        "threshold",
        "alert when",
        "warn when",
        "system health",
        "system status",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(
      input: string,
      ctx: ServiceContext,
    ): Promise<ServiceResponse> {
      const lower = input.toLowerCase();
      let result: string;

      if (
        /^(show|list|get|what)\s+(my\s+)?(monitor\s+)?(rules?|watches?|alerts?|thresholds?)/i.test(
          lower,
        )
      ) {
        const rules = loadRules();
        if (rules.length === 0) {
          result =
            "No monitor rules set. Create one with: `monitor CPU above 80 alert`";
        } else {
          const list = rules
            .map((r, i) => {
              const status = r.enabled ? "✅" : "⏸️";
              return `${i + 1}. ${status} **${r.name}**: ${r.type} ${r.condition} ${r.threshold ?? r.value} → ${r.action}`;
            })
            .join("\n");
          result = `**Monitor Rules:**\n\n${list}`;
        }
      } else if (/^(add|create|set|new)\s+(a\s+)?monitor/i.test(lower)) {
        const match = input.match(
          /(?:add|create|set|new)\s+(?:a\s+)?monitor\s+(cpu|memory|disk|process)\s+(above|below|equals)\s+(\d+)\s*(alert|speak|log|notify)?\s*(.*)?/i,
        );

        if (!match) {
          result =
            "Usage: `add monitor [cpu|memory|disk] [above|below] [threshold] [alert|speak] [message]`\nExample: `add monitor CPU above 80 alert High CPU usage detected`";
        } else {
          const type = match[1] ?? "cpu";
          const condition = match[2] ?? "above";
          const threshold = match[3] ?? "80";
          const action = match[4] ?? "alert";
          const message =
            match[5]?.trim() ||
            `${type.toUpperCase()} is ${condition} ${threshold}%`;

          const rule: MonitorRule = {
            id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: `${type.toUpperCase()} ${condition} ${threshold}%`,
            type: type.toLowerCase() as MonitorRule["type"],
            threshold: parseInt(threshold),
            condition: condition.toLowerCase() as MonitorRule["condition"],
            value: threshold,
            action: action.toLowerCase() as MonitorRule["action"],
            message,
            enabled: true,
          };

          const rules = loadRules();
          rules.push(rule);
          saveRules(rules);

          logEvent(`Rule created: ${rule.name}`);
          result = `Monitor rule created: **${rule.name}**\nAction: ${rule.action} when ${rule.type} ${rule.condition} ${rule.threshold}%`;
        }
      } else if (
        /^(remove|delete|disable)\s+(rule|monitor|watch)\s*(\d+)?/i.test(lower)
      ) {
        const rules = loadRules();
        const match = input.match(/(\d+)$/);
        const index = match ? parseInt(match[1]!) - 1 : -1;

        if (index >= 0 && index < rules.length) {
          const removed = rules.splice(index, 1)[0];
          saveRules(rules);
          logEvent(`Rule removed: ${removed?.name ?? "unknown"}`);
          result = `Removed rule: **${removed?.name ?? "unknown"}**`;
        } else {
          result = "Usage: `remove rule [number]`";
        }
      } else if (
        /^(enable|disable)\s+(rule|monitor|watch)\s*(\d+)?/i.test(lower)
      ) {
        const rules = loadRules();
        const match = input.match(/(\d+)$/);
        const index = match ? parseInt(match[1]!) - 1 : -1;
        const enable = /^enable/i.test(lower);

        if (index >= 0 && index < rules.length) {
          const rule = rules[index]!;
          rule.enabled = enable;
          saveRules(rules);
          result = `${enable ? "Enabled" : "Disabled"} rule: **${rule.name}**`;
        } else {
          result = "Usage: `enable/disable rule [number]`";
        }
      } else if (/^(check|scan|status|health)/i.test(lower)) {
        const metrics = getSystemMetrics();
        const rules = loadRules().filter((r) => r.enabled);
        const triggered: string[] = [];

        for (const rule of rules) {
          if (checkRule(rule, metrics)) {
            triggered.push(rule.message);
            rule.lastTriggered = new Date().toISOString();
          }
        }

        saveRules(rules);

        const status = [
          `**System Health:**`,
          `CPU: ${metrics.cpu}% | Memory: ${metrics.memory.percent}% (${metrics.memory.used}MB/${metrics.memory.total}MB) | Load: ${metrics.load[0]?.toFixed(2) ?? "0"}`,
          "",
          triggered.length > 0
            ? `⚠️ **${triggered.length} alerts triggered:**\n${triggered.map((t) => `- ${t}`).join("\n")}`
            : "✅ All systems normal.",
        ].join("\n");

        if (triggered.length > 0) {
          ctx.speak(`Warning: ${triggered[0]}`);
        }

        result = status;
      } else if (/^(start|begin)\s+monitoring/i.test(lower)) {
        result =
          "Continuous monitoring started. I'll alert you when thresholds are exceeded.\n\nUse `check` to scan now, or `show rules` to see active monitors.";
      } else {
        result =
          "I can monitor your system. Try:\n- `check` — scan system health\n- `add monitor CPU above 80 alert` — set a rule\n- `show rules` — list monitors\n- `remove rule 1` — delete a rule";
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}
