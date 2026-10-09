import type { LlmProvider } from "../interfaces/service-context.js";

// ─── LLM-based intent classification ─────────────────────────────────────────
// The model itself decides the intent (no regex routing). One fast call to a
// small local model returns an ordered list of actions, which also solves
// multi-command inputs ("open notepad then vs code and search X on youtube").
//
// Latency on a local 3B model is ~0.8-1.1s (typical <1s); a 0.5B model can be
// selected via FLUX_INTENT_MODEL but trades reliability for speed.
//
// Design:
// - Input is embedded in the system message and the model is asked to
//   "classify" — inverted framing stops small models from answering the user
//   conversationally instead of emitting the action list.
// - Terse "service|command" line output costs ~3x fewer tokens than JSON.
// - Consecutive same-service steps are de-duplicated; steps whose command text
//   isn't grounded in the user's input are dropped, and unparseable/timeout
//   results return null so the caller can fall back to the keyword router.

export interface LlmIntentAction {
  readonly service: string;
  readonly command: string;
}

export interface LlmIntentOptions {
  /** Valid service names (from the registry). Unknown names are dropped. */
  readonly services: readonly string[];
  /** Override the intent model (default: qwen2.5:3b). */
  readonly model?: string;
  /** Hard deadline in ms (default: 1300). */
  readonly timeoutMs?: number;
}

const INTENT_MODEL = process.env.FLUX_INTENT_MODEL || "qwen2.5:3b";
const INTENT_TIMEOUT_MS = Number(process.env.FLUX_INTENT_TIMEOUT_MS ?? 1300);
const INTENT_MAX_TOKENS = Number(process.env.FLUX_INTENT_MAX_TOKENS ?? 96);

// Hints only for names whose purpose isn't obvious from the name itself.
const SERVICE_HINTS: Record<string, string> = {
  system: "open/close apps,volume,battery",
  "vs-code": "editor",
  terminal: "shell",
  "browser-control": "websites,youtube",
  spotify: "music",
  reminders: "tasks,notes",
  coding: "code,git",
  "desktop-control": "windows,screenshot,brightness",
  search: "web facts",
};

function buildPrompt(
  input: string,
  services: readonly string[],
): readonly { role: string; content: string }[] {
  // Only advertise routable services — niche/internal ones stay out of the
  // prompt to save tokens; unknown names in output are dropped anyway.
  const routable = services.filter((s) => s !== "chat");
  const serviceList = routable
    .map((name) => {
      const hint = SERVICE_HINTS[name];
      return hint ? `${name}(${hint})` : name;
    })
    .join(", ");
  const system = `Route THIS user request into ordered steps; reply ONLY lines "<service>|<command>", command copies the user's own words. Conversation/question/smalltalk => chat
SERVICES: chat, ${serviceList}
Ex: "open notepad then vs code and play music" ->
system|open notepad
vs-code|open vs code
spotify|play music
REQUEST: "${input}"`;
  return [
    { role: "system", content: system },
    { role: "user", content: "classify" },
  ];
}

/** Normalize common aliases the model may emit for real service names. */
function normalizeServiceName(raw: string): string {
  const name = raw.toLowerCase().trim().replace(/\s+/g, "-");
  if (["vscode", "vs-code", "code"].includes(name)) return "vs-code";
  if (["youtube", "browser", "web", "web-browser"].includes(name)) return "browser-control";
  if (["shell", "cmd", "command-line"].includes(name)) return "terminal";
  if (["reminder", "task", "todo"].includes(name)) return "reminders";
  if (["screenshot", "desktop"].includes(name)) return "desktop-control";
  if (name === "music") return "spotify";
  return name;
}

function stripWrappers(text: string): string {
  // Remove a leading <think>...</think> block (models that ignore think:false)
  // plus markdown fences. Tags are built from explicit char codes so the
  // source survives any pipeline that mangles literal "<think>" sequences.
  const lower = text.toLowerCase();
  const OPEN = "\u003cthink\u003e";
  const CLOSE = "\u003c/think\u003e";
  const openIdx = lower.indexOf(OPEN);
  const closeIdx = lower.indexOf(CLOSE, openIdx + OPEN.length);
  let stripped = text;
  if (openIdx !== -1 && closeIdx > openIdx) {
    stripped = text.slice(closeIdx + CLOSE.length);
  }
  return stripped.replace(/```/g, "").trim();
}

/**
 * Parse model output into actions. Primary format is terse pipe-lines:
 *   system|open notepad
 * A bare "chat" reply means no action (just chatting) → [].
 * Falls back to JSON arrays ([{"service":"...","command":"..."}]) for models
 * that ignore the format instruction.
 */
export function parseIntentOutput(
  raw: string,
): Array<{ service: string; command: string }> | null {
  const text = stripWrappers(raw);
  if (text.length === 0) return null;

  const actions: Array<{ service: string; command: string }> = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("//") || trimmed.startsWith("#")) continue;

    if (!trimmed.includes("|")) {
      // Bare "chat" marker → no actions; anything else is prose garbage
      if (/^(chat|none|empty|null)$/i.test(trimmed)) continue;
      return parseIntentJsonFallback(text);
    }

    const sep = trimmed.indexOf("|");
    const serviceRaw = trimmed.slice(0, sep);
    const command = trimmed.slice(sep + 1).trim();
    if (serviceRaw.length === 0 || command.length === 0) {
      return parseIntentJsonFallback(text);
    }
    actions.push({ service: normalizeServiceName(serviceRaw), command });
  }

  return actions;
}

function parseIntentJsonFallback(
  text: string,
): Array<{ service: string; command: string }> | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return null;

  let body = text.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    try {
      body = body.replace(/,\s*([\]}])/g, "$1").replace(/'/g, '"');
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;

  const actions: Array<{ service: string; command: string }> = [];
  for (const entry of parsed as Array<Record<string, unknown>>) {
    if (!entry || typeof entry !== "object") continue;
    const serviceRaw = entry.service;
    const commandRaw = entry.command ?? entry.action ?? entry.c;
    if (typeof serviceRaw !== "string" || typeof commandRaw !== "string") continue;
    if (commandRaw.trim().length === 0) continue;
    actions.push({ service: normalizeServiceName(serviceRaw), command: commandRaw.trim() });
  }
  return actions;
}

/** True when the command text is grounded in the user's original words. */
function isGrounded(command: string, input: string): boolean {
  const tokens = command.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return true;
  const haystack = ` ${input.toLowerCase()} `;
  return tokens.some((t) => haystack.includes(t));
}

/**
 * Ask the model to classify input into one or more service actions.
 *
 * Resolves with:
 * - `LlmIntentAction[]` — possibly empty ([] means "just chatting" → chat)
 * - `null` — timeout/error/unparseable → caller falls back to keyword router
 */
export async function classifyIntentsWithLlm(
  input: string,
  provider: LlmProvider,
  options: LlmIntentOptions,
): Promise<LlmIntentAction[] | null> {
  const validServices = new Set(options.services.map((s) => s.toLowerCase()));
  const messages = buildPrompt(input, options.services);

  const timeoutMs = options.timeoutMs ?? INTENT_TIMEOUT_MS;
  const model = options.model ?? INTENT_MODEL;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  const t0 = Date.now();
  try {
    const result = await Promise.race([
      provider.complete({
        model,
        prompt: input,
        messages,
        temperature: 0,
        maxTokens: INTENT_MAX_TOKENS,
      }),
      timeout,
    ]);

    if (!result) {
      console.log(`[intent] llm timeout after ${Date.now() - t0}ms`);
      return null;
    }

    const elapsed = Date.now() - t0;
    const parsed = parseIntentOutput(result.text);
    if (parsed === null) {
      console.log(
        `[intent] llm unparseable (${elapsed}ms) head=${result.text.slice(0, 80).replace(/\n/g, " ")}`,
      );
      return null;
    }

    // Filter to known services, drop ungrounded steps, dedupe consecutive
    const actions: LlmIntentAction[] = [];
    for (const step of parsed) {
      if (!validServices.has(step.service)) continue;
      if (step.service === "chat") continue; // model said chat|... → no action
      if (!isGrounded(step.command, input)) continue;
      const last = actions[actions.length - 1];
      if (last && last.service === step.service && last.command === step.command) continue;
      actions.push({ service: step.service, command: step.command });
    }
    console.log(
      `[intent] llm ok=${elapsed}ms actions=${actions.length} raw=${parsed.length} model=${model}`,
    );
    return actions;
  } catch (err) {
    console.log(
      `[intent] llm error ${err instanceof Error ? err.message : String(err)} (${Date.now() - t0}ms)`,
    );
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}