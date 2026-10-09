import { describe, expect, it } from "vitest";
import { parseIntentOutput } from "../impl/llm-intent-classifier.js";

describe("parseIntentOutput", () => {
  it("parses terse pipe-lines", () => {
    const result = parseIntentOutput("system|open notepad");
    expect(result).toEqual([{ service: "system", command: "open notepad" }]);
  });

  it("parses multi-command pipe-lines in order", () => {
    const result = parseIntentOutput(
      "system|open notepad\nvs-code|open vs code\nbrowser-control|search javascript one shot video on yt",
    );
    expect(result).toHaveLength(3);
    expect(result?.[0]).toEqual({ service: "system", command: "open notepad" });
    expect(result?.[2]).toEqual({
      service: "browser-control",
      command: "search javascript one shot video on yt",
    });
  });

  it("normalizes service aliases", () => {
    expect(parseIntentOutput("vscode|open editor")).toEqual([
      { service: "vs-code", command: "open editor" },
    ]);
    expect(parseIntentOutput("youtube|open youtube")).toEqual([
      { service: "browser-control", command: "open youtube" },
    ]);
  });

  it("returns [] for bare chat markers (just chatting)", () => {
    expect(parseIntentOutput("chat")).toEqual([]);
    expect(parseIntentOutput("chat\n")).toEqual([]);
    expect(parseIntentOutput(`${openThink}hmm${closeThink}chat`)).toEqual([]);
    expect(parseIntentOutput(`${openThink}nothing after`)).toBeNull();
  });

  it("falls back to JSON arrays when the model ignores the format", () => {
    const result = parseIntentOutput(
      '[{"service":"system","command":"open notepad"}]',
    );
    expect(result).toEqual([{ service: "system", command: "open notepad" }]);
  });

  it("repairs single quotes and trailing commas in JSON fallback", () => {
    const result = parseIntentJsonFallbackStyle(
      "[{'service':'spotify','command':'play music'},]",
    );
    expect(result).toEqual([{ service: "spotify", command: "play music" }]);
  });

  it("returns null for garbage output so caller falls back", () => {
    expect(parseIntentOutput("response")).toBeNull();
    expect(parseIntentOutput("")).toBeNull();
    expect(parseIntentOutput("I would open notepad for you")).toBeNull();
  });
});

const openThink = "\u003cthink\u003e";
const closeThink = "\u003c/think\u003e";

// JSON fallback path is exercised through the same public entry point
function parseIntentJsonFallbackStyle(raw: string) {
  return parseIntentOutput(`${openThink}prose${closeThink}${raw}`);
}
