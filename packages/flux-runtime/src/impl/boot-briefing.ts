import type { LlmProvider } from "@ai-agent/services-core";

// ─── Types ──────────────────────────────────────────────────────

export interface BootBriefing {
  readonly greeting: string;
  readonly timeString: string;
  readonly recap: string;
  readonly news: ReadonlyArray<NewsHeadline>;
  readonly systemStatus: SystemStatus;
  readonly goals: ReadonlyArray<BriefingGoal>;
  readonly spokenText: string;
  readonly markdown: string;
}

export interface NewsHeadline {
  readonly title: string;
  readonly snippet: string;
  readonly url: string;
}

export interface SystemStatus {
  readonly battery: string;
  readonly git: string;
  readonly cpu: string;
  readonly memory: string;
  readonly uptime: string;
}

export interface BriefingGoal {
  readonly name: string;
  readonly progress: number;
  readonly status: string;
}

export interface BootBriefingContext {
  readonly activeGoals: ReadonlyArray<BriefingGoal>;
  readonly recentActivity: ReadonlyArray<string>;
  readonly reflections: ReadonlyArray<string>;
  readonly episodicMemories: ReadonlyArray<string>;
  readonly sessionSummaries: ReadonlyArray<string>;
  readonly batteryLevel: number | null;
  readonly batteryCharging: boolean;
  readonly gitBranch: string;
  readonly gitDirty: boolean;
  readonly cpuUsage: number;
  readonly memoryUsage: number;
  readonly uptimeMs: number;
  readonly memoryCount: number;
}

// ─── News Fetching (DuckDuckGo Lite) ────────────────────────────

interface LiteSearchResult {
  title: string;
  body: string;
  url: string;
}

async function fetchNewsHeadlines(query: string): Promise<NewsHeadline[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FluxAssistant/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseNewsHtml(html);
  } catch {
    return [];
  }
}

function parseNewsHtml(html: string): NewsHeadline[] {
  const results: NewsHeadline[] = [];
  const linkRegex = /<a[^>]+class=['"]result-link['"][^>]*href=['"]([^'"]*)['"][^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi;

  const links: string[] = [];
  const titles: string[] = [];
  const snippets: string[] = [];

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    links.push(extractUrl(match[1] ?? ""));
    titles.push(stripHtml(match[2] ?? ""));
  }
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtml(match[1] ?? ""));
  }

  for (let i = 0; i < Math.min(titles.length, 5); i++) {
    const title = titles[i] ?? "";
    if (title.length < 5 || title.length > 200) continue;
    results.push({
      title,
      snippet: snippets[i] ?? "",
      url: links[i] ?? "",
    });
  }

  return results;
}

function extractUrl(href: string): string {
  const uddgMatch = href.match(/[?&]uddg=([^&]+)/);
  if (uddgMatch) {
    try {
      return decodeURIComponent(uddgMatch[1] ?? "");
    } catch {
      // fall through
    }
  }
  return href;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Greeting ───────────────────────────────────────────────────

function getTimeGreeting(): { greeting: string; timeString: string } {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  let greeting: string;
  if (hour < 6) {
    greeting = "Burning the midnight oil? It's";
  } else if (hour < 12) {
    greeting = "Good morning! It's";
  } else if (hour < 17) {
    greeting = "Good afternoon! It's";
  } else if (hour < 21) {
    greeting = "Good evening! It's";
  } else {
    greeting = "Working late? It's";
  }

  return { greeting: `${greeting} ${timeStr}.`, timeString: timeStr };
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// ─── Boot Briefing Generator ────────────────────────────────────

export class BootBriefingGenerator {
  private lastBriefing = 0;
  private readonly cooldownMs = 60_000; // 1 minute cooldown between briefings

  async generate(
    ctx: BootBriefingContext,
    provider: LlmProvider | null,
  ): Promise<BootBriefing> {
    const now = Date.now();

    // Cooldown check
    if (now - this.lastBriefing < this.cooldownMs) {
      return this.buildQuickBriefing(ctx);
    }
    this.lastBriefing = now;

    // Fetch news concurrently with building the briefing
    const newsPromise = this.fetchNews();

    // Build context for LLM
    const { greeting, timeString } = getTimeGreeting();

    // Build the recap section
    const recapParts: string[] = [];
    // Session summaries from previous conversations (consumed after use)
    if (ctx.sessionSummaries.length > 0) {
      recapParts.push("From our last conversations:");
      ctx.sessionSummaries.forEach((s) => recapParts.push(`- ${s}`));
    }
    if (ctx.episodicMemories.length > 0) {
      recapParts.push("Recent activity:");
      ctx.episodicMemories.slice(0, 5).forEach((m) => recapParts.push(`- ${m}`));
    }
    if (ctx.reflections.length > 0) {
      recapParts.push("Reflections:");
      ctx.reflections.slice(0, 3).forEach((r) => recapParts.push(`- ${r}`));
    }
    if (ctx.activeGoals.length > 0) {
      recapParts.push("Active goals:");
      ctx.activeGoals.forEach((g) =>
        recapParts.push(`- ${g.name}: ${g.progress}% (${g.status})`),
      );
    }

    const recap = recapParts.length > 0 ? recapParts.join("\n") : "No recent activity recorded.";

    // System status
    const systemStatus: SystemStatus = {
      battery:
        ctx.batteryLevel !== null
          ? `${ctx.batteryLevel}%${ctx.batteryCharging ? " (charging)" : ""}`
          : "unknown",
      git: ctx.gitBranch
        ? `${ctx.gitBranch}${ctx.gitDirty ? " (dirty)" : ""}`
        : "not in a repo",
      cpu: `${ctx.cpuUsage}%`,
      memory: `${ctx.memoryUsage}%`,
      uptime: formatUptime(ctx.uptimeMs),
    };

    // Goals
    const goals = ctx.activeGoals;

    // Wait for news
    const news = await newsPromise;

    // Generate spoken text using LLM if available, otherwise use template
    let spokenText: string;
    let markdown: string;

    if (provider) {
      const llmResult = await this.generateWithLLM(
        greeting,
        recap,
        news,
        systemStatus,
        goals,
        ctx,
        provider,
      );
      spokenText = llmResult.spokenText;
      markdown = llmResult.markdown;
    } else {
      spokenText = this.buildTemplateSpokenText(greeting, recap, news, goals, systemStatus, ctx.sessionSummaries);
      markdown = this.buildTemplateMarkdown(greeting, recap, news, goals, systemStatus, ctx.sessionSummaries);
    }

    return {
      greeting,
      timeString,
      recap,
      news,
      systemStatus,
      goals,
      spokenText,
      markdown,
    };
  }

  private async fetchNews(): Promise<NewsHeadline[]> {
    // Try multiple queries to get diverse news
    const queries = ["top news today", "technology news today", "AI news today"];
    const query = queries[Math.floor(Math.random() * queries.length)]!;
    return fetchNewsHeadlines(query);
  }

  private async generateWithLLM(
    greeting: string,
    recap: string,
    news: ReadonlyArray<NewsHeadline>,
    systemStatus: SystemStatus,
    goals: ReadonlyArray<BriefingGoal>,
    ctx: BootBriefingContext,
    provider: LlmProvider,
  ): Promise<{ spokenText: string; markdown: string }> {
    const newsText =
      news.length > 0
        ? news.map((n) => `- ${n.title}`).join("\n")
        : "No news available.";

    const prompt = `You are Flux, a personal AI assistant. Generate a boot briefing for the user.

## Current Time
${greeting}

## Yesterday's Recap
${recap}

## Today's Headlines
${newsText}

## System Status
Battery: ${systemStatus.battery} | Git: ${systemStatus.git} | CPU: ${systemStatus.cpu} | Memory: ${systemStatus.memory} | Uptime: ${systemStatus.uptime}

## Active Goals
${goals.length > 0 ? goals.map((g) => `- ${g.name} (${g.progress}%)`).join("\n") : "None"}

## Instructions
Generate TWO outputs separated by "===SPLIT===":

1. **SPOKEN** (what to say aloud): A natural, conversational greeting. Greet by name if known. Mention the time. If there are session summaries (marked "From our last conversations"), mention 1-2 key points naturally — e.g. "Yesterday we were working on X" or "Last time you mentioned Y". This is a one-time mention — the summaries will not appear again. Then summarise yesterday briefly (2-3 sentences). Mention 1-2 top news headlines. Mention active goals if any. End with an offer to help. Keep it under 120 words. Be warm but concise.

2. **MARKDOWN** (what to display): A formatted briefing with sections. Use HTML-friendly markdown. Include:
   - Greeting with time
   - Yesterday recap (bullet points) — include session summaries as "Last conversation" items
   - Top news headlines (with links)
   - System status (compact)
   - Active goals with progress bars

Respond with ONLY the two sections separated by ===SPLIT===.`;

    try {
      const response = await provider.complete({
        model: "qwen2.5-coder:7b",
        prompt,
        temperature: 0.4,
      });

      const parts = response.text.split("===SPLIT===");
      if (parts.length >= 2) {
        return {
          spokenText: (parts[0] ?? "").replace(/^SPOKEN:?\s*/i, "").trim(),
          markdown: (parts[1] ?? "").replace(/^MARKDOWN:?\s*/i, "").trim(),
        };
      }
    } catch {
      // Fall through to template
    }

    return {
      spokenText: this.buildTemplateSpokenText(greeting, recap, news, goals, systemStatus, ctx.sessionSummaries),
      markdown: this.buildTemplateMarkdown(greeting, recap, news, goals, systemStatus, ctx.sessionSummaries),
    };
  }

  private buildQuickBriefing(ctx: BootBriefingContext): BootBriefing {
    const { greeting, timeString } = getTimeGreeting();
    const goals = ctx.activeGoals;
    const spokenText = `${greeting} I just gave you a briefing. You have ${goals.length} active goal${goals.length !== 1 ? "s" : ""}. How can I help?`;
    return {
      greeting,
      timeString,
      recap: "",
      news: [],
      systemStatus: {
        battery: ctx.batteryLevel !== null ? `${ctx.batteryLevel}%` : "unknown",
        git: ctx.gitBranch || "n/a",
        cpu: `${ctx.cpuUsage}%`,
        memory: `${ctx.memoryUsage}%`,
        uptime: formatUptime(ctx.uptimeMs),
      },
      goals,
      spokenText,
      markdown: `<p>${greeting}</p><p>You have ${goals.length} active goal${goals.length !== 1 ? "s" : ""}.</p>`,
    };
  }

  private buildTemplateSpokenText(
    greeting: string,
    recap: string,
    news: ReadonlyArray<NewsHeadline>,
    goals: ReadonlyArray<BriefingGoal>,
    systemStatus: SystemStatus,
    sessionSummaries?: ReadonlyArray<string>,
  ): string {
    const parts: string[] = [greeting];

    // Session summaries (one-time, consumed after use)
    if (sessionSummaries && sessionSummaries.length > 0) {
      parts.push("From our last conversations:");
      sessionSummaries.slice(0, 2).forEach((s) => parts.push(s));
    }

    // Recap
    if (recap !== "No recent activity recorded.") {
      const lines = recap.split("\n").filter((l) => l.startsWith("- "));
      if (lines.length > 0) {
        parts.push("Here's what happened recently:");
        lines.slice(0, 3).forEach((l) => parts.push(l.replace(/^- /, "")));
      }
    }

    // News
    if (news.length > 0) {
      parts.push("In today's news:");
      news.slice(0, 2).forEach((n) => parts.push(n.title));
    }

    // Goals
    if (goals.length > 0) {
      parts.push(
        `You have ${goals.length} active goal${goals.length > 1 ? "s" : ""}.`,
      );
      goals.slice(0, 2).forEach((g) =>
        parts.push(`${g.name} at ${g.progress} percent.`),
      );
    }

    // System
    if (systemStatus.battery !== "unknown") {
      parts.push(`Battery at ${systemStatus.battery}.`);
    }

    parts.push("How can I help you today?");
    return parts.join(" ");
  }

  private buildTemplateMarkdown(
    greeting: string,
    recap: string,
    news: ReadonlyArray<NewsHeadline>,
    goals: ReadonlyArray<BriefingGoal>,
    systemStatus: SystemStatus,
    sessionSummaries?: ReadonlyArray<string>,
  ): string {
    const sections: string[] = [];

    // Header
    sections.push(`<div class="briefing-header"><h2>\u{1F44B} ${greeting}</h2></div>`);

    // Session summaries (one-time mention)
    if (sessionSummaries && sessionSummaries.length > 0) {
      sections.push(`<div class="briefing-section"><h3>Last Conversations</h3>`);
      sessionSummaries.forEach((s) => {
        sections.push(`<div class="briefing-item">\u2022 ${s}</div>`);
      });
      sections.push(`</div>`);
    }

    // Recap
    const recapLines = recap.split("\n").filter((l) => l.trim());
    if (recapLines.length > 0 && recap !== "No recent activity recorded.") {
      sections.push(`<div class="briefing-section"><h3>Yesterday</h3>`);
      recapLines.forEach((l) => {
        if (l.startsWith("- ")) {
          sections.push(`<div class="briefing-item">\u2022 ${l.slice(2)}</div>`);
        } else {
          sections.push(`<div class="briefing-subhead">${l}</div>`);
        }
      });
      sections.push(`</div>`);
    }

    // News
    if (news.length > 0) {
      sections.push(`<div class="briefing-section"><h3>\u{1F4F0} Today's Headlines</h3>`);
      news.forEach((n) => {
        const link = n.url
          ? `<a href="${n.url}" target="_blank" class="briefing-link">${n.title}</a>`
          : n.title;
        sections.push(`<div class="briefing-news">${link}</div>`);
        if (n.snippet) {
          sections.push(`<div class="briefing-snippet">${n.snippet}</div>`);
        }
      });
      sections.push(`</div>`);
    }

    // Goals
    if (goals.length > 0) {
      sections.push(`<div class="briefing-section"><h3>\u{1F3AF} Active Goals</h3>`);
      goals.forEach((g) => {
        const bar = `<div class="briefing-progress"><div class="briefing-progress-fill" style="width:${g.progress}%"></div></div>`;
        sections.push(
          `<div class="briefing-goal"><span>${g.name}</span><span class="briefing-goal-pct">${g.progress}%</span>${bar}</div>`,
        );
      });
      sections.push(`</div>`);
    }

    // System status
    sections.push(`<div class="briefing-section briefing-status">
      \u{1F4BB} ${systemStatus.cpu} CPU \u00B7 ${systemStatus.memory} RAM \u00B7 \u{1F50B} ${systemStatus.battery} \u00B7 \u{1F4C8} ${systemStatus.git} \u00B7 \u23F1 ${systemStatus.uptime}
    </div>`);

    return sections.join("\n");
  }
}
