import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

interface DuckDuckGoResult {
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

interface DuckDuckGoSearchResult {
  results: Array<{
    title: string;
    body: string;
    url: string;
  }>;
}

async function instantAnswer(query: string): Promise<DuckDuckGoResult | null> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as DuckDuckGoResult;
  } catch {
    return null;
  }
}

async function htmlSearch(query: string): Promise<DuckDuckGoSearchResult> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FluxAssistant/1.0" },
    });
    if (!res.ok) return { results: [] };
    const html = await res.text();
    return parseHtmlResults(html);
  } catch {
    return { results: [] };
  }
}

function parseHtmlResults(html: string): DuckDuckGoSearchResult {
  const results: DuckDuckGoSearchResult["results"] = [];
  const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const links: string[] = [];
  const titles: string[] = [];
  const snippets: string[] = [];

  let match;
  while ((match = resultRegex.exec(html)) !== null) {
    links.push(match[1] ?? "");
    titles.push(stripHtml(match[2] ?? ""));
  }
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtml(match[1] ?? ""));
  }

  for (let i = 0; i < Math.min(titles.length, 5); i++) {
    results.push({
      title: titles[i] ?? "",
      body: snippets[i] ?? "",
      url: links[i] ?? "",
    });
  }

  return { results };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatResults(
  query: string,
  instant: DuckDuckGoResult | null,
  search: DuckDuckGoSearchResult,
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

  if (search.results.length > 0) {
    parts.push("Search results:");
    for (const r of search.results.slice(0, 5)) {
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
        .replace(/^(search|look up|find|google|research)\s*/i, "")
        .replace(/^(what is|who is|where is|when did|how to|tell me about)\s*/i, "")
        .trim();

      const searchQuery = query || input;

      const [instant, search] = await Promise.all([
        instantAnswer(searchQuery),
        htmlSearch(searchQuery),
      ]);

      const result = formatResults(searchQuery, instant, search);

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);

      ctx.reply(result);

      return { text: result };
    },
  };
}
