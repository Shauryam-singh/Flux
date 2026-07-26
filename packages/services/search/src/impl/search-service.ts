import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

interface DuckDuckGoInstant {
  Abstract: string;
  AbstractText: string;
  AbstractSource: string;
  AbstractURL: string;
  Heading: string;
  RelatedTopics: Array<{
    Text?: string;
    FirstURL?: string;
  }>;
}

interface SearchResult {
  title: string;
  body: string;
  url: string;
}

async function instantAnswer(query: string): Promise<DuckDuckGoInstant | null> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as DuckDuckGoInstant;
  } catch {
    return null;
  }
}

async function liteSearch(query: string): Promise<SearchResult[]> {
  // DuckDuckGo Lite has simpler, more stable HTML than the standard HTML endpoint
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
    return parseLiteHtml(html);
  } catch {
    return [];
  }
}

function parseLiteHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Lite endpoint uses single-quoted class attributes: class='result-link', class='result-snippet'
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

  // Fallback: grab any <a> with result text
  if (titles.length === 0) {
    const altLinkRegex = /<a[^>]+href=['"]([^'"]*)['"][^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = altLinkRegex.exec(html)) !== null) {
      const href = match[1] ?? "";
      const text = stripHtml(match[2] ?? "");
      if (
        href.includes("duckduckgo.com") && !href.includes("uddg=") ||
        text.length < 5 ||
        text.length > 200
      ) {
        continue;
      }
      links.push(extractUrl(href));
      titles.push(text);
    }
  }

  for (let i = 0; i < Math.min(titles.length, 5); i++) {
    results.push({
      title: titles[i] ?? "",
      body: snippets[i] ?? "",
      url: links[i] ?? "",
    });
  }

  return results;
}

function extractUrl(href: string): string {
  // DuckDuckGo wraps URLs in redirect URLs — extract the actual URL
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

function formatResults(
  query: string,
  instant: DuckDuckGoInstant | null,
  searchResults: SearchResult[],
): string {
  const parts: string[] = [];

  if (instant?.AbstractText) {
    parts.push(`**${instant.Heading}**`);
    parts.push(instant.AbstractText);
    if (instant.AbstractSource) {
      parts.push(`Source: ${instant.AbstractSource}`);
    }
    parts.push("");
  }

  if (searchResults.length > 0) {
    parts.push("Search results:");
    for (const r of searchResults.slice(0, 5)) {
      parts.push(`- **${r.title}**`);
      if (r.body) parts.push(`  ${r.body}`);
      if (r.url) parts.push(`  ${r.url}`);
    }
  }

  if (parts.length === 0) {
    parts.push(`No results found for "${query}".`);
  }

  return parts.join("\n");
}

export function createSearchService(): Service {
  return {
    name: "search",
    description: "Web search for information, facts, news, and research",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "search", "look up", "find", "what is", "who is", "where is",
        "when did", "how to", "tell me about", "google", "research",
        "latest", "news", "current",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const query = input
        .replace(/^(search|look up|find|google|research)\s+(for\s+)?/i, "")
        .replace(/^(what is|who is|where is|when did|how to|tell me about)\s+/i, "")
        .trim();

      const searchQuery = query || input;

      const [instant, searchResults] = await Promise.all([
        instantAnswer(searchQuery),
        liteSearch(searchQuery),
      ]);

      const result = formatResults(searchQuery, instant, searchResults);

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);

      ctx.reply(result);

      return { text: result };
    },
  };
}
