// Priority-ordered rules. First match wins.
// Each rule: [regex, service name]
const RULES: [RegExp, string][] = [
  // ── Reminders: task-specific "open" (before system "open") ──
  [/^(open|show|list)\s+(my\s+)?(open\s+)?(reminders?|notes?|tasks?|todos?)/i, "reminders"],

  // ── System (highest priority — action commands) ──
  [/^(open|launch|start|run)\s+\S+/i, "system"],
  [/^(close|quit|kill)\s+\S+/i, "system"],
  [/^(set|change|adjust)\s+(volume|brightness)/i, "system"],
  [/^(get|show|what)\s+(volume|brightness)/i, "system"],
  [/^(show|get|what)\s+(system\s+info|hostname|uptime|cpu|memory|disk|battery|wifi|bluetooth|kernel|platform|info)/i, "system"],
  [/^(what|how)\s+(is|about)\s+(my\s+|the\s+)?(uptime|hostname|cpu|memory|disk|battery|system)/i, "system"],
  [/^(system\s+info|hostname|uptime|kernel)$/i, "system"],
  [/^(shutdown|restart|reboot|sleep|lock|suspend)/i, "system"],
  [/^(screenshot|take\s+(a\s+)?screenshot)/i, "system"],

  // ── Search (question patterns) ──
  [/^(search|look\s*up|find|google|research)\s+/i, "search"],
  [/^(tell\s+me\s+about|explain|describe)\s+/i, "search"],
  [/^(what|who|where|when|why|how)\s+(is|are|was|were|do|does|did|can|could|should|would)/i, "search"],
  [/^(latest|current|recent|news)\s+/i, "search"],

  // ── Coding (code actions — before general "create" in reminders) ──
  [/^(create|write|make|generate)\s+(a\s+)?(\w+\s+)*(file|function|class|component|module|script|test|project|app|application|website|page)/i, "coding"],
  [/^(edit|modify|update|change|fix|debug|refactor)\s+(\w+\s+)*(file|function|code|bug|error|issue|problem|module|component|service|test|class|app)/i, "coding"],
  [/^(git|commit|push|pull|branch|merge|checkout|status|diff|log)\s*/i, "coding"],
  [/^(run|execute|build|compile|test|lint|format)\s+(the\s+)?(project|code|tests?|script|command)/i, "coding"],
  [/^(read|show|cat)\s+(the\s+)?file/i, "coding"],

  // ── Reminders (task/note commands — general "create" after coding) ──
  [/^(add|create|new|save)\s+(a\s+)?(reminder|note|task|todo)/i, "reminders"],
  [/^(add|create|new|save)\s+(a\s+)?\w+/i, "reminders"],
  [/^(list|show)\s+(my\s+)?(open\s+)?(reminders?|notes?|tasks?|todos?)/i, "reminders"],
  [/^(my\s+)?(open\s+)?(reminders?|notes?|tasks?|todos?)\s*$/i, "reminders"],
  [/^(show|list)\s+my\s+/i, "reminders"],
  [/^(complete|done|finish|mark)\s+(a\s+)?(task|reminder|todo)/i, "reminders"],
  [/^(delete|remove|clear)\s+(a\s+)?(task|reminder|note|todo)/i, "reminders"],
  [/^(remind\s+me|remember)\s+/i, "reminders"],
];

export function classifyIntent(input: string): string | null {
  const trimmed = input.trim();

  for (const [regex, service] of RULES) {
    if (regex.test(trimmed)) {
      return service;
    }
  }

  return null;
}
