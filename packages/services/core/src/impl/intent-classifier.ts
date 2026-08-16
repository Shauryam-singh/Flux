// ─── Priority-ordered regex rules (fast path) ────────────────────────────────
// First match wins. Each rule: [regex, service name, optional elevation/depression context]
type RuleEntry = [RegExp, string] | [RegExp, string, { elevation?: string[]; depression?: string[] }];
const RULES: RuleEntry[] = [
  // ── Notifications (highest priority — alert commands) ──
  [
    /\b(send|create|new|add|notify)\s+(a\s+)?(notification|alert|notify)\b/i,
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
  [/\bnotify\s+(me|us)\b/i, "notifications"],

  // ── Reminders: goal creation (BEFORE coding — "i want to finish the api" → reminders) ──
  [
    /\b(i want to|i'd like to|i need to\s+(finish|complete|work on|start|set up|organize|plan)|my goal is|i('m|\s+am)\s+going\s+to|plan\s+to|aim\s+to)\s+/i,
    "reminders",
  ],

  // ── Reminders: schedule/activity queries (BEFORE search — "what's on my schedule" → reminders) ──
  [
    /\b(what('s|s|\s+is)\s+on\s+(my\s+)?schedule|what\s+(did|was)\s+(i|we)\s+(do|doing))\b/i,
    "reminders",
  ],

  // ── Coding (code actions — BEFORE monitor/system so "git status" → coding) ──
  [
    /\b(create|write|make|generate)\s+(a\s+)?(\w+\s+)*(file|function|class|component|module|script|test|project|app|application|website|page)\b/i,
    "coding",
  ],
  [
    /\b(edit|modify|update|change|fix|debug|refactor)\s+(\w+\s+)*(file|function|code|bug|error|issue|problem|module|component|service|test|class|app)\b/i,
    "coding",
  ],
  [
    /\b(git|commit|push|pull|branch|merge|checkout|diff|log)\b/i,
    "coding",
  ],
  [
    /\b(run|execute|build|compile|test|lint|format)\s+(the\s+)?(project|code|tests?|script|command)\b/i,
    "coding",
  ],
  [/\b(read|show|cat)\s+(the\s+)?file\b/i, "coding"],

  // ── Monitor (system health commands — AFTER coding) ──
  [
    /\b(show|list|get|what)\s+(my\s+)?(monitor\s+)?(rules?|watches?|alerts?|thresholds?)\b/i,
    "monitor",
  ],
  [/\b(add|create|set|new)\s+(a\s+)?monitor\b/i, "monitor"],
  [/\b(remove|delete|disable)\s+(rule|monitor|watch)\s*(\d+)?\b/i, "monitor"],
  [/\b(enable|disable)\s+(rule|monitor|watch)\s*(\d+)?\b/i, "monitor"],
  [/\b(check|scan|health)\s+(system|server|disk|cpu|memory|network|service|status|monitor|health)\b/i, "monitor"],

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
  [/\b(automate|create\s+an?\s+automation|set\s+up\s+an?\s+automation)\b/i, "automations"],

  // ── Reminders: personal data overview ──
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
  [/\b(open|show|list)\s+(my\s+)?(open\s+)?(reminders?|notes?|tasks?|todos?)\b/i, "reminders"],

  // ── Screen Understanding ──
  [
    /\b(what('s|s| is) on (my |the )?screen|read (my|the|this) screen|describe (my|the|this) screen|screen\s*(understand|analy[zs]e|read|describe)|what\s+am\s+i\s+doing|what('s|s| is)\s+open|click\s+(the\s+)?|find\s+(the\s+)?button|read\s+text|extract\s+text|ui\s*elements?|detect\s*elements?)\b/i,
    "screen-understanding",
  ],

  // ── System (action commands — after coding) ──
  [/\b(open|launch|start|run)\s+\S+/i, "system"],
  [/\b(close|quit|kill)\s+\S+/i, "system"],
  [/\b(set|change|adjust)\s+(volume|brightness)\b/i, "system"],
  [/\b(get|show|what)\s+(volume|brightness)\b/i, "system"],
  [/\b(what|how)\s+(is|about)\s+(the\s+)?(volume|brightness)\b/i, "system"],
  [
    /\b(show|get|what)\s+(system\s+info|hostname|uptime|cpu|memory|disk|battery|wifi|bluetooth|kernel|platform|info)\b/i,
    "system",
  ],
  [
    /\b(what|how)\s+(is|about)\s+(my\s+|the\s+)?(uptime|hostname|cpu|memory|disk|battery|system)\b/i,
    "system",
  ],
  [/\b(system\s+info|hostname|uptime|kernel)\b/i, "system"],
  [/\b(check|show|get|what)\s+(my\s+)?(battery|volume|brightness|disk|cpu|memory)\b/i, "system"],
  [/\b(shutdown|restart|reboot|sleep|lock|suspend)\b/i, "system"],
  [/\b(screenshot|take\s+(a\s+)?screenshot)\b/i, "system"],

  // ── Chat/Casual (before search — greetings and personal questions) ──
  [/\b(how are you|how('re|\s+are)\s+(you|u|it|things|everything)|what('s| is)\s+up|hey flux|hi flux|hello flux|how('s|\s+is)\s+it\s+going)\b/i, "chat"],
  [/\b(hi|hello|hey|yo|sup|greetings|good\s+(morning|afternoon|evening|night)|what('s| is)\s+up|bye|goodbye|see\s+you)\b/i, "chat"],
  [/\b(what('s| is)\s+your\s+name|who\s+are\s+you|tell\s+me\s+about\s+yourself|what\s+do\s+you\s+think|how\s+old\s+are\s+you)\b/i, "chat"],

  // ── Search (factual questions — NOT identity/conversation) ──
  [/\b(search|look\s*up|find|google|research)\s+/i, "search"],
  [/\b(tell\s+me\s+about|explain|describe)\s+(?!you\b|your\b|yourself\b)/i, "search"],
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
  // "how hot is it today", "how far is the moon" — flexible "how X is" pattern
  [/\bhow\s+\w+\s+(is|are|was|were)\s+/i, "search"],

  // ── Reminders (task/note commands — after search so "fix bug" → coding, not reminders) ──
  [/\b(add|create|new|save|set)\s+(a\s+)?(reminder|note|task|todo)\b/i, "reminders"],
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

// ─── Keyword scoring dictionary (~100 entries) ────────────────────────────────
const KEYWORDS: Record<string, [string, number][]> = {
  "code":       [["coding", 10]],
  "coding":     [["coding", 10]],
  "function":   [["coding", 8]],
  "class":      [["coding", 8]],
  "method":     [["coding", 7]],
  "variable":   [["coding", 6]],
  "loop":       [["coding", 6]],
  "array":      [["coding", 5]],
  "string":     [["coding", 4]],
  "type":       [["coding", 5]],
  "interface":  [["coding", 7]],
  "api":        [["coding", 6], ["search", 3]],
  "bug":        [["coding", 8]],
  "debug":      [["coding", 9]],
  "error":      [["coding", 6], ["system", 3]],
  "exception":  [["coding", 7]],
  "refactor":   [["coding", 9]],
  "compile":    [["coding", 8]],
  "build":      [["coding", 7], ["system", 2]],
  "lint":       [["coding", 9]],
  "format":     [["coding", 7]],
  "syntax":     [["coding", 8]],
  "algorithm":  [["coding", 8]],
  "implement":  [["coding", 9]],
  "program":    [["coding", 7]],
  "developer":  [["coding", 7]],
  "software":   [["coding", 6]],
  "typescript": [["coding", 8]],
  "javascript": [["coding", 8]],
  "python":     [["coding", 7]],
  "react":      [["coding", 7]],
  "component":  [["coding", 7]],
  "hook":       [["coding", 6]],
  "state":      [["coding", 5], ["system", 3]],
  "render":     [["coding", 6]],
  "deploy":     [["coding", 7], ["system", 3]],
  "commit":     [["coding", 9]],
  "push":       [["coding", 8]],
  "pull":       [["coding", 7]],
  "branch":     [["coding", 8]],
  "merge":      [["coding", 8]],
  "git":        [["coding", 9]],
  "repo":       [["coding", 7]],
  "repository": [["coding", 7]],
  "readme":     [["coding", 6]],
  "dependencies": [["coding", 6]],
  "package":    [["coding", 5]],
  "import":     [["coding", 5]],
  "open":       [["system", 8], ["coding", 2]],
  "close":      [["system", 9]],
  "launch":     [["system", 9]],
  "start":      [["system", 7], ["coding", 2]],
  "quit":       [["system", 9]],
  "kill":       [["system", 8]],
  "run":        [["system", 7], ["coding", 4]],
  "execute":    [["system", 7], ["coding", 4]],
  "volume":     [["system", 10]],
  "brightness": [["system", 10]],
  "screenshot": [["system", 10]],
  "shutdown":   [["system", 10]],
  "restart":    [["system", 10]],
  "reboot":     [["system", 10]],
  "sleep":      [["system", 8]],
  "lock":       [["system", 8]],
  "suspend":    [["system", 8]],
  "uptime":     [["system", 9]],
  "hostname":   [["system", 9]],
  "cpu":        [["system", 7], ["monitor", 5]],
  "memory":     [["system", 7], ["monitor", 5]],
  "disk":       [["system", 7], ["monitor", 5]],
  "battery":    [["system", 9]],
  "wifi":       [["system", 8]],
  "bluetooth":  [["system", 8]],
  "kernel":     [["system", 8]],
  "platform":   [["system", 6]],
  "app":        [["system", 6]],
  "application":[["system", 6]],
  "browser":    [["system", 6], ["search", 3]],
  "chrome":     [["system", 7]],
  "brave":      [["system", 7]],
  "firefox":    [["system", 7]],
  "vs":         [["system", 3], ["coding", 3]],
  "search":     [["search", 10]],
  "google":     [["search", 10]],
  "lookup":     [["search", 9]],
  "look":       [["search", 4]],
  "research":   [["search", 9]],
  "explain":    [["search", 8]],
  "describe":   [["search", 7], ["screen-understanding", 5]],
  "tell":       [["search", 4], ["chat", 3]],
  "about":      [["search", 3]],
  "capital":    [["search", 9]],
  "president":  [["search", 9]],
  "population": [["search", 9]],
  "history":    [["search", 7]],
  "science":    [["search", 7]],
  "meaning":    [["search", 8]],
  "definition": [["search", 8]],
  "weather":    [["search", 8]],
  "temperature":[["search", 7]],
  "forecast":   [["search", 8]],
  "latest":     [["search", 8]],
  "news":       [["search", 8]],
  "recent":     [["search", 6]],
  "current":    [["search", 5]],
  "evaluate":   [["search", 8]],
  "tradeoffs":  [["search", 7]],
  "tradeoff":   [["search", 7]],
  "who":        [["search", 7]],
  "where":      [["search", 7]],
  "when":       [["search", 7]],
  "why":        [["search", 7]],
  "how":        [["search", 5], ["chat", 3]],
  "which":      [["search", 6]],
  "remind":     [["reminders", 10]],
  "reminder":   [["reminders", 10]],
  "task":       [["reminders", 9]],
  "tasks":      [["reminders", 9]],
  "todo":       [["reminders", 9]],
  "todos":      [["reminders", 9]],
  "goal":       [["reminders", 9]],
  "goals":      [["reminders", 9]],
  "note":       [["reminders", 7]],
  "notes":      [["reminders", 7]],
  "plan":       [["reminders", 7]],
  "plans":      [["reminders", 7]],
  "progress":   [["reminders", 7]],
  "schedule":   [["reminders", 8]],
  "deadline":   [["reminders", 9]],
  "finish":     [["reminders", 6], ["coding", 3]],
  "complete":   [["reminders", 7]],
  "done":       [["reminders", 6]],
  "mark":       [["reminders", 5]],
  "list":       [["reminders", 4], ["system", 2]],
  "show":       [["reminders", 3], ["system", 3]],
  "delete":     [["reminders", 5], ["system", 3]],
  "remove":     [["reminders", 5], ["system", 3]],
  "clear":      [["reminders", 4], ["system", 3]],
  "want":       [["reminders", 4]],
  "need":       [["reminders", 4]],
  "going":      [["reminders", 3]],
  "health":     [["monitor", 8]],
  "monitor":    [["monitor", 9]],
  "threshold":  [["monitor", 9]],
  "watch":      [["monitor", 7]],
  "watches":    [["monitor", 7]],
  "network":    [["monitor", 7]],
  "server":     [["monitor", 7]],
  "service":    [["monitor", 6], ["coding", 3]],
  "latency":    [["monitor", 8]],
  "bandwidth":  [["monitor", 8]],
  "usage":      [["monitor", 6]],
  "check":      [["monitor", 4], ["system", 3]],
  "scan":       [["monitor", 5]],
  "notification":   [["notifications", 10]],
  "notifications":  [["notifications", 10]],
  "alert":          [["notifications", 8], ["monitor", 4]],
  "alerts":         [["notifications", 8], ["monitor", 4]],
  "unread":         [["notifications", 9]],
  "dismiss":        [["notifications", 8]],
  "message":        [["notifications", 6]],
  "messages":       [["notifications", 6]],
  "inbox":          [["notifications", 7]],
  "screen":         [["screen-understanding", 8]],
  "display":        [["screen-understanding", 6]],
  "click":          [["screen-understanding", 8]],
  "button":         [["screen-understanding", 8]],
  "element":        [["screen-understanding", 7]],
  "ui":             [["screen-understanding", 8]],
  "text":           [["screen-understanding", 4]],
  "read":           [["screen-understanding", 4], ["coding", 4]],
  "visible":        [["screen-understanding", 5]],
  "see":            [["screen-understanding", 3]],
  "showing":        [["screen-understanding", 4]],
  "automation":     [["automations", 10]],
  "automations":    [["automations", 10]],
  "automate":       [["automations", 10]],
  "chain":          [["automations", 8]],
  "trigger":        [["automations", 8]],
  "workflow":       [["automations", 8]],
  "pipeline":       [["automations", 8]],
  "routine":        [["automations", 7]],
  "hello":          [["chat", 10]],
  "hey":            [["chat", 10]],
  "hi":             [["chat", 10]],
  "yo":             [["chat", 8]],
  "sup":            [["chat", 8]],
  "greetings":      [["chat", 9]],
  "morning":        [["chat", 6]],
  "afternoon":      [["chat", 6]],
  "evening":        [["chat", 6]],
  "night":          [["chat", 6]],
  "thanks":         [["chat", 8]],
  "thank":          [["chat", 8]],
  "bye":            [["chat", 8]],
  "goodbye":        [["chat", 8]],
  "cool":           [["chat", 6]],
  "nice":           [["chat", 6]],
  "great":          [["chat", 5]],
  "awesome":        [["chat", 5]],
  "yeah":           [["chat", 6]],
  "yep":            [["chat", 6]],
  "nope":           [["chat", 6]],
  "nah":            [["chat", 6]],
  "ok":             [["chat", 5]],
  "okay":           [["chat", 5]],
  "sure":           [["chat", 5]],
  "yes":            [["chat", 5]],
  "no":             [["chat", 4]],
  "maybe":          [["chat", 4]],
  "name":           [["chat", 3]],
  "yourself":       [["chat", 6]],
  "your":           [["chat", 3]],
  "you":            [["chat", 3]],
};

// ─── Complexity keywords for model routing ────────────────────────────────────
const COMPLEXITY_KEYWORDS: [string, number][] = [
  ["implement", 10], ["architect", 10],
  ["refactor", 9], ["debug", 8],
  ["write", 8], ["create", 7],
  ["build", 7], ["develop", 8],
  ["program", 7], ["programming", 7],
  ["compile", 7], ["design", 7], ["plan", 7],
  ["analyze", 8], ["review", 7],
  ["optimize", 8], ["improve", 7],
  ["compare", 7], ["evaluate", 7],
  ["assess", 7], ["simplify", 7],
  ["tradeoffs", 7], ["tradeoff", 7],
  ["explain", 6], ["describe", 6],
  ["function", 7], ["class", 7],
  ["component", 6], ["module", 6],
  ["script", 6], ["test", 6],
  ["fix", 6], ["change", 5],
  ["update", 5], ["modify", 5],
  ["architecture", 10], ["microservices", 8],
  ["algorithm", 8], ["database", 7],
  ["schema", 7], ["api", 6],
  ["endpoints", 7], ["documentation", 7],
  ["performance", 7], ["bottleneck", 8],
  ["caching", 7], ["strategies", 6],
  ["sort", 6], ["array", 5],
  ["login", 5], ["page", 4],
  ["project", 5], ["system", 5],
  ["binary", 5], ["search", 5],
  ["authentication", 7], ["security", 6],
  ["deployment", 7], ["infrastructure", 7],
  ["docker", 7], ["kubernetes", 8],
  ["pipeline", 6], ["workflow", 5],
  ["integration", 6], ["testing", 6],
  ["debugging", 7], ["scaling", 7],
  ["migration", 7], ["configuration", 6],
  ["setup", 5], ["scaffold", 6],
  ["merge", 5], ["conflict", 6],
  ["pattern", 5], ["abstraction", 6],
  ["dependency", 6], ["middleware", 6],
  ["asynchronous", 7], ["concurrent", 7],
  ["distributed", 7], ["cluster", 6],
  ["query", 5], ["optimization", 7],
  ["validation", 6], ["serialization", 7],
  ["parsing", 6], ["runtime", 5],
  ["virtualization", 7], ["compression", 6],
  ["encoding", 6], ["pagination", 6],
  ["filtering", 5], ["sorting", 5],
  ["aggregation", 6], ["transforming", 6],
  ["processing", 5], ["analyzing", 6],
  ["visualizing", 6], ["reporting", 5],
  ["exporting", 5], ["importing", 5],
  ["syncing", 5], ["replicating", 6],
];

const SCORING_THRESHOLD = 10;
const COMPLEXITY_COMPLEX_THRESHOLD = 12;

export interface IntentContext {
  readonly isCoding?: boolean;
  readonly isBrowsing?: boolean;
  readonly isTerminal?: boolean;
  readonly dockerRunning?: boolean;
  readonly k8sActive?: boolean;
  readonly gitDirty?: boolean;
  readonly cpuHigh?: boolean;
}

export type ModelComplexity = "simple" | "medium" | "complex";

export function classifyIntent(
  input: string,
  context?: IntentContext,
): string | null {
  const trimmed = input.trim();

  for (const rule of RULES) {
    const [regex, service, opts] = rule;
    if (regex.test(trimmed)) {
      if (opts && context) {
        if (opts.elevation) {
          for (const condition of opts.elevation) {
            if (matchesContext(condition, context)) {
              return service;
            }
          }
        }
        if (opts.depression) {
          let suppressed = false;
          for (const condition of opts.depression) {
            if (matchesContext(condition, context)) {
              suppressed = true;
              break;
            }
          }
          if (suppressed) continue;
        }
      }
      return service;
    }
  }

  const scored = scoreByKeywords(trimmed, context);
  if (scored) return scored;

  return null;
}

function scoreByKeywords(
  input: string,
  context?: IntentContext,
): string | null {
  const tokens = input.toLowerCase().split(/[\s,;.!?]+/).filter(Boolean);
  const scores: Record<string, number> = {};

  for (const token of tokens) {
    const mappings = KEYWORDS[token];
    if (mappings) {
      for (const [intent, weight] of mappings) {
        scores[intent] = (scores[intent] ?? 0) + weight;
      }
    }
  }

  if (context) {
    if (context.isTerminal) scores["coding"] = (scores["coding"] ?? 0) + 5;
    if (context.isBrowsing) scores["search"] = (scores["search"] ?? 0) + 3;
    if (context.gitDirty) scores["coding"] = (scores["coding"] ?? 0) + 3;
    if (context.dockerRunning) scores["monitor"] = (scores["monitor"] ?? 0) + 3;
    if (context.cpuHigh) scores["monitor"] = (scores["monitor"] ?? 0) + 4;
  }

  let bestIntent: string | null = null;
  let bestScore = 0;
  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  if (bestScore >= SCORING_THRESHOLD && bestIntent) {
    return bestIntent;
  }
  return null;
}

export function detectModelComplexity(input: string): ModelComplexity {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.length < 15) return "simple";

  if (/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|cool|nice|great|good|bad|yeah|yep|nope|nah|bye|goodbye)\s*[!?.]*$/i.test(trimmed)) {
    return "simple";
  }

  const tokens = trimmed.split(/[\s,;.!?]+/).filter(Boolean);
  let score = 0;

  for (const token of tokens) {
    for (const [kw, weight] of COMPLEXITY_KEYWORDS) {
      if (token === kw) {
        score += weight;
        break;
      }
    }
  }

  if (trimmed.length > 200) score += 8;
  else if (trimmed.length > 100) score += 4;
  else if (trimmed.length > 50) score += 2;

  if (/\b(and|then|after|before|also|plus|including|step|first|second|third)\b/i.test(trimmed) && trimmed.length > 60) {
    score += 5;
  }

  const sentenceCount = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
  if (sentenceCount >= 3) score += 6;

  if (score >= COMPLEXITY_COMPLEX_THRESHOLD) return "complex";
  return "medium";
}

export function getRecommendedModel(complexity: ModelComplexity): string {
  switch (complexity) {
    case "simple":
    case "medium":
      return "0.5b";
    case "complex":
      return "7b";
  }
}

function matchesContext(condition: string, context: IntentContext): boolean {
  switch (condition) {
    case "isCoding": return context.isCoding === true;
    case "isBrowsing": return context.isBrowsing === true;
    case "isTerminal": return context.isTerminal === true;
    case "dockerRunning": return context.dockerRunning === true;
    case "k8sActive": return context.k8sActive === true;
    case "gitDirty": return context.gitDirty === true;
    case "cpuHigh": return context.cpuHigh === true;
    default: return false;
  }
}
