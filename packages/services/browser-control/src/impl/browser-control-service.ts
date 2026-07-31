/**
 * Browser Control Service
 *
 * Full browser automation via Playwright:
 *   - Open any URL, navigate, back/forward/reload
 *   - Tab management (open, close, switch, list)
 *   - Click elements by text or CSS selector
 *   - Type into inputs, fill forms
 *   - Scroll, search on any site
 *   - Screenshots, page content extraction
 *   - JavaScript execution
 *
 * Voice commands:
 *   "open youtube.com"
 *   "search for cats on Google"
 *   "click the login button"
 *   "type hello in the search box"
 *   "scroll down"
 *   "switch to tab 2"
 *   "take a screenshot"
 *   "what's on the page"
 */

import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Lazy Playwright import (avoids crash if not installed) ──────

type Browser = import("playwright").Browser;
type Page = import("playwright").Page;
type BrowserContext = import("playwright").BrowserContext;

let chromium: typeof import("playwright").chromium | null = null;

async function loadPlaywright() {
  if (!chromium) {
    try {
      const pw = await import("playwright");
      chromium = pw.chromium;
    } catch {
      throw new Error(
        "Playwright is not installed. Run: npm install playwright && npx playwright install chromium",
      );
    }
  }
  return chromium;
}

// ─── Browser Manager ────────────────────────────────────────────

interface Tab {
  id: string;
  page: Page;
  url: string;
  title: string;
}

class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private tabs: Tab[] = [];
  activeTabIndex = 0;
  private idCounter = 0;

  async launch(): Promise<void> {
    if (this.browser) return;
    const chromium_ = await loadPlaywright();
    this.browser = await chromium_.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await this.context.newPage();
    this.tabs.push({
      id: this.nextId(),
      page,
      url: "about:blank",
      title: "New Tab",
    });
  }

  private nextId(): string {
    return `tab_${++this.idCounter}`;
  }

  async syncTab(tab: Tab): Promise<void> {
    try {
      tab.url = tab.page.url();
      tab.title = await tab.page.title();
    } catch {
      // Page may have been closed
    }
  }

  async openUrl(url: string): Promise<Tab> {
    await this.launch();
    const ctx = this.context!;
    const page = await ctx.newPage();
    // Ensure URL has protocol
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const tab: Tab = {
      id: this.nextId(),
      page,
      url: page.url(),
      title: await page.title(),
    };
    this.tabs.push(tab);
    this.activeTabIndex = this.tabs.length - 1;
    return tab;
  }

  async searchOnSite(query: string, site?: string): Promise<Tab> {
    await this.launch();
    // Build search URL based on site
    let searchUrl: string;
    const q = encodeURIComponent(query);

    if (!site || site === "google") {
      searchUrl = `https://www.google.com/search?q=${q}`;
    } else if (site === "youtube") {
      searchUrl = `https://www.youtube.com/results?search_query=${q}`;
    } else if (site === "wikipedia") {
      searchUrl = `https://en.wikipedia.org/w/index.php?search=${q}`;
    } else if (site === "github") {
      searchUrl = `https://github.com/search?q=${q}`;
    } else if (site === "reddit") {
      searchUrl = `https://www.reddit.com/search/?q=${q}`;
    } else if (site === "stackoverflow" || site === "stack overflow") {
      searchUrl = `https://stackoverflow.com/search?q=${q}`;
    } else if (site === "amazon") {
      searchUrl = `https://www.amazon.com/s?k=${q}`;
    } else if (site === "twitter" || site === "x") {
      searchUrl = `https://x.com/search?q=${q}`;
    } else if (site === "bing") {
      searchUrl = `https://www.bing.com/search?q=${q}`;
    } else if (site === "duckduckgo") {
      searchUrl = `https://duckduckgo.com/?q=${q}`;
    } else if (site === "arxiv") {
      searchUrl = `https://arxiv.org/search/?query=${q}`;
    } else if (site === "npm") {
      searchUrl = `https://www.npmjs.com/search?q=${q}`;
    } else if (site === "crates") {
      searchUrl = `https://crates.io/search?q=${q}`;
    } else if (site === "pypi") {
      searchUrl = `https://pypi.org/search/?q=${q}`;
    } else if (site === "medium") {
      searchUrl = `https://medium.com/search?q=${q}`;
    } else if (site === "linkedin") {
      searchUrl = `https://www.linkedin.com/search/results/all/?keywords=${q}`;
    } else if (site === "ebay") {
      searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${q}`;
    } else if (site === "imdb") {
      searchUrl = `https://www.imdb.com/find/?q=${q}`;
    } else if (site === "goodreads") {
      searchUrl = `https://www.goodreads.com/search?q=${q}`;
    } else if (site === "hackernews") {
      searchUrl = `https://hn.algolia.com/?q=${q}`;
    } else if (site === "leetcode") {
      searchUrl = `https://leetcode.com/problemset/?keywords=${q}`;
    } else {
      // Generic: try searching the site directly or fall back to Google site: search
      searchUrl = `https://www.google.com/search?q=${q}+site:${site}`;
    }

    return this.openUrl(searchUrl);
  }

  async closeTab(indexOrId?: number | string): Promise<string> {
    if (this.tabs.length <= 1) return "Cannot close the last tab.";
    let idx: number;
    if (typeof indexOrId === "string") {
      idx = this.tabs.findIndex((t) => t.id === indexOrId);
    } else if (typeof indexOrId === "number") {
      idx = indexOrId - 1; // 1-indexed for user
    } else {
      idx = this.activeTabIndex;
    }
    if (idx < 0 || idx >= this.tabs.length) return "Tab not found.";
    const tab = this.tabs[idx]!;
    await tab.page.close().catch(() => {});
    this.tabs.splice(idx, 1);
    if (this.activeTabIndex >= this.tabs.length) {
      this.activeTabIndex = this.tabs.length - 1;
    }
    return `Closed tab: ${tab.title}`;
  }

  switchTab(indexOrId: number | string): string {
    let idx: number;
    if (typeof indexOrId === "string") {
      idx = this.tabs.findIndex((t) => t.id === indexOrId);
    } else {
      idx = indexOrId - 1;
    }
    if (idx < 0 || idx >= this.tabs.length) return "Tab not found.";
    this.activeTabIndex = idx;
    const tab = this.tabs[idx]!;
    return `Switched to: ${tab.title} (${tab.url})`;
  }

  listTabs(): Tab[] {
    return this.tabs.map((t, i) => ({
      ...t,
      active: i === this.activeTabIndex,
    })) as Tab[];
  }

  activePage(): Page | null {
    return this.tabs[this.activeTabIndex]?.page ?? null;
  }

  async getPageContent(): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";
    try {
      // Get visible text
      const text = await page.evaluate(() => {
        const el = document.body;
        if (!el) return "Empty page";
        return el.innerText?.slice(0, 12000) ?? "Empty page";
      });
      return text;
    } catch {
      return "Could not read page content.";
    }
  }

  async getPageLinks(): Promise<string[]> {
    const page = this.activePage();
    if (!page) return [];
    try {
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a[href]"))
          .slice(0, 50)
          .map((a) => {
            const href = (a as HTMLAnchorElement).href;
            const text = (a as HTMLAnchorElement).innerText?.trim().slice(0, 80) ?? "";
            return text ? `${text} → ${href}` : href;
          });
      });
    } catch {
      return [];
    }
  }

  async screenshot(): Promise<string | null> {
    const page = this.activePage();
    if (!page) return null;
    try {
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return buf.toString("base64");
    } catch {
      return null;
    }
  }

  async clickElement(target: string): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";

    // Try multiple strategies
    try {
      // 1. Try text selector
      const textLocator = page.getByText(target, { exact: false });
      if (await textLocator.count() > 0) {
        await textLocator.first().click({ timeout: 5000 });
        return `Clicked: "${target}" (by text)`;
      }
    } catch {}

    try {
      // 2. Try role + name
      const roleLocator = page.getByRole("button", { name: target });
      if (await roleLocator.count() > 0) {
        await roleLocator.first().click({ timeout: 5000 });
        return `Clicked: "${target}" (button)`;
      }
    } catch {}

    try {
      // 3. Try link
      const linkLocator = page.getByRole("link", { name: target });
      if (await linkLocator.count() > 0) {
        await linkLocator.first().click({ timeout: 5000 });
        return `Clicked: "${target}" (link)`;
      }
    } catch {}

    try {
      // 4. Try CSS selector
      const cssLocator = page.locator(target);
      if (await cssLocator.count() > 0) {
        await cssLocator.first().click({ timeout: 5000 });
        return `Clicked: "${target}" (CSS selector)`;
      }
    } catch {}

    try {
      // 5. Try aria-label
      const ariaLocator = page.locator(`[aria-label*="${target}" i]`);
      if (await ariaLocator.count() > 0) {
        await ariaLocator.first().click({ timeout: 5000 });
        return `Clicked: "${target}" (aria-label)`;
      }
    } catch {}

    try {
      // 6. Try placeholder
      const placeholderLocator = page.locator(`[placeholder*="${target}" i]`);
      if (await placeholderLocator.count() > 0) {
        await placeholderLocator.first().click({ timeout: 5000 });
        return `Clicked: "${target}" (placeholder)`;
      }
    } catch {}

    return `Could not find element: "${target}"`;
  }

  async typeInto(target: string, text: string): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";

    // Try to find the input/textarea
    try {
      // 1. By placeholder
      let locator = page.locator(`[placeholder*="${target}" i]`);
      if (await locator.count() === 0) {
        // 2. By label text
        locator = page.getByPlaceholder(target);
      }
      if (await locator.count() === 0) {
        // 3. By aria-label
        locator = page.locator(`[aria-label*="${target}" i]`);
      }
      if (await locator.count() === 0) {
        // 4. By name attribute
        locator = page.locator(`input[name*="${target}" i], textarea[name*="${target}" i]`);
      }
      if (await locator.count() === 0) {
        // 5. Try the first visible input/textarea
        locator = page.locator("input:visible, textarea:visible").first();
      }
      if (await locator.count() > 0) {
        await locator.first().fill(text);
        return `Typed "${text}" into ${target}`;
      }
    } catch {}

    return `Could not find input field: "${target}"`;
  }

  async scrollTo(direction: "up" | "down" | "top" | "bottom"): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";
    try {
      await page.evaluate((dir) => {
        const h = document.documentElement;
        switch (dir) {
          case "down": h.scrollBy(0, window.innerHeight * 0.8); break;
          case "up": h.scrollBy(0, -window.innerHeight * 0.8); break;
          case "top": h.scrollTop = 0; break;
          case "bottom": h.scrollTop = h.scrollHeight; break;
        }
      }, direction);
      return `Scrolled ${direction}`;
    } catch {
      return "Could not scroll.";
    }
  }

  async goBack(): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";
    try {
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 });
      await this.syncTab(this.tabs[this.activeTabIndex]!);
      return `Navigated back to: ${this.tabs[this.activeTabIndex]!.url}`;
    } catch {
      return "Cannot go back.";
    }
  }

  async goForward(): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";
    try {
      await page.goForward({ waitUntil: "domcontentloaded", timeout: 15000 });
      await this.syncTab(this.tabs[this.activeTabIndex]!);
      return `Navigated forward to: ${this.tabs[this.activeTabIndex]!.url}`;
    } catch {
      return "Cannot go forward.";
    }
  }

  async reload(): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";
    try {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
      await this.syncTab(this.tabs[this.activeTabIndex]!);
      return `Reloaded: ${this.tabs[this.activeTabIndex]!.url}`;
    } catch {
      return "Could not reload.";
    }
  }

  async executeJs(code: string): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";
    try {
      const result = await page.evaluate(code);
      return typeof result === "string" ? result : JSON.stringify(result, null, 2);
    } catch (e) {
      return `JS error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async waitAndClick(selector: string, timeoutMs = 10000): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";
    try {
      await page.waitForSelector(selector, { timeout: timeoutMs });
      await page.click(selector);
      return `Waited for and clicked: ${selector}`;
    } catch {
      return `Element not found within ${timeoutMs}ms: ${selector}`;
    }
  }

  async hoverElement(target: string): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";
    try {
      const locator = page.getByText(target, { exact: false });
      if (await locator.count() > 0) {
        await locator.first().hover({ timeout: 5000 });
        return `Hovered over: "${target}"`;
      }
      const cssLocator = page.locator(target);
      if (await cssLocator.count() > 0) {
        await cssLocator.first().hover({ timeout: 5000 });
        return `Hovered over: "${target}"`;
      }
    } catch {}
    return `Could not hover: "${target}"`;
  }

  async selectOption(target: string, value: string): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";
    try {
      let locator = page.locator(`select[name*="${target}" i]`);
      if (await locator.count() === 0) {
        locator = page.locator(`[aria-label*="${target}" i]`);
      }
      if (await locator.count() === 0) {
        locator = page.locator(target);
      }
      if (await locator.count() > 0) {
        await locator.first().selectOption(value, { timeout: 5000 });
        return `Selected "${value}" in ${target}`;
      }
    } catch {}
    return `Could not find select element: "${target}"`;
  }

  async pressKey(key: string): Promise<string> {
    const page = this.activePage();
    if (!page) return "No active tab.";
    try {
      await page.keyboard.press(key);
      return `Pressed key: ${key}`;
    } catch {
      return `Could not press key: ${key}`;
    }
  }

  async close(): Promise<void> {
    for (const tab of this.tabs) {
      await tab.page.close().catch(() => {});
    }
    this.tabs = [];
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.context = null;
  }
}

// ─── Natural Language Parser ────────────────────────────────────

interface BrowserIntent {
  action:
    | "open"
    | "search"
    | "click"
    | "type"
    | "scroll"
    | "back"
    | "forward"
    | "reload"
    | "tabs"
    | "switch_tab"
    | "close_tab"
    | "screenshot"
    | "read_page"
    | "links"
    | "js"
    | "hover"
    | "select"
    | "press_key"
    | "wait_click"
    | "help";
  url?: string;
  searchQuery?: string;
  searchSite?: string;
  target?: string;
  text?: string;
  direction?: "up" | "down" | "top" | "bottom";
  tabIndex?: number;
  code?: string;
  key?: string;
  value?: string;
}

function parseBrowserIntent(input: string): BrowserIntent {
  const lower = input.toLowerCase().trim();

  // Help
  if (/^(help|what can you do|commands|browser help)\b/.test(lower)) {
    return { action: "help" };
  }

  // Screenshot
  if (/\b(screenshot|capture|snap|take a (?:photo|picture))\b/.test(lower)) {
    return { action: "screenshot" };
  }

  // Read page / page content
  if (/\b(read|what('s| is) on|page content|text on|what do(?:es)? (?:the )?page)\b/.test(lower)) {
    return { action: "read_page" };
  }

  // Links on page
  if (/\b(links? on|show.*links?|list.*links?|what.*links?)\b/.test(lower)) {
    return { action: "links" };
  }

  // Back
  if (/\b(go\s+back|back|previous)\b/.test(lower)) {
    return { action: "back" };
  }

  // Forward
  if (/\b(go\s+forward|forward|next)\b/.test(lower)) {
    return { action: "forward" };
  }

  // Reload
  if (/\b(reload|refresh)\b/.test(lower)) {
    return { action: "reload" };
  }

  // List tabs
  if (/\b(list|show|what('s| are))\s*(?:the\s+)?tabs?\b/.test(lower)) {
    return { action: "tabs" };
  }

  // Close tab
  const closeTabMatch = lower.match(/\b(close|exit)\s+(?:tab\s+)?(\d+|current)\b/);
  if (closeTabMatch) {
    if (closeTabMatch[2] === "current") return { action: "close_tab" };
    return { action: "close_tab", tabIndex: Number.parseInt(closeTabMatch[2]!, 10) };
  }

  // Switch tab
  const switchTabMatch = lower.match(/\b(switch|go)\s+(?:to\s+)?(?:tab\s+)?(\d+)\b/);
  if (switchTabMatch?.[2]) {
    return { action: "switch_tab", tabIndex: Number.parseInt(switchTabMatch[2], 10) };
  }

  // New tab / open tab
  const newTabMatch = lower.match(/\b(new|open)\s+tab\b/);
  if (newTabMatch && !/\b(open|go|navigate|visit)\b/.test(lower.replace(/\b(new|open)\s+tab\b/, ""))) {
    return { action: "open", url: "about:blank" };
  }

  // Search: "search X on Y" / "google X" / "youtube X"
  const searchMatch = lower.match(
    /\b(?:search|google|look up|find|query)\b(?:\s+(?:for|on))?\s+(.+?)(?:\s+(?:on|in|at)\s+(\w[\w\s]*))?$/i,
  );
  if (searchMatch) {
    let query = searchMatch[1]!.trim();
    const site = searchMatch[2]?.trim();
    // Clean query: remove trailing "on site"
    query = query.replace(/\s+(?:on|in|at)\s+\w[\w\s]*$/, "").trim();
    return site
      ? { action: "search", searchQuery: query, searchSite: site }
      : { action: "search", searchQuery: query };
  }

  // Direct site search: "youtube cats" / "reddit memes"
  const directSearchMatch = lower.match(
    /\b(google|youtube|wikipedia|github|reddit|stackoverflow|stack overflow|amazon|twitter|x|bing|duckduckgo|arxiv|npm|crates|pypi|medium|linkedin|ebay|imdb|goodreads|hackernews|leetcode)\s+(.+)/i,
  );
  if (directSearchMatch) {
    return { action: "search", searchQuery: directSearchMatch[2]!.trim(), searchSite: directSearchMatch[1]!.trim() };
  }

  // Type: "type X in Y" / "fill Y with X"
  const typeMatch = lower.match(
    /\b(?:type|enter|fill|input|write)\s+(.+?)\s+(?:in|into|on)\s+(.+)/i,
  );
  if (typeMatch) {
    return { action: "type", text: typeMatch[1]!.trim().replace(/^["']|["']$/g, ""), target: typeMatch[2]!.trim() };
  }

  const fillMatch = lower.match(
    /\b(?:fill|set)\s+(.+?)\s+(?:to|with)\s+(.+)/i,
  );
  if (fillMatch) {
    return { action: "type", target: fillMatch[1]!.trim(), text: fillMatch[2]!.trim().replace(/^["']|["']$/g, "") };
  }

  // Click: "click X" / "press X"
  const clickMatch = lower.match(
    /\b(?:click|press|tap|hit)\s+(?:on\s+)?(?:the\s+)?(.+)/i,
  );
  if (clickMatch) {
    return { action: "click", target: clickMatch[1]!.trim().replace(/^["']|["']$/g, "") };
  }

  // Hover: "hover over X" / "mouse over X"
  const hoverMatch = lower.match(/\b(?:hover|mouse over)\s+(?:on\s+)?(?:the\s+)?(.+)/i);
  if (hoverMatch) {
    return { action: "hover", target: hoverMatch[1]!.trim() };
  }

  // Select: "select X in Y" / "choose X from Y"
  const selectMatch = lower.match(/\b(?:select|choose)\s+(.+?)\s+(?:in|from|on)\s+(.+)/i);
  if (selectMatch) {
    return { action: "select", value: selectMatch[1]!.trim(), target: selectMatch[2]!.trim() };
  }

  // Scroll
  const scrollMatch = lower.match(/\bscroll\s+(down|up|to (?:the )?(?:top|bottom|start|end))\b/i);
  if (scrollMatch) {
    let dir: "up" | "down" | "top" | "bottom" = "down";
    const d = scrollMatch[1]!.toLowerCase();
    if (d.includes("down")) dir = "down";
    else if (d.includes("up")) dir = "up";
    else if (d.includes("top") || d.includes("start")) dir = "top";
    else if (d.includes("bottom") || d.includes("end")) dir = "bottom";
    return { action: "scroll", direction: dir };
  }

  // Page down / page up
  if (/\bpage\s+down\b/.test(lower)) return { action: "scroll", direction: "down" };
  if (/\bpage\s+up\b/.test(lower)) return { action: "scroll", direction: "up" };

  // Press key: "press enter" / "press Escape"
  const pressMatch = lower.match(/\bpress\s+(enter|escape|tab|space|backspace|delete|arrowup|arrowdown|arrowleft|arrowright|home|end|pageup|pagedown|f\d{1,2})\b/i);
  if (pressMatch) {
    return { action: "press_key", key: pressMatch[1]! };
  }

  // Execute JS
  const jsMatch = input.match(/\b(?:run|execute|eval)\s+(?:js|javascript|code)[:\s]+(.+)/i);
  if (jsMatch) {
    return { action: "js", code: jsMatch[1]!.trim() };
  }

  // Open URL
  const openMatch = lower.match(
    /\b(?:open|go\s+to|navigate\s+to|visit|browse|load|launch)\s+(.+)/i,
  );
  if (openMatch) {
    let url = openMatch[1]!.trim().replace(/^["']|["']$/g, "");
    // If it doesn't look like a URL, treat as a search
    if (!url.match(/[\w-]+\.\w{2,}/) && !url.startsWith("http")) {
      return { action: "search", searchQuery: url };
    }
    return { action: "open", url };
  }

  // Bare URL detection
  const urlMatch = input.match(/\b(https?:\/\/[\w./\-?=&%#+]+|[\w-]+\.(com|org|net|io|dev|app|co|edu|gov)(?:\/\S*)?)/i);
  if (urlMatch) {
    return { action: "open", url: urlMatch[1]! };
  }

  return { action: "help" };
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(open|browse|search|click|type|scroll|tabs?|screenshot|read.*page|page.*content|what.*page|browser|navigate|go\s+to|reload|back|forward|press|hover|select|fill|links?)\b/i;

let manager: BrowserManager | null = null;

function getManager(): BrowserManager {
  if (!manager) manager = new BrowserManager();
  return manager;
}

export function createBrowserControlService(): Service {
  return {
    name: "browser-control",
    description:
      "Full browser control via Playwright: open any URL, navigate, click, type, scroll, search any site, tabs, screenshots",

    canHandle(input: string): boolean {
      return MATCH.test(input);
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const mgr = getManager();
      const intent = parseBrowserIntent(input);

      try {
        switch (intent.action) {
          case "help":
            return {
              text: [
                "**Browser Control** — voice commands for any website:",
                "",
                "**Navigate:** \"open youtube.com\", \"go to github.com\", \"reload\"",
                "**Search:** \"search cats on Google\", \"youtube recipes\", \"reddit programming\"",
                "**Click:** \"click login\", \"press the submit button\"",
                "**Type:** \"type hello in the search box\", \"fill email with test@test.com\"",
                "**Scroll:** \"scroll down\", \"scroll to top\", \"page down\"",
                "**Tabs:** \"list tabs\", \"switch to tab 2\", \"new tab\", \"close tab\"",
                "**Read:** \"what's on the page\", \"read the page\", \"show links\"",
                "**Screenshot:** \"take a screenshot\", \"capture the page\"",
                "**Other:** \"go back\", \"go forward\", \"press Enter\", \"hover over menu\"",
                "",
                "Supported sites: Google, YouTube, GitHub, Reddit, Wikipedia, Amazon,",
                "Twitter/X, StackOverflow, Medium, LinkedIn, eBay, IMDB, npm, PyPI,",
                "arXiv, Hacker News, LeetCode, Goodreads, DuckDuckGo, Bing, and ANY URL.",
              ].join("\n"),
            };

          case "open": {
            const tab = await mgr.openUrl(intent.url!);
            await mgr.syncTab(tab);
            return { text: `Opened: ${tab.title}\n${tab.url}` };
          }

          case "search": {
            const tab = await mgr.searchOnSite(intent.searchQuery!, intent.searchSite);
            await mgr.syncTab(tab);
            const site = intent.searchSite ? ` on ${intent.searchSite}` : "";
            return { text: `Searched "${intent.searchQuery}"${site}\n${tab.title}\n${tab.url}` };
          }

          case "click": {
            const result = await mgr.clickElement(intent.target!);
            await mgr.syncTab(mgr.listTabs()[mgr.activeTabIndex - 1 < 0 ? 0 : mgr.activeTabIndex] as Tab ?? { url: "", title: "" });
            return { text: result };
          }

          case "type": {
            const result = await mgr.typeInto(intent.target!, intent.text!);
            return { text: result };
          }

          case "scroll": {
            const result = await mgr.scrollTo(intent.direction!);
            return { text: result };
          }

          case "back": {
            const result = await mgr.goBack();
            return { text: result };
          }

          case "forward": {
            const result = await mgr.goForward();
            return { text: result };
          }

          case "reload": {
            const result = await mgr.reload();
            return { text: result };
          }

          case "tabs": {
            const tabs = mgr.listTabs();
            if (tabs.length === 0) return { text: "No tabs open." };
            const lines = tabs.map((t, i) => {
              const active = (t as unknown as { active?: boolean }).active ? " [ACTIVE]" : "";
              return `${i + 1}. ${t.title || "Untitled"} — ${t.url}${active}`;
            });
            return { text: `Tabs (${tabs.length}):\n${lines.join("\n")}` };
          }

          case "switch_tab": {
            const result = mgr.switchTab(intent.tabIndex!);
            return { text: result };
          }

          case "close_tab": {
            const result = await mgr.closeTab(intent.tabIndex ?? "current");
            return { text: result };
          }

          case "screenshot": {
            const b64 = await mgr.screenshot();
            if (b64) {
              return { text: `[Screenshot captured — ${b64.length} bytes base64]` };
            }
            return { text: "Could not take screenshot." };
          }

          case "read_page": {
            const content = await mgr.getPageContent();
            return { text: content.slice(0, 4000) };
          }

          case "links": {
            const links = await mgr.getPageLinks();
            if (links.length === 0) return { text: "No links found on the page." };
            return { text: `Links on page (${links.length}):\n${links.join("\n")}` };
          }

          case "js": {
            const result = await mgr.executeJs(intent.code!);
            return { text: result.slice(0, 4000) };
          }

          case "hover": {
            const result = await mgr.hoverElement(intent.target!);
            return { text: result };
          }

          case "select": {
            const result = await mgr.selectOption(intent.target!, intent.value!);
            return { text: result };
          }

          case "press_key": {
            const result = await mgr.pressKey(intent.key!);
            return { text: result };
          }

          default:
            return { text: "Try: \"open youtube.com\" or \"search for cats on Google\"." };
        }
      } catch (e) {
        return { text: `Browser error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}
