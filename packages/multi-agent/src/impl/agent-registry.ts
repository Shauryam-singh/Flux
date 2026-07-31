import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  SubAgent,
  AgentRole,
  AgentSpec,
  AgentMemory,
} from "../interfaces/multi-agent.js";

const AGENTS_DIR = join(process.env.HOME ?? "/tmp", ".flux");
const AGENTS_FILE = join(AGENTS_DIR, "agents.json");

interface PersistedAgent {
  id: string;
  name: string;
  description: string;
  role: AgentRole;
  domain: string;
  systemPrompt: string;
  capabilities: string[];
  status: "active" | "inactive" | "busy";
  createdAt: string;
  lastUsedAt: string | null;
  tasksCompleted: number;
  successRate: number;
  memory: AgentMemory;
}

export class AgentRegistry {
  private agents: Map<string, SubAgent> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.load();
    this.flushTimer = setInterval(() => {
      if (this.dirty) this.flush();
    }, 10000);
  }

  // ─── CRUD ─────────────────────────────────────────────────────

  add(agent: SubAgent): void {
    this.agents.set(agent.id, agent);
    this.dirty = true;
    this.flush();
  }

  get(agentId: string): SubAgent | null {
    return this.agents.get(agentId) ?? null;
  }

  getAll(): SubAgent[] {
    return Array.from(this.agents.values());
  }

  getByRole(role: AgentRole): SubAgent[] {
    return this.getAll().filter((a) => a.role === role);
  }

  update(
    agentId: string,
    updates: Partial<
      Pick<
        SubAgent,
        | "name"
        | "description"
        | "role"
        | "domain"
        | "systemPrompt"
        | "capabilities"
        | "status"
      >
    >,
  ): SubAgent | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    if (updates.name !== undefined) agent.name = updates.name;
    if (updates.description !== undefined)
      agent.description = updates.description;
    if (updates.role !== undefined) agent.role = updates.role;
    if (updates.domain !== undefined) agent.domain = updates.domain;
    if (updates.systemPrompt !== undefined)
      agent.systemPrompt = updates.systemPrompt;
    if (updates.capabilities !== undefined)
      agent.capabilities = updates.capabilities;
    if (updates.status !== undefined) agent.status = updates.status;

    this.dirty = true;
    this.flush();
    return agent;
  }

  delete(agentId: string): boolean {
    const existed = this.agents.delete(agentId);
    if (existed) {
      this.dirty = true;
      this.flush();
    }
    return existed;
  }

  // ─── Duplicate Detection ──────────────────────────────────────

  exists(name: string, domain: string): boolean {
    const nameLower = name.toLowerCase();
    const domainLower = domain.toLowerCase();
    return this.getAll().some(
      (a) =>
        a.name.toLowerCase() === nameLower ||
        (a.domain.toLowerCase() === domainLower && a.role === this.inferRole(name)),
    );
  }

  findSimilar(spec: AgentSpec): SubAgent | null {
    const specCaps = spec.capabilities.map((c) => c.toLowerCase());
    let bestMatch: SubAgent | null = null;
    let bestScore = 0;

    for (const agent of this.agents.values()) {
      let score = 0;
      // Domain match
      if (agent.domain.toLowerCase() === spec.domain.toLowerCase()) score += 30;
      // Role match
      if (agent.role === spec.role) score += 20;
      // Capability overlap
      for (const cap of agent.capabilities) {
        if (specCaps.includes(cap.toLowerCase())) score += 10;
      }
      if (score > bestScore && score >= 30) {
        bestScore = score;
        bestMatch = agent;
      }
    }

    return bestMatch;
  }

  // ─── Capability Scoring ───────────────────────────────────────

  findBestForIntent(intent: string): SubAgent | null {
    const intentLower = intent.toLowerCase();
    let best: SubAgent | null = null;
    let bestScore = 0;

    for (const agent of this.agents.values()) {
      if (agent.status !== "active") continue;
      const score = this.scoreAgent(agent, intentLower);
      if (score > bestScore) {
        bestScore = score;
        best = agent;
      }
    }

    return best;
  }

  private scoreAgent(agent: SubAgent, intentLower: string): number {
    let score = 0;
    for (const cap of agent.capabilities) {
      if (intentLower.includes(cap.toLowerCase())) score += 10;
    }
    // Boost for success rate
    score += Math.round(agent.successRate * 5);
    // Boost for lower task load
    if (agent.status === "active") score += 5;
    return score;
  }

  // ─── Persistence ──────────────────────────────────────────────

  private load(): void {
    try {
      if (!existsSync(AGENTS_FILE)) return;
      const raw = readFileSync(AGENTS_FILE, "utf-8");
      const data = JSON.parse(raw) as PersistedAgent[];
      for (const p of data) {
        // We store the persisted data but can't reconstruct functions.
        // The coordinator will wrap these with LLM-backed execute().
        const agent = this.hydrateAgent(p);
        this.agents.set(agent.id, agent);
      }
    } catch {
      // Corrupted file — start fresh
    }
  }

  flush(): void {
    try {
      if (!existsSync(AGENTS_DIR)) {
        mkdirSync(AGENTS_DIR, { recursive: true });
      }
      const data: PersistedAgent[] = this.getAll().map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        role: a.role,
        domain: a.domain,
        systemPrompt: a.systemPrompt,
        capabilities: [...a.capabilities],
        status: a.status,
        createdAt: a.createdAt,
        lastUsedAt: a.lastUsedAt,
        tasksCompleted: a.tasksCompleted,
        successRate: a.successRate,
        memory: a.memory,
      }));
      writeFileSync(AGENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
      this.dirty = false;
    } catch {
      // Disk error — non-fatal
    }
  }

  clear(): void {
    this.agents.clear();
    this.dirty = true;
    this.flush();
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.dirty) this.flush();
  }

  // ─── Hydration (reconstruct agent from persisted data) ────────

  private hydrateAgent(p: PersistedAgent): SubAgent {
    const memory: AgentMemory = p.memory ?? {
      messages: [],
      maxMessages: 50,
    };

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      role: p.role,
      domain: p.domain,
      systemPrompt: p.systemPrompt,
      capabilities: p.capabilities,
      status: p.status,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
      tasksCompleted: p.tasksCompleted,
      successRate: p.successRate,
      memory,
      canHandle: (intent: string) => {
        const lower = intent.toLowerCase();
        return p.capabilities.some((c) => lower.includes(c.toLowerCase()));
      },
      execute: async (intent: string, _ctx: Record<string, unknown>) => {
        // Stub — the coordinator will override with LLM-backed execute
        return `[${p.name}] Received task: ${intent}`;
      },
    };
  }

  private inferRole(name: string): AgentRole {
    const lower = name.toLowerCase();
    if (lower.includes("code") || lower.includes("develop")) return "coder";
    if (lower.includes("research") || lower.includes("analysis"))
      return "researcher";
    if (lower.includes("review") || lower.includes("audit")) return "reviewer";
    if (lower.includes("plan") || lower.includes("architect")) return "planner";
    if (lower.includes("design") || lower.includes("ui")) return "designer";
    if (lower.includes("devops") || lower.includes("deploy")) return "devops";
    if (lower.includes("writ") || lower.includes("doc")) return "writer";
    return "custom";
  }
}
