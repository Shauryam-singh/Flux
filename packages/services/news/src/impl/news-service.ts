import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

interface NewsItem {
  title: string;
  url: string;
  source: string;
  time: string | undefined;
  score: number | undefined;
}

interface HNItem {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  time?: number;
  by?: string;
}

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

interface RedditPost {
  data: {
    title: string;
    url: string;
    permalink: string;
    score: number;
    created_utc: number;
    subreddit: string;
  };
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

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item[\s>][\s\S]*?<\/item>/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const block = itemMatch[0];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const description = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate");
    if (title) {
      items.push({
        title: stripHtml(title),
        link: link || "",
        description: stripHtml(description || ""),
        pubDate: pubDate || "",
      });
    }
  }
  return items;
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA: <tag><![CDATA[content]]></tag>
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1] ?? "";

  // Handle plain: <tag>content</tag>
  const plainRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const plainMatch = xml.match(plainRegex);
  if (plainMatch) return plainMatch[1] ?? "";

  // RSS <link> can appear as just <link/> or <link>url</link> or even <link>url</link>\n
  // Some feeds have <link> without a closing tag for simple URLs
  if (tag === "link") {
    const linkRegex2 = /<link[^>]*>\s*([^<\s][\s\S]*?)\s*<\/link>/i;
    const linkMatch2 = xml.match(linkRegex2);
    if (linkMatch2) return linkMatch2[1] ?? "";

    // Self-closing or bare
    const linkRegex3 = /<link[^>]*\/?>\s*(https?:\/\/[^\s<]+)/i;
    const linkMatch3 = xml.match(linkRegex3);
    if (linkMatch3) return linkMatch3[1] ?? "";
  }

  return "";
}

function timeAgo(unixSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function rssPubDateToAgo(pubDate: string): string {
  if (!pubDate) return "";
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return timeAgo(Math.floor(parsed.getTime() / 1000));
}

async function fetchText(url: string, timeout = 5000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FluxNews/1.0)" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, timeout = 5000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FluxNews/1.0)" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// --- Hacker News ---

async function fetchHackerNews(limit = 10): Promise<NewsItem[]> {
  const ids = await fetchJson<number[]>(
    "https://hacker-news.firebaseio.com/v0/topstories.json",
  );
  if (!ids) return [];

  const topIds = ids.slice(0, limit);
  const items = await Promise.all(
    topIds.map((id) =>
      fetchJson<HNItem>(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
      )
    ),
  );

  return items
    .filter((item): item is HNItem => item !== null && item.title != null)
    .map((item) => ({
      title: item.title ?? "",
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      source: "Hacker News",
      time: item.time ? timeAgo(item.time) : undefined,
      score: item.score,
    }));
}

// --- RSS feeds ---

async function fetchRssFeed(url: string, sourceName: string): Promise<NewsItem[]> {
  const xml = await fetchText(url, 8000);
  if (!xml) return [];

  const items = parseRssItems(xml);
  return items.map((item) => ({
    title: item.title,
    url: item.link,
    source: sourceName,
    time: rssPubDateToAgo(item.pubDate),
    score: undefined,
  }));
}

async function fetchIndianNews(): Promise<NewsItem[]> {
  const [ndtv, ndtvIndia, toi] = await Promise.all([
    fetchRssFeed("https://feeds.feedburner.com/ndtvnews-latest", "NDTV"),
    fetchRssFeed("https://feeds.feedburner.com/ndtvnews-india-news", "NDTV India"),
    fetchRssFeed("https://timesofindia.indiatimes.com/rssfeedstopstories.cms", "Times of India"),
  ]);

  const seen = new Set<string>();
  const combined: NewsItem[] = [];
  for (const item of [...ndtv, ...ndtvIndia, ...toi]) {
    const key = item.title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }
  return combined.slice(0, 10);
}

async function fetchDevTo(): Promise<NewsItem[]> {
  const articles = await fetchJson<Array<{ title: string; url: string; published_at: string; public_reactions_count: number }>>(
    "https://dev.to/api/articles?per_page=10",
  );
  if (!articles) return [];

  return articles.map((a) => ({
    title: a.title,
    url: a.url,
    source: "Dev.to",
    time: a.published_at ? rssPubDateToAgo(a.published_at) : undefined,
    score: a.public_reactions_count,
  }));
}

async function fetchRedditProgramming(limit = 10): Promise<NewsItem[]> {
  const data = await fetchJson<{ data: { children: RedditPost[] } }>(
    `https://www.reddit.com/r/programming/top.json?limit=${limit}&t=day`,
  );
  if (!data?.data?.children) return [];

  return data.data.children.map((child) => ({
    title: child.data.title,
    url: child.data.url || `https://reddit.com${child.data.permalink}`,
    source: "r/programming",
    time: child.data.created_utc ? timeAgo(child.data.created_utc) : undefined,
    score: child.data.score,
  }));
}

function formatNewsList(title: string, items: NewsItem[]): string {
  if (items.length === 0) return `No ${title.toLowerCase()} found.`;

  const parts: string[] = [`**${title}**`, ""];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const num = i + 1;
    parts.push(`${num}. ${item.title}`);

    const meta: string[] = [];
    if (item.source) meta.push(`Source: ${item.source}`);
    if (item.time) meta.push(item.time);
    if (item.score != null) meta.push(`${item.score} points`);
    if (meta.length > 0) parts.push(`   ${meta.join(" | ")}`);

    if (item.url) parts.push(`   ${item.url}`);
    parts.push("");
  }

  return parts.join("\n").trim();
}

export function createNewsService(): Service {
  return {
    name: "news",
    description: "News aggregation — Indian news, tech news, dev news, headlines, trending stories",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "news", "headlines", "what's happening", "what is happening",
        "indian news", "tech news", "dev news", "latest news",
        "top stories", "trending", "ndtv", "show me news",
        "programming news", "reddit news",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      let result: string;

      if (
        lower.includes("indian news") ||
        lower.includes("news from india") ||
        lower.includes("ndtv")
      ) {
        const items = await fetchIndianNews();
        result = formatNewsList("Top Indian News", items);
      } else if (
        lower.includes("tech news") ||
        lower.includes("dev news") ||
        lower.includes("programming news")
      ) {
        const [hn, devto] = await Promise.all([
          fetchHackerNews(5),
          fetchDevTo(),
        ]);
        const combined = [...hn, ...devto].slice(0, 10);
        result = formatNewsList("Top Tech & Dev News", combined);
      } else if (
        lower.includes("reddit")
      ) {
        const items = await fetchRedditProgramming(10);
        result = formatNewsList("Top Reddit Programming Posts", items);
      } else {
        // General news: mix of NDTV + Hacker News
        const [ndtv, hn] = await Promise.all([
          fetchRssFeed("https://feeds.feedburner.com/ndtvnews-latest", "NDTV"),
          fetchHackerNews(5),
        ]);
        const combined = [...ndtv.slice(0, 5), ...hn].slice(0, 10);
        result = formatNewsList("Latest Headlines", combined);
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);

      ctx.reply(result);

      return { text: result };
    },
  };
}
