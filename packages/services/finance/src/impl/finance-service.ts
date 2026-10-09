import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type {
  Service,
  ServiceContext,
  ServiceResponse,
} from "@ai-agent/services-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoinGeckoPrice {
  [coin: string]: {
    usd: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
  };
}

interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // previous close
  t: number; // timestamp
}

interface FinanceConfig {
  finnhubApiKey?: string;
}

interface CoinMapping {
  id: string;
  symbol: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COINS: CoinMapping[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
  { id: "ripple", symbol: "XRP", name: "Ripple" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot" },
  { id: "litecoin", symbol: "LTC", name: "Litecoin" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink" },
  { id: "uniswap", symbol: "UNI", name: "Uniswap" },
];

const STOCK_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com Inc.",
  NVDA: "NVIDIA Corporation",
  TSLA: "Tesla Inc.",
  META: "Meta Platforms Inc.",
  NFLX: "Netflix Inc.",
  AMD: "Advanced Micro Devices",
  INTC: "Intel Corporation",
  JPM: "JPMorgan Chase",
  V: "Visa Inc.",
  WMT: "Walmart Inc.",
  DIS: "Walt Disney Co.",
  BA: "Boeing Co.",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "\u20AC",
  GBP: "\u00A3",
  JPY: "\u00A5",
  INR: "\u20B9",
  CAD: "CA$",
  AUD: "A$",
  CHF: "CHF ",
  CNY: "\u00A5",
  KRW: "\u20A9",
  BRL: "R$",
  MXN: "MX$",
  RUB: "\u20BD",
  SEK: "kr",
  SGD: "S$",
  HKD: "HK$",
  TRY: "\u20BA",
  ZAR: "R",
  PLN: "zł",
  THB: "\u0E3F",
  NGN: "\u20A6",
  ARS: "AR$",
  EGP: "E\u00A3",
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getConfigPath(): string {
  return path.join(os.homedir(), ".flux", "finance.json");
}

function loadConfig(): FinanceConfig {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(raw) as FinanceConfig;
    }
  } catch {
    // ignore
  }
  return {};
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000_000) return `$${formatNumber(n / 1_000_000_000_000)}T`;
  if (n >= 1_000_000_000) return `$${formatNumber(n / 1_000_000_000)}B`;
  if (n >= 1_000_000) return `$${formatNumber(n / 1_000_000)}M`;
  return `$${formatNumber(n)}`;
}

function formatChange(change: number, percent: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${formatNumber(change)} (${sign}${formatNumber(percent)}%)`;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchCryptoPrices(
  coinIds: string[],
): Promise<CoinGeckoPrice | null> {
  const ids = coinIds.join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
  return fetchJson<CoinGeckoPrice>(url);
}

async function fetchStockQuote(
  symbol: string,
  apiKey: string,
): Promise<FinnhubQuote | null> {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  return fetchJson<FinnhubQuote>(url);
}

// ---------------------------------------------------------------------------
// Coin resolution
// ---------------------------------------------------------------------------

function resolveCoin(input: string): CoinMapping | null {
  const lower = input.toLowerCase().trim();

  // Direct id match
  for (const coin of COINS) {
    if (lower === coin.id) return coin;
  }

  // Symbol match (case-insensitive)
  for (const coin of COINS) {
    if (lower === coin.symbol.toLowerCase()) return coin;
  }

  // Name match
  for (const coin of COINS) {
    if (lower === coin.name.toLowerCase()) return coin;
  }

  // Partial match (e.g. "doge" → dogecoin)
  for (const coin of COINS) {
    if (
      coin.id.startsWith(lower) ||
      coin.name.toLowerCase().startsWith(lower)
    ) {
      return coin;
    }
  }

  return null;
}

function extractMultipleCoins(input: string): CoinMapping[] {
  const lower = input.toLowerCase();

  // Try to find multiple coins separated by "and", ",", or "+"
  const parts = lower.split(/(?:\s+and\s+|,|\s*\+\s*)/);
  const found: CoinMapping[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const coin = resolveCoin(part);
    if (coin && !seen.has(coin.id)) {
      found.push(coin);
      seen.add(coin.id);
    }
  }

  return found;
}

function resolveStockSymbol(input: string): string | null {
  const upper = input.toUpperCase().trim();

  // Direct symbol match
  if (STOCK_NAMES[upper]) return upper;

  // Match by company name
  for (const [symbol, name] of Object.entries(STOCK_NAMES)) {
    if (name.toLowerCase() === input.toLowerCase().trim()) return symbol;
  }

  // Check if input looks like a stock symbol (1-5 uppercase letters)
  if (/^[A-Za-z]{1,5}$/.test(upper)) return upper;

  return null;
}

// ---------------------------------------------------------------------------
// Currency pair resolution
// ---------------------------------------------------------------------------

function resolveCurrencyPair(
  input: string,
): { from: string; to: string } | null {
  const lower = input.toLowerCase();

  // "dollar to rupee", "usd to inr", "$ to €", etc.
  const patterns = [
    /(?:convert\s+)?(\w{2,3})\s+(?:to|in)\s+(\w{2,3})/i,
    /(\w+)\s+(?:to|in)\s+(\w+)/i,
  ];

  const currencyNames: Record<string, string> = {
    dollar: "USD",
    dollars: "USD",
    usd: "USD",
    euro: "EUR",
    euros: "EUR",
    eur: "EUR",
    pound: "GBP",
    pounds: "GBP",
    gbp: "GBP",
    yen: "JPY",
    jpy: "JPY",
    rupee: "INR",
    rupees: "INR",
    inr: "INR",
    real: "BRL",
    reais: "BRL",
    brl: "BRL",
    yuan: "CNY",
    cny: "CNY",
    won: "KRW",
    krw: "KRW",
    franc: "CHF",
    swiss: "CHF",
    chf: "CHF",
    cad: "CAD",
    aud: "AUD",
    sgd: "SGD",
    hkd: "HKD",
    sek: "SEK",
    try: "TRY",
    rand: "ZAR",
    zar: "ZAR",
    zloty: "PLN",
    pln: "PLN",
  };

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      const fromRaw =
        currencyNames[match[1]?.toLowerCase() ?? ""] ??
        match[1]?.toUpperCase() ??
        "";
      const toRaw =
        currencyNames[match[2]?.toLowerCase() ?? ""] ??
        match[2]?.toUpperCase() ??
        "";
      if (fromRaw.length === 3 && toRaw.length === 3) {
        return { from: fromRaw, to: toRaw };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatCryptoPrice(
  coin: CoinMapping,
  data: CoinGeckoPrice[string],
): string {
  const parts: string[] = [];
  parts.push(`**${coin.name} (${coin.symbol})**`);
  parts.push(`Price: $${formatNumber(data.usd)}`);
  if (data.usd_24h_change !== undefined) {
    const sign = data.usd_24h_change >= 0 ? "+" : "";
    parts.push(`24h Change: ${sign}${formatNumber(data.usd_24h_change)}%`);
  }
  if (data.usd_market_cap !== undefined) {
    parts.push(`Market Cap: ${formatLargeNumber(data.usd_market_cap)}`);
  }
  return parts.join("\n");
}

function formatStockPrice(symbol: string, quote: FinnhubQuote): string {
  const name = STOCK_NAMES[symbol] ?? symbol;
  const parts: string[] = [];
  parts.push(`**${name} (${symbol})**`);
  parts.push(`Price: $${formatNumber(quote.c)}`);
  parts.push(`Change: ${formatChange(quote.d, quote.dp)}`);
  parts.push(`High: $${formatNumber(quote.h)}`);
  parts.push(`Low: $${formatNumber(quote.l)}`);
  parts.push(`Open: $${formatNumber(quote.o)}`);
  parts.push(`Prev Close: $${formatNumber(quote.pc)}`);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Command detection
// ---------------------------------------------------------------------------

type CommandType = "crypto" | "stock" | "market" | "currency" | "unknown";

interface ParsedCommand {
  type: CommandType;
  payload: unknown;
}

function parseCommand(input: string): ParsedCommand {
  const lower = input.toLowerCase();

  // Market overview
  if (
    /\b(?:how'?s?\s+the\s+market|market\s+overview|market\s+summary|stock\s+market)\b/i.test(
      lower,
    ) ||
    /\b(?:what'?s?\s+the\s+market)\b/i.test(lower)
  ) {
    return { type: "market", payload: null };
  }

  // Currency conversion
  const currencyPair = resolveCurrencyPair(input);
  if (currencyPair) {
    return { type: "currency", payload: currencyPair };
  }

  // Multi-crypto (e.g. "price of bitcoin and ethereum")
  const multiCoins = extractMultipleCoins(input);
  if (multiCoins.length > 1) {
    return { type: "crypto", payload: multiCoins };
  }

  // Single crypto
  // Match patterns: "price of bitcoin", "bitcoin price", "btc price", "eth"
  const coinWords = lower
    .replace(/(?:price|of|crypto|coin|what\s+is|what'?s|current|the)\s*/gi, " ")
    .trim();
  const coins = extractMultipleCoins(coinWords);
  if (coins.length === 1) {
    return { type: "crypto", payload: coins };
  }

  // Single word might be a crypto symbol
  const singleWord = lower.replace(/[^a-z]/g, "");
  const singleCoin = resolveCoin(singleWord);
  if (singleCoin) {
    return { type: "crypto", payload: [singleCoin] };
  }

  // Stock price
  // Match patterns: "apple stock", "msft price", "TSLA", "how is AAPL doing"
  const stockPattern =
    /(?:price\s+of\s+)?([A-Za-z]{1,5})(?:\s+stock)?|(?:stock|share)\s+(?:price\s+of\s+)?([A-Za-z]{1,5})/i;
  const stockMatch = input.match(stockPattern);
  if (stockMatch) {
    const symbol = resolveStockSymbol(stockMatch[1] ?? stockMatch[2] ?? "");
    if (symbol) {
      return { type: "stock", payload: symbol };
    }
  }

  // Try extracting any word that looks like a stock symbol
  const words = input.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^A-Za-z]/g, "");
    if (clean.length >= 1 && clean.length <= 5) {
      const symbol = resolveStockSymbol(clean);
      if (symbol && STOCK_NAMES[symbol]) {
        return { type: "stock", payload: symbol };
      }
    }
  }

  return { type: "unknown", payload: input };
}

// ---------------------------------------------------------------------------
// Execute handlers
// ---------------------------------------------------------------------------

async function handleCrypto(coins: CoinMapping[]): Promise<string> {
  const coinIds = coins.map((c) => c.id);
  const data = await fetchCryptoPrices(coinIds);

  if (!data) {
    return `Sorry, I couldn't fetch crypto prices right now. The CoinGecko API might be rate-limited. Please try again in a moment.`;
  }

  const parts: string[] = [];
  for (const coin of coins) {
    const coinData = data[coin.id];
    if (coinData) {
      parts.push(formatCryptoPrice(coin, coinData));
    } else {
      parts.push(`**${coin.name} (${coin.symbol})** — data not available`);
    }
  }

  return parts.join("\n\n");
}

async function handleStock(
  symbol: string,
  config: FinanceConfig,
): Promise<string> {
  if (!config.finnhubApiKey) {
    return (
      `I don't have a Finnhub API key configured. To get stock prices, add your free API key to ~/.flux/finance.json:\n\n` +
      `{"finnhubApiKey": "your_key_here"}\n\n` +
      `Get a free key at https://finnhub.io/register`
    );
  }

  const quote = await fetchStockQuote(symbol, config.finnhubApiKey);

  if (!quote || quote.c === 0) {
    return `Sorry, I couldn't fetch the stock price for ${symbol}. The symbol might be invalid or the API is unavailable.`;
  }

  return formatStockPrice(symbol, quote);
}

async function handleMarket(config: FinanceConfig): Promise<string> {
  const topCrypto = ["bitcoin", "ethereum"];
  const topStocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"];

  const apiKey = config.finnhubApiKey;
  const [cryptoData, ...stockQuotes] = await Promise.all([
    fetchCryptoPrices(topCrypto),
    ...(apiKey ? topStocks.map((s) => fetchStockQuote(s, apiKey)) : []),
  ]);

  const parts: string[] = [];
  parts.push("**Market Overview**\n");

  // Crypto section
  parts.push("**Top Crypto**");
  if (cryptoData) {
    for (const coinId of topCrypto) {
      const coin = COINS.find((c) => c.id === coinId);
      const data = cryptoData[coinId];
      if (coin && data) {
        const sign =
          data.usd_24h_change !== undefined && data.usd_24h_change >= 0
            ? "+"
            : "";
        const change =
          data.usd_24h_change !== undefined
            ? `${sign}${formatNumber(data.usd_24h_change)}%`
            : "";
        parts.push(
          `- ${coin.name} (${coin.symbol}): $${formatNumber(data.usd)} ${change}`,
        );
      }
    }
  } else {
    parts.push("- Crypto data unavailable");
  }

  parts.push("");

  // Stocks section
  parts.push("**Top Stocks**");
  if (config.finnhubApiKey) {
    for (let i = 0; i < topStocks.length; i++) {
      const symbol = topStocks[i];
      if (!symbol) continue;
      const quote = stockQuotes[i];
      if (quote && quote.c > 0) {
        const sign = quote.d >= 0 ? "+" : "";
        parts.push(
          `- ${symbol}: $${formatNumber(quote.c)} (${sign}${formatNumber(quote.dp)}%)`,
        );
      } else {
        parts.push(`- ${symbol}: unavailable`);
      }
    }
  } else {
    parts.push(
      "- Stock data requires Finnhub API key (see ~/.flux/finance.json)",
    );
  }

  return parts.join("\n");
}

async function handleCurrency(from: string, to: string): Promise<string> {
  // CoinGecko can do simple/price with multiple vs_currencies
  // We fetch both currencies in USD to compute the rate
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=${from.toLowerCase()},${to.toLowerCase()}`;
  const data = await fetchJson<Record<string, Record<string, number>>>(url);

  // CoinGecko vs_currencies works with fiat for market data but not always reliably
  // Fallback: use a dedicated free API
  if (!data) {
    // Fallback to exchangerate-api
    const fallbackUrl = `https://open.er-api.com/v6/latest/${from}`;
    const fallback = await fetchJson<{ rates: Record<string, number> }>(
      fallbackUrl,
    );
    if (fallback?.rates[to]) {
      const rate = fallback.rates[to];
      if (rate === undefined) {
        return `Sorry, I couldn't fetch the exchange rate for ${from} to ${to}. The currencies might not be supported.`;
      }
      const fromSymbol = CURRENCY_SYMBOLS[from] ?? `${from} `;
      const toSymbol = CURRENCY_SYMBOLS[to] ?? `${to} `;
      return (
        `**${from} to ${to}**\n\n` +
        `1 ${fromSymbol}1.00 = ${toSymbol}${formatNumber(rate, 4)}\n` +
        `1 ${to} = ${fromSymbol}${formatNumber(1 / rate, 6)}`
      );
    }
    return `Sorry, I couldn't fetch the exchange rate for ${from} to ${to}. The currencies might not be supported.`;
  }

  // This path may not work for all fiat pairs on CoinGecko, so try to extract anyway
  const tetherData = data.tether;
  if (tetherData) {
    const fromRate = tetherData[from.toLowerCase()];
    const toRate = tetherData[to.toLowerCase()];
    if (fromRate !== undefined && toRate !== undefined && fromRate > 0) {
      const rate = toRate / fromRate;
      const fromSymbol = CURRENCY_SYMBOLS[from] ?? `${from} `;
      const toSymbol = CURRENCY_SYMBOLS[to] ?? `${to} `;
      return (
        `**${from} to ${to}**\n\n` +
        `1 ${fromSymbol}1.00 = ${toSymbol}${formatNumber(rate, 4)}\n` +
        `1 ${to} = ${fromSymbol}${formatNumber(1 / rate, 6)}`
      );
    }
  }

  // Final fallback
  const fallbackUrl = `https://open.er-api.com/v6/latest/${from}`;
  const fallback = await fetchJson<{ rates: Record<string, number> }>(
    fallbackUrl,
  );
  if (fallback?.rates[to]) {
    const rate = fallback.rates[to];
    if (rate === undefined) {
      return `Sorry, I couldn't fetch the exchange rate for ${from} to ${to}. The currencies might not be supported.`;
    }
    const fromSymbol = CURRENCY_SYMBOLS[from] ?? `${from} `;
    const toSymbol = CURRENCY_SYMBOLS[to] ?? `${to} `;
    return (
      `**${from} to ${to}**\n\n` +
      `1 ${fromSymbol}1.00 = ${toSymbol}${formatNumber(rate, 4)}\n` +
      `1 ${to} = ${fromSymbol}${formatNumber(1 / rate, 6)}`
    );
  }

  return `Sorry, I couldn't fetch the exchange rate for ${from} to ${to}. The currencies might not be supported.`;
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createFinanceService(): Service {
  return {
    name: "finance",
    description:
      "Financial data — crypto prices, stock quotes, forex rates, market overview",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "price",
        "stock",
        "crypto",
        "bitcoin",
        "ethereum",
        "solana",
        "dogecoin",
        "btc",
        "eth",
        "sol",
        "doge",
        "market",
        "forex",
        "dollar",
        "euro",
        "rupee",
        "currency",
        "exchange rate",
        "market cap",
        "portfolio",
        "ticker",
        "trading",
        "invest",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(
      input: string,
      ctx: ServiceContext,
    ): Promise<ServiceResponse> {
      const config = loadConfig();
      const command = parseCommand(input);

      let result: string;

      switch (command.type) {
        case "crypto": {
          const coins = command.payload as CoinMapping[];
          result = await handleCrypto(coins);
          break;
        }
        case "stock": {
          const symbol = command.payload as string;
          result = await handleStock(symbol, config);
          break;
        }
        case "market": {
          result = await handleMarket(config);
          break;
        }
        case "currency": {
          const { from, to } = command.payload as { from: string; to: string };
          result = await handleCurrency(from, to);
          break;
        }
        default: {
          result =
            `I'm not sure what financial data you're looking for. Try:\n` +
            `- "price of bitcoin" — crypto prices\n` +
            `- "apple stock" — stock quotes\n` +
            `- "market overview" — market summary\n` +
            `- "dollar to rupee" — currency conversion`;
          break;
        }
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);

      ctx.reply(result);

      return { text: result };
    },
  };
}
