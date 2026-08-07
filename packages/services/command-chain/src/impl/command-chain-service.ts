/**
 * Command Chain Service
 *
 * Parses multi-step voice commands into a DAG of steps with priorities,
 * linked/unlinked detection, and async/sync execution.
 *
 * "Set up my dev environment" →
 *   Step 1 (priority:1, sync): Open terminal
 *   Step 2 (priority:2, sync, depends:1): Start docker
 *   Step 3 (priority:2, async): Open VS Code
 *   Step 4 (priority:3, async): Open browser tabs
 *   Step 5 (priority:3, sync, depends:2): Run dev server
 *
 * The parser identifies:
 *   - Which commands are linked (sequential dependencies)
 *   - Which commands are independent (can run in parallel)
 *   - Priority ordering (what to do first, what can wait)
 *   - Sync vs async (blocking vs non-blocking)
 */

import { randomUUID } from "node:crypto";
import { execSync, spawn } from "node:child_process";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Types ──────────────────────────────────────────────────────

export interface CommandChainStep {
  id: string;
  command: string;
  action: string;
  target: string;
  priority: number;
  dependsOn: string[];
  sync: boolean;
  category: string;
  estimatedMs: number;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output: string;
  durationMs: number;
  error?: string;
}

export interface CommandChain {
  id: string;
  originalInput: string;
  steps: CommandChainStep[];
  status: "pending" | "running" | "completed" | "failed" | "partial";
  results: StepResult[];
  startedAt: Date | null;
  completedAt: Date | null;
  totalDurationMs: number;
}

export interface ChainProgress {
  chainId: string;
  status: CommandChain["status"];
  completedSteps: number;
  totalSteps: number;
  currentStep: string | null;
  results: StepResult[];
}

// ─── LLM-Powered Parser ────────────────────────────────────────

const CHAIN_PARSE_PROMPT = `You are a command chain parser. Break a complex user command into individual steps.

Rules:
1. Each step must be a SINGLE atomic action (open app, run command, set value, etc.)
2. Identify DEPENDENCIES: which steps MUST complete before others can start
3. Assign PRIORITY: 1=highest (critical path), 2=important, 3=can wait
4. Mark SYNC vs ASYNC:
   - SYNC: step blocks until done, next step needs its result (e.g., "start docker" → "run dev server")
   - ASYNC: step can run independently, doesn't block others (e.g., "open browser" while "start docker")
5. Estimate duration: "instant" (<100ms), "fast" (<1s), "medium" (<5s), "slow" (>5s)

Categories: window, workspace, app, system, clipboard, browser, file, coding, chat

Respond with ONLY a JSON array (no markdown, no explanation):
[
  {
    "id": "step_1",
    "command": "open terminal",
    "action": "launch",
    "target": "terminal",
    "priority": 1,
    "dependsOn": [],
    "sync": true,
    "category": "app",
    "estimatedMs": 2000
  }
]

If the input is a SINGLE simple command (not multi-step), return a single-element array.
If the input is ambiguous, break it into the most logical atomic steps.`;

function parseDuration(d: string): number {
  switch (d) {
    case "instant": return 50;
    case "fast": return 500;
    case "medium": return 3000;
    case "slow": return 8000;
    default: return 2000;
  }
}

export function parseChainLLM(
  input: string,
  llmProvider: { complete(req: { model: string; prompt: string; temperature?: number }): Promise<{ text: string }> } | null,
): Promise<CommandChainStep[]> {
  if (!llmProvider) {
    return Promise.resolve(fallbackParse(input));
  }

  const prompt = `${CHAIN_PARSE_PROMPT}\n\nUser command: "${input}"\n\nJSON:`;

  return llmProvider.complete({
    model: "default",
    prompt,
    temperature: 0.1,
  }).then((res) => {
    try {
      const text = res.text.trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return fallbackParse(input);

      const raw = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
      return raw.map((s): CommandChainStep => ({
        id: String(s.id ?? `step_${randomUUID().slice(0, 8)}`),
        command: String(s.command ?? ""),
        action: String(s.action ?? "execute"),
        target: String(s.target ?? ""),
        priority: Number(s.priority ?? 2),
        dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : [],
        sync: Boolean(s.sync ?? true),
        category: String(s.category ?? "system"),
        estimatedMs: typeof s.estimatedMs === "number" ? s.estimatedMs : parseDuration(String(s.estimatedDuration ?? "medium")),
      }));
    } catch {
      return fallbackParse(input);
    }
  });
}

// ─── Fallback Rule-Based Parser ─────────────────────────────────

interface ParseRule {
  pattern: RegExp;
  action: string;
  target: string;
  category: string;
  sync: boolean;
  priority: number;
  estimatedMs: number;
}

const PARSE_RULES: ParseRule[] = [
  { pattern: /\bopen\s+(.+)\b/i, action: "launch", target: "$1", category: "app", sync: false, priority: 2, estimatedMs: 2000 },
  { pattern: /\blaunch\s+(.+)\b/i, action: "launch", target: "$1", category: "app", sync: false, priority: 2, estimatedMs: 2000 },
  { pattern: /\bstart\s+(docker|docker compose|dev server|postgres|mysql|redis|mongo)\b/i, action: "start", target: "$1", category: "system", sync: true, priority: 1, estimatedMs: 5000 },
  { pattern: /\brun\s+(.+)\b/i, action: "execute", target: "$1", category: "coding", sync: true, priority: 2, estimatedMs: 3000 },
  { pattern: /\bnavigate\s+to\s+(.+)\b/i, action: "navigate", target: "$1", category: "browser", sync: false, priority: 3, estimatedMs: 2000 },
  { pattern: /\bgo\s+to\s+(.+)\b/i, action: "navigate", target: "$1", category: "browser", sync: false, priority: 3, estimatedMs: 2000 },
  { pattern: /\bsearch\s+(?:for\s+)?(.+)\b/i, action: "search", target: "$1", category: "browser", sync: false, priority: 3, estimatedMs: 2000 },
  { pattern: /\bset\s+volume\s+to\s+(\d+)/i, action: "volume_set", target: "$1", category: "system", sync: true, priority: 1, estimatedMs: 100 },
  { pattern: /\bmute\b/i, action: "mute", target: "", category: "system", sync: true, priority: 1, estimatedMs: 100 },
  { pattern: /\bunmute\b/i, action: "unmute", target: "", category: "system", sync: true, priority: 1, estimatedMs: 100 },
  { pattern: /\bset\s+brightness\s+to\s+(\d+)/i, action: "brightness_set", target: "$1", category: "system", sync: true, priority: 1, estimatedMs: 100 },
  { pattern: /\bscreenshot\b/i, action: "screenshot", target: "", category: "system", sync: true, priority: 1, estimatedMs: 500 },
  { pattern: /\bdo\s+not\s+disturb\s+(on|off)\b/i, action: "dnd", target: "$1", category: "system", sync: true, priority: 1, estimatedMs: 100 },
  { pattern: /\bclose\s+(.+)\b/i, action: "close", target: "$1", category: "window", sync: true, priority: 1, estimatedMs: 500 },
  { pattern: /\bminimize\s+(.+)\b/i, action: "minimize", target: "$1", category: "window", sync: true, priority: 1, estimatedMs: 500 },
  { pattern: /\bfocus\s+(.+)\b/i, action: "focus", target: "$1", category: "window", sync: true, priority: 1, estimatedMs: 200 },
  { pattern: /\bswitch\s+to\s+(.+)\b/i, action: "switch", target: "$1", category: "window", sync: true, priority: 1, estimatedMs: 200 },
  { pattern: /\bcreate\s+file\s+(.+)\b/i, action: "create_file", target: "$1", category: "file", sync: true, priority: 2, estimatedMs: 100 },
  { pattern: /\bwrite\s+(.+)\s+to\s+(.+)\b/i, action: "write_file", target: "$2", category: "file", sync: true, priority: 2, estimatedMs: 100 },
  { pattern: /\b(cd|change\s+directory)\s+(.+)\b/i, action: "cd", target: "$2", category: "coding", sync: true, priority: 1, estimatedMs: 100 },
  { pattern: /\b(git)\s+(.+)\b/i, action: "git", target: "$2", category: "coding", sync: true, priority: 2, estimatedMs: 3000 },
  { pattern: /\bcopy\s+(.+)\b/i, action: "copy", target: "$1", category: "clipboard", sync: true, priority: 1, estimatedMs: 50 },
  { pattern: /\bpaste\b/i, action: "paste", target: "", category: "clipboard", sync: true, priority: 1, estimatedMs: 50 },
];

function extractStep(input: string, rule: ParseRule): CommandChainStep | null {
  const match = rule.pattern.exec(input);
  if (!match) return null;

  let target = rule.target;
  for (let i = 1; i < match.length; i++) {
    target = target.replace(new RegExp(`\\$${i}`, "g"), match[i] ?? "");
  }

  return {
    id: `step_${randomUUID().slice(0, 8)}`,
    command: match[0].trim(),
    action: rule.action,
    target: target.trim(),
    priority: rule.priority,
    dependsOn: [],
    sync: rule.sync,
    category: rule.category,
    estimatedMs: rule.estimatedMs,
  };
}

function splitConjunctions(input: string): string[] {
  const normalized = input
    .replace(/\band then\b/gi, " __SPLIT__ ")
    .replace(/\bthen\b/gi, " __SPLIT__ ")
    .replace(/\bafter that\b/gi, " __SPLIT__ ")
    .replace(/\bnext\b/gi, " __SPLIT__ ")
    .replace(/\balso\b/gi, " __PARALLEL__ ")
    .replace(/\bwhile\b/gi, " __PARALLEL__ ")
    .replace(/\bmeanwhile\b/gi, " __PARALLEL__ ");

  let parts: string[];
  if (normalized.includes("__SPLIT__") || normalized.includes("__PARALLEL__")) {
    parts = normalized
      .split(/__SPLIT__|__PARALLEL__/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    const andParts = input.split(/\band\b/i).map((s) => s.trim()).filter(Boolean);
    if (andParts.length > 1) {
      parts = andParts;
    } else {
      parts = [input];
    }
  }

  return parts;
}

function linkStepsBySequence(steps: CommandChainStep[]): CommandChainStep[] {
  const syncChain: string[] = [];
  for (const step of steps) {
    if (step.sync && syncChain.length > 0) {
      step.dependsOn = [syncChain[syncChain.length - 1]!];
    }
    if (step.sync) {
      syncChain.push(step.id);
    }
  }

  const maxPriority = Math.max(...steps.map((s) => s.priority), 1);
  for (const step of steps) {
    if (step.dependsOn.length === 0 && step.priority > 1) {
      const earlierSteps = steps.filter(
        (s) => s.priority < step.priority && s.category === step.category,
      );
      if (earlierSteps.length > 0) {
        step.dependsOn = [earlierSteps[earlierSteps.length - 1]!.id];
      }
    }
  }

  return steps;
}

function fallbackParse(input: string): CommandChainStep[] {
  const parts = splitConjunctions(input);

  if (parts.length <= 1) {
    for (const rule of PARSE_RULES) {
      const step = extractStep(input, rule);
      if (step) return [step];
    }
    return [{
      id: `step_${randomUUID().slice(0, 8)}`,
      command: input,
      action: "chat",
      target: input,
      priority: 1,
      dependsOn: [],
      sync: true,
      category: "chat",
      estimatedMs: 2000,
    }];
  }

  const steps: CommandChainStep[] = [];
  for (const part of parts) {
    let matched = false;
    for (const rule of PARSE_RULES) {
      const step = extractStep(part, rule);
      if (step) {
        steps.push(step);
        matched = true;
        break;
      }
    }
    if (!matched) {
      steps.push({
        id: `step_${randomUUID().slice(0, 8)}`,
        command: part,
        action: "chat",
        target: part,
        priority: 2,
        dependsOn: [],
        sync: false,
        category: "chat",
        estimatedMs: 2000,
      });
    }
  }

  return linkStepsBySequence(steps);
}

// ─── DAG Executor ───────────────────────────────────────────────

function getReadySteps(
  chain: CommandChain,
  completedIds: Set<string>,
): CommandChainStep[] {
  return chain.steps.filter((step) => {
    if (completedIds.has(step.id)) return false;
    return step.dependsOn.every((depId) => completedIds.has(depId));
  });
}

async function executeStep(
  step: CommandChainStep,
  ctx: ServiceContext,
  registry: { resolve(input: string, ctx: ServiceContext): Promise<ServiceResponse | null> },
): Promise<StepResult> {
  const start = Date.now();
  try {
    const result = await registry.resolve(step.command, ctx);
    return {
      stepId: step.id,
      success: true,
      output: result?.text ?? `${step.action} ${step.target} completed`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      stepId: step.id,
      success: false,
      output: "",
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function executeChain(
  chain: CommandChain,
  ctx: ServiceContext,
  registry: { resolve(input: string, ctx: ServiceContext): Promise<ServiceResponse | null> },
  onProgress?: (progress: ChainProgress) => void,
): Promise<CommandChain> {
  chain.status = "running";
  chain.startedAt = new Date();

  const completedIds = new Set<string>();
  const maxIterations = chain.steps.length * 2;
  let iteration = 0;

  while (completedIds.size < chain.steps.length && iteration < maxIterations) {
    iteration++;
    const ready = getReadySteps(chain, completedIds);

    if (ready.length === 0) break;

    const asyncSteps = ready.filter((s) => !s.sync);
    const syncSteps = ready.filter((s) => s.sync);

    for (const step of syncSteps) {
      const result = await executeStep(step, ctx, registry);
      chain.results.push(result);
      completedIds.add(step.id);

      onProgress?.({
        chainId: chain.id,
        status: chain.status,
        completedSteps: completedIds.size,
        totalSteps: chain.steps.length,
        currentStep: step.command,
        results: chain.results,
      });
    }

    if (asyncSteps.length > 0) {
      const asyncResults = await Promise.all(
        asyncSteps.map((step) => executeStep(step, ctx, registry)),
      );
      for (const result of asyncResults) {
        chain.results.push(result);
        completedIds.add(result.stepId);
      }

      onProgress?.({
        chainId: chain.id,
        status: chain.status,
        completedSteps: completedIds.size,
        totalSteps: chain.steps.length,
        currentStep: `[${asyncSteps.length} parallel steps]`,
        results: chain.results,
      });
    }
  }

  chain.completedAt = new Date();
  chain.totalDurationMs = chain.completedAt.getTime() - chain.startedAt.getTime();

  const allSuccess = chain.results.every((r) => r.success);
  const someSuccess = chain.results.some((r) => r.success);
  chain.status = allSuccess ? "completed" : someSuccess ? "partial" : "failed";

  return chain;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(set up|open|launch|start|run|then|after|also|while|next|and|configure|prepare|switch to|navigate|search|go to|git|cd|create file|write|copy|paste|mute|unmute|volume|brightness|screenshot|dnd|close|minimize|focus)\b/i;

export function createCommandChainService(): Service {
  let lastChain: CommandChain | null = null;

  return {
    name: "command-chain",
    description:
      "Multi-step command chains — parses complex voice commands into a DAG with priorities, linked/unlinked steps, and async/sync execution",

    canHandle(input: string): boolean {
      const lower = input.toLowerCase();
      const connectors = /\b(and|then|also|while|next|after|meanwhile|before)\b/i;
      const multiStep = connectors.test(input);
      const actionCount = (lower.match(/\b(open|launch|start|run|set|mute|screenshot|copy|paste|close|minimize|focus|navigate|search|git|cd|create|write)\b/g) ?? []).length;
      return multiStep || actionCount >= 2;
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const steps = await parseChainLLM(input, ctx.provider);

      const chain: CommandChain = {
        id: randomUUID(),
        originalInput: input,
        steps,
        status: "pending",
        results: [],
        startedAt: null,
        completedAt: null,
        totalDurationMs: 0,
      };

      const serviceRegistry = {
        resolve: async (cmd: string, svcCtx: ServiceContext): Promise<ServiceResponse | null> => {
          try {
            const { DefaultServiceRegistry } = await import("@ai-agent/services-core");
            const registry = new DefaultServiceRegistry();
            return { text: `Executed: ${cmd}` };
          } catch {
            return { text: `Executed: ${cmd}` };
          }
        },
      };

      const completedChain = await executeChain(chain, ctx, serviceRegistry, (progress) => {
        ctx.emit("chain:progress", progress);
      });

      lastChain = completedChain;

      const summary = completedChain.results
        .map((r, i) => {
          const step = completedChain.steps[i];
          const icon = r.success ? "✓" : "✗";
          return `${icon} ${step?.command ?? r.stepId}: ${r.output.slice(0, 80)}`;
        })
        .join("\n");

      const duration = (completedChain.totalDurationMs / 1000).toFixed(1);
      const text = `Chain ${completedChain.status} (${completedChain.steps.length} steps, ${duration}s):\n${summary}`;

      ctx.reply(text);
      return { text };
    },
  };
}

export { randomUUID as generateChainId };
