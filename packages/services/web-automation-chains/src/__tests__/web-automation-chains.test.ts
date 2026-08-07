import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWebAutomationChainsService, parseWorkflowFromNL } from "../impl/web-automation-chains-service.js";

// Mock execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

describe("webAutomationChainsService", () => {
  let service: ReturnType<typeof createWebAutomationChainsService>;
  const mockContext = {
    provider: {
      complete: vi.fn().mockResolvedValue({ text: "Generated response" }),
    },
    memory: {
      add: vi.fn(),
      history: vi.fn().mockResolvedValue([]),
    },
  } as any;

  beforeEach(() => {
    service = createWebAutomationChainsService();
    vi.clearAllMocks();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("web-automation-chains");
  });

  it("should have canHandle method", () => {
    expect(typeof service.canHandle).toBe("function");
  });

  it("should handle automation queries", () => {
    expect(service.canHandle("search for flights to NYC")).toBe(true);
    expect(service.canHandle("order laptop from Amazon")).toBe(true);
    expect(service.canHandle("post on Twitter")).toBe(true);
    expect(service.canHandle("browse Reddit")).toBe(true);
    expect(service.canHandle("automate my workflow")).toBe(true);
  });

  it("should not handle non-automation queries", () => {
    expect(service.canHandle("what time is it")).toBe(false);
    expect(service.canHandle("play music")).toBe(false);
  });

  it("should have execute method", () => {
    expect(typeof service.execute).toBe("function");
  });
});

describe("parseWorkflowFromNL", () => {
  const sitePatterns = new Map();

  it("should parse Google search workflow", () => {
    const workflow = parseWorkflowFromNL("search for TypeScript tutorials on Google", sitePatterns);
    expect(workflow.site).toBe("google");
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.steps[0]?.action).toBe("search");
  });

  it("should parse Google click result workflow", () => {
    const workflow = parseWorkflowFromNL("click the first result on Google", sitePatterns);
    expect(workflow.site).toBe("google");
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.steps[0]?.action).toBe("clickResult");
  });

  it("should parse YouTube search workflow", () => {
    const workflow = parseWorkflowFromNL("find JavaScript tutorial on YouTube", sitePatterns);
    expect(workflow.site).toBe("youtube");
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.steps[0]?.action).toBe("search");
  });

  it("should parse YouTube play workflow", () => {
    const workflow = parseWorkflowFromNL("play the first video on YouTube", sitePatterns);
    expect(workflow.site).toBe("youtube");
    expect(workflow.steps.some(s => s.action === "playVideo")).toBe(true);
  });

  it("should parse YouTube like workflow", () => {
    const workflow = parseWorkflowFromNL("like this video on YouTube", sitePatterns);
    expect(workflow.site).toBe("youtube");
    expect(workflow.steps.some(s => s.action === "like")).toBe(true);
  });

  it("should parse YouTube subscribe workflow", () => {
    const workflow = parseWorkflowFromNL("subscribe to this channel on YouTube", sitePatterns);
    expect(workflow.site).toBe("youtube");
    expect(workflow.steps.some(s => s.action === "subscribe")).toBe(true);
  });

  it("should parse Amazon search workflow", () => {
    const workflow = parseWorkflowFromNL("search for laptop on Amazon", sitePatterns);
    expect(workflow.site).toBe("amazon");
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.steps[0]?.action).toBe("search");
  });

  it("should parse Amazon add to cart workflow", () => {
    const workflow = parseWorkflowFromNL("add laptop to cart on Amazon", sitePatterns);
    expect(workflow.site).toBe("amazon");
    expect(workflow.steps.some(s => s.action === "addToCart")).toBe(true);
  });

  it("should parse Amazon buy workflow", () => {
    const workflow = parseWorkflowFromNL("buy laptop from Amazon", sitePatterns);
    expect(workflow.site).toBe("amazon");
    expect(workflow.steps.some(s => s.action === "buyNow")).toBe(true);
  });

  it("should parse Flipkart search workflow", () => {
    const workflow = parseWorkflowFromNL("search for phone on Flipkart", sitePatterns);
    expect(workflow.site).toBe("flipkart");
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.steps[0]?.action).toBe("search");
  });

  it("should parse LeetCode workflow", () => {
    const workflow = parseWorkflowFromNL("open Two Sum on LeetCode", sitePatterns);
    expect(workflow.site).toBe("leetcode");
    expect(workflow.steps.some(s => s.action === "openProblemByName")).toBe(true);
  });

  it("should parse Twitter post workflow", () => {
    const workflow = parseWorkflowFromNL("post tweet saying Hello World", sitePatterns);
    expect(workflow.site).toBe("twitter");
    expect(workflow.steps.some(s => s.action === "composeTweet")).toBe(true);
  });

  it("should parse Reddit browse workflow", () => {
    const workflow = parseWorkflowFromNL("go to r/programming", sitePatterns);
    expect(workflow.site).toBe("reddit");
    expect(workflow.steps.some(s => s.action === "browseSubreddit")).toBe(true);
  });

  it("should parse generic scroll down", () => {
    const workflow = parseWorkflowFromNL("scroll down", sitePatterns);
    expect(workflow.steps.some(s => s.action === "scrollDown")).toBe(true);
  });

  it("should parse generic scroll up", () => {
    const workflow = parseWorkflowFromNL("scroll up", sitePatterns);
    expect(workflow.steps.some(s => s.action === "scrollUp")).toBe(true);
  });

  it("should parse generic go back", () => {
    const workflow = parseWorkflowFromNL("go back", sitePatterns);
    expect(workflow.steps.some(s => s.action === "goBack")).toBe(true);
  });

  it("should parse generic go forward", () => {
    const workflow = parseWorkflowFromNL("go forward", sitePatterns);
    expect(workflow.steps.some(s => s.action === "goForward")).toBe(true);
  });

  it("should parse generic screenshot", () => {
    const workflow = parseWorkflowFromNL("take a screenshot", sitePatterns);
    expect(workflow.steps.some(s => s.action === "screenshot")).toBe(true);
  });

  it("should parse generic click first link", () => {
    const workflow = parseWorkflowFromNL("click the first link", sitePatterns);
    expect(workflow.steps.some(s => s.action === "clickNth")).toBe(true);
  });

  it("should parse generic click second button", () => {
    const workflow = parseWorkflowFromNL("click the second button", sitePatterns);
    expect(workflow.steps.some(s => s.action === "clickNth")).toBe(true);
  });

  it("should parse generic type action", () => {
    const workflow = parseWorkflowFromNL("type hello in search", sitePatterns);
    expect(workflow.steps.some(s => s.action === "type")).toBe(true);
  });

  it("should parse generic wait action", () => {
    const workflow = parseWorkflowFromNL("wait 2 seconds", sitePatterns);
    expect(workflow.steps.some(s => s.action === "wait")).toBe(true);
  });

  it("should parse navigate to URL", () => {
    const workflow = parseWorkflowFromNL("open https://example.com", sitePatterns);
    expect(workflow.steps.some(s => s.action === "navigate")).toBe(true);
  });
});
