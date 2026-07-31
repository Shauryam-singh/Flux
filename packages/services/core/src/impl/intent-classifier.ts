// Priority-ordered rules. First match wins.
// Each rule: [regex, service name]
// Rules use \b or flexible matching (no ^) to detect intent anywhere in input.
const RULES: [RegExp, string][] = [
  // ── Notifications (highest priority — alert commands) ──
  [
    /\b(send|create|new|add)\s+(a\s+)?(notification|alert|notify)\b/i,
    "notifications",
  ],
  [
    /\b(show|list|view|get|what('s| did))\s*(my\s+)?(unread\s+)?(notifications?|alerts?|messages?)\b/i,
    "notifications",
  ],
  [/\b(what did i miss|any alerts|unread)\b/i, "notifications"],
  [/\b(mark|set)\s+(all\s+)?(as\s+)?read\b/i, "notifications"],
  [
    /\b(clear|dismiss|delete)\s+(all\s+)?(notifications?|alerts?)\b/i,
    "notifications",
  ],
  [
    /\b(speak|read aloud|tell me)\s+(my\s+)?(unread\s+)?(notifications?|alerts?)\b/i,
    "notifications",
  ],

  // ── Monitor (system health commands) ──
  [
    /\b(show|list|get|what)\s+(my\s+)?(monitor\s+)?(rules?|watches?|alerts?|thresholds?)\b/i,
    "monitor",
  ],
  [/\b(add|create|set|new)\s+(a\s+)?monitor\b/i, "monitor"],
  [/\b(remove|delete|disable)\s+(rule|monitor|watch)\s*(\d+)?\b/i, "monitor"],
  [/\b(enable|disable)\s+(rule|monitor|watch)\s*(\d+)?\b/i, "monitor"],
  [/\b(check|scan|status|health)\b/i, "monitor"],

  // ── Automations (trigger→action rules) ──
  [
    /\b(show|list|get|what)\s+(my\s+)?(automations?|chains?|rules?)\b/i,
    "automations",
  ],
  [/\b(add|create|new|set)\s+(an?\s+)?automation\b/i, "automations"],
  [
    /\b(remove|delete|disable)\s+(automation|chain|rule)\s*(\d+)?\b/i,
    "automations",
  ],
  [/\b(enable|disable)\s+(automation|chain|rule)\s*(\d+)?\b/i, "automations"],
  [/\b(run|trigger|execute)\s+(automation|chain|rule)\s*(\d+)?\b/i, "automations"],
  [/\b(automate|every\s+|when\s+|at\s+)\b/i, "automations"],

  // ── Reminders: personal data overview ("what is my goal", "how are my tasks") ──
  // Must come BEFORE search rules so "what is my goal" doesn't match search.
  [
    /\b(what|how)\s+(is|are|do|does|did)\s+(my|the)\s+(goals?|tasks?|reminders?|notes?|todos?|projects?|schedule|plan|list|progress|status)\b/i,
    "reminders",
  ],
  [
    /\b(any|got|have)\s+(updates?|news?|progress)\s+(on|about|for)\s+(my\s+)?(goals?|tasks?|reminders?|notes?|todos?|projects?)\b/i,
    "reminders",
  ],
  [
    /\b(show|tell|give)\s+me\s+(my\s+)?(goals?|tasks?|reminders?|notes?|todos?|projects?|schedule|progress|status|overview)\b/i,
    "reminders",
  ],
  [
    /\b(am|i|did)\s+(i|we)\s+(finish|complete|done)\s+(the\s+)?(goal|task|reminder|todo|project)\b/i,
    "reminders",
  ],
  [
    /\b(how('s|\s+is|\s+are))\s+(my\s+)?(goal|task|project|progress)\b/i,
    "reminders",
  ],

  // ── Reminders: task-specific "open" (before system "open") ──
  [
    /\b(open|show|list)\s+(my\s+)?(open\s+)?(reminders?|notes?|tasks?|todos?)\b/i,
    "reminders",
  ],

  // ── Coding (code actions — BEFORE system so "run tests" → coding not system) ──
  [
    /\b(create|write|make|generate)\s+(a\s+)?(\w+\s+)*(file|function|class|component|module|script|test|project|app|application|website|page)\b/i,
    "coding",
  ],
  [
    /\b(edit|modify|update|change|fix|debug|refactor)\s+(\w+\s+)*(file|function|code|bug|error|issue|problem|module|component|service|test|class|app)\b/i,
    "coding",
  ],
  [
    /\b(git|commit|push|pull|branch|merge|checkout|status|diff|log)\b/i,
    "coding",
  ],
  [
    /\b(run|execute|build|compile|test|lint|format)\s+(the\s+)?(project|code|tests?|script|command)\b/i,
    "coding",
  ],
  [/\b(read|show|cat)\s+(the\s+)?file\b/i, "coding"],

  // ── System (action commands — after coding) ──
  [/\b(open|launch|start|run)\s+\S+/i, "system"],
  [/\b(close|quit|kill)\s+\S+/i, "system"],
  [/\b(set|change|adjust)\s+(volume|brightness)\b/i, "system"],
  [/\b(get|show|what)\s+(volume|brightness)\b/i, "system"],
  [
    /\b(show|get|what)\s+(system\s+info|hostname|uptime|cpu|memory|disk|battery|wifi|bluetooth|kernel|platform|info)\b/i,
    "system",
  ],
  [
    /\b(what|how)\s+(is|about)\s+(my\s+|the\s+)?(uptime|hostname|cpu|memory|disk|battery|system)\b/i,
    "system",
  ],
  [/\b(system\s+info|hostname|uptime|kernel)\b/i, "system"],
  [/\b(shutdown|restart|reboot|sleep|lock|suspend)\b/i, "system"],
  [/\b(screenshot|take\s+(a\s+)?screenshot)\b/i, "system"],

  // ── Search (factual questions — NOT identity/conversation) ──
  [/\b(search|look\s*up|find|google|research)\s+/i, "search"],
  [/\b(tell\s+me\s+about|explain|describe)\s+/i, "search"],
  [
    /\b(what|where|when|why|how)\s+(is|are|was|were|do|does|did|can|could|should|would)\s+(?!you\b|your\b|about you)/i,
    "search",
  ],
  [/\bwho\s+(is|are|was|were)\s+(?!you\b|your\b)/i, "search"],
  [
    /\b(what('s| is| are))\s+(?!you\b|your\b|up\b|going on\b|happening\b)/i,
    "search",
  ],
  [/\b(latest|current|recent|news)\s+/i, "search"],

  // ── Reminders: goal creation ("I want to finish the API", "my goal is to...") ──
  // After coding so "fix the bug" → coding, but "I want to fix the API" → reminders
  [
    /\b(i want to|i'd like to|i need to|my goal is|i'm going to|plan to|aim to)\s+/i,
    "reminders",
  ],

  // ── Reminders (task/note commands — general "create" after coding) ──
  [/\b(add|create|new|save)\s+(a\s+)?(reminder|note|task|todo)\b/i, "reminders"],
  [
    /\b(list|show)\s+(my\s+)?(open\s+)?(reminders?|notes?|tasks?|todos?)\b/i,
    "reminders",
  ],
  [/\b(remind\s+me|remember)\s+/i, "reminders"],
  [/\b(complete|done|finish|mark)\s+(a\s+)?(task|reminder|todo)\b/i, "reminders"],
  [/\b(complete|done|finish|mark)\s+\w+/i, "reminders"],
  [/\b(delete|remove|clear)\s+(a\s+)?(task|reminder|note|todo)\b/i, "reminders"],
  [/^(my\s+)?(open\s+)?(reminders?|notes?|tasks?|todos?)\s*$/i, "reminders"],
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
