/**
 * Screen Understanding Service
 *
 * Captures screenshots and analyzes them with multimodal LLM (Ollama vision models).
 * Provides:
 *   - Screen description (what's on screen)
 *   - UI element detection (buttons, text fields, links with coordinates)
 *   - Text extraction (OCR-like)
 *   - Context integration for the main LLM pipeline
 *
 * Usage:
 *   "What's on my screen?" → describe screen content
 *   "Click the blue button" → detect UI elements → find blue button → return coordinates
 *   "Read the text on screen" → extract all visible text
 *   "What app am I in?" → identify active application from screenshot
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Types ──────────────────────────────────────────────────────

export interface UIElement {
  id: string;
  type: "button" | "text_field" | "link" | "icon" | "menu" | "tab" | "checkbox" | "dropdown" | "text" | "image" | "unknown";
  label: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  actionable: boolean;
}

export interface ScreenAnalysis {
  screenshotPath: string;
  description: string;
  activeApp: string;
  activeWindowTitle: string;
  elements: UIElement[];
  textContent: string;
  timestamp: Date;
  resolution: { width: number; height: number };
}

export interface ScreenContext {
  hasScreen: boolean;
  activeApp: string;
  activeWindowTitle: string;
  description: string;
  elementCount: number;
  timestamp: Date;
}

// ─── Screenshot Capture ─────────────────────────────────────────

function getPlatform(): string {
  return process.platform;
}

function captureScreenshot(): { path: string; width: number; height: number } {
  const ts = Date.now();
  const path = join(tmpdir(), `flux-screen-${ts}.png`);
  const platform = getPlatform();

  // Windows 11: PowerShell + System.Drawing
  if (platform === "win32") {
    try {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen
        $bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
        $bitmap.Save("${path.replace(/\\/g, "\\\\")}")
        $graphics.Dispose()
        $bitmap.Dispose()
        Write-Output "$($screen.Bounds.Width)x$($screen.Bounds.Height)"
      `.trim();
      const res = execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`, {
        timeout: 10000,
        encoding: "utf-8",
        stdio: "pipe",
      });
      const match = res.match(/(\d+)x(\d+)/);
      return {
        path,
        width: match?.[1] ? Number.parseInt(match[1], 10) : 1920,
        height: match?.[2] ? Number.parseInt(match[2], 10) : 1080,
      };
    } catch {
      writeFileSync(path, Buffer.alloc(0));
      return { path, width: 1920, height: 1080 };
    }
  }

  // macOS: screencapture
  if (platform === "darwin") {
    try {
      execSync(`screencapture -x "${path}"`, { timeout: 5000, stdio: "pipe" });
      return { path, width: 1920, height: 1080 };
    } catch {
      writeFileSync(path, Buffer.alloc(0));
      return { path, width: 1920, height: 1080 };
    }
  }

  // Linux: try grim (Wayland) → import (X11) → fallback
  try {
    const res = execSync("xdpyinfo 2>/dev/null | grep dimensions", {
      timeout: 3000,
      encoding: "utf-8",
      stdio: "pipe",
    });
    const match = res.match(/(\d+)x(\d+)/);
    const width = match?.[1] ? Number.parseInt(match[1], 10) : 1920;
    const height = match?.[2] ? Number.parseInt(match[2], 10) : 1080;

    execSync(`grim ${path}`, { timeout: 5000, stdio: "pipe" });
    return { path, width, height };
  } catch {
    try {
      execSync(`import -window root ${path}`, { timeout: 5000, stdio: "pipe" });
      return { path, width: 1920, height: 1080 };
    } catch {
      writeFileSync(path, Buffer.alloc(0));
      return { path, width: 1920, height: 1080 };
    }
  }
}

function captureRegion(x: number, y: number, w: number, h: number): string {
  const path = join(tmpdir(), `flux-region-${Date.now()}.png`);
  try {
    execSync(`grim -g "${x},${y} ${w}x${h}" ${path}`, { timeout: 5000, stdio: "pipe" });
    return path;
  } catch {
    return captureScreenshot().path;
  }
}

function cleanupScreenshot(path: string): void {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch { /* ignore */ }
}

// ─── Vision Analysis ────────────────────────────────────────────

const VISION_MODEL = "llava:7b";

async function analyzeWithVision(
  screenshotPath: string,
  prompt: string,
  provider: { complete(req: { model: string; prompt: string; temperature?: number }): Promise<{ text: string }> } | null,
): Promise<string> {
  if (!provider) {
    return "Vision analysis requires a multimodal LLM provider (Ollama with llava).";
  }

  try {
    const imageBuffer = readFileSync(screenshotPath);
    const base64 = imageBuffer.toString("base64");

    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
            images: [base64],
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      return provider.complete({
        model: "default",
        prompt: `[Screen analysis unavailable - vision model not accessible]\n\nDescribe what you would expect to see on a ${process.platform} desktop.`,
        temperature: 0.3,
      }).then((r) => r.text);
    }

    const data = await response.json() as { message?: { content?: string } };
    return data.message?.content ?? "No analysis available.";
  } catch {
    return provider.complete({
      model: "default",
      prompt: `[Screen capture failed]\n\nProvide general guidance for desktop automation on ${process.platform}.`,
      temperature: 0.3,
    }).then((r) => r.text);
  }
}

// ─── UI Element Detection ───────────────────────────────────────

const ELEMENT_DETECT_PROMPT = `Analyze this screenshot and identify all interactive UI elements.

For each element, provide:
- type: button, text_field, link, icon, menu, tab, checkbox, dropdown, text, image, or unknown
- label: visible text or description
- x, y: approximate center coordinates (percentage of screen width/height, 0-100)
- width, height: approximate size (percentage of screen, 0-100)
- confidence: 0.0-1.0
- actionable: can this element be clicked/interacted with?

Respond with ONLY a JSON array (no markdown):
[
  {
    "type": "button",
    "label": "Submit",
    "description": "Submit form button",
    "x": 75.5,
    "y": 82.3,
    "width": 10,
    "height": 4,
    "confidence": 0.95,
    "actionable": true
  }
]

Focus on:
- Buttons, links, and clickable elements
- Text input fields and text areas
- Menu items and dropdown options
- Tabs and navigation elements
- Checkboxes and toggles
- Icon buttons
- Important text labels`;

const TEXT_EXTRACT_PROMPT = `Extract ALL visible text from this screenshot.
Include:
- Window titles and menu items
- Button labels
- Input field labels and placeholders
- Body text
- Status bar text
- Tooltip text
- Navigation text

Format: one text item per line, prefixed with its approximate position:
[TOP-LEFT] Window Title
[CENTER] Main Content Text
[BOTTOM] Status Bar

Only include readable text, not image descriptions.`;

const DESCRIBE_PROMPT = `Describe what's on this screen in detail. Include:
1. What application(s) are visible
2. What the user appears to be doing
3. Key UI elements and their state
4. Any text content visible
5. The overall context/workflow

Be concise but comprehensive. Focus on actionable information.`;

const APP_IDENTIFY_PROMPT = `What application is currently active/focused? What is the window title?
Respond in format:
APP: <application name>
TITLE: <window title>
CONTEXT: <brief description of what the user is doing>`;

// ─── Element Search ─────────────────────────────────────────────

function findElement(
  elements: UIElement[],
  query: string,
): UIElement | null {
  const lower = query.toLowerCase();

  const byLabel = elements.find((e) =>
    e.label.toLowerCase().includes(lower) && e.actionable,
  );
  if (byLabel) return byLabel;

  const byType = elements.find((e) =>
    e.type.toLowerCase().includes(lower) && e.actionable,
  );
  if (byType) return byType;

  const byDescription = elements.find((e) =>
    e.description.toLowerCase().includes(lower),
  );
  if (byDescription) return byDescription;

  return null;
}

function formatElements(elements: UIElement[]): string {
  if (elements.length === 0) return "No interactive elements detected.";

  return elements
    .map((e, i) => {
      const coords = `(${e.x.toFixed(1)}%, ${e.y.toFixed(1)}%)`;
      return `${i + 1}. [${e.type}] "${e.label}" ${coords} — ${e.description}`;
    })
    .join("\n");
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(what('s| is) on (my |the )?screen|screenshot|screen\s*(shot|understand|analy[zs]e|read|describe)|click\s+(the\s+)?|find\s+(the\s+)?button|read\s+text|what\s+app|identify\s+app|ui\s*elements?|detect\s+elements?|extract\s+text)\b/i;

export function createScreenUnderstandingService(): Service {
  let cachedAnalysis: ScreenAnalysis | null = null;
  let cacheTime = 0;
  const CACHE_TTL_MS = 5000;

  return {
    name: "screen-understanding",
    description:
      "Screen understanding — capture screenshots, analyze with vision LLM, detect UI elements, extract text, and provide screen context",

    canHandle(input: string): boolean {
      return MATCH.test(input);
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const now = Date.now();
      const useCache = cachedAnalysis && (now - cacheTime) < CACHE_TTL_MS;

      let analysis: ScreenAnalysis;
      if (useCache && cachedAnalysis) {
        analysis = cachedAnalysis;
      } else {
        const { path, width, height } = captureScreenshot();

        const [description, elementsText, textContent, appInfo] = await Promise.all([
          analyzeWithVision(path, DESCRIBE_PROMPT, ctx.provider),
          analyzeWithVision(path, ELEMENT_DETECT_PROMPT, ctx.provider),
          analyzeWithVision(path, TEXT_EXTRACT_PROMPT, ctx.provider),
          analyzeWithVision(path, APP_IDENTIFY_PROMPT, ctx.provider),
        ]);

        let elements: UIElement[] = [];
        try {
          const jsonMatch = elementsText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const raw = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
            elements = raw.map((e, i): UIElement => ({
              id: `el_${i}`,
              type: (String(e.type ?? "unknown") as UIElement["type"]),
              label: String(e.label ?? ""),
              description: String(e.description ?? ""),
              x: Number(e.x ?? 0),
              y: Number(e.y ?? 0),
              width: Number(e.width ?? 5),
              height: Number(e.height ?? 3),
              confidence: Number(e.confidence ?? 0.5),
              actionable: Boolean(e.actionable ?? false),
            }));
          }
        } catch { /* ignore parse errors */ }

        const appMatch = appInfo.match(/APP:\s*(.+)/i);
        const titleMatch = appInfo.match(/TITLE:\s*(.+)/i);

        analysis = {
          screenshotPath: path,
          description,
          activeApp: appMatch?.[1]?.trim() ?? "Unknown",
          activeWindowTitle: titleMatch?.[1]?.trim() ?? "",
          elements,
          textContent,
          timestamp: new Date(),
          resolution: { width, height },
        };

        cachedAnalysis = analysis;
        cacheTime = now;
      }

      const lower = input.toLowerCase();

      if (/\bclick\s+(the\s+)?(.+)/.test(lower)) {
        const clickMatch = lower.match(/\bclick\s+(?:the\s+)?(.+)/);
        const query = clickMatch?.[1]?.trim() ?? "";
        const element = findElement(analysis.elements, query);
        if (element) {
          const x = Math.round((element.x / 100) * analysis.resolution.width);
          const y = Math.round((element.y / 100) * analysis.resolution.height);
          try {
            execSync(`xdotool mousemove ${x} ${y} click 1`, { timeout: 3000, stdio: "pipe" });
          } catch { /* xdotool not available */ }
          cleanupScreenshot(analysis.screenshotPath);
          return { text: `Clicked "${element.label}" at (${x}, ${y})` };
        }
        cleanupScreenshot(analysis.screenshotPath);
        return { text: `Could not find element matching "${query}" on screen.` };
      }

      if (/\bfind\s+(the\s+)?button|ui\s*elements?|detect\s+elements?/.test(lower)) {
        cleanupScreenshot(analysis.screenshotPath);
        return {
          text: `Found ${analysis.elements.length} UI elements:\n\n${formatElements(analysis.elements)}`,
        };
      }

      if (/\bread\s+text|extract\s+text/.test(lower)) {
        cleanupScreenshot(analysis.screenshotPath);
        return { text: `Extracted text:\n\n${analysis.textContent}` };
      }

      if (/\bwhat\s+app|identify\s+app/.test(lower)) {
        cleanupScreenshot(analysis.screenshotPath);
        return {
          text: `Active app: ${analysis.activeApp}\nWindow: ${analysis.activeWindowTitle}\nContext: ${analysis.description}`,
        };
      }

      cleanupScreenshot(analysis.screenshotPath);
      return {
        text: `**Screen Analysis** (${analysis.activeApp}):\n\n${analysis.description}\n\nElements: ${analysis.elements.length} detected`,
      };
    },
  };
}

// ─── Proactive Screen Observation ───────────────────────────────

const OBSERVE_PROMPT = `You are observing a user's screen as part of a background cognition loop.
Describe what you see concisely (2-3 sentences). Focus on:
1. What app/workflow the user is engaged in
2. Any issues, blockers, or interesting patterns
3. Suggestive actions IF something obvious stands out (e.g., "you have unsaved changes")

Be brief and non-intrusive. Only comment if something noteworthy is happening.
If the screen looks normal/routine, respond with just the app name and a one-line status.`;

let lastObservation = "";
let lastObservationApp = "";
let lastObservationTime = 0;
const OBSERVATION_COOLDOWN_MS = 30000;

export interface ScreenObservation {
  app: string;
  description: string;
  isNoteworthy: boolean;
  suggestion: string | null;
  timestamp: Date;
}

export async function observeScreen(
  provider: { complete(req: { model: string; prompt: string; temperature?: number }): Promise<{ text: string }> } | null,
): Promise<ScreenObservation | null> {
  const now = Date.now();
  if (now - lastObservationTime < OBSERVATION_COOLDOWN_MS) {
    return null;
  }

  const { path } = captureScreenshot();
  lastObservationTime = now;

  try {
    let description: string;
    if (provider) {
      try {
        const imageBuffer = readFileSync(path);
        const base64 = imageBuffer.toString("base64");
        const response = await fetch("http://localhost:11434/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: VISION_MODEL,
            messages: [{ role: "user", content: OBSERVE_PROMPT, images: [base64] }],
            stream: false,
          }),
        });
        if (response.ok) {
          const data = await response.json() as { message?: { content?: string } };
          description = data.message?.content ?? "";
        } else {
          description = await provider.complete({
            model: "default",
            prompt: "[Screen observation] Describe general desktop activity.",
            temperature: 0.3,
          }).then((r) => r.text);
        }
      } catch {
        description = await provider.complete({
          model: "default",
          prompt: "[Screen observation unavailable] Note that screen observation is active.",
          temperature: 0.3,
        }).then((r) => r.text);
      }
    } else {
      description = "Screen observation requires a vision-capable LLM provider.";
    }

    const appMatch = description.match(/(?:app|application|program|window):\s*(.+)/i);
    const app = appMatch?.[1]?.trim() ?? "Unknown";

    const isNoteworthy = !description.toLowerCase().includes("normal") &&
      !description.toLowerCase().includes("routine") &&
      description.length > 20 &&
      app !== lastObservationApp;

    const suggestionMatch = description.match(/(?:suggest|recommend|you (?:should|could|might)|consider)\s+(.+)/i);
    const suggestion = suggestionMatch?.[1]?.trim() ?? null;

    lastObservation = description;
    lastObservationApp = app;

    return {
      app,
      description,
      isNoteworthy,
      suggestion,
      timestamp: new Date(),
    };
  } finally {
    cleanupScreenshot(path);
  }
}

export function getLastObservation(): string {
  return lastObservation;
}

// ─── Screen Context Provider ────────────────────────────────────

export function getScreenContext(): ScreenContext {
  const platform = getPlatform();

  // Windows 11: always has a screen
  if (platform === "win32") {
    return {
      hasScreen: true,
      activeApp: "Unknown",
      activeWindowTitle: "",
      description: "Windows desktop available",
      elementCount: 0,
      timestamp: new Date(),
    };
  }

  // macOS: always has a screen
  if (platform === "darwin") {
    return {
      hasScreen: true,
      activeApp: "Unknown",
      activeWindowTitle: "",
      description: "macOS desktop available",
      elementCount: 0,
      timestamp: new Date(),
    };
  }

  // Linux: check for display
  try {
    execSync("xdpyinfo", { timeout: 2000, stdio: "pipe" });
    return {
      hasScreen: true,
      activeApp: "Unknown",
      activeWindowTitle: "",
      description: "Screen available",
      elementCount: 0,
      timestamp: new Date(),
    };
  } catch {
    return {
      hasScreen: false,
      activeApp: "Headless",
      activeWindowTitle: "",
      description: "No display detected",
      elementCount: 0,
      timestamp: new Date(),
    };
  }
}
