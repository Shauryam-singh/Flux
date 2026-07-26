// Priority-ordered rules. First match wins.
// Each rule: [regex, service name]
const RULES: [RegExp, string][] = [
  // ── Notifications (highest priority — alert commands) ──
  [/^(send|create|new|add)\s+(a\s+)?(notification|alert|notify)/i, "notifications"],
  [/^(show|list|view|get|what('s| did))\s*(my\s+)?(unread\s+)?(notifications?|alerts?|messages?)/i, "notifications"],
  [/^(what did i miss|any alerts|unread)/i, "notifications"],
  [/^(mark|set)\s+(all\s+)?(as\s+)?read/i, "notifications"],
  [/^(clear|dismiss|delete)\s+(all\s+)?(notifications?|alerts?)/i, "notifications"],
  [/^(speak|read aloud|tell me)\s+(my\s+)?(unread\s+)?(notifications?|alerts?)/i, "notifications"],

  // ── Monitor (system health commands) ──
  [/^(show|list|get|what)\s+(my\s+)?(monitor\s+)?(rules?|watches?|alerts?|thresholds?)/i, "monitor"],
  [/^(add|create|set|new)\s+(a\s+)?monitor/i, "monitor"],
  [/^(remove|delete|disable)\s+(rule|monitor|watch)\s*(\d+)?/i, "monitor"],
  [/^(enable|disable)\s+(rule|monitor|watch)\s*(\d+)?/i, "monitor"],
  [/^(check|scan|status|health)$/i, "monitor"],

  // ── Automations (trigger→action rules) ──
  [/^(show|list|get|what)\s+(my\s+)?(automations?|chains?|rules?)/i, "automations"],
  [/^(add|create|new|set)\s+(an?\s+)?automation/i, "automations"],
  [/^(remove|delete|disable)\s+(automation|chain|rule)\s*(\d+)?/i, "automations"],
  [/^(enable|disable)\s+(automation|chain|rule)\s*(\d+)?/i, "automations"],
  [/^(run|trigger|execute)\s+(automation|chain|rule)\s*(\d+)?/i, "automations"],
  [/^(automate|every\s+|when\s+|at\s+)/i, "automations"],

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

  // ── Search (factual questions — NOT identity/conversation) ──
  // Exclude: who are you, what's your name, how are you, etc.
  [/^(search|look\s*up|find|google|research)\s+/i, "search"],
  [/^(tell\s+me\s+about|explain|describe)\s+/i, "search"],
  [/^(what|where|when|why|how)\s+(is|are|was|were|do|does|did|can|could|should|would)\s+(?!you\b|your\b|about you)/i, "search"],
  // "who" questions that are NOT "who are you" — search for facts
  [/^who\s+(is|are|was|were)\s+(?!you\b|your\b)/i, "search"],
  // "what is" for things — but not "what's your name"
  [/^(what('s| is| are))\s+(?!you\b|your\b|up\b|going on\b|happening\b)/i, "search"],
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
