/**
 * ============================================================================
 * REGRESSION SUITE — Multi-turn Conversation Quality
 *
 * Based on Test 9 corpus: 5 scenarios, 34 turns total.
 * Measures retention, latency, and hallucination rate.
 *
 * Run: npx tsx test-regression.ts
 * ============================================================================
 */

import { execSync, spawn } from "node:child_process";

const BASE = "http://localhost:3141";
const TIMEOUT = 30_000;
const TURN_DELAY = 2_000;
const SCENARIO_DELAY = 3_000;
const SLOW_THRESHOLD_MS = 4000;

// ── Helpers ──────────────────────────────────────────────────────────

function kw(t: string, k: string) { return t.toLowerCase().includes(k.toLowerCase()); }
function any(t: string, ks: string[]) { return ks.some(k => kw(t, k)); }
function fmtMs(ms: number) { return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`; }
async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Unsupported claim detection ──────────────────────────────────────

const TECH_PATTERNS = [
  /\b(react|angular|vue|svelte|next\.?js|nuxt|remix)\b/i,
  /\b(django|flask|rails|laravel|spring)\b/i,
  /\b(mysql|sqlite|cassandra|dynamodb|couchdb)\b/i,
  /\b(kafka|rabbitmq|celery|bull)\b/i,
  /\b(kubernetes|k8s|helm|istio)\b/i,
  /\b(terraform|ansible|cloudformation)\b/i,
  /\b(nginx|apache|caddy|traefik)\b/i,
  /\b(golang|rust|ruby|php|java|kotlin|swift|dart)\b/i,
];

function detectUnsupported(text: string, context: string): string[] {
  const queryLower = context.toLowerCase();
  const claims: string[] = [];
  for (const pt of TECH_PATTERNS) {
    const m = text.match(pt);
    if (m && !queryLower.includes(m[0].toLowerCase())) claims.push(m[0].toLowerCase());
  }
  return [...new Set(claims)];
}

// ── Scenario definitions ─────────────────────────────────────────────

interface TurnDef {
  prompt: string;
  expect?: string[];
  any?: string[];
  forbidden?: string[];
  desc: string;
}

interface ScenarioDef {
  name: string;
  category: string;
  allowed: string[];
  turns: TurnDef[];
}

const SCENARIOS: ScenarioDef[] = [
  {
    name: "Direct Context Retention",
    category: "direct",
    allowed: ["skywatch","weather","radar","node","nodejs","node.js","express","postgresql","postgres","prisma","orm","typescript","javascript"],
    turns: [
      { prompt: "I'm building a project called SkyWatch \u2014 it's a real-time weather dashboard with live radar overlays." },
      { prompt: "The backend uses Node.js 20 with Express and the database is PostgreSQL 16 with Prisma ORM." },
      { prompt: "What is my project called and what does it do?", expect: ["skywatch","weather"], desc: "Recall: name + purpose" },
      { prompt: "What database and ORM are we using?", expect: ["postgresql","prisma"], desc: "Recall: database + ORM" },
      { prompt: "Give me a complete summary of everything you know about my project.", expect: ["skywatch","weather","node","express","postgresql","prisma"], desc: "Full recall" },
    ],
  },
  {
    name: "Accumulating Constraints",
    category: "constraints",
    allowed: ["typescript","rest","api","500","error","users","endpoint","postgresql","postgres","prisma","orm","node","nodejs","node.js","express","migration","role","column","table","database","pgbouncer","connection","pooling","pool","debugging","debug","fix","step"],
    turns: [
      { prompt: "I have a TypeScript REST API that returns 500 errors on the /users endpoint." },
      { prompt: "The stack is PostgreSQL with Prisma ORM, running on Node.js with Express." },
      { prompt: "The error started after I ran a migration that added a 'role' column to the users table." },
      { prompt: "I need step-by-step debugging instructions for this specific issue.", expect: ["migration"], any: ["/users","role"], desc: "Debug: reference constraints" },
      { prompt: "Also, I want to add connection pooling with pgBouncer before deploying the fix." },
      { prompt: "Give me the complete solution \u2014 include the debugging steps, migration fix, and connection pooling setup.", expect: ["migration","prisma"], any: ["pgbouncer","role"], desc: "Complete solution: ALL constraints" },
    ],
  },
  {
    name: "Correction Handling",
    category: "correction",
    allowed: ["express","fastify","middleware","plugin","hook","jwt","authentication","auth","token","rate","limiting","login","endpoint","node","nodejs","node.js","javascript"],
    turns: [
      { prompt: "What's the best way to structure authentication middleware in Express.js?" },
      { prompt: "Correction \u2014 I'm actually using Fastify, not Express. How does that change the middleware approach?", expect: ["fastify"], desc: "KEY: Express->Fastify" },
      { prompt: "Show me the Fastify plugin setup for JWT-based auth.", expect: ["fastify"], desc: "Continuation: stay on Fastify" },
      { prompt: "Now add rate limiting specifically to the login endpoint.", expect: ["fastify"], desc: "Constraint addition" },
      { prompt: "What was the framework correction I made earlier in this conversation?", expect: ["fastify"], any: ["express"], desc: "Meta-recall" },
    ],
  },
  {
    name: "Topic Switching",
    category: "switching",
    allowed: ["docker","multi-stage","build","image","container","node","nodejs","node.js","javascript","optimization","size","layer","rest","graphql","api","mobile","subscription","real-time","endpoint","schema","query","mutation"],
    turns: [
      { prompt: "Explain how Docker multi-stage builds work for a Node.js application.", expect: ["docker"], desc: "Topic A: Docker" },
      { prompt: "What are the best practices for optimizing Docker image size?", expect: ["docker"], desc: "Topic A: Docker optimization" },
      { prompt: "Switching topics entirely \u2014 what are the key differences between REST and GraphQL for a mobile app backend?" },
      { prompt: "Which approach handles real-time subscriptions better and why?", any: ["rest","graphql"], desc: "Topic B: subscriptions" },
      { prompt: "Going back to Docker \u2014 what optimization approach did we discuss for Node.js images?", expect: ["docker"], forbidden: ["graphql"], desc: "Back to A: Docker" },
      { prompt: "Now back to API design \u2014 what were the REST vs GraphQL tradeoffs we covered?", expect: ["rest","graphql"], forbidden: ["docker"], desc: "Back to B: API" },
    ],
  },
  {
    name: "History Window Overflow",
    category: "overflow",
    allowed: ["quantum","task","management","platform","python","3.12","fastapi","api","backend","mongodb","mongo","redis","cache","caching","aws","ecs","fargate","cloud","deploy","container","react","native","mobile","ios","android","websocket","socket.io","socket","notification","real-time","10000","10,000","10k","concurrent","horizontal","scaling"],
    turns: [
      { prompt: "My project is called Quantum \u2014 it's a task management platform." },
      { prompt: "Built with Python 3.12 and FastAPI for the backend API." },
      { prompt: "Using MongoDB for the main database and Redis for caching." },
      { prompt: "Deployment target is AWS ECS with Fargate containers." },
      { prompt: "We also have a React Native mobile app for iOS and Android." },
      { prompt: "What's the project name, tech stack, and deployment target?", expect: ["quantum","python","fastapi","mongodb","redis"], any: ["ecs","fargate","aws"], desc: "Full recall" },
      { prompt: "Adding a new feature: real-time notifications via WebSocket with Socket.io." },
      { prompt: "The WebSocket server must handle 10,000 concurrent connections with horizontal scaling." },
      { prompt: "What's the project name and what database are we using?", expect: ["mongodb"], any: ["quantum"], desc: "Partial recall" },
      { prompt: "What are the scaling requirements for the WebSocket feature?", any: ["10000","10,000","10k","horizontal","scaling","concurrent"], desc: "Recent recall: scaling" },
      { prompt: "What caching solution did we discuss?", expect: ["redis"], desc: "Mid-range: Redis" },
      { prompt: "Summarize everything we've discussed about this project.", desc: "Summary" },
    ],
  },
];

// ── API call ─────────────────────────────────────────────────────────

interface ChatResult {
  full: string;
  ms: number;
  ttft: number;
  tokens: number;
  error: string | null;
}

async function sendChat(message: string): Promise<ChatResult> {
  const t0 = Date.now();
  let full = "", tokens = 0, ttft = 0, error: string | null = null;
  try {
    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), TIMEOUT);
    const res = await fetch(`${BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId: "regression" }),
      signal: ac.signal,
    });
    clearTimeout(tm);
    if (!res.ok) return { full, ms: Date.now() - t0, ttft: 0, tokens: 0, error: `HTTP ${res.status}` };
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const e = JSON.parse(p);
          if (e.error) error = e.error;
          else if (e.token && !e.done) { tokens++; if (!ttft) ttft = Date.now() - t0; full += e.token; }
          else if (e.done && e.text) full = e.text;
        } catch {}
      }
    }
  } catch (err: any) {
    error = (err?.name === "AbortError" || String(err).includes("fetch")) ? "server not running" : String(err);
  }
  return { full, ms: Date.now() - t0, ttft, tokens, error };
}

// ── Server management ────────────────────────────────────────────────

function killServer(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const output = execSync('netstat -ano | findstr ":3141" | findstr "LISTEN"', { encoding: "utf8", stdio: "pipe" });
      const lines = output.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0") {
          try { execSync(`taskkill /F /PID ${pid}`, { stdio: "pipe" }); } catch {}
        }
      }
    } catch {}
    setTimeout(resolve, 2000);
  });
}

function startServer(): Promise<boolean> {
  return new Promise((resolve) => {
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      FLUX_DISABLE_COGNITIVE: "1",
    };

    const child = spawn("npx", ["tsx", "apps/api/src/index.ts"], {
      cwd: process.cwd(), env, stdio: "ignore", detached: true, shell: true,
    });
    child.unref();

    let attempts = 0;
    const check = async () => {
      attempts++;
      try {
        const ac = new AbortController();
        const tm = setTimeout(() => ac.abort(), 3000);
        const res = await fetch(`${BASE}/health`, { signal: ac.signal });
        clearTimeout(tm);
        if (res.ok) { resolve(true); return; }
      } catch {}
      if (attempts > 30) { resolve(false); return; }
      setTimeout(check, 2000);
    };
    setTimeout(check, 5000);
  });
}

// ── Turn evaluation ──────────────────────────────────────────────────

interface TurnResult {
  pass: boolean;
  retained: number;
  expected: number;
  unsupported: string[];
  ms: number;
  ttft: number;
  tokens: number;
  estimatedModel: "0.5b" | "3b";
}

function evaluateTurn(res: ChatResult, td: TurnDef, allowed: string[]): TurnResult {
  if (res.error) return {
    pass: false, retained: 0, expected: (td.expect ?? []).length,
    unsupported: [], ms: res.ms, ttft: 0, tokens: 0, estimatedModel: "0.5b",
  };

  const exp = td.expect ?? [];
  let retained = 0;
  for (const k of exp) { if (kw(res.full, k)) retained++; }

  let anyOk = true;
  if (td.any) anyOk = any(res.full, td.any);

  let forbiddenOk = true;
  if (td.forbidden) {
    for (const k of td.forbidden) { if (kw(res.full, k)) { forbiddenOk = false; break; } }
  }

  const requiredOk = exp.length === 0 || retained === exp.length;
  const pass = requiredOk && anyOk && forbiddenOk;

  const unsupported = detectUnsupported(res.full, td.prompt);
  const estimatedModel: "0.5b" | "3b" = res.ms > SLOW_THRESHOLD_MS ? "3b" : "0.5b";

  return { pass, retained, expected: exp.length, unsupported, ms: res.ms, ttft: res.ttft, tokens: res.tokens, estimatedModel };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const W = 80;
  const line = "=".repeat(W);
  const dash = "-".repeat(W);

  console.log(`\n+${line}+`);
  console.log(`|${"REGRESSION SUITE: Multi-turn Conversation Quality".padEnd(W)}|`);
  console.log(`+${dash}+`);
  console.log(`|  5 scenarios, 34 turns, N=5 hysteresis routing`.padEnd(W) + `|`);
  console.log(`+${line}+\n`);

  await killServer();
  console.log("Starting server...");
  const ok = await startServer();
  if (!ok) { console.log("FAILED."); process.exit(1); }
  console.log("Ready.\n");

  const allTurns: TurnResult[] = [];

  for (const sc of SCENARIOS) {
    console.log(`[${sc.category}] ${sc.name}`);

    for (let ti = 0; ti < sc.turns.length; ti++) {
      const td = sc.turns[ti];
      const res = await sendChat(td.prompt);
      const tr = evaluateTurn(res, td, sc.allowed);
      allTurns.push(tr);

      process.stdout.write(`  ${tr.pass ? "\u2713" : "\u2717"} T${ti + 1} lat=${fmtMs(tr.ms).padStart(6)} ${tr.estimatedModel}${tr.unsupported.length ? ` [${tr.unsupported.join(",")}]` : ""}\n`);
      await sleep(TURN_DELAY);
    }
    console.log();
    if (SCENARIOS.indexOf(sc) < SCENARIOS.length - 1) await sleep(SCENARIO_DELAY);
  }

  // ── Aggregate results ────────────────────────────────────────────

  const withExpect = allTurns.filter(t => t.expected > 0);
  const totalExp = withExpect.reduce((s, t) => s + t.expected, 0);
  const totalRet = withExpect.reduce((s, t) => s + t.retained, 0);
  const retention = totalExp > 0 ? (totalRet / totalExp) * 100 : 100;
  const passCount = withExpect.filter(t => t.pass).length;

  const lats = allTurns.map(t => t.ms).sort((a, b) => a - b);
  const avgMs = lats.reduce((a, b) => a + b, 0) / lats.length;
  const p50 = lats[Math.floor(lats.length * 0.5)];
  const p95 = lats[Math.floor(lats.length * 0.95)];

  const totalUns = allTurns.reduce((s, t) => s + t.unsupported.length, 0);
  const turns3b = allTurns.filter(t => t.estimatedModel === "3b").length;

  let switches = 0;
  for (let i = 1; i < allTurns.length; i++) {
    if (allTurns[i].estimatedModel !== allTurns[i - 1].estimatedModel) switches++;
  }

  let coldLoads = 0, coldLoadDuration = 0;
  for (let i = 0; i < allTurns.length; i++) {
    if (allTurns[i].estimatedModel === "3b") {
      if (i === 0 || allTurns[i - 1].estimatedModel === "0.5b") {
        coldLoads++;
        coldLoadDuration += allTurns[i].ms;
      }
    }
  }

  // ── Print results ────────────────────────────────────────────────

  console.log(`+${line}+`);
  console.log(`|  ${"METRIC".padEnd(30)} ${"VALUE".padEnd(30)} |`);
  console.log(`+${"-".repeat(W)}+`);
  console.log(`|  ${"Retention".padEnd(30)} ${`${retention.toFixed(1)}% (${totalRet}/${totalExp})`.padEnd(30)} |`);
  console.log(`|  ${"Pass count".padEnd(30)} ${`${passCount}/${withExpect.length}`.padEnd(30)} |`);
  console.log(`|  ${"Hallucinations".padEnd(30)} ${String(totalUns).padEnd(30)} |`);
  console.log(`|  ${"-".repeat(30)} ${"-".repeat(30)} |`);
  console.log(`|  ${"Avg latency".padEnd(30)} ${fmtMs(avgMs).padEnd(30)} |`);
  console.log(`|  ${"P50".padEnd(30)} ${fmtMs(p50).padEnd(30)} |`);
  console.log(`|  ${"P95".padEnd(30)} ${fmtMs(p95).padEnd(30)} |`);
  console.log(`|  ${"-".repeat(30)} ${"-".repeat(30)} |`);
  console.log(`|  ${"Model switches".padEnd(30)} ${String(switches).padEnd(30)} |`);
  console.log(`|  ${"3B turns".padEnd(30)} ${`${turns3b}/${allTurns.length}`.padEnd(30)} |`);
  console.log(`|  ${"Cold loads".padEnd(30)} ${String(coldLoads).padEnd(30)} |`);
  console.log(`|  ${"Cold load duration".padEnd(30)} ${fmtMs(coldLoadDuration).padEnd(30)} |`);
  console.log(`+${line}+\n`);

  // ── Pass/fail verdict ────────────────────────────────────────────

  const PASS_THRESHOLD = 80;
  if (retention >= PASS_THRESHOLD && totalUns <= 5) {
    console.log(`  PASS: ${retention.toFixed(1)}% retention, ${totalUns} hallucinations`);
  } else {
    console.log(`  FAIL: ${retention.toFixed(1)}% retention (need ${PASS_THRESHOLD}%), ${totalUns} hallucinations (max 5)`);
  }

  await killServer();
  process.exit(0);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
