/**
 * Accessibility Voice Control Service
 *
 * Voice-controlled browser interaction with visual element targeting.
 * Find elements by color, label, or text and interact with them.
 *
 * Commands:
 *   "click the blue button" → find element by color, click it
 *   "scroll down to the pricing section" → find section, scroll to it
 *   "read this page aloud" → extract text, TTS
 *   "find the red error message" → locate element by color
 *   "click the button that says Submit" → find by text content
 *   "scroll to the footer" → find footer, scroll to it
 *   "what's on this page?" → extract and describe page content
 *   "click the element with aria-label 'menu'" → find by aria-label
 *   "find all images" → locate all image elements
 *   "read the navigation menu" → extract and read menu content
 */

import { execSync } from "node:child_process";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Lazy Playwright ────────────────────────────────────────────

type Page = import("playwright").Page;

// ─── Color Detection ────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  red: "#ff0000",
  green: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  pink: "#ffc0cb",
  black: "#000000",
  white: "#ffffff",
  gray: "#808080",
  grey: "#808080",
  brown: "#a52a2a",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  lime: "#00ff00",
  teal: "#008080",
  navy: "#000080",
  maroon: "#800000",
  olive: "#808000",
  aqua: "#00ffff",
  silver: "#c0c0c0",
};

function parseColor(colorName: string): string | null {
  const lower = colorName.toLowerCase().trim();
  return COLOR_MAP[lower] ?? null;
}

// ─── Element Finding ────────────────────────────────────────────

interface FoundElement {
  selector: string;
  description: string;
  visible: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
}

async function findElementByColor(page: Page, color: string): Promise<FoundElement[]> {
  const hexColor = parseColor(color);
  if (!hexColor) return [];

  const elements = await page.evaluate((targetColor) => {
    const results: Array<{
      selector: string;
      description: string;
      visible: boolean;
      bounds: { x: number; y: number; width: number; height: number };
    }> = [];

    const allElements = document.querySelectorAll("*");
    for (const el of allElements) {
      const htmlEl = el as HTMLElement;
      const computedStyle = window.getComputedStyle(htmlEl);
      const bgColor = computedStyle.backgroundColor;
      const color = computedStyle.color;
      const borderColor = computedStyle.borderColor;

      // Check if any color matches
      if (bgColor.includes(targetColor) || color.includes(targetColor) || borderColor.includes(targetColor)) {
        const rect = htmlEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const selector = htmlEl.id
            ? `#${htmlEl.id}`
            : htmlEl.className
            ? `${htmlEl.tagName.toLowerCase()}.${htmlEl.className.split(" ").join(".")}`
            : htmlEl.tagName.toLowerCase();

          results.push({
            selector,
            description: htmlEl.textContent?.trim().slice(0, 100) ?? "",
            visible: computedStyle.display !== "none" && computedStyle.visibility !== "hidden",
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          });
        }
      }
    }

    return results.slice(0, 10);
  }, hexColor);

  return elements;
}

async function findElementByText(page: Page, text: string): Promise<FoundElement[]> {
  const elements = await page.evaluate((targetText) => {
    const results: Array<{
      selector: string;
      description: string;
      visible: boolean;
      bounds: { x: number; y: number; width: number; height: number };
    }> = [];

    // Find elements containing the text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.textContent?.toLowerCase().includes(targetText.toLowerCase())) {
        textNodes.push(node);
      }
    }

    for (const textNode of textNodes.slice(0, 10)) {
      const parent = textNode.parentElement;
      if (parent) {
        const htmlEl = parent as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(htmlEl);

        if (rect.width > 0 && rect.height > 0) {
          const selector = htmlEl.id
            ? `#${htmlEl.id}`
            : htmlEl.className
            ? `${htmlEl.tagName.toLowerCase()}.${htmlEl.className.split(" ").join(".")}`
            : htmlEl.tagName.toLowerCase();

          results.push({
            selector,
            description: htmlEl.textContent?.trim().slice(0, 100) ?? "",
            visible: computedStyle.display !== "none" && computedStyle.visibility !== "hidden",
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          });
        }
      }
    }

    return results;
  }, text);

  return elements;
}

async function findElementByAriaLabel(page: Page, label: string): Promise<FoundElement[]> {
  const elements = await page.evaluate((targetLabel) => {
    const results: Array<{
      selector: string;
      description: string;
      visible: boolean;
      bounds: { x: number; y: number; width: number; height: number };
    }> = [];

    const allElements = document.querySelectorAll(`[aria-label*="${targetLabel}" i]`);
    for (const el of allElements) {
      const htmlEl = el as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(htmlEl);

      if (rect.width > 0 && rect.height > 0) {
        const selector = htmlEl.id
          ? `#${htmlEl.id}`
          : `[aria-label="${htmlEl.getAttribute("aria-label")}"]`;

        results.push({
          selector,
          description: htmlEl.getAttribute("aria-label") ?? "",
          visible: computedStyle.display !== "none" && computedStyle.visibility !== "hidden",
          bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }
    }

    return results.slice(0, 10);
  }, label);

  return elements;
}

async function findSection(page: Page, sectionName: string): Promise<FoundElement[]> {
  const elements = await page.evaluate((targetSection) => {
    const results: Array<{
      selector: string;
      description: string;
      visible: boolean;
      bounds: { x: number; y: number; width: number; height: number };
    }> = [];

    // Look for section-like elements
    const sectionSelectors = [
      "section",
      "div[id]",
      "div[class]",
      "header",
      "footer",
      "nav",
      "main",
      "article",
      "aside",
    ];

    for (const selector of sectionSelectors) {
      const sections = document.querySelectorAll(selector);
      for (const section of sections) {
        const htmlEl = section as HTMLElement;
        const text = htmlEl.textContent?.toLowerCase() ?? "";
        const id = htmlEl.id?.toLowerCase() ?? "";
        const className = htmlEl.className?.toLowerCase() ?? "";

        if (
          text.includes(targetSection.toLowerCase()) ||
          id.includes(targetSection.toLowerCase()) ||
          className.includes(targetSection.toLowerCase())
        ) {
          const rect = htmlEl.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(htmlEl);

          if (rect.width > 0 && rect.height > 0) {
            const selectorStr = htmlEl.id
              ? `#${htmlEl.id}`
              : htmlEl.className
              ? `${htmlEl.tagName.toLowerCase()}.${htmlEl.className.split(" ").join(".")}`
              : htmlEl.tagName.toLowerCase();

            results.push({
              selector: selectorStr,
              description: htmlEl.textContent?.trim().slice(0, 100) ?? "",
              visible: computedStyle.display !== "none" && computedStyle.visibility !== "hidden",
              bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            });
          }
        }
      }
    }

    return results.slice(0, 5);
  }, sectionName);

  return elements;
}

async function findAllImages(page: Page): Promise<FoundElement[]> {
  const elements = await page.evaluate(() => {
    const results: Array<{
      selector: string;
      description: string;
      visible: boolean;
      bounds: { x: number; y: number; width: number; height: number };
    }> = [];

    const images = document.querySelectorAll("img");
    for (const img of images) {
      const htmlEl = img as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(htmlEl);

      if (rect.width > 0 && rect.height > 0) {
        const selector = htmlEl.id
          ? `#${htmlEl.id}`
          : img.src
          ? `img[src*="${img.src.split("/").pop()}"]`
          : "img";

        results.push({
          selector,
          description: img.alt ?? img.title ?? "",
          visible: computedStyle.display !== "none" && computedStyle.visibility !== "hidden",
          bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }
    }

    return results.slice(0, 20);
  });

  return elements;
}

// ─── Page Content Extraction ────────────────────────────────────

interface PageContent {
  title: string;
  text: string;
  links: Array<{ text: string; href: string }>;
  headings: Array<{ level: number; text: string }>;
  forms: Array<{ action: string; fields: string[] }>;
  images: Array<{ src: string; alt: string }>;
}

async function extractPageContent(page: Page): Promise<PageContent> {
  return page.evaluate(() => {
    const title = document.title;

    // Extract main text content
    const body = document.body;
    const text = body?.innerText?.slice(0, 10000) ?? "";

    // Extract links
    const links = Array.from(document.querySelectorAll("a[href]"))
      .slice(0, 50)
      .map((a) => ({
        text: (a as HTMLAnchorElement).textContent?.trim().slice(0, 100) ?? "",
        href: (a as HTMLAnchorElement).href,
      }));

    // Extract headings
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))
      .map((h) => ({
        level: parseInt(h.tagName.charAt(1)),
        text: h.textContent?.trim().slice(0, 200) ?? "",
      }));

    // Extract forms
    const forms = Array.from(document.querySelectorAll("form"))
      .map((form) => ({
        action: form.action,
        fields: Array.from(form.querySelectorAll("input, textarea, select"))
          .map((field) => {
            const htmlField = field as HTMLInputElement;
            return htmlField.name ?? htmlField.placeholder ?? htmlField.type ?? "unknown";
          }),
      }));

    // Extract images
    const images = Array.from(document.querySelectorAll("img"))
      .slice(0, 20)
      .map((img) => ({
        src: (img as HTMLImageElement).src,
        alt: (img as HTMLImageElement).alt ?? "",
      }));

    return { title, text, links, headings, forms, images };
  });
}

// ─── TTS ────────────────────────────────────────────────────────

function speakText(text: string): boolean {
  const platform = process.platform;

  try {
    if (platform === "linux") {
      // Try espeak-ng first, then espeak
      const result = execSync(
        `echo ${JSON.stringify(text)} | espeak-ng -v en-us 2>/dev/null || echo ${JSON.stringify(text)} | espeak -v en-us 2>/dev/null`,
        { timeout: 10000, stdio: "pipe" }
      );
      return true;
    }

    if (platform === "win32") {
      // Use PowerShell speech synthesis
      execSync(
        `powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${text.replace(/'/g, "''")}')"`,
        { timeout: 10000, stdio: "pipe" }
      );
      return true;
    }

    if (platform === "darwin") {
      execSync(`say "${text.replace(/"/g, '\\"')}"`, { timeout: 10000, stdio: "pipe" });
      return true;
    }
  } catch {
    // TTS not available
  }

  return false;
}

// ─── Intent Parsing ─────────────────────────────────────────────

interface AccessibilityIntent {
  action: "click" | "scroll" | "read" | "find" | "describe" | "list";
  target: string | undefined;
  color: string | undefined;
  text: string | undefined;
  ariaLabel: string | undefined;
  section: string | undefined;
}

function parseAccessibilityIntent(input: string): AccessibilityIntent | null {
  const lower = input.toLowerCase();

  // Click by aria-label (most specific — check first)
  const clickAriaMatch = lower.match(/(?:click|tap|press)\s+(?:the\s+)?(?:element\s+)?(?:with\s+)?aria[-\s]label\s+["']?(.+?)["']?\s*$/i);
  if (clickAriaMatch) {
    return {
      action: "click",
      color: undefined,
      target: undefined,
      text: undefined,
      ariaLabel: clickAriaMatch[1]?.trim(),
      section: undefined,
    };
  }

  // Click by text — capture from original input to preserve case
  const clickTextMatch = lower.match(/(?:click|tap|press)\s+(?:the\s+)?(?:button|link|element)?\s*(?:that\s+says?|with\s+text|labeled?)\s+["']?(.+?)["']?\s*$/i);
  if (clickTextMatch) {
    const textMatch = input.match(/(?:click|tap|press)\s+(?:the\s+)?(?:button|link|element)?\s*(?:that\s+says?|with\s+text|labeled?)\s+["']?(.+?)["']?\s*$/i);
    return {
      action: "click",
      color: undefined,
      target: undefined,
      text: textMatch?.[1]?.trim() ?? clickTextMatch[1]?.trim(),
      ariaLabel: undefined,
      section: undefined,
    };
  }

  // Click by color
  const clickColorMatch = lower.match(/(?:click|tap|press)\s+(?:the\s+)?(\w+)\s+(button|link|element|icon|image)/i);
  if (clickColorMatch) {
    return {
      action: "click",
      color: clickColorMatch[1],
      target: clickColorMatch[2],
      text: undefined,
      ariaLabel: undefined,
      section: undefined,
    };
  }

  // Scroll to section (check before scroll direction)
  const scrollSectionMatch = lower.match(/scroll\s+(?:down\s+)?to\s+(?:the\s+)?(.+?)(?:\s+section)?$/i);
  if (scrollSectionMatch) {
    const section = scrollSectionMatch[1]?.trim().replace(/\s+section$/, "");
    return {
      action: "scroll",
      color: undefined,
      target: undefined,
      text: undefined,
      ariaLabel: undefined,
      section,
    };
  }

  // Scroll direction
  if (/scroll\s+down/i.test(lower)) {
    return { action: "scroll", color: undefined, target: "down", text: undefined, ariaLabel: undefined, section: undefined };
  }
  if (/scroll\s+up/i.test(lower)) {
    return { action: "scroll", color: undefined, target: "up", text: undefined, ariaLabel: undefined, section: undefined };
  }

  // Read page
  if (/read\s+(?:this\s+)?(?:the\s+)?(?:page\s+)?(?:aloud|out\s+loud|to\s+me)/i.test(lower)) {
    return { action: "read", color: undefined, target: undefined, text: undefined, ariaLabel: undefined, section: undefined };
  }

  // Find elements
  const findMatch = lower.match(/find\s+(?:all\s+)?(?:the\s+)?(\w+)\s*(?:elements?|images?|buttons?|links?)?/i);
  if (findMatch) {
    return {
      action: "find",
      color: undefined,
      target: findMatch[1]?.trim(),
      text: undefined,
      ariaLabel: undefined,
      section: undefined,
    };
  }

  // Describe page
  if (/what('s| is)\s+(?:on\s+)?(?:this\s+)?page|describe\s+(?:this\s+)?page/i.test(lower)) {
    return { action: "describe", color: undefined, target: undefined, text: undefined, ariaLabel: undefined, section: undefined };
  }

  // List elements
  if (/list\s+(?:all\s+)?(?:the\s+)?(?:links|buttons|images|forms|headings)/i.test(lower)) {
    return { action: "list", color: undefined, target: lower.includes("links") ? "links" : lower.includes("buttons") ? "buttons" : lower.includes("images") ? "images" : lower.includes("forms") ? "forms" : "headings", text: undefined, ariaLabel: undefined, section: undefined };
  }

  return null;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(click|scroll|read|find|describe|list|blue|red|green|button|section|page|aloud|aria|label)\b/i;

export function createAccessibilityVoiceService(): Service {
  return {
    name: "accessibility-voice",
    description: "Accessibility voice control — find elements by color/label, scroll to sections, read pages aloud",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      try {
        const intent = parseAccessibilityIntent(input);
        if (!intent) {
          return { text: "Could not parse accessibility command. Try: 'click the blue button', 'scroll to pricing', 'read this page aloud'" };
        }

        // For now, return a description of what would be done
        // In a real implementation, this would interact with the browser
        const response = [
          `**Accessibility Command:**`,
          `Action: ${intent.action}`,
          intent.color ? `Color: ${intent.color}` : "",
          intent.text ? `Text: ${intent.text}` : "",
          intent.ariaLabel ? `Aria-label: ${intent.ariaLabel}` : "",
          intent.section ? `Section: ${intent.section}` : "",
          intent.target ? `Target: ${intent.target}` : "",
          "",
          `*Note: This command requires browser integration. Use the browser control service for actual interaction.*`,
        ].filter(Boolean).join("\n");

        return { text: response };
      } catch (e) {
        return { text: `Accessibility error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}

// ─── Exports ────────────────────────────────────────────────────

export {
  parseAccessibilityIntent,
  findElementByColor,
  findElementByText,
  findElementByAriaLabel,
  findSection,
  findAllImages,
  extractPageContent,
  speakText,
  type AccessibilityIntent,
  type FoundElement,
  type PageContent,
};
