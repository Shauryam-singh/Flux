import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAccessibilityVoiceService, parseAccessibilityIntent } from "../impl/accessibility-voice-service.js";

// Mock execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

describe("accessibilityVoiceService", () => {
  let service: ReturnType<typeof createAccessibilityVoiceService>;
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
    service = createAccessibilityVoiceService();
    vi.clearAllMocks();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("accessibility-voice");
  });

  it("should have canHandle method", () => {
    expect(typeof service.canHandle).toBe("function");
  });

  it("should handle accessibility queries", () => {
    expect(service.canHandle("click the blue button")).toBe(true);
    expect(service.canHandle("scroll down to pricing")).toBe(true);
    expect(service.canHandle("read this page aloud")).toBe(true);
    expect(service.canHandle("find all images")).toBe(true);
    expect(service.canHandle("what's on this page")).toBe(true);
  });

  it("should not handle non-accessibility queries", () => {
    expect(service.canHandle("play music")).toBe(false);
    expect(service.canHandle("what time is it")).toBe(false);
  });

  it("should have execute method", () => {
    expect(typeof service.execute).toBe("function");
  });
});

describe("parseAccessibilityIntent", () => {
  it("should parse click by color", () => {
    const intent = parseAccessibilityIntent("click the blue button");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("click");
    expect(intent?.color).toBe("blue");
    expect(intent?.target).toBe("button");
  });

  it("should parse click by red color", () => {
    const intent = parseAccessibilityIntent("click the red link");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("click");
    expect(intent?.color).toBe("red");
    expect(intent?.target).toBe("link");
  });

  it("should parse click by text", () => {
    const intent = parseAccessibilityIntent('click the button that says "Submit"');
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("click");
    expect(intent?.text).toBe("Submit");
  });

  it("should parse click by aria-label", () => {
    const intent = parseAccessibilityIntent('click the element with aria-label "menu"');
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("click");
    expect(intent?.ariaLabel).toBe("menu");
  });

  it("should parse scroll to section", () => {
    const intent = parseAccessibilityIntent("scroll down to the pricing section");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("scroll");
    expect(intent?.section).toBe("pricing");
  });

  it("should parse scroll down", () => {
    const intent = parseAccessibilityIntent("scroll down");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("scroll");
    expect(intent?.target).toBe("down");
  });

  it("should parse scroll up", () => {
    const intent = parseAccessibilityIntent("scroll up");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("scroll");
    expect(intent?.target).toBe("up");
  });

  it("should parse read page aloud", () => {
    const intent = parseAccessibilityIntent("read this page aloud");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("read");
  });

  it("should parse read to me", () => {
    const intent = parseAccessibilityIntent("read the page to me");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("read");
  });

  it("should parse find elements", () => {
    const intent = parseAccessibilityIntent("find all images");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("find");
    expect(intent?.target).toBe("images");
  });

  it("should parse describe page", () => {
    const intent = parseAccessibilityIntent("what's on this page");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("describe");
  });

  it("should parse list links", () => {
    const intent = parseAccessibilityIntent("list all links");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("list");
    expect(intent?.target).toBe("links");
  });

  it("should parse list buttons", () => {
    const intent = parseAccessibilityIntent("list all buttons");
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe("list");
    expect(intent?.target).toBe("buttons");
  });
});
