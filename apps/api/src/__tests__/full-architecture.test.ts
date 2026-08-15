import { describe, it, expect, afterAll } from 'vitest';
import { createFlux } from '@ai-agent/cli/flux';
import { analyzeScreenContext, AutomationEngine } from '@ai-agent/automation';
import { classifyIntent } from '@ai-agent/services-core';

const results: Array<{ name: string; ms: number; status: string }> = [];
let flux: ReturnType<typeof createFlux>;

function timed(name: string, fn: () => unknown) {
  const t0 = Date.now();
  const result = fn();
  const ms = Date.now() - t0;
  results.push({ name, ms, status: 'OK' });
  console.log(`  ✓ ${name}: ${ms}ms`);
  return result;
}

async function timedAsync(name: string, fn: () => Promise<unknown>) {
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  results.push({ name, ms, status: 'OK' });
  console.log(`  ✓ ${name}: ${ms}ms`);
  return result;
}

describe('Full Architecture Feature Test', () => {
  it('initialize flux runtime', () => {
    const t0 = Date.now();
    flux = createFlux({
      provider: 'ollama',
      model: 'qwen2.5:3b',
      providerConfigs: { ollama: { baseUrl: 'http://localhost:11434' } },
    });
    const ms = Date.now() - t0;
    results.push({ name: 'Initialize runtime', ms, status: 'OK' });
    console.log(`  ✓ Initialize runtime: ${ms}ms`);
  });

  // ─── 1. CHAT ──────────────────────────────────────────────
  it('chat: simple greeting', async () => {
    await timedAsync('Chat: greeting', () => flux.process('hello'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  it('chat: identity', async () => {
    await timedAsync('Chat: identity', () => flux.process('who are you'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  it('chat: complex question', async () => {
    await timedAsync('Chat: complex', () => flux.process('what is the difference between a stack and a queue'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  // ─── 2. CODING ────────────────────────────────────────────
  it('coding: write code', async () => {
    await timedAsync('Coding: write', () => flux.process('write a hello world in python'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  it('coding: explain concept', async () => {
    await timedAsync('Coding: explain', () => flux.process('explain what a closure is in javascript'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  it('coding: debug help', async () => {
    await timedAsync('Coding: debug', () => flux.process('how to fix a segfault in C'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  // ─── 3. SYSTEM ────────────────────────────────────────────
  it('system: battery check', async () => {
    await timedAsync('System: battery', () => flux.process('check battery'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  it('system: system info', async () => {
    await timedAsync('System: info', () => flux.process('system info'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  it('system: volume', async () => {
    await timedAsync('System: volume', () => flux.process('what is my volume'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  // ─── 4. SEARCH ────────────────────────────────────────────
  it('search: factual query', async () => {
    await timedAsync('Search: factual', () => flux.process('what is the capital of france'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  // ─── 5. REMINDERS ─────────────────────────────────────────
  it('reminders: set goal', async () => {
    await timedAsync('Reminders: set', () => flux.process('set a goal to finish the report'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  it('reminders: check goals', async () => {
    await timedAsync('Reminders: check', () => flux.process('what are my goals'));
    expect(results.at(-1)!.ms).toBeGreaterThan(0);
  }, 30000);

  // ─── 6. SCREEN CONTEXT ────────────────────────────────────
  it('screen: VS Code context', () => {
    const ctx = timed('Screen: VS Code', () => analyzeScreenContext('Code', 'orchestrator.ts — Flux'));
    expect((ctx as any).activity).toBe('editing orchestrator.ts');
    expect((ctx as any).appCategory).toBe('coding');
  });

  it('screen: YouTube', () => {
    const ctx = timed('Screen: YouTube', () => analyzeScreenContext('chrome.exe', 'YouTube - Lo-fi beats'));
    expect((ctx as any).website).toBe('YouTube');
  });

  it('screen: GitHub', () => {
    const ctx = timed('Screen: GitHub', () => analyzeScreenContext('chrome.exe', 'GitHub - Shauryam-singh/Flux'));
    expect((ctx as any).website).toBe('GitHub');
  });

  it('screen: error detection', () => {
    const ctx = timed('Screen: error', () => analyzeScreenContext('Code', 'error: Cannot find module')) as any;
    expect(ctx.hasError).toBe(true);
    expect(ctx.errorHint).toBe('error');
  });

  it('screen: LeetCode', () => {
    const ctx = timed('Screen: LeetCode', () => analyzeScreenContext('chrome.exe', 'LeetCode - Two Sum'));
    expect((ctx as any).website).toBe('LeetCode');
  });

  it('screen: gaming', () => {
    const ctx = timed('Screen: gaming', () => analyzeScreenContext('roblox.exe', ''));
    expect((ctx as any).appCategory).toBe('gaming');
  });

  it('screen: Gmail', () => {
    const ctx = timed('Screen: Gmail', () => analyzeScreenContext('chrome.exe', 'Gmail - Inbox'));
    expect((ctx as any).website).toBe('Gmail');
  });

  it('screen: Jira', () => {
    const ctx = timed('Screen: Jira', () => analyzeScreenContext('chrome.exe', 'Jira - PROJ-123'));
    expect((ctx as any).website).toBe('Jira');
  });

  it('screen: merge conflict', () => {
    const ctx = timed('Screen: merge conflict', () => analyzeScreenContext('Code', 'merge_conflict.ts — Flux'));
    expect((ctx as any).activity).toContain('conflict');
  });

  it('screen: Python file', () => {
    const ctx = timed('Screen: Python', () => analyzeScreenContext('Code', 'test.py — myproject'));
    expect((ctx as any).language).toBe('Python');
  });

  // ─── 7. AUTOMATION ENGINE ─────────────────────────────────
  it('automation: classify coding', () => {
    const auto = new AutomationEngine();
    timed('Auto: classify coding', () => { auto.observe('Code', 'test.ts'); });
    expect(auto.getState().currentMode).toBe('coding');
    auto.destroy();
  });

  it('automation: classify gaming', () => {
    const auto = new AutomationEngine();
    timed('Auto: classify gaming', () => { auto.observe('roblox.exe', ''); });
    expect(auto.getState().currentMode).toBe('gaming');
    auto.destroy();
  });

  it('automation: classify watching', () => {
    const auto = new AutomationEngine();
    timed('Auto: classify watching', () => { auto.observe('chrome.exe', 'YouTube - Music'); });
    expect(auto.getState().currentMode).toBe('watching');
    auto.destroy();
  });

  it('automation: classify browsing', () => {
    const auto = new AutomationEngine();
    timed('Auto: classify browsing', () => { auto.observe('chrome.exe', 'Wikipedia - Machine learning'); });
    expect(auto.getState().currentMode).toBe('browsing');
    auto.destroy();
  });

  it('automation: classify communicating', () => {
    const auto = new AutomationEngine();
    timed('Auto: classify communicating', () => { auto.observe('slack.exe', 'Slack - #general'); });
    expect(auto.getState().currentMode).toBe('communicating');
    auto.destroy();
  });

  it('automation: discover patterns', () => {
    const auto = new AutomationEngine();
    auto.observe('Code', 'test.ts');
    auto.observe('chrome.exe', 'YouTube');
    auto.observe('Code', 'test.ts');
    const patterns = timed('Auto: patterns', () => auto.discoverPatterns());
    expect(Array.isArray(patterns)).toBe(true);
    auto.destroy();
  });

  it('automation: get stats', () => {
    const auto = new AutomationEngine();
    const stats = timed('Auto: stats', () => auto.store.getStats());
    expect(stats).toBeTruthy();
    auto.destroy();
  });

  it('automation: get state', () => {
    const auto = new AutomationEngine();
    const state = timed('Auto: state', () => auto.getState());
    expect(state).toBeTruthy();
    expect(state.currentMode).toBe('unknown');
    auto.destroy();
  });

  // ─── 8. INTENT CLASSIFIER ─────────────────────────────────
  it('intent: chat greeting', () => {
    const intent = timed('Intent: greeting', () => classifyIntent('hello flux', {}));
    expect(intent).toBe('chat');
  });

  it('intent: coding', () => {
    const intent = timed('Intent: coding', () => classifyIntent('write a function in python', {}));
    expect(intent).toBe('coding');
  });

  it('intent: system', () => {
    const intent = timed('Intent: system', () => classifyIntent('open chrome', {}));
    expect(intent).toBe('system');
  });

  it('intent: search', () => {
    const intent = timed('Intent: search', () => classifyIntent('what is the capital of france', {}));
    expect(intent).toBe('search');
  });

  it('intent: git', () => {
    const intent = timed('Intent: git', () => classifyIntent('git status', {}));
    expect(intent).toBe('coding');
  });

  it('intent: screen', () => {
    const intent = timed('Intent: screen', () => classifyIntent('what is on my screen', {}));
    expect(intent).toBe('screen-understanding');
  });

  it('intent: reminder', () => {
    const intent = timed('Intent: reminder', () => classifyIntent('add a reminder for tomorrow', {}));
    expect(intent).toBe('reminders');
  });

  it('intent: monitor', () => {
    const intent = timed('Intent: monitor', () => classifyIntent('check system health', {}));
    expect(intent).toBe('monitor');
  });

  it('intent: automation', () => {
    const intent = timed('Intent: automation', () => classifyIntent('create an automation rule', {}));
    expect(intent).toBe('automations');
  });

  // ─── 9. RUNTIME STATE ─────────────────────────────────────
  it('runtime: state', () => {
    const state = timed('Runtime: state', () => flux.runtime.getState());
    expect(state).toBeTruthy();
  });

  it('runtime: cognitive state', () => {
    const state = timed('Runtime: cognitive', () => flux.runtime.cognitive.getState());
    expect(state).toBeTruthy();
  });

  it('runtime: memory stats', () => {
    const stats = timed('Runtime: memory', () => flux.runtime.memory.getStats());
    expect(stats).toBeTruthy();
  });

  it('runtime: goals', () => {
    const goals = timed('Runtime: goals', () => flux.runtime.goalManager.getAll());
    expect(goals).toBeTruthy();
  });

  it('runtime: habits', () => {
    const habits = timed('Runtime: habits', () => flux.runtime.habits.getAll());
    expect(habits).toBeTruthy();
  });

  it('runtime: experiences', () => {
    const exps = timed('Runtime: experiences', () => flux.runtime.experienceDb.getRecent(5));
    expect(exps).toBeTruthy();
  });

  it('runtime: thoughts', () => {
    const thoughts = timed('Runtime: thoughts', () => flux.runtime.thoughtGraph.snapshot());
    expect(thoughts).toBeTruthy();
  });

  it('runtime: history', () => {
    const history = timed('Runtime: history', () => flux.runtime.getHistory());
    expect(history.length).toBeGreaterThan(0);
  });

  // ─── 10. PROACTIVE ────────────────────────────────────────
  it('proactive: messages', () => {
    const msgs = timed('Proactive: msgs', () => flux.runtime.getProactiveMessages(5));
    expect(msgs).toBeTruthy();
  });

  it('proactive: patterns', () => {
    const patterns = timed('Proactive: patterns', () => flux.runtime.getAutomationPatterns());
    expect(patterns).toBeTruthy();
  });

  it('proactive: correlations', () => {
    const corr = timed('Proactive: correlations', () => flux.runtime.getCorrelations(5));
    expect(corr).toBeTruthy();
  });

  // ─── 11. WORKING MEMORY ───────────────────────────────────
  it('working memory: entries', () => {
    const stats = timed('Working memory', () => flux.runtime.memory.getStats());
    expect(stats).toBeTruthy();
    expect(stats.totalMemories).toBeGreaterThanOrEqual(0);
  });

  // ─── SUMMARY ──────────────────────────────────────────────
  it('print timing summary', () => {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║                 TIMING SUMMARY                      ║');
    console.log('╚══════════════════════════════════════════════════════╝');

    const totalTime = results.reduce((s, r) => s + r.ms, 0);

    console.log(`Total tests: ${results.length}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Avg per test: ${(totalTime / results.length).toFixed(1)}ms`);

    const categories: Record<string, typeof results> = {};
    for (const r of results) {
      const cat = r.name.split(':')[0].trim();
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(r);
    }

    console.log('\nBy category:');
    for (const [cat, items] of Object.entries(categories)) {
      const catTime = items.reduce((s, r) => s + r.ms, 0);
      console.log(`  ${cat.padEnd(18)} ${String(items.length).padStart(2)} tests, ${String(catTime).padStart(6)}ms total, ${(catTime / items.length).toFixed(1).padStart(6)}ms avg`);
    }

    const sorted = [...results].sort((a, b) => b.ms - a.ms);
    console.log('\nSlowest 5:');
    for (const r of sorted.slice(0, 5)) {
      console.log(`  ${r.name.padEnd(25)} ${r.ms}ms`);
    }

    console.log('\nFastest 5:');
    for (const r of sorted.slice(-5)) {
      console.log(`  ${r.name.padEnd(25)} ${r.ms}ms`);
    }

    expect(true).toBe(true);
  });

  afterAll(async () => {
    await flux.shutdown();
  });
});
