import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ── Config ──────────────────────────────────────────────────────────────

interface EntertainmentConfig {
  tmdbApiKey?: string;
  rawgApiKey?: string;
}

function loadConfig(): EntertainmentConfig {
  try {
    const configPath = join(homedir(), ".flux", "entertainment.json");
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as EntertainmentConfig;
  } catch {
    return {};
  }
}

let cachedConfig: EntertainmentConfig | null = null;
function getConfig(): EntertainmentConfig {
  if (cachedConfig === null) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

// ── Trivia state ────────────────────────────────────────────────────────

interface TriviaQuestion {
  question: string;
  correctAnswer: string;
  options: string[];
  askedAt: number;
}

let pendingTrivia: TriviaQuestion | null = null;
const TRIVIA_TIMEOUT_MS = 5 * 60 * 1000;

// ── Jikan rate limiter (3 req/sec) ──────────────────────────────────────

let jikanLastRequest = 0;
async function jikanFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - jikanLastRequest;
  if (elapsed < 350) {
    await new Promise((r) => setTimeout(r, 350 - elapsed));
  }
  jikanLastRequest = Date.now();
  return fetch(url, { signal: AbortSignal.timeout(8000) });
}

// ── TMDB ────────────────────────────────────────────────────────────────

interface TmdbMovie {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  overview: string;
}

interface TmdbResponse {
  results: TmdbMovie[];
}

async function tmdbFetch(path: string): Promise<TmdbResponse | null> {
  const config = getConfig();
  if (!config.tmdbApiKey) return null;
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.themoviedb.org/3${path}${sep}api_key=${config.tmdbApiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as TmdbResponse;
  } catch {
    return null;
  }
}

async function trendingMovies(): Promise<string> {
  const data = await tmdbFetch("/trending/movie/week");
  if (!data?.results?.length) return "Could not fetch trending movies right now.";
  return formatMovieList("Trending Movies This Week", data.results);
}

async function searchMovies(query: string): Promise<string> {
  const data = await tmdbFetch(`/search/movie?query=${encodeURIComponent(query)}`);
  if (!data?.results?.length) return `No movies found for "${query}".`;
  return formatMovieList(`Search Results for "${query}"`, data.results.slice(0, 5));
}

function formatMovieList(title: string, movies: TmdbMovie[]): string {
  const lines: string[] = [`**${title}**`, ""];
  for (let i = 0; i < movies.length; i++) {
    const m = movies[i]!;
    const year = m.release_date ? ` (${m.release_date.slice(0, 4)})` : "";
    const rating = m.vote_average.toFixed(1);
    const overview = m.overview
      ? m.overview.length > 150
        ? m.overview.slice(0, 147) + "..."
        : m.overview
      : "No description available.";
    lines.push(`${i + 1}. **${m.title}**${year}`);
    lines.push(`   Rating: ${rating}/10 | Overview: ${overview}`);
    lines.push("");
  }
  return lines.join("\n");
}

// ── AniList ─────────────────────────────────────────────────────────────

interface AniListMedia {
  title: { romaji: string; english: string | null };
  description: string | null;
  score: number | null;
  averageScore: number | null;
  episodes: number | null;
  status: string | null;
}

interface AniListPage {
  media: AniListMedia[];
}

interface AniListResponse {
  data: { Page: AniListPage };
}

const ANILIST_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC) {
      title { romaji english }
      description
      score
      averageScore
      coverImage { large }
      episodes
      status
    }
  }
}`;

async function trendingAnime(): Promise<string> {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { page: 1, perPage: 10 } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "Could not fetch trending anime right now.";
    const data = (await res.json()) as AniListResponse;
    const media = data.data?.Page?.media;
    if (!media?.length) return "No trending anime found.";

    const lines: string[] = ["**Top Trending Anime**", ""];
    for (let i = 0; i < media.length; i++) {
      const a = media[i]!;
      const title = a.title.english || a.title.romaji;
      const score = a.averageScore || a.score || 0;
      const episodes = a.episodes ? `${a.episodes}` : "Unknown";
      const status = a.status || "Unknown";
      let synopsis = stripHtml(a.description || "");
      if (synopsis.length > 150) synopsis = synopsis.slice(0, 147) + "...";

      lines.push(`${i + 1}. **${title}** (${a.title.romaji})`);
      lines.push(`   Score: ${score}/100 | Episodes: ${episodes} | Status: ${status}`);
      lines.push(`   Synopsis: ${synopsis || "No description available."}`);
      lines.push("");
    }
    return lines.join("\n");
  } catch {
    return "Could not fetch trending anime right now.";
  }
}

// ── Jikan (Anime search) ────────────────────────────────────────────────

interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  score: number | null;
  episodes: number | null;
  status: string | null;
  synopsis: string | null;
}

interface JikanResponse {
  data: JikanAnime[];
}

async function searchAnime(query: string): Promise<string> {
  try {
    const res = await jikanFetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`,
    );
    if (!res.ok) return `Could not search anime right now.`;
    const data = (await res.json()) as JikanResponse;
    if (!data.data?.length) return `No anime found for "${query}".`;

    const lines: string[] = [`**Anime Search: "${query}"**`, ""];
    for (let i = 0; i < data.data.length; i++) {
      const a = data.data[i]!;
      const title = a.title_english || a.title;
      const score = a.score ? `${a.score}/10` : "N/A";
      const episodes = a.episodes ? `${a.episodes}` : "Unknown";
      const status = a.status || "Unknown";
      let synopsis = stripHtml(a.synopsis || "");
      if (synopsis.length > 150) synopsis = synopsis.slice(0, 147) + "...";

      lines.push(`${i + 1}. **${title}** (${a.title})`);
      lines.push(`   Score: ${score} | Episodes: ${episodes} | Status: ${status}`);
      lines.push(`   Synopsis: ${synopsis || "No description available."}`);
      lines.push("");
    }
    return lines.join("\n");
  } catch {
    return "Could not search anime right now.";
  }
}

// ── RAWG (Games) ────────────────────────────────────────────────────────

interface RawgGame {
  name: string;
  rating: number;
  released: string | null;
  genres: Array<{ name: string }>;
  description_raw: string | null;
}

interface RawgResponse {
  results: RawgGame[];
}

async function rawgFetch(path: string): Promise<RawgResponse | null> {
  const config = getConfig();
  if (!config.rawgApiKey) return null;
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.rawg.io/api${path}${sep}key=${config.rawgApiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as RawgResponse;
  } catch {
    return null;
  }
}

async function topGames(): Promise<string> {
  const data = await rawgFetch("/games?ordering=-rating&page_size=10");
  if (!data?.results?.length) return "Could not fetch top games. Make sure a RAWG API key is configured.";
  return formatGameList("Top Rated Games", data.results);
}

async function searchGames(query: string): Promise<string> {
  const data = await rawgFetch(`/games?search=${encodeURIComponent(query)}&page_size=5`);
  if (!data?.results?.length) return `No games found for "${query}".`;
  return formatGameList(`Game Search: "${query}"`, data.results);
}

function formatGameList(title: string, games: RawgGame[]): string {
  const lines: string[] = [`**${title}**`, ""];
  for (let i = 0; i < games.length; i++) {
    const g = games[i]!;
    const year = g.released ? g.released.slice(0, 4) : "TBA";
    const genres = g.genres?.map((gn) => gn.name).join(", ") || "N/A";
    lines.push(`${i + 1}. **${g.name}**`);
    lines.push(`   Rating: ${g.rating.toFixed(1)} | Released: ${year}`);
    lines.push(`   Genres: ${genres}`);
    lines.push("");
  }
  return lines.join("\n");
}

// ── Open Library (Books) ────────────────────────────────────────────────

interface OpenLibraryDoc {
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  subject?: string[];
  key: string;
}

interface OpenLibraryResponse {
  docs: OpenLibraryDoc[];
}

async function searchBooks(query: string): Promise<string> {
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return "Could not search books right now.";
    const data = (await res.json()) as OpenLibraryResponse;
    if (!data.docs?.length) return `No books found for "${query}".`;

    const lines: string[] = [`**Book Search: "${query}"**`, ""];
    for (let i = 0; i < data.docs.length; i++) {
      const b = data.docs[i]!;
      const authors = b.author_name?.slice(0, 3).join(", ") || "Unknown author";
      const year = b.first_publish_year ? ` (${b.first_publish_year})` : "";
      const subjects = b.subject?.slice(0, 3).join(", ") || "";
      const link = `https://openlibrary.org${b.key}`;

      lines.push(`${i + 1}. **${b.title}**${year}`);
      lines.push(`   Author: ${authors}`);
      if (subjects) lines.push(`   Subjects: ${subjects}`);
      lines.push(`   Link: ${link}`);
      lines.push("");
    }
    return lines.join("\n");
  } catch {
    return "Could not search books right now.";
  }
}

// ── Trivia ──────────────────────────────────────────────────────────────

interface TriviaRaw {
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface TriviaApiResponse {
  results: TriviaRaw[];
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&eacute;/g, "é")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&hellip;/g, "...");
}

async function fetchTrivia(): Promise<string> {
  try {
    const res = await fetch(
      "https://opentdb.com/api.php?amount=1&type=multiple",
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return "Could not fetch trivia question right now.";
    const data = (await res.json()) as TriviaApiResponse;
    if (!data.results?.length) return "No trivia questions available.";

    const raw = data.results[0]!;
    const question = decodeHtmlEntities(raw.question);
    const correct = decodeHtmlEntities(raw.correct_answer);
    const incorrect = raw.incorrect_answers.map(decodeHtmlEntities);

    const options = [...incorrect, correct].sort(() => Math.random() - 0.5);
    const labels = ["A", "B", "C", "D"];

    pendingTrivia = {
      question,
      correctAnswer: correct,
      options,
      askedAt: Date.now(),
    };

    const lines: string[] = ["**Trivia Time!**", "", question, ""];
    for (let i = 0; i < options.length; i++) {
      lines.push(`${labels[i]}. ${options[i]}`);
    }
    lines.push("");
    lines.push('Reply with the answer letter (e.g., "B" or "the answer is B").');

    return lines.join("\n");
  } catch {
    return "Could not fetch trivia question right now.";
  }
}

function answerTrivia(input: string): string {
  if (!pendingTrivia) return "No pending trivia question. Ask me for trivia first!";

  if (Date.now() - pendingTrivia.askedAt > TRIVIA_TIMEOUT_MS) {
    pendingTrivia = null;
    return "Trivia question expired. Ask me for a new one!";
  }

  const normalized = input.toLowerCase().replace(/^(the answer is|answer|ans)\s*/i, "").trim();
  const labels = ["A", "B", "C", "D"];
  const idx = labels.indexOf(normalized.toUpperCase());
  if (idx === -1) {
    return 'Please reply with a letter: A, B, C, or D (e.g., "B" or "the answer is B").';
  }

  const chosen = pendingTrivia.options[idx];
  const isCorrect = chosen === pendingTrivia.correctAnswer;
  const result = isCorrect
    ? `**Correct!** The answer is **${pendingTrivia.correctAnswer}**.`
    : `**Incorrect.** The correct answer was **${pendingTrivia.correctAnswer}**.`;

  pendingTrivia = null;
  return result;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Intent detection ────────────────────────────────────────────────────

type Intent =
  | "trending_movies"
  | "search_movies"
  | "trending_anime"
  | "search_anime"
  | "top_games"
  | "search_games"
  | "search_books"
  | "trivia_answer"
  | "trivia_start"
  | null;

function classifyIntent(input: string): { intent: Intent; query: string } {
  const lower = input.toLowerCase().trim();

  // Trivia answer check (before other intents so it takes priority)
  if (pendingTrivia) {
    const cleaned = lower.replace(/^(the answer is|answer|ans)\s*/i, "").trim();
    if (["A", "B", "C", "D"].includes(cleaned.toUpperCase())) {
      return { intent: "trivia_answer", query: input };
    }
  }

  // Trivia start
  if (
    lower.includes("trivia") ||
    lower.includes("quiz") ||
    lower.includes("give me a trivia")
  ) {
    return { intent: "trivia_start", query: "" };
  }

  // Trending movies
  if (
    lower.includes("trending movie") ||
    lower.includes("what's popular") ||
    lower.includes("what should i watch") ||
    (lower.includes("popular") && lower.includes("movie"))
  ) {
    return { intent: "trending_movies", query: "" };
  }

  // Search movies
  const movieSearchMatch = lower.match(
    /(?:find|search|look up)\s+(?:a\s+)?(?:movie|film)\s+(?:called\s+|named\s+|for\s+)?(.+)/i,
  );
  if (movieSearchMatch) {
    return { intent: "search_movies", query: movieSearchMatch[1]!.trim() };
  }

  // Trending anime
  if (
    lower.includes("trending anime") ||
    lower.includes("popular anime") ||
    lower.includes("top anime")
  ) {
    return { intent: "trending_anime", query: "" };
  }

  // Search anime
  const animeSearchMatch = lower.match(
    /(?:find|search|look up)\s+(?:a\s+)?(?:anime|manga)\s+(?:called\s+|named\s+|for\s+)?(.+)/i,
  );
  if (animeSearchMatch) {
    return { intent: "search_anime", query: animeSearchMatch[1]!.trim() };
  }

  // Top games
  if (
    lower.includes("top game") ||
    lower.includes("popular game") ||
    lower.includes("best game") ||
    (lower.includes("popular") && lower.includes("game"))
  ) {
    return { intent: "top_games", query: "" };
  }

  // Search games
  const gameSearchMatch = lower.match(
    /(?:find|search|look up)\s+(?:a\s+)?game\s+(?:called\s+|named\s+|for\s+)?(.+)/i,
  );
  if (gameSearchMatch) {
    return { intent: "search_games", query: gameSearchMatch[1]!.trim() };
  }

  // Search books
  const bookSearchMatch = lower.match(
    /(?:find|search|look up|recommend)\s+(?:a\s+)?book\s+(?:called\s+|named\s+|for\s+)?(.*)/i,
  );
  if (bookSearchMatch || lower.includes("recommend a book")) {
    const bookQuery = bookSearchMatch?.[1]?.trim() || "";
    return { intent: "search_books", query: bookQuery || "popular fiction" };
  }

  // Fuzzy: if user said "movie" or "anime" or "game" without a clear command
  if (lower.includes("movie") || lower.includes("film")) {
    return { intent: "trending_movies", query: "" };
  }
  if (lower.includes("anime") || lower.includes("manga")) {
    return { intent: "trending_anime", query: "" };
  }
  if (lower.includes("game")) {
    return { intent: "top_games", query: "" };
  }

  return { intent: null, query: "" };
}

// ── Service ─────────────────────────────────────────────────────────────

export function createEntertainmentService(): Service {
  return {
    name: "entertainment",
    description: "Entertainment — movies, TV shows, anime, manga, games, books, trivia",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "movie", "movies", "anime", "manga", "game", "games",
        "trivia", "quiz", "entertainment", "recommend", "trending",
        "what should i watch", "popular", "top rated", "book",
        "film",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const { intent, query } = classifyIntent(input);

      let result: string;

      switch (intent) {
        case "trending_movies":
          result = await trendingMovies();
          break;
        case "search_movies":
          result = await searchMovies(query);
          break;
        case "trending_anime":
          result = await trendingAnime();
          break;
        case "search_anime":
          result = await searchAnime(query);
          break;
        case "top_games":
          result = await topGames();
          break;
        case "search_games":
          result = await searchGames(query);
          break;
        case "search_books":
          result = await searchBooks(query);
          break;
        case "trivia_start":
          result = await fetchTrivia();
          break;
        case "trivia_answer":
          result = answerTrivia(input);
          break;
        default:
          result = `I'm not sure what you're looking for. Try asking about movies, anime, games, books, or trivia!`;
          break;
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);

      ctx.reply(result);

      return { text: result };
    },
  };
}
