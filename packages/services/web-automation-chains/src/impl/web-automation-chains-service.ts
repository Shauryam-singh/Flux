/**
 * Web Automation Chains Service
 *
 * Multi-step browser workflows with site-specific intelligence.
 * Handles complex tasks like booking flights, ordering, posting, etc.
 *
 * Generic Actions:
 *   click first/second/nth link
 *   scroll down/up/left/right
 *   go back/forward
 *   type in search box
 *   wait for element
 *   take screenshot
 *   get page content
 *
 * Site-Specific Patterns:
 *   Google: search, click result, image search, maps
 *   YouTube: search video, play, subscribe, like
 *   Instagram: browse feed, search, view profile, stories
 *   Amazon: search product, add to cart, checkout
 *   Flipkart: search product, filter, compare
 *   LeetCode: find problem, submit solution
 *   Twitter/X: compose tweet, like, retweet, reply
 *   GitHub: search repo, view code, star
 *   Reddit: browse subreddit, upvote, comment
 *   Netflix: search show, play, browse categories
 */

import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Lazy Playwright ────────────────────────────────────────────

type Browser = import("playwright").Browser;
type Page = import("playwright").Page;
type BrowserContext = import("playwright").BrowserContext;
type ElementHandle = import("playwright").ElementHandle;

let chromium: typeof import("playwright").chromium | null = null;

async function loadPlaywright() {
  if (!chromium) {
    try {
      const pw = await import("playwright");
      chromium = pw.chromium;
    } catch {
      throw new Error("Playwright not installed. Run: npm install playwright && npx playwright install chromium");
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
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await this.context.newPage();
    this.tabs.push({ id: this.nextId(), page, url: "about:blank", title: "New Tab" });
  }

  private nextId(): string {
    return `tab_${++this.idCounter}`;
  }

  async openUrl(url: string): Promise<Tab> {
    await this.launch();
    const ctx = this.context!;
    const page = await ctx.newPage();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const tab: Tab = { id: this.nextId(), page, url: page.url(), title: await page.title() };
    this.tabs.push(tab);
    this.activeTabIndex = this.tabs.length - 1;
    return tab;
  }

  activePage(): Page | null {
    return this.tabs[this.activeTabIndex]?.page ?? null;
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
}

// ─── Workflow Engine ────────────────────────────────────────────

interface WorkflowStep {
  action: string;
  target: string | undefined;
  value: string | undefined;
  options: Record<string, unknown> | undefined;
  description: string | undefined;
}

interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  site: string;
  createdAt: Date;
}

interface StepResult {
  step: WorkflowStep;
  success: boolean;
  output: string;
  screenshot?: string;
  duration: number;
}

interface WorkflowResult {
  workflow: Workflow;
  steps: StepResult[];
  success: boolean;
  summary: string;
  totalDuration: number;
}

// ─── Site Patterns ──────────────────────────────────────────────

interface SitePattern {
  name: string;
  domains: string[];
  selectors: Record<string, string>;
  actions: Record<string, (page: Page, target?: string, value?: string) => Promise<string>>;
}

function createGooglePattern(): SitePattern {
  return {
    name: "google",
    domains: ["google.com", "google.co.uk", "google.ca", "google.com.au"],
    selectors: {
      searchBox: 'textarea[name="q"], input[name="q"]',
      searchButton: 'input[name="btnK"], button[type="submit"]',
      results: "#search .g, #rso .g",
      firstResult: "#search .g:first-child a, #rso .g:first-child a",
      images: 'a[data-hveid] img, div[data-ou] img',
      maps: 'a[href*="maps"]',
    },
    actions: {
      search: async (page, query) => {
        const searchBox = page.locator('textarea[name="q"], input[name="q"]');
        await searchBox.fill(query ?? "");
        await searchBox.press("Enter");
        await page.waitForLoadState("domcontentloaded");
        return `Searched Google for: ${query}`;
      },
      clickFirstResult: async (page) => {
        const firstLink = page.locator("#search .g:first-child a, #rso .g:first-child a").first();
        await firstLink.click();
        await page.waitForLoadState("domcontentloaded");
        return `Clicked first result: ${await page.title()}`;
      },
      clickResult: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const results = page.locator("#search .g a, #rso .g a");
        await results.nth(n - 1).click();
        await page.waitForLoadState("domcontentloaded");
        return `Clicked result #${n}: ${await page.title()}`;
      },
      imageSearch: async (page, query) => {
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query ?? "")}&tbm=isch`);
        await page.waitForLoadState("domcontentloaded");
        return `Image search: ${query}`;
      },
      maps: async (page, query) => {
        await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query ?? "")}`);
        await page.waitForLoadState("domcontentloaded");
        return `Google Maps: ${query}`;
      },
      next: async (page) => {
        const nextBtn = page.locator('a#pnnext, a[aria-label="Next"]');
        await nextBtn.click();
        await page.waitForLoadState("domcontentloaded");
        return "Clicked next page";
      },
    },
  };
}

function createYouTubePattern(): SitePattern {
  return {
    name: "youtube",
    domains: ["youtube.com", "youtu.be"],
    selectors: {
      searchBox: 'input#search, input[name="search_query"]',
      searchButton: 'button#search-icon-legacy',
      videos: "ytd-video-renderer, ytd-rich-item-renderer",
      playButton: "button.ytp-large-play-button",
      subscribeButton: 'button#subscribe-button, yt-button-shape button',
      likeButton: 'button#like-button, like-button-view-model button',
    },
    actions: {
      search: async (page, query) => {
        const searchBox = page.locator('input#search, input[name="search_query"]');
        await searchBox.fill(query ?? "");
        await searchBox.press("Enter");
        await page.waitForLoadState("domcontentloaded");
        return `Searched YouTube for: ${query}`;
      },
      playVideo: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const videos = page.locator("ytd-video-renderer #video-title, ytd-rich-item-renderer #video-title-link");
        await videos.nth(n - 1).click();
        await page.waitForLoadState("domcontentloaded");
        return `Playing video #${n}`;
      },
      subscribe: async (page) => {
        const subBtn = page.locator('button#subscribe-button, yt-button-shape button[aria-label*="Subscribe"]').first();
        await subBtn.click();
        return "Subscribed to channel";
      },
      like: async (page) => {
        const likeBtn = page.locator('button#like-button, like-button-view-model button').first();
        await likeBtn.click();
        return "Liked video";
      },
      comments: async (page) => {
        await page.evaluate(() => window.scrollBy(0, 800));
        await page.waitForTimeout(1000);
        return "Scrolled to comments";
      },
      nextVideo: async (page) => {
        const nextBtn = page.locator('button.ytp-next-button, a.ytp-next-button').first();
        await nextBtn.click();
        return "Playing next video";
      },
      pause: async (page) => {
        await page.keyboard.press("k");
        return "Paused/Resumed video";
      },
      mute: async (page) => {
        await page.keyboard.press("m");
        return "Muted/Unmuted video";
      },
      fullscreen: async (page) => {
        await page.keyboard.press("f");
        return "Toggled fullscreen";
      },
    },
  };
}

function createInstagramPattern(): SitePattern {
  return {
    name: "instagram",
    domains: ["instagram.com"],
    selectors: {
      searchBox: 'input[aria-label="Search input"], input[placeholder="Search"]',
      feed: "article div[role='button'] img, main div[role='presentation'] img",
      stories: "header canvas, div[role='tablist'] button",
      likeButton: 'button[aria-label="Like"], span[class*="like"]',
      commentBox: 'textarea[aria-label="Add a comment"], textarea[placeholder*="comment"]',
      profile: 'header section h2, header span[class*="username"]',
    },
    actions: {
      search: async (page, query) => {
        const searchBox = page.locator('input[aria-label="Search input"], input[placeholder="Search"]').first();
        await searchBox.click();
        await searchBox.fill(query ?? "");
        await page.waitForTimeout(1000);
        return `Searching Instagram for: ${query}`;
      },
      viewProfile: async (page, username) => {
        await page.goto(`https://www.instagram.com/${username ?? ""}/`);
        await page.waitForLoadState("domcontentloaded");
        return `Viewing profile: ${username}`;
      },
      viewStory: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const stories = page.locator('header canvas, div[role="tablist"] button');
        await stories.nth(n - 1).click();
        return `Viewing story #${n}`;
      },
      likePost: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const posts = page.locator('article div[role="button"], article button[aria-label*="like"]');
        await posts.nth(n - 1).dblclick();
        return `Liked post #${n}`;
      },
      comment: async (page, text) => {
        const commentBox = page.locator('textarea[aria-label="Add a comment"], textarea[placeholder*="comment"]').first();
        await commentBox.click();
        await commentBox.fill(text ?? "");
        await commentBox.press("Enter");
        return `Commented: ${text}`;
      },
      nextStory: async (page) => {
        const nextBtn = page.locator('button[aria-label="Next"], svg[aria-label="Next"]').first();
        await nextBtn.click();
        return "Next story";
      },
      previousStory: async (page) => {
        const prevBtn = page.locator('button[aria-label="Back"], svg[aria-label="Back"]').first();
        await prevBtn.click();
        return "Previous story";
      },
    },
  };
}

function createAmazonPattern(): SitePattern {
  return {
    name: "amazon",
    domains: ["amazon.com", "amazon.in", "amazon.co.uk", "amazon.de"],
    selectors: {
      searchBox: 'input#twotabsearchtextbox, input[name="field-keywords"]',
      searchButton: 'input#nav-search-submit-button, .nav-search-submit',
      products: 'div[data-component-type="s-search-result"]',
      addToCart: 'input[name="submit.add-to-cart"], span#add-to-cart-button input',
      buyNow: 'input[name="submit.buy-now"], #buy-now-button',
      price: 'span.a-price span.a-offscreen, span.price',
      reviews: 'span.a-icon-alt, i.a-icon-star-small',
    },
    actions: {
      search: async (page, query) => {
        const searchBox = page.locator('input#twotabsearchtextbox, input[name="field-keywords"]');
        await searchBox.fill(query ?? "");
        await searchBox.press("Enter");
        await page.waitForLoadState("domcontentloaded");
        return `Searched Amazon for: ${query}`;
      },
      clickProduct: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const products = page.locator('div[data-component-type="s-search-result"] h2 a, div.s-result-item h2 a');
        await products.nth(n - 1).click();
        await page.waitForLoadState("domcontentloaded");
        return `Viewing product #${n}`;
      },
      addToCart: async (page) => {
        const addBtn = page.locator('input[name="submit.add-to-cart"], span#add-to-cart-button input, #add-to-cart-button').first();
        await addBtn.click();
        await page.waitForTimeout(2000);
        return "Added to cart";
      },
      buyNow: async (page) => {
        const buyBtn = page.locator('input[name="submit.buy-now"], #buy-now-button').first();
        await buyBtn.click();
        await page.waitForLoadState("domcontentloaded");
        return "Clicked Buy Now";
      },
      viewCart: async (page) => {
        await page.goto("https://www.amazon.com/gp/viewcart");
        await page.waitForLoadState("domcontentloaded");
        return "Viewing cart";
      },
      filter: async (page, filterType, value) => {
        const filter = page.locator(`span:has-text("${value}")`).first();
        await filter.click();
        await page.waitForLoadState("domcontentloaded");
        return `Applied filter: ${value}`;
      },
      sortBy: async (page, criteria) => {
        const sortDropdown = page.locator('select#s-dropdown-sort, span.a-dropdown-label').first();
        await sortDropdown.click();
        const option = page.locator(`span:has-text("${criteria}")`).first();
        await option.click();
        return `Sorted by: ${criteria}`;
      },
      nextPage: async (page) => {
        const nextBtn = page.locator('a.s-pagination-next, li.a-last a').first();
        await nextBtn.click();
        await page.waitForLoadState("domcontentloaded");
        return "Next page";
      },
    },
  };
}

function createFlipkartPattern(): SitePattern {
  return {
    name: "flipkart",
    domains: ["flipkart.com"],
    selectors: {
      searchBox: 'input[name="search"], input[title="Search for Products, Brands and More"]',
      searchButton: 'button[type="submit"], .vh79eN',
      products: 'div._1AtVbE, div._2kHMtA',
      addToCart: 'button._2KpZ6l._2U9uOA._3v1uww, button[class*="add-to-cart"]',
      buyNow: 'button._16FRkO._3WUaJ2, button[class*="buy-now"]',
      price: 'div._30jeq3._16Jk6d, span._1_WHN1',
      filter: 'div._6i1qNp, div[class*="filter"]',
    },
    actions: {
      search: async (page, query) => {
        const searchBox = page.locator('input[name="search"], input[title="Search for Products, Brands and More"]');
        await searchBox.fill(query ?? "");
        await searchBox.press("Enter");
        await page.waitForLoadState("domcontentloaded");
        return `Searched Flipkart for: ${query}`;
      },
      clickProduct: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const products = page.locator('div._1AtVbE a, div._2kHMtA a');
        await products.nth(n - 1).click();
        await page.waitForLoadState("domcontentloaded");
        return `Viewing product #${n}`;
      },
      addToCart: async (page) => {
        const addBtn = page.locator('button._2KpZ6l._2U9uOA, button[class*="add-to-cart"]').first();
        await addBtn.click();
        await page.waitForTimeout(2000);
        return "Added to cart";
      },
      buyNow: async (page) => {
        const buyBtn = page.locator('button._16FRkO, button[class*="buy-now"]').first();
        await buyBtn.click();
        await page.waitForLoadState("domcontentloaded");
        return "Clicked Buy Now";
      },
      filterByPrice: async (page, min, max) => {
        const minInput = page.locator('input[placeholder="Min"]').first();
        const maxInput = page.locator('input[placeholder="Max"]').first();
        await minInput.fill(min ?? "0");
        await maxInput.fill(max ?? "100000");
        const applyBtn = page.locator('button:has-text("Apply")').first();
        await applyBtn.click();
        return `Filtered by price: ${min} - ${max}`;
      },
      filterByBrand: async (page, brand) => {
        const brandFilter = page.locator(`span:has-text("${brand}")`).first();
        await brandFilter.click();
        await page.waitForLoadState("domcontentloaded");
        return `Filtered by brand: ${brand}`;
      },
      sortBy: async (page, criteria) => {
        const sortDropdown = page.locator('div._1ZaaL_, select[class*="sort"]').first();
        await sortDropdown.click();
        const option = page.locator(`li:has-text("${criteria}")`).first();
        await option.click();
        return `Sorted by: ${criteria}`;
      },
    },
  };
}

function createLeetCodePattern(): SitePattern {
  return {
    name: "leetcode",
    domains: ["leetcode.com"],
    selectors: {
      searchBox: 'input[placeholder="Search"], input[type="search"]',
      problems: 'div[role="row"], table tbody tr',
      problemTitle: 'a[href*="/problems/"], td a',
      submitButton: 'button:has-text("Submit"), button[data-e2e-locator="submit-button"]',
      codeEditor: 'div.monaco-editor, textarea[aria-label*="code"]',
    },
    actions: {
      search: async (page, query) => {
        const searchBox = page.locator('input[placeholder="Search"], input[type="search"]').first();
        await searchBox.fill(query ?? "");
        await page.waitForTimeout(1000);
        return `Searching LeetCode for: ${query}`;
      },
      openProblem: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const problems = page.locator('a[href*="/problems/"]');
        await problems.nth(n - 1).click();
        await page.waitForLoadState("domcontentloaded");
        return `Opened problem #${n}`;
      },
      openProblemByName: async (page, name) => {
        const problem = page.locator(`a:has-text("${name}")`).first();
        await problem.click();
        await page.waitForLoadState("domcontentloaded");
        return `Opened problem: ${name}`;
      },
      submitSolution: async (page) => {
        const submitBtn = page.locator('button:has-text("Submit"), button[data-e2e-locator="submit-button"]').first();
        await submitBtn.click();
        await page.waitForTimeout(5000);
        return "Submitted solution";
      },
      runCode: async (page) => {
        const runBtn = page.locator('button:has-text("Run"), button[data-e2e-locator="run-button"]').first();
        await runBtn.click();
        await page.waitForTimeout(3000);
        return "Running code";
      },
      goToProblems: async (page) => {
        await page.goto("https://leetcode.com/problemset/");
        await page.waitForLoadState("domcontentloaded");
        return "Navigated to problems";
      },
      filterByDifficulty: async (page, difficulty) => {
        const filter = page.locator(`button:has-text("${difficulty}")`).first();
        await filter.click();
        return `Filtered by: ${difficulty}`;
      },
    },
  };
}

function createTwitterPattern(): SitePattern {
  return {
    name: "twitter",
    domains: ["twitter.com", "x.com"],
    selectors: {
      composeBox: 'div[role="textbox"][data-testid="tweetTextarea_0"], div[aria-label*="Tweet"]',
      tweetButton: 'button[data-testid="tweetButton"], button:has-text("Tweet")',
      searchBox: 'input[data-testid="SearchBox_Search_Input"], input[aria-label="Search query"]',
      tweet: 'article[data-testid="tweet"], div[data-testid="tweet"]',
      likeButton: 'button[data-testid="like"], button[data-testid="unlike"]',
      retweetButton: 'button[data-testid="retweet"], button[data-testid="unretweet"]',
      replyButton: 'button[data-testid="reply"]',
      followButton: 'button[data-testid$="-follow"], button:has-text("Follow")',
    },
    actions: {
      composeTweet: async (page, text) => {
        const composeBox = page.locator('div[role="textbox"][data-testid="tweetTextarea_0"], div[aria-label*="Tweet"]').first();
        await composeBox.click();
        await composeBox.fill(text ?? "");
        const tweetBtn = page.locator('button[data-testid="tweetButton"], button:has-text("Tweet")').first();
        await tweetBtn.click();
        await page.waitForTimeout(2000);
        return `Posted tweet: ${text}`;
      },
      like: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const likeBtns = page.locator('button[data-testid="like"]');
        await likeBtns.nth(n - 1).click();
        return `Liked tweet #${n}`;
      },
      retweet: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const rtBtns = page.locator('button[data-testid="retweet"]');
        await rtBtns.nth(n - 1).click();
        await page.waitForTimeout(500);
        const confirmRt = page.locator('button[data-testid="retweetConfirm"]').first();
        await confirmRt.click();
        return `Retweeted tweet #${n}`;
      },
      reply: async (page, text, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const replyBtns = page.locator('button[data-testid="reply"]');
        await replyBtns.nth(n - 1).click();
        const replyBox = page.locator('div[role="textbox"][data-testid="tweetTextarea_0"]').first();
        await replyBox.fill(text ?? "");
        const tweetBtn = page.locator('button[data-testid="tweetButton"]').first();
        await tweetBtn.click();
        return `Replied: ${text}`;
      },
      search: async (page, query) => {
        const searchBox = page.locator('input[data-testid="SearchBox_Search_Input"], input[aria-label="Search query"]').first();
        await searchBox.fill(query ?? "");
        await searchBox.press("Enter");
        await page.waitForLoadState("domcontentloaded");
        return `Searched Twitter for: ${query}`;
      },
      follow: async (page, username) => {
        await page.goto(`https://x.com/${username ?? ""}`);
        await page.waitForLoadState("domcontentloaded");
        const followBtn = page.locator('button[data-testid$="-follow"], button:has-text("Follow")').first();
        await followBtn.click();
        return `Following @${username}`;
      },
      viewTrending: async (page) => {
        await page.goto("https://x.com/explore");
        await page.waitForLoadState("domcontentloaded");
        return "Viewing trending";
      },
    },
  };
}

function createGitHubPattern(): SitePattern {
  return {
    name: "github",
    domains: ["github.com"],
    selectors: {
      searchBox: 'input[name="query-builder"], input[type="search"]',
      repositories: 'div[data-testid="results-list"] div, div.repo-list-item',
      codeResults: 'div[data-testid="code-results"] div',
      starButton: 'button[data-hydro-click*="STAR"], button:has-text("Star")',
      forkButton: 'button[data-hydro-click*="FORK"]',
      issues: 'div[data-testid="issue-row"]',
    },
    actions: {
      search: async (page, query) => {
        await page.goto(`https://github.com/search?q=${encodeURIComponent(query ?? "")}&type=repositories`);
        await page.waitForLoadState("domcontentloaded");
        return `Searched GitHub for: ${query}`;
      },
      openRepo: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const repos = page.locator('div[data-testid="results-list"] a, div.repo-list-item a');
        await repos.nth(n - 1).click();
        await page.waitForLoadState("domcontentloaded");
        return `Opened repo #${n}`;
      },
      star: async (page) => {
        const starBtn = page.locator('button[data-hydro-click*="STAR"], button:has-text("Star")').first();
        await starBtn.click();
        return "Starred repo";
      },
      viewCode: async (page) => {
        const codeTab = page.locator('a[data-tab-item="code"], a:has-text("Code")').first();
        await codeTab.click();
        return "Viewing code";
      },
      viewIssues: async (page) => {
        await page.click('a[data-tab-item="issues"], a:has-text("Issues")');
        await page.waitForLoadState("domcontentloaded");
        return "Viewing issues";
      },
      cloneUrl: async (page) => {
        const cloneBtn = page.locator('button:has-text("Code"), details summary').first();
        await cloneBtn.click();
        const url = page.locator('input[type="text"], input clipboard-copy').first();
        const cloneUrl = await url.inputValue();
        return `Clone URL: ${cloneUrl}`;
      },
    },
  };
}

function createRedditPattern(): SitePattern {
  return {
    name: "reddit",
    domains: ["reddit.com", "old.reddit.com"],
    selectors: {
      posts: 'article[data-testid="post-container"], div[data-testid="post"]',
      upvoteButton: 'button[aria-label="Upvote"], button[data-click-id="upvote"]',
      downvoteButton: 'button[aria-label="Downvote"], button[data-click-id="downvote"]',
      commentBox: 'textarea[aria-label*="comment"], div[contenteditable="true"]',
      searchBox: 'input[name="q"], input[aria-label="Search Reddit"]',
      subscribeButton: 'button:has-text("Join"), button[data-click-id="join"]',
    },
    actions: {
      browseSubreddit: async (page, subreddit) => {
        await page.goto(`https://www.reddit.com/r/${subreddit ?? ""}`);
        await page.waitForLoadState("domcontentloaded");
        return `Browsing r/${subreddit}`;
      },
      upvote: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const upvoteBtns = page.locator('button[aria-label="Upvote"], button[data-click-id="upvote"]');
        await upvoteBtns.nth(n - 1).click();
        return `Upvoted post #${n}`;
      },
      downvote: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const downvoteBtns = page.locator('button[aria-label="Downvote"], button[data-click-id="downvote"]');
        await downvoteBtns.nth(n - 1).click();
        return `Downvoted post #${n}`;
      },
      comment: async (page, text) => {
        const commentBox = page.locator('textarea[aria-label*="comment"], div[contenteditable="true"]').first();
        await commentBox.click();
        await commentBox.fill(text ?? "");
        const submitBtn = page.locator('button:has-text("Comment"), button:has-text("Submit")').first();
        await submitBtn.click();
        return `Commented: ${text}`;
      },
      search: async (page, query) => {
        const searchBox = page.locator('input[name="q"], input[aria-label="Search Reddit"]').first();
        await searchBox.fill(query ?? "");
        await searchBox.press("Enter");
        await page.waitForLoadState("domcontentloaded");
        return `Searched Reddit for: ${query}`;
      },
      subscribe: async (page) => {
        const joinBtn = page.locator('button:has-text("Join"), button[data-click-id="join"]').first();
        await joinBtn.click();
        return "Joined subreddit";
      },
      openPost: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const posts = page.locator('article[data-testid="post-container"] a, div[data-testid="post"] a');
        await posts.nth(n - 1).click();
        await page.waitForLoadState("domcontentloaded");
        return `Opened post #${n}`;
      },
    },
  };
}

function createNetflixPattern(): SitePattern {
  return {
    name: "netflix",
    domains: ["netflix.com"],
    selectors: {
      searchBox: 'input[data-testid="search-box-input"], input[type="search"]',
      searchResults: 'div[data-testid="search-for-X-results"] a, div.slider-item',
      playButton: 'button[data-testid="play-button"], button:has-text("Play")',
      myList: 'button[data-testid="mylist-add-button"]',
      categories: 'div[data-testid="category-pill"], a:has-text("Categories")',
    },
    actions: {
      search: async (page, query) => {
        const searchBox = page.locator('input[data-testid="search-box-input"], input[type="search"]').first();
        await searchBox.click();
        await searchBox.fill(query ?? "");
        await page.waitForTimeout(2000);
        return `Searching Netflix for: ${query}`;
      },
      play: async (page, nth) => {
        const n = Number.parseInt(nth ?? "1", 10);
        const playBtns = page.locator('button[data-testid="play-button"]');
        await playBtns.nth(n - 1).click();
        return `Playing title #${n}`;
      },
      addToMyList: async (page) => {
        const addBtn = page.locator('button[data-testid="mylist-add-button"]').first();
        await addBtn.click();
        return "Added to My List";
      },
      browseCategory: async (page, category) => {
        const catBtn = page.locator(`div[data-testid="category-pill"]:has-text("${category}")`).first();
        await catBtn.click();
        return `Browsing category: ${category}`;
      },
      playNextEpisode: async (page) => {
        const nextBtn = page.locator('button[data-testid="next-episode"]').first();
        await nextBtn.click();
        return "Playing next episode";
      },
      skipIntro: async (page) => {
        const skipBtn = page.locator('button:has-text("Skip Intro"), button[data-testid="skip-button"]').first();
        await skipBtn.click();
        return "Skipped intro";
      },
    },
  };
}

// ─── Workflow Parser ────────────────────────────────────────────

function parseWorkflowFromNL(input: string, sitePatterns: Map<string, SitePattern>): Workflow {
  const lower = input.toLowerCase();
  const steps: WorkflowStep[] = [];
  let site = "generic";

  // Detect site (case-insensitive)
  if (/google/i.test(input)) site = "google";
  else if (/youtube|yt\b/i.test(input)) site = "youtube";
  else if (/instagram|insta\b/i.test(input)) site = "instagram";
  else if (/amazon/i.test(input)) site = "amazon";
  else if (/flipkart/i.test(input)) site = "flipkart";
  else if (/leetcode/i.test(input)) site = "leetcode";
  else if (/twitter|x\.com|tweet/i.test(input)) site = "twitter";
  else if (/github/i.test(input)) site = "github";
  else if (/reddit|r\/\w+/i.test(input)) site = "reddit";
  else if (/netflix/i.test(input)) site = "netflix";

  // Parse steps based on detected site
  if (site === "google") {
    const queryMatch = input.match(/(?:search|google|look\s+up)\s+(?:for\s+)?(.+)/i);
    if (queryMatch) {
      steps.push({ action: "search", target: queryMatch[1]?.trim(), value: undefined, options: undefined, description: `Search Google for ${queryMatch[1]}` });
    }
    const clickMatch = input.match(/(?:click|open)\s+(?:the\s+)?(?:first|1st|second|2nd|third|3rd|(\d+)(?:st|nd|rd|th)?)\s+(?:result|link)/i);
    if (clickMatch) {
      const nth = clickMatch[1] ?? (clickMatch[0].includes("first") ? "1" : clickMatch[0].includes("second") ? "2" : "3");
      steps.push({ action: "clickResult", target: nth, value: undefined, options: undefined, description: `Click result #${nth}` });
    }
  } else if (site === "youtube") {
    const queryMatch = input.match(/(?:search|find|look)\s+(?:for\s+)?(.+?)(?:\s+on\s+youtube|\s+video)/i);
    if (queryMatch) {
      steps.push({ action: "search", target: queryMatch[1]?.trim(), value: undefined, options: undefined, description: `Search YouTube for ${queryMatch[1]}` });
    }
    if (/play|watch|start/.test(lower)) {
      steps.push({ action: "playVideo", target: "1", value: undefined, options: undefined, description: "Play first video" });
    }
    if (/like|thumbs?\s*up/.test(lower)) {
      steps.push({ action: "like", target: undefined, value: undefined, options: undefined, description: "Like video" });
    }
    if (/subscribe/.test(lower)) {
      steps.push({ action: "subscribe", target: undefined, value: undefined, options: undefined, description: "Subscribe to channel" });
    }
  } else if (site === "amazon") {
    const queryMatch = input.match(/(?:search|find|look)\s+(?:for\s+)?(.+?)(?:\s+on\s+amazon|\s+product)/i);
    if (queryMatch) {
      steps.push({ action: "search", target: queryMatch[1]?.trim(), value: undefined, options: undefined, description: `Search Amazon for ${queryMatch[1]}` });
    }
    if (/add\s+(.+?)?\s*to\s+cart|add\s+to\s+cart/i.test(lower)) {
      steps.push({ action: "clickProduct", target: "1", value: undefined, options: undefined, description: "Click first product" });
      steps.push({ action: "addToCart", target: undefined, value: undefined, options: undefined, description: "Add to cart" });
    }
    if (/buy|purchase|order/i.test(lower)) {
      steps.push({ action: "clickProduct", target: "1", value: undefined, options: undefined, description: "Click first product" });
      steps.push({ action: "buyNow", target: undefined, value: undefined, options: undefined, description: "Buy now" });
    }
  } else if (site === "flipkart") {
    const queryMatch = input.match(/(?:search|find|look)\s+(?:for\s+)?(.+?)(?:\s+on\s+flipkart)/i);
    if (queryMatch) {
      steps.push({ action: "search", target: queryMatch[1]?.trim(), value: undefined, options: undefined, description: `Search Flipkart for ${queryMatch[1]}` });
    }
    if (/add\s+(?:to\s+)?cart/.test(lower)) {
      steps.push({ action: "clickProduct", target: "1", value: undefined, options: undefined, description: "Click first product" });
      steps.push({ action: "addToCart", target: undefined, value: undefined, options: undefined, description: "Add to cart" });
    }
  } else if (site === "leetcode") {
    if (/problem|solve|coding/.test(lower)) {
      steps.push({ action: "goToProblems", target: undefined, value: undefined, options: undefined, description: "Go to problems" });
    }
    const problemMatch = input.match(/(?:open|solve|find)\s+(.+)/i);
    if (problemMatch) {
      steps.push({ action: "openProblemByName", target: problemMatch[1]?.trim(), value: undefined, options: undefined, description: `Open problem: ${problemMatch[1]}` });
    }
    if (/submit/.test(lower)) {
      steps.push({ action: "submitSolution", target: undefined, value: undefined, options: undefined, description: "Submit solution" });
    }
  } else if (site === "twitter") {
    const tweetMatch = input.match(/(?:post|tweet|send)\s+(?:a\s+)?(?:tweet|message)?\s*(?:that|saying)?\s*(.+)/i);
    if (tweetMatch) {
      steps.push({ action: "composeTweet", target: tweetMatch[1]?.trim(), value: undefined, options: undefined, description: `Post tweet: ${tweetMatch[1]}` });
    }
    if (/like/.test(lower)) {
      steps.push({ action: "like", target: "1", value: undefined, options: undefined, description: "Like first tweet" });
    }
  } else if (site === "reddit") {
    const subMatch = input.match(/(?:go\s+to|browse|visit)\s+r\/(\w+)/i);
    if (subMatch) {
      steps.push({ action: "browseSubreddit", target: subMatch[1], value: undefined, options: undefined, description: `Browse r/${subMatch[1]}` });
    }
    if (/upvote/.test(lower)) {
      steps.push({ action: "upvote", target: "1", value: undefined, options: undefined, description: "Upvote first post" });
    }
  }

  // Parse generic actions if no site-specific steps
  if (steps.length === 0) {
    // Click actions
    const clickMatch = input.match(/(?:click|tap|press)\s+(?:the\s+)?(?:first|1st|second|2nd|third|3rd|(\d+)(?:st|nd|rd|th)?)\s+(link|button|element|video|image|post)/i);
    if (clickMatch) {
      const nth = clickMatch[1] ?? (clickMatch[0].includes("first") ? "1" : clickMatch[0].includes("second") ? "2" : "3");
      steps.push({ action: "clickNth", target: nth, value: clickMatch[2] ?? "link", options: undefined, description: `Click ${nth} ${clickMatch[2] ?? "link"}` });
    }

    // Scroll actions
    if (/scroll\s+down/.test(lower)) {
      steps.push({ action: "scrollDown", target: undefined, value: undefined, options: undefined, description: "Scroll down" });
    }
    if (/scroll\s+up/.test(lower)) {
      steps.push({ action: "scrollUp", target: undefined, value: undefined, options: undefined, description: "Scroll up" });
    }
    if (/scroll\s+left/.test(lower)) {
      steps.push({ action: "scrollLeft", target: undefined, value: undefined, options: undefined, description: "Scroll left" });
    }
    if (/scroll\s+right/.test(lower)) {
      steps.push({ action: "scrollRight", target: undefined, value: undefined, options: undefined, description: "Scroll right" });
    }

    // Navigation
    if (/go\s+back|back/.test(lower)) {
      steps.push({ action: "goBack", target: undefined, value: undefined, options: undefined, description: "Go back" });
    }
    if (/go\s+forward|forward/.test(lower)) {
      steps.push({ action: "goForward", target: undefined, value: undefined, options: undefined, description: "Go forward" });
    }

    // Screenshot
    if (/screenshot|take\s+(?:a\s+)?pic|capture/.test(lower)) {
      steps.push({ action: "screenshot", target: undefined, value: undefined, options: undefined, description: "Take screenshot" });
    }

    // Get content
    if (/what('s| is)\s+(?:on|there|the)\s+page|read\s+(?:the\s+)?page|page\s+content/.test(lower)) {
      steps.push({ action: "getPageContent", target: undefined, value: undefined, options: undefined, description: "Get page content" });
    }

    // Type
    const typeMatch = input.match(/(?:type|enter|input)\s+(.+?)(?:\s+in\s+(?:the\s+)?(.+))?$/i);
    if (typeMatch) {
      steps.push({ action: "type", target: typeMatch[2] ?? "search", value: typeMatch[1] ?? "", options: undefined, description: `Type ${typeMatch[1]}` });
    }

    // Wait
    if (/wait/.test(lower)) {
      steps.push({ action: "wait", target: "2000", value: undefined, options: undefined, description: "Wait 2 seconds" });
    }

    // Navigate to URL
    const urlMatch = input.match(/(?:open|go\s+to|navigate\s+to)\s+(https?:\/\/\S+)/i);
    if (urlMatch) {
      steps.push({ action: "navigate", target: urlMatch[1], value: undefined, options: undefined, description: `Navigate to ${urlMatch[1]}` });
    }
  }

  return {
    id: `workflow_${Date.now()}`,
    name: input.slice(0, 100),
    steps,
    site,
    createdAt: new Date(),
  };
}

// ─── Workflow Executor ──────────────────────────────────────────

async function executeWorkflow(
  workflow: Workflow,
  browser: BrowserManager,
  sitePatterns: Map<string, SitePattern>,
): Promise<WorkflowResult> {
  const results: StepResult[] = [];
  const startTime = Date.now();
  const pattern = sitePatterns.get(workflow.site);

  for (const step of workflow.steps) {
    const stepStart = Date.now();
    let success = false;
    let output = "";

    try {
      const page = browser.activePage();
      if (!page) throw new Error("No active page");

      // Execute step based on action
      switch (step.action) {
        case "navigate":
          await browser.openUrl(step.target ?? "");
          output = `Navigated to ${step.target}`;
          success = true;
          break;

        case "search":
          if (pattern?.actions.search) {
            output = await pattern.actions.search(page, step.target);
            success = true;
          }
          break;

        case "clickResult":
          if (pattern?.actions.clickResult) {
            output = await pattern.actions.clickResult(page, step.target);
            success = true;
          } else if (pattern?.actions.clickProduct) {
            output = await pattern.actions.clickProduct(page, step.target);
            success = true;
          }
          break;

        case "clickNth": {
          const n = Number.parseInt(step.target ?? "1", 10);
          const elementType = step.value ?? "link";
          const selector = elementType === "link" ? "a" : elementType === "button" ? "button" : elementType === "video" ? "video, [data-testid*='video']" : elementType === "image" ? "img" : "a";
          const elements = page.locator(selector);
          await elements.nth(n - 1).click();
          output = `Clicked ${n} ${elementType}`;
          success = true;
          break;
        }

        case "playVideo":
          if (pattern?.actions.playVideo) {
            output = await pattern.actions.playVideo(page, step.target);
            success = true;
          }
          break;

        case "like":
          if (pattern?.actions.like) {
            output = await pattern.actions.like(page, step.target);
            success = true;
          }
          break;

        case "subscribe":
          if (pattern?.actions.subscribe) {
            output = await pattern.actions.subscribe(page);
            success = true;
          }
          break;

        case "addToCart":
          if (pattern?.actions.addToCart) {
            output = await pattern.actions.addToCart(page);
            success = true;
          }
          break;

        case "buyNow":
          if (pattern?.actions.buyNow) {
            output = await pattern.actions.buyNow(page);
            success = true;
          }
          break;

        case "composeTweet":
          if (pattern?.actions.composeTweet) {
            output = await pattern.actions.composeTweet(page, step.target);
            success = true;
          }
          break;

        case "browseSubreddit":
          if (pattern?.actions.browseSubreddit) {
            output = await pattern.actions.browseSubreddit(page, step.target);
            success = true;
          }
          break;

        case "upvote":
          if (pattern?.actions.upvote) {
            output = await pattern.actions.upvote(page, step.target);
            success = true;
          }
          break;

        case "goToProblems":
          if (pattern?.actions.goToProblems) {
            output = await pattern.actions.goToProblems(page);
            success = true;
          }
          break;

        case "openProblemByName":
          if (pattern?.actions.openProblemByName) {
            output = await pattern.actions.openProblemByName(page, step.target);
            success = true;
          }
          break;

        case "submitSolution":
          if (pattern?.actions.submitSolution) {
            output = await pattern.actions.submitSolution(page);
            success = true;
          }
          break;

        case "scrollDown":
          await page.evaluate(() => (window as Window).scrollBy(0, 500));
          output = "Scrolled down";
          success = true;
          break;

        case "scrollUp":
          await page.evaluate(() => (window as Window).scrollBy(0, -500));
          output = "Scrolled up";
          success = true;
          break;

        case "scrollLeft":
          await page.evaluate(() => (window as Window).scrollBy(-500, 0));
          output = "Scrolled left";
          success = true;
          break;

        case "scrollRight":
          await page.evaluate(() => (window as Window).scrollBy(500, 0));
          output = "Scrolled right";
          success = true;
          break;

        case "goBack":
          await page.goBack();
          output = "Went back";
          success = true;
          break;

        case "goForward":
          await page.goForward();
          output = "Went forward";
          success = true;
          break;

        case "screenshot": {
          const screenshot = await browser.screenshot();
          output = screenshot ? "Screenshot taken" : "Screenshot failed";
          success = !!screenshot;
          break;
        }

        case "getPageContent": {
          const content = await page.evaluate(() => (document as Document).body?.innerText?.slice(0, 5000) ?? "");
          output = content;
          success = true;
          break;
        }

        case "type": {
          const target = step.target ?? "search";
          const value = step.value ?? "";
          const input = page.locator(`input[name*="${target}"], input[placeholder*="${target}"], textarea`).first();
          await input.fill(value);
          output = `Typed "${value}" in ${target}`;
          success = true;
          break;
        }

        case "wait": {
          const ms = Number.parseInt(step.target ?? "2000", 10);
          await page.waitForTimeout(ms);
          output = `Waited ${ms}ms`;
          success = true;
          break;
        }

        default:
          output = `Unknown action: ${step.action}`;
      }
    } catch (e) {
      output = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }

    results.push({
      step,
      success,
      output,
      duration: Date.now() - stepStart,
    });

    if (!success) break;
  }

  const allSuccess = results.every((r) => r.success);
  const totalDuration = Date.now() - startTime;

  return {
    workflow,
    steps: results,
    success: allSuccess,
    summary: results.map((r) => `${r.step.description ?? r.step.action}: ${r.output}`).join("\n"),
    totalDuration,
  };
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(book|order|post|search|find|browse|open|click|scroll|navigate|automate|workflow|chain)\b/i;

export function createWebAutomationChainsService(): Service {
  const sitePatterns = new Map<string, SitePattern>();
  sitePatterns.set("google", createGooglePattern());
  sitePatterns.set("youtube", createYouTubePattern());
  sitePatterns.set("instagram", createInstagramPattern());
  sitePatterns.set("amazon", createAmazonPattern());
  sitePatterns.set("flipkart", createFlipkartPattern());
  sitePatterns.set("leetcode", createLeetCodePattern());
  sitePatterns.set("twitter", createTwitterPattern());
  sitePatterns.set("github", createGitHubPattern());
  sitePatterns.set("reddit", createRedditPattern());
  sitePatterns.set("netflix", createNetflixPattern());

  const browser = new BrowserManager();

  return {
    name: "web-automation-chains",
    description: "Multi-step browser workflows — search, order, post, automate across sites",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      try {
        // Parse workflow from natural language
        const workflow = parseWorkflowFromNL(input, sitePatterns);

        if (workflow.steps.length === 0) {
          return { text: `Could not parse workflow from: ${input}\n\nTry: "search for flights to NYC on Google" or "order laptop from Amazon"` };
        }

        // Execute workflow
        const result = await executeWorkflow(workflow, browser, sitePatterns);

        // Build response
        const response = [
          `Workflow: ${workflow.name}`,
          `Site: ${workflow.site}`,
          `Steps: ${workflow.steps.length}`,
          `Success: ${result.success ? "Yes" : "No"}`,
          `Duration: ${result.totalDuration}ms`,
          "",
          "Steps:",
          ...result.steps.map((r, i) => `${i + 1}. ${r.step.description ?? r.step.action}: ${r.output}`),
        ].join("\n");

        return { text: response };
      } catch (e) {
        return { text: `Workflow error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}

// ─── Exports ────────────────────────────────────────────────────

export { parseWorkflowFromNL, executeWorkflow, type Workflow, type WorkflowStep, type StepResult, type WorkflowResult };
