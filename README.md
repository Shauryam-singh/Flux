# Flux — Fully Loaded Universal Expert

An AI operating system that thinks, senses, and acts. Built as a TypeScript monorepo with a 6-phase architecture, 14-stage cognition pipeline, 15+ real-world sensors, 7-type cognitive memory, and deep application-specific automation. Powered by Ollama for fully offline, local AI.

---

## What Flux Is

Flux is not a chatbot. It's an AI that:

- **Thinks every 5 seconds** through a 14-stage cognition pipeline
- **Remembers** with 7 memory types based on cognitive science
- **Senses** the real world through 15+ sensors (git, filesystem, Docker, clipboard, battery, screen, browser...)
- **Controls your desktop** — windows, workspaces, apps, volume, brightness, screenshots, clipboard
- **Controls specific apps** — Spotify, VS Code, Terminal, Slack/Discord with deep integration
- **Understands your screen** — window title inference, activity classification, screen context
- **Chains multi-step commands** — "set up my dev environment" executes a DAG of linked steps
- **Browses the web** — opens sites, clicks elements, reads content via CDP (Chrome DevTools Protocol)
- **Sends messages** — Telegram, Email, Discord, Slack, WhatsApp, Signal, SMS
- **Explains** its decisions with evidence chains and counterarguments
- **Learns** from every interaction and consolidates memories over time
- **Proactively observes** your screen and suggests actions without being asked
- **Streams responses** with real-time progress indicators showing exactly what it's doing
- **Speaks naturally** with gapless sentence-by-sentence TTS powered by Piper

---

## Desktop UI

Flux ships with a premium Tauri v2 desktop application featuring a cinematic, JARVIS-inspired interface.

### Boot Screen
- Flux-core energy nucleus with orbital rings, volumetric glow, and particle effects
- Cinematic 5-phase startup: Power detection → Core formation → System synchronization → Intelligence online → Transition to HUD
- Boot steps with progress bar (Sensors → Model → Cognitive Engine → Ready)

### HUD (3-Column Layout)
```
┌─────────────┬──────────────────┬──────────────────┐
│  Left Panel │   Center Core    │   Right Panel    │
│             │                  │                  │
│  CPU    ██  │   ┌──────────┐   │  Chat Messages   │
│  RAM    ██  │   │  FLUX    │   │                  │
│  Disk   ██  │   │  Core    │   │  [Thinking...]   │
│  Net    ██  │   │  Orb     │   │  [Reply text]    │
│  ─────────  │   └──────────┘   │                  │
│  Weather    │  Fully Loaded    │  ┌────────────┐  │
│  Date       │  Universal       │  │ Type here  │  │
│  Uptime     │  Expert          │  └────────────┘  │
└─────────────┴──────────────────┴──────────────────┘
```

- **Left panel**: Live system stats (CPU, RAM, disk, network), weather, date, uptime
- **Center**: Flux-core orb with 5 orbital rings, volumetric glow, energy field, particle nodes, scanning arc
- **Right panel**: Chat with markdown rendering, streaming replies, thinking indicator with real-time progress
- **Minimize**: Shrinks to a floating 140x140px orb, always on top
- **Close**: Actually quits the app

### Orb States
| State | Visual |
|-------|--------|
| **Idle** | Slow breathing cyan pulse, gentle orbit rotation |
| **Listening** | Brighter core, faster orbits, "Hi" label (mic active only) |
| **Processing** | Amber accents, increased activity, shows real status text |
| **Speaking** | Rhythmic pulses synchronized with TTS output |
| **Error** | Restrained amber/red accent |

### Thinking Indicator
When you send a message, a thinking bubble appears showing **real-time backend progress**:
- "Classifying intent..." → "Opening in browser..." / "Generating response..." / "Searching the web..."
- On first token, thinking bubble is removed and the real streaming reply appears
- On error/timeout, thinking bubble is cleaned up automatically

### Streaming Chat
- Token-by-token streaming via SSE
- Markdown rendering (headers, bold, italic, code blocks, lists, blockquotes, links)
- Role prefix stripping (removes `assistant:`, `user:` from tiny model output)
- Pause/stop speech button visible during TTS playback

### Typography
- "F.L.U.X" title with "Fully Loaded Universal Expert" tagline
- Subtle uppercase tagline with low-opacity cyan — visible but non-competing

---

## Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Desktop App │  │   CLI (TUI)  │  │   REST API   │  │  Voice Input │
│   (Tauri)    │  │              │  │  (SSE + REST)│  │  (Push-to-talk│
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                  │
       └────────┬────────┘────────┬────────┘────────┬────────┘
                ▼                 ▼                 ▼
        ┌───────────────────────────────────────────────────┐
        │                  FluxRuntime                      │
        │            (central nervous system)               │
        └───────────────────┬───────────────────────────────┘
                            │
     ┌──────────────────────┼──────────────────────────┐
     │                      │                          │
     ▼                      ▼                          ▼
┌──────────┐   ┌────────────────────┐   ┌─────────────────────┐
│ Services │   │   Cognition        │   │   Memory System     │
│ (20+)    │   │   Pipeline (14)    │   │   (7 types)         │
│          │   │                    │   │                     │
│ Desktop  │   │  Thought Graph     │   │  Cognitive Memory   │
│ Browser  │   │  (DAG with         │   │  (Semantic, Episodic│
│ Spotify  │   │   evidence,        │   │   Procedural,       │
│ VS Code  │   │   confidence,      │   │   Relationship,     │
│ Terminal │   │   counterargs)     │   │   Project, Timeline,│
│ Slack    │   │                    │   │   Reflection)       │
│ Discord  │   │                    │   │                     │
│ Screen   │   │                    │   │                     │
│ Chain    │   │                    │   │                     │
│ ...      │   │                    │   │                     │
└──────┬───┘   └─────────┬──────────┘   └─────────┬───────────┘
       │                 │                        │
       ▼                 ▼                        ▼
  Observations     Thought Graph           Cognitive Memory
```

---

## The 6 Phases

### Phase 1: Sensory Layer
- **25+ tools** — file ops, git, shell, scaffolding, HTTP, Docker, screen monitoring
- **20+ services** — chat, coding, search, system, reminders, files, notifications, monitor, automations, context, proactive, desktop-control, browser-control, command-chain, screen-understanding, file-processor, send-message, scheduled-notifications, game-updater, spotify, vs-code, terminal, slack-discord
- **15+ sensors** — git, filesystem, clipboard, battery, idle, audio, Docker, Kubernetes, SSH, Spotify, notifications, screen, system-health, window-tracker, browser-context
- **Attention system** — priority scoring, policy filtering, observation buffering, summarization
- **Voice I/O** — push-to-talk, Piper TTS with audio preloading, fallback espeak

### Phase 2: Cognitive Layer
- **World model** — tracks project, application, and system state
- **Working memory** — short-term memory with weight-based eviction
- **Goal manager** — goal tracking with blocker detection
- **Reasoning engine** — rule-based + LLM-powered thought generation
- **Decision engine** — candidate scoring and action selection
- **Interrupt controller** — policy-based interrupt decisions

### Phase 3: Companion Layer
- **Personality** — 8 personality presets (professional, casual, etc.)
- **User model** — user preference tracking
- **Relationship** — interaction history and rapport
- **Timeline** — 23 event types for life logging
- **Speech** — response generation with personality
- **Learning** — pattern recognition from interactions
- **Reflection** — meta-cognitive analysis

### Phase 4: Ambient Intelligence
- **Screen understanding** — window title inference, activity classification, context analysis
- **Workspace** — file system monitoring
- **Calendar** — event tracking
- **Email** — inbox monitoring
- **Notification intelligence** — priority-based alerting
- **Presence** — user activity detection
- **Multi-device** — cross-device sync
- **Context fusion** — merging observations from all sources
- **Prediction** — user intent forecasting

### Phase 5: Executive Intelligence
- **Agent protocol** — autonomous agent execution
- **Agent framework** — 8 built-in agents
- **Task graph** — dependency-aware task scheduling
- **Executive planner** — high-level goal decomposition
- **Delegation** — task assignment to agents
- **Execution supervisor** — progress monitoring
- **Resource manager** — capacity allocation
- **Approval pipeline** — human-in-the-loop approvals
- **Background projects** — long-running task tracking
- **Long goals** — multi-session goal persistence

### Phase 6: Self-Evolution
- **Meta-cognition** — thinking about thinking
- **Strategy library** — reusable problem-solving strategies
- **Experience database** — past action outcomes
- **Adaptive planner** — dynamic plan adjustment
- **Workflow discovery** — automatic workflow detection
- **Skill library** — learned capability registry
- **Knowledge consolidation** — long-term knowledge management
- **Confidence calibration** — accuracy tracking
- **Self-evaluation** — performance assessment
- **Habit discovery** — behavioral pattern detection
- **Automation builder** — automatic workflow creation
- **Cognitive health** — system health monitoring
- **Simulation engine** — what-if analysis
- **Research mode** — deep exploration capability

---

## The 14-Stage Cognition Pipeline

Every 5 seconds, Flux thinks:

```
 1.  Observe        → Gather raw observations from sensors
 2.  Merge          → Deduplicate and compress similar observations
 3.  World Model    → Update world state with merged observations
 4.  Working Memory → Store relevant observations in short-term memory
 5.  Goal Eval      → Evaluate active goals against current state
 6.  Intent Predict → Predict what the user is likely to do next
 7.  Generate       → Generate rich thoughts with evidence
 8.  Compare        → Compare new thoughts with existing thought graph
 9.  Opportunities  → Detect opportunities for proactive action
10.  Interrupt Eval → Evaluate whether to interrupt the user
11.  Choose Action  → Select the best action based on all analysis
12.  Store          → Store thoughts and edges in the graph
13.  Explain        → Generate explanation chain for the decision
14.  Sleep          → Wait for next tick
```

---

## The Thought Graph

A directed acyclic graph where each thought has:

- **Evidence** — observations that support it (with strength scores)
- **Confidence** — value + reasoning that updates as evidence accumulates
- **Counterarguments** — opposing evidence recorded
- **Edges** — supports, contradicts, extends, follows, alternative

**Explanation chain example:**
> "I suggested fixing the build because I noticed the same compiler error occurred 5 times (confidence: 0.9, reinforced by 3 existing thoughts)"

---

## Intent Classification

Flux uses a **hybrid intent classifier** with three layers for fast, accurate routing:

1. **Regex fast-path** — Instant matching for high-confidence patterns (commands, keywords, known sites)
2. **Weighted keyword scoring** — ~100-keyword dictionary with weighted scoring (threshold 10)
3. **Context boosts** — System context modifiers (terminal detected, git dirty, docker running)

### Routing Examples
| Input | Intent | Handler |
|-------|--------|---------|
| "open youtube" | `browser-control` | CDP opens YouTube in Brave |
| "what is python" | `null` | LLM answers directly |
| "search for cats" | `search` | DuckDuckGo search |
| "list windows" | `desktop-control` | Win32/Hyprland window list |
| "play some music" | `spotify` | Spotify playback control |
| "remember that..." | `memory` | Stores in cognitive memory |

### Model Routing
- **Simple queries** (greetings, quick answers) → `qwen2.5:0.5b` (fast)
- **Complex tasks** (coding, analysis, multi-step) → default model (`qwen2.5:3b`)

---

## Browser Control (CDP)

Flux connects to **Brave browser** via Chrome DevTools Protocol (CDP) for full browser automation:

### Setup
```bash
# Windows
scripts/start-brave-cdp.bat

# Linux
scripts/start-brave-cdp.sh
```

### Capabilities
| Command | Action |
|---------|--------|
| "open youtube" | Opens YouTube in Brave via CDP |
| "search google for X" | Google search |
| "click the login button" | Finds and clicks element |
| "fill the search box with..." | Types into input fields |
| "read the page" | Extracts page content |
| "reconnect" | Reconnects to CDP if disconnected |

### Connection Flow
1. Tries IPv4 (`127.0.0.1:9222`) then IPv6 (`localhost:9222`)
2. Discovers existing tabs before launching new ones
3. Seamless fallback from headless to CDP when available
4. Manual reconnect via "reconnect" command

---

## Streaming & Real-Time Progress

### Chat Streaming (SSE)
```
POST /chat/stream → Server-Sent Events

data: {"status":"Classifying intent..."}
data: {"status":"Generating response..."}
data: {"token":"Hello"}
data: {"token":", "}
data: {"token":"how"}
data: {"token":" can I help?"}
data: {"token":"","done":true,"text":"Hello, how can I help?"}
```

### Real-Time Progress Events
The backend emits status events at each pipeline stage:
- `"Classifying intent..."` — Intent classifier running
- `"Generating response..."` — LLM generating tokens
- `"Opening in browser..."` — Browser-control service active
- `"Searching the web..."` — Search service active
- `"Analyzing screen..."` — Screen-understanding active
- `"Controlling desktop..."` — Desktop-control active
- `"Accessing memory..."` — Memory service active
- `"Managing goals..."` — Goals service active
- `"Setting reminder..."` — Reminders service active
- `"Running {service}..."` — Any other service

---

## TTS & Voice

### Piper TTS
- Primary TTS engine via Piper (local, fast)
- Persistent process with 5-minute idle timeout
- Windows fallback: espeak via PowerShell

### Audio Preloading
- Sentences are pre-fetched in background as they're queued
- Eliminates API round-trip gaps between sentences
- Cache managed per-session, cleaned after playback

### Sentence Boundary Detection
- Detects ALL sentence boundaries within accumulated text
- Regex: `/[.!?…][\s]+(?=[A-Z\u0900-\u097F])/g`
- Handles multi-sentence tokens correctly (no skipped sentences)

### Speech Queue
- Sentences spoken in order without overlap
- Queue halt on `stopSpeaking()` (stops processing remaining sentences)
- Pause/stop button visible during playback

---

## Services (20+)

### Core Services
| Service | Description |
|---------|-------------|
| **chat** | General conversational AI with markdown rendering |
| **coding** | Code assistant with file editing, git, testing |
| **search** | DuckDuckGo web search |
| **system** | OS control (shutdown, restart, suspend, info) |
| **reminders** | Notes, tasks, goals with LLM parsing |
| **files** | File browsing and operations |
| **notifications** | Desktop notification management |
| **monitor** | System health monitoring |
| **automations** | Task automation rules |
| **context** | Context management |
| **proactive** | Proactive suggestions engine |

### Desktop Control (Linux + Windows 11)
| Command | Linux (Hyprland) | Windows 11 |
|---------|-----------------|------------|
| `list windows` | `hyprctl clients -j` | PowerShell Get-Process |
| `focus firefox` | `hyprctl dispatch focuswindow` | Win32 SetForegroundWindow |
| `close window` | `hyprctl dispatch killactive` | Win32 CloseWindow |
| `minimize/maximize` | `hyprctl dispatch togglefloating` | Win32 ShowWindow |
| `tile left/right` | `hyprctl dispatch movewindow` | Win+Left/Right |
| `switch workspace` | `hyprctl dispatch workspace` | Win+Ctrl+Left/Right |
| `volume up/down` | `pamixer` | PowerShell Volume |
| `brightness up/down` | `brightnessctl` | PowerShell Brightness |
| `screenshot` | `grim` | PowerShell Screenshot |
| `clipboard copy/paste` | `wl-copy`/`wl-paste` | PowerShell Clipboard |
| `lock screen` | `loginctl lock-session` | Win32 LockWorkStation |
| `app launcher` | `rofi -show drun` | Start Menu |

### Application-Specific Automation

#### Spotify Control (Cross-Platform)
| Command | Action | Method |
|---------|--------|--------|
| `play` | Resume playback | `playerctl play` / Spotify Web API |
| `pause` | Pause playback | `playerctl pause` / Spotify Web API |
| `next` / `skip` | Skip to next track | `playerctl next` / Spotify Web API |
| `previous` | Previous track | `playerctl previous` / Spotify Web API |
| `what song` | Current track info | `playerctl metadata` / Spotify Web API |
| `play <song>` | Search and play song | Spotify Web API search + play |
| `play playlist <name>` | Play playlist | Spotify Web API |
| `create playlist <name>` | Create new playlist | Spotify Web API |
| `shuffle on/off` | Toggle shuffle | `playerctl shuffle` / Spotify Web API |
| `repeat on/off` | Toggle repeat | `playerctl repeat` / Spotify Web API |
| `set volume <n>` | Set volume | `playerctl volume` / Spotify Web API |

#### VS Code Automation (Cross-Platform)
| Command | Action | Method |
|---------|--------|--------|
| `open file <path>` | Open file in VS Code | `code <path>` |
| `open folder <path>` | Open folder | `code <folder>` |
| `run tests` | Run test suite | `code --command=workbench.action.tasks.runTask` |
| `install extension <name>` | Install extension | `code --install-extension` |
| `list extensions` | List installed | `code --list-extensions` |
| `change theme <name>` | Change color theme | VS Code CLI + settings |
| `format document` | Format current file | VS Code command |
| `search in files` | Global search | VS Code command |
| `go to line <n>` | Jump to line | VS Code command |
| `rename symbol` | Rename symbol | VS Code command |
| `organize imports` | Organize imports | VS Code command |

#### Terminal Automation (Cross-Platform)
| Command | Action | Method |
|---------|--------|--------|
| `run <command>` | Execute command | `child_process.exec` |
| `run in <dir> <cmd>` | Execute in directory | `exec` with `cwd` |
| `ssh <host>` | SSH to host | `ssh` command |
| `tmux new <name>` | New tmux session | `tmux new-session -d` |
| `tmux attach <name>` | Attach to session | `tmux attach -t` |
| `tmux list` | List sessions | `tmux list-sessions` |
| `run background <cmd>` | Run in background | `nohup` / `Start-Process` |
| `list processes` | List running processes | `ps aux` / `Get-Process` |
| `kill process <name>` | Kill process | `pkill` / `Stop-Process` |

#### Slack / Discord Automation
| Command | Action | Method |
|---------|--------|--------|
| `read slack <channel>` | Read channel messages | Slack API (Bot Token) |
| `send slack <channel> <msg>` | Send message | Slack API |
| `read discord <channel>` | Read channel messages | Discord Bot API |
| `send discord <channel> <msg>` | Send message | Discord Bot API |
| `list slack channels` | List channels | Slack API |
| `list discord channels` | List channels | Discord Bot API |
| `search slack <query>` | Search messages | Slack API |

---

## Multi-Step Command Chains

Flux parses complex voice commands into a DAG of steps:

```
"Set up my dev environment"
  ↓
Step 1 [sync, p=1]: open terminal
Step 2 [sync, p=1, depends:1]: start docker     ← waits for Step 1
Step 3 [async, p=2]: open VS Code               ← runs in parallel
Step 4 [async, p=3]: open browser tabs           ← runs in parallel
Step 5 [sync, p=2, depends:2]: run dev server    ← waits for Step 2
```

**Parser modes:**
- **LLM-powered**: Sends command to Ollama, gets structured JSON with steps, dependencies, priorities
- **Fallback rule-based**: 20+ regex patterns, auto-links sequential sync steps

**Executor:**
- Resolves ready steps (all dependencies met)
- Runs sync steps sequentially, async steps in parallel via `Promise.all`
- Reports progress via SSE, handles partial failures

---

## Screen Understanding

### Screen Context Analyzer
- **Pure regex** — no LLM calls, 0-1ms latency
- **40+ websites** recognized (YouTube, GitHub, Google Docs, etc.)
- **30+ app categories** (IDE, browser, terminal, chat, media, etc.)
- **Activity classification** — coding, browsing, debugging, reading, meeting, gaming

### Window Title Inference
- Extracts app name, URL, file name, project name from window title
- Maps to categories and contexts without vision model
- No screenshot capture needed (user preference: no model downloads)

### Proactive Screen Observation
- Every 10th tick (~30s), analyzes screen context
- Detects noteworthy changes (app switches, unusual patterns)
- Emits proactive suggestions via SSE
- 30s cooldown between observations (cost-aware)

---

## Real-World Sensors (15+)

| Sensor | What it senses | How |
|--------|---------------|-----|
| **Git** | Commits, branches, merges, pushes, stashes | `git status/log` polling |
| **File System** | File create/modify/delete | `fs.watch` (inotify/fsevents) |
| **Clipboard** | Clipboard content changes | `xclip`/`pbpaste`/PowerShell polling |
| **Battery** | Charge level, charging state | `/sys/class/power_supply` / PowerShell |
| **Idle** | User activity/inactivity | `xprintidle` / Windows idle time |
| **Audio** | Volume, mute, active device | PulseAudio/PipeWire/pamixer |
| **Docker** | Container start/stop/die | `docker ps` polling |
| **Kubernetes** | Pod status, restarts, failures | `kubectl get pods` |
| **SSH** | Active SSH sessions | `ps aux` filtering |
| **Spotify** | Playback state, track, artist | `playerctl` (MPRIS) / Spotify API |
| **Notifications** | Desktop notifications | `dbus-monitor` / PowerShell |
| **Screen** | Active window, app, title | `hyprctl`/`xdotool`/PowerShell |
| **System Health** | CPU, memory, disk, network | `/proc` / PowerShell WMI |
| **Browser Context** | Active browser tab, URL | CDP (Chrome DevTools Protocol) |
| **Window Tracker** | Window focus changes | `hyprctl activewindow` polling |

---

## Cognitive Memory System (7 types)

Based on cognitive science memory systems:

| Memory Type | What it stores | Example |
|-------------|---------------|---------|
| **Semantic** | Facts, preferences, knowledge | "User prefers TypeScript" |
| **Episodic** | Events, experiences, interactions | "Yesterday we fixed the router" |
| **Procedural** | How-to workflows, commands | "Deploy: pnpm build → docker compose up" |
| **Relationship** | User preferences, personality | "User likes sarcasm at medium level" |
| **Project** | Project-specific knowledge | "Flux uses 14-stage cognition pipeline" |
| **Timeline** | Chronological life events | "Completed Executive Intelligence" |
| **Reflection** | Meta-cognitive insights | "I should be more proactive about errors" |

**Consolidation:** Memories decay over time, strengthen with access, merge when similar, prune when old.

---

## Session Memory

Every 5 user messages, Flux summarizes the conversation. On next boot, unconsumed summaries are included in the boot briefing:

> "From our last conversations: You were working on the desktop control service. We fixed the Hyprland window tiling commands and added Windows 11 support via PowerShell."

Summaries are marked consumed after the briefing. Stored in `~/.flux/session-summaries.json`.

---

## Workspace Structure

```
packages/
├── shared/                    # Core types, Result<T,E>, EventBus
├── config/                    # Configuration management
├── providers/                 # LLM providers (Ollama, OpenAI, Anthropic)
├── router/                    # Request routing with middleware
├── tools/                     # 25+ tools (file, git, shell, docker, screen...)
├── agent/                     # Agent orchestration
├── attention/                 # Observation scoring, buffering, summarization
├── world-model/               # Project, application, system state tracking
├── working-memory/            # Short-term memory with weight-based eviction
├── goals/                     # Goal tracking with blocker detection
├── reasoning/                 # Rule-based + LLM thought generation
├── decisions/                 # Action scoring and interrupt control
├── cognitive/                 # Cognitive orchestrator (think cycle)
├── cognitive-types/           # Shared cognitive types
├── cognitive-memory/          # 7-type cognitive memory system
├── thought-graph/             # DAG of thoughts with evidence + confidence
├── sensors/                   # 15+ real-world sensors
├── flux-runtime/              # Central runtime connecting all systems
├── experience-db/             # Past action outcomes
├── meta-cognition/            # Thinking about thinking
├── strategy-library/          # Reusable problem-solving strategies
├── confidence-calibration/    # Accuracy tracking
├── knowledge-consolidation/   # Long-term knowledge management
├── habit-discovery/           # Behavioral pattern detection
├── self-evolution-core/       # Self-improvement orchestrator
├── personality/               # 8 personality presets
├── user-model/                # User preference tracking
├── relationship/              # Interaction history and rapport
├── timeline/                  # 23 event types for life logging
├── speech/                    # Response generation
├── learning/                  # Pattern recognition
├── reflection/                # Meta-cognitive analysis
├── companion/                 # Companion personality
├── vision/                    # Screen capture and analysis
├── workspace/                 # File system monitoring
├── calendar/                  # Event tracking
├── email/                     # Inbox monitoring
├── notification-intel/        # Priority-based alerting
├── presence/                  # User activity detection
├── multi-device/              # Cross-device sync
├── context-fusion/            # Merging observations
├── prediction/                # User intent forecasting
├── ambient-core/              # Ambient intelligence orchestrator
├── ambient-types/             # Ambient system types
├── exec-types/                # Executive intelligence types
├── agent-protocol/            # Autonomous agent execution
├── agent-framework/           # 8 built-in agents
├── agent-registry/            # Agent lifecycle management
├── task-graph/                # Dependency-aware task scheduling
├── executive-planner/         # High-level goal decomposition
├── delegation/                # Task assignment to agents
├── execution-supervisor/      # Progress monitoring
├── resource-manager/          # Capacity allocation
├── approval-pipeline/         # Human-in-the-loop approvals
├── verification/              # Action verification
├── background-projects/       # Long-running task tracking
├── long-goals/                # Multi-session goal persistence
├── executive-core/            # Executive intelligence orchestrator
├── automation-builder/        # Automatic workflow creation
├── cognitive-health/          # System health monitoring
├── simulation-engine/         # What-if analysis
├── research-mode/             # Deep exploration capability
├── skill-library/             # Learned capability registry
├── workflow-discovery/        # Automatic workflow detection
├── plugins/                   # Plugin system with loader
├── knowledge-base/            # Keyword-based knowledge search
├── cross-device/              # Cross-device sync
├── automation/                # Learning, behavior classification, proactive engine
├── services/                  # 20+ specialized services
│   ├── core/                  # Service interface, Orchestrator, Hybrid Intent Classifier
│   ├── chat/                  # General conversation (markdown rendering, streaming)
│   ├── coding/                # Code assistant (file edit, git, test)
│   ├── search/                # DuckDuckGo web search
│   ├── system/                # OS control (shutdown, info, Hyprland/Win11)
│   ├── reminders/             # Notes, tasks, goals
│   ├── files/                 # File browsing and operations
│   ├── notifications/         # Desktop notifications
│   ├── monitor/               # System health monitoring
│   ├── automations/           # Task automation rules
│   ├── context/               # Context management
│   ├── proactive/             # Proactive suggestions (15+ awareness sources)
│   ├── desktop-control/       # Window/workspace/app/system/clipboard control
│   ├── browser-control/       # CDP browser automation (Brave, any Chromium)
│   ├── command-chain/         # Multi-step command DAG execution
│   ├── screen-understanding/  # Window title inference + activity classification
│   ├── file-processor/        # File summarise/explain/compare/Q&A
│   ├── send-message/          # Telegram, Email, Discord, Slack, WhatsApp, Signal, SMS
│   ├── scheduled-notifications/ # OS-native timed notifications
│   ├── game-updater/          # Steam/Epic game update detection
│   ├── spotify/               # Deep Spotify integration
│   ├── vs-code/               # Deep VS Code integration
│   ├── terminal/              # Terminal/tmux/SSH automation
│   └── slack-discord/         # Slack + Discord integration
└── voice/
    ├── stt/                   # Speech-to-text (Whisper)
    ├── tts/                   # Text-to-speech (Piper + espeak fallback)
    └── pipeline/              # Record → STT → Text → TTS → Play

apps/
├── cli/                       # Terminal interface (rich TUI)
├── api/                       # HTTP API server (port 3141)
└── desktop/                   # Tauri v2 desktop app
    ├── icons/                 # flux-logo.svg, flux-tray.svg
    ├── js/
    │   ├── app.js             # Main app logic, orb states, chat, streaming
    │   ├── data.js            # Live HUD data, stats refresh
    │   ├── components.js      # HUD element updaters
    │   └── animations.js      # Particle system, thought graph
    └── src-tauri/             # Rust backend (window management, IPC)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Send a message, get a reply |
| POST | `/chat/stream` | Send a message, get streaming SSE reply with status events |
| GET | `/health` | Health check |
| GET | `/events` | SSE event stream (ticks, proactive, speech) |
| GET | `/state` | Runtime state (CPU, RAM, disk, network) |
| GET | `/services` | List available services |
| GET | `/goals` | List active goals |
| GET | `/memory/all` | All memory types |
| GET | `/memory/stats` | Memory statistics |
| GET | `/chat/history` | Chat history |
| GET | `/session-summaries` | Session summaries |
| GET | `/agents` | List autonomous agents |
| POST | `/agents` | Create agent |
| PUT | `/agents/:id` | Update agent |
| DELETE | `/agents/:id` | Delete agent |
| POST | `/orchestrate` | Orchestrate multi-agent task |
| GET | `/thoughts` | Recent thoughts |
| GET | `/correlations` | Cross-sensor correlations |
| GET | `/dismissals` | Dismissal statistics |
| POST | `/dismissals` | Dismiss suggestion |
| GET | `/automation/actions` | Automation actions |
| GET | `/automation/patterns` | Detected patterns |
| POST | `/voice/transcribe` | Voice to text |
| POST | `/voice/speak` | Text to speech |
| GET | `/weather` | Current weather (formatted) |
| GET | `/boot/briefing` | Boot greeting + session summary |
| POST | `/screen/context` | Screen context analysis |
| GET | `/screen/context` | Current screen context |

```bash
# Chat with streaming + progress
curl -N -X POST http://localhost:3141/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Flux!"}'

# Chat (non-streaming)
curl -X POST http://localhost:3141/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Flux!"}'

# Multi-step command
curl -X POST http://localhost:3141/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Set up my dev environment — open terminal, start docker, open vs code"}'

# Screen context
curl -X POST http://localhost:3141/screen/context \
  -H "Content-Type: application/json" \
  -d '{"title": "main.py - VS Code", "app": "Code"}'
```

---

## Performance Optimizations

- **Sensor caching** — Fresh sensor data reused within tick window
- **LLM response cache** — Repeated queries cached
- **Session summary deferral** — Summarization runs after response
- **Model pre-warming** — Ollama model loaded on startup
- **num_batch = 1024** — Larger batch for faster inference
- **Audio preloading** — TTS sentences pre-fetched in background
- **Intent classifier** — Regex fast-path skips LLM for obvious patterns
- **Screen context** — Pure regex, 0-1ms latency (no vision model)

---

## Requirements

- Node.js 22+
- pnpm 10+
- Rust + Cargo (for Tauri desktop app)
- Ollama running locally (for LLM + vision models)
- Brave browser (for CDP browser control)

### Optional (per feature)
- `playerctl` — Spotify control on Linux
- `hyprctl` — Hyprland window management
- `grim` / `slurp` — Wayland screenshots
- `pamixer` — Volume control
- `brightnessctl` — Brightness control
- `wl-copy` / `wl-paste` — Wayland clipboard
- `rofi` — App launcher
- `xdotool` — X11 automation
- `tmux` — Terminal multiplexer
- `ffmpeg` — Screen recording
- `piper` — High-quality local TTS

---

## Quick Start

```bash
git clone <repository-url>
cd Flux
pnpm install
pnpm build
```

### Run the API Server
```bash
pnpm --filter @ai-agent/api dev
# Server runs on http://localhost:3141
```

### Run the Desktop App
```bash
cd apps/desktop
npx tauri dev
```

### Run the CLI
```bash
pnpm --filter @ai-agent/cli dev
```

### Browser Control (Optional)
```bash
# Start Brave with CDP debugging
scripts/start-brave-cdp.bat   # Windows
scripts/start-brave-cdp.sh    # Linux
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 6+ / Rust |
| Runtime | Node.js 22+ |
| Build | Turborepo + tsc |
| LLM | Ollama (qwen2.5:3b default, qwen2.5:0.5b fast) |
| Desktop | Tauri v2 (fullscreen, always-on-top) |
| Frontend | Vanilla JS (JARVIS-inspired dark neon theme) |
| Voice STT | Whisper (@xenova/transformers) |
| Voice TTS | Piper (primary), espeak (fallback) |
| Search | DuckDuckGo API |
| Browser | CDP (Chrome DevTools Protocol) via Brave |
| Intent | Hybrid classifier (regex + keyword scoring + context) |
| Streaming | SSE with real-time status events |
| Markdown | Custom renderer (headers, code, lists, links) |
| Clipboard | wl-copy/wl-paste (Linux), PowerShell (Win), pbpaste (mac) |
| Window Mgmt | hyprctl (Hyprland), Win32 API (Win11), screencapture (mac) |
| Testing | Vitest (1083+ tests) |
| Platforms | Linux (Hyprland/X11), Windows 11, macOS |

---

## License

MIT
