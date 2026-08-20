/**
 * ============================================================================
 * COGNITIVE LATENCY BENCHMARK
 *
 * Measures whether the cognitive system (orchestrator + 5s think cycle)
 * impacts user-visible chat response times.
 *
 * Tests:
 *   1. Cognitive OFF (baseline) — 10 simple prompts
 *   2. Cognitive ON (active) — same 10 prompts, plus enough turns to seed
 *      observations/goals so the LLM thought generator can fire
 *
 * Key architecture insight: cognitive.message() is called AFTER the chat
 * response is sent (fire-and-forget). The real risk is the 5s think cycle
 * competing for Ollama's serial queue on the NEXT user message.
 *
 * Run: npx tsx test-cognitive-latency.ts
 * ============================================================================
 */

import { execSync, spawn } from "node:child_process";

const BASE = "http://localhost:3141";
const TIMEOUT = 30_000;
const WARMUP_DELAY = 2_000;
const TURN_DELAY = 1_000;

// ── Helpers ──────────────────────────────────────────────────────────

function fmtMs(ms: number) { return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`; }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function sendChat(message: string): Promise<{ full: string; ms: number; ttft: number; error?: string }> {
  let full = "";
  let ttft = 0;
  let error: string | undefined;
  const t0 = Date.now();

  try {
    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), TIMEOUT);
    const res = await fetch(`${BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: ac.signal,
    });
    clearTimeout(tm);

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (reader) {
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const e = JSON.parse(line.slice(6));
            if (e.error) { error = e.error; break; }
            if (e.token && !ttft) ttft = Date.now() - t0;
            if (e.token) full += e.token;
            else if (e.done && e.text) full = e.text;
          } catch {}
        }
      }
    }
  } catch (err: any) {
    error = (err?.name === "AbortError" || String(err).includes("fetch")) ? "server not running" : String(err);
  }
  return { full, ms: Date.now() - t0, ttft, error };
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

function startServer(disableCognitive: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
    };
    if (disableCognitive) env.FLUX_DISABLE_COGNITIVE = "1";

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

// ── Test prompts ─────────────────────────────────────────────────────

// Simple factual prompts — won't trigger 3B routing
const SIMPLE_PROMPTS = [
  "What's 2 + 2?",
  "What color is the sky?",
  "How many letters in 'hello'?",
  "What is JSON?",
  "Name a programming language.",
  "What does HTML stand for?",
  "Is 7 a prime number?",
  "What is a function?",
  "Capital of France?",
  "What is 10 / 2?",
];

// Context-setting prompts to seed observations/goals for cognitive system
const SEED_PROMPTS = [
  "I'm building a project called SkyWatch — it's a real-time weather dashboard.",
  "The backend uses Node.js with Express and PostgreSQL with Prisma ORM.",
  "I want to add a live radar overlay feature.",
];

async function runBench(label: string, prompts: string[], isSeed: boolean): Promise<{ ttfts: number[]; lats: number[]; errors: number }> {
  const ttfts: number[] = [];
  const lats: number[] = [];
  let errors = 0;

  // Warmup turn (not measured)
  await sendChat("ping");

  if (isSeed) {
    // Seed context first to populate observations/goals
    for (const p of SEED_PROMPTS) {
      await sendChat(p);
      await sleep(TURN_DELAY);
    }
  }

  for (const prompt of prompts) {
    const res = await sendChat(prompt);
    if (res.error) {
      errors++;
      process.stdout.write(`  ! ERROR: ${res.error}\n`);
    } else {
      ttfts.push(res.ttft);
      lats.push(res.ms);
      process.stdout.write(`  TTFT=${fmtMs(res.ttft).padStart(7)}  Total=${fmtMs(res.ms).padStart(7)}\n`);
    }
    await sleep(TURN_DELAY);
  }

  return { ttfts, lats, errors };
}

function printStats(label: string, ttfts: number[], lats: number[], errors: number) {
  if (ttfts.length === 0) {
    console.log(`  ${label}: ALL ERRORS (${errors})`);
    return;
  }
  const avgTtft = ttfts.reduce((a, b) => a + b, 0) / ttfts.length;
  const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const sortedLat = [...lats].sort((a, b) => a - b);
  const sortedTtft = [...ttfts].sort((a, b) => a - b);
  const p50 = sortedLat[Math.floor(sortedLat.length * 0.5)];
  const p95 = sortedLat[Math.floor(sortedLat.length * 0.95)];

  console.log(`  TTFT  avg=${fmtMs(avgTtft)}  p50=${fmtMs(sortedTtft[Math.floor(sortedTtft.length * 0.5)])}  p95=${fmtMs(sortedTtft[Math.floor(sortedTtft.length * 0.95)])}`);
  console.log(`  Lat   avg=${fmtMs(avgLat)}  p50=${fmtMs(p50)}  p95=${fmtMs(p95)}  (${ttfts.length} turns, ${errors} errors)`);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const W = 70;
  const line = "=".repeat(W);

  console.log(`\n+${line}+`);
  console.log(`|${"COGNITIVE LATENCY BENCHMARK".padEnd(W)}|`);
  console.log(`+${"─".repeat(W)}+`);
  console.log(`|  Tests whether the cognitive orchestrator impacts response times`.padEnd(W) + `|`);
  console.log(`+${line}+\n`);

  // ── Phase 1: Baseline (cognitive OFF) ──────────────────────────────
  console.log("Phase 1: Baseline (cognitive OFF)");
  await killServer();
  console.log("  Starting server with FLUX_DISABLE_COGNITIVE=1...");
  if (!await startServer(true)) { console.log("  FAILED to start server."); process.exit(1); }
  console.log("  Server ready.\n");

  const base = await runBench("baseline", SIMPLE_PROMPTS, false);
  printStats("Baseline (cognitive OFF)", base.ttfts, base.lats, base.errors);

  // ── Phase 2: Cognitive ON ──────────────────────────────────────────
  console.log("\nPhase 2: Cognitive ON");
  await killServer();
  console.log("  Starting server with cognitive ENABLED...");
  if (!await startServer(false)) { console.log("  FAILED to start server."); process.exit(1); }
  console.log("  Server ready.\n");

  const cog = await runBench("cognitive ON", SIMPLE_PROMPTS, true);
  printStats("Cognitive ON", cog.ttfts, cog.lats, cog.errors);

  // ── Phase 3: Stress — rapid-fire after cognitive has warmed up ─────
  console.log("\nPhase 3: Rapid-fire (5 turns, 200ms gap) — cognitive ON");
  // Give cognitive system time to run a think cycle (5s)
  await sleep(6000);
  const rapidPrompts = ["What is 1+1?", "What is 2+2?", "What is 3+3?", "What is 4+4?", "What is 5+5?"];
  const rapid = await runBench("rapid", rapidPrompts, false);
  printStats("Rapid-fire", rapid.ttfts, rapid.lats, rapid.errors);

  // ── Comparison ─────────────────────────────────────────────────────
  console.log(`\n+${line}+`);
  console.log(`|${"COMPARISON".padEnd(W)}|`);
  console.log(`+${"─".repeat(W)}+`);

  if (base.ttfts.length > 0 && cog.ttfts.length > 0) {
    const baseAvgTtft = base.ttfts.reduce((a, b) => a + b, 0) / base.ttfts.length;
    const cogAvgTtft = cog.ttfts.reduce((a, b) => a + b, 0) / cog.ttfts.length;
    const baseAvgLat = base.lats.reduce((a, b) => a + b, 0) / base.lats.length;
    const cogAvgLat = cog.lats.reduce((a, b) => a + b, 0) / cog.lats.length;

    const ttftDelta = ((cogAvgTtft - baseAvgTtft) / baseAvgTtft * 100);
    const latDelta = ((cogAvgLat - baseAvgLat) / baseAvgLat * 100);

    console.log(`|  TTFT:  baseline=${fmtMs(baseAvgTtft)}  cognitive=${fmtMs(cogAvgTtft)}  delta=${ttftDelta >= 0 ? "+" : ""}${ttftDelta.toFixed(1)}%`.padEnd(W + 1) + `|`);
    console.log(`|  Lat:   baseline=${fmtMs(baseAvgLat)}  cognitive=${fmtMs(cogAvgLat)}  delta=${latDelta >= 0 ? "+" : ""}${latDelta.toFixed(1)}%`.padEnd(W + 1) + `|`);
    console.log(`|`.padEnd(W) + `|`);

    if (Math.abs(ttftDelta) < 5 && Math.abs(latDelta) < 5) {
      console.log(`|  VERDICT: Cognitive layer has NEGLIGIBLE impact on response time`.padEnd(W) + `|`);
    } else if (Math.abs(ttftDelta) < 10 && Math.abs(latDelta) < 10) {
      console.log(`|  VERDICT: Cognitive layer has MINOR impact (<10%)`.padEnd(W) + `|`);
    } else {
      console.log(`|  VERDICT: Cognitive layer has SIGNIFICANT impact (${latDelta >= 0 ? "+" : ""}${latDelta.toFixed(1)}%)`.padEnd(W) + `|`);
    }
  }

  console.log(`+${line}+\n`);

  await killServer();
}

main().catch(console.error);
