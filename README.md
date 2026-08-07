# Flux

An AI operating system that thinks, senses, and acts. Built as a TypeScript monorepo with a 6-phase architecture, 14-stage cognition pipeline, 15+ real-world sensors, 7-type cognitive memory, and deep application-specific automation. Powered by Ollama for fully offline, local AI.

---

## What Flux Is

Flux is not a chatbot. It's an AI that:

- **Thinks every 5 seconds** through a 14-stage cognition pipeline
- **Remembers** with 7 memory types based on cognitive science
- **Senses** the real world through 15+ sensors (git, filesystem, Docker, clipboard, battery, screen, browser...)
- **Controls your desktop** — windows, workspaces, apps, volume, brightness, screenshots, clipboard
- **Controls specific apps** — Spotify, VS Code, Terminal, Slack/Discord with deep integration
- **Understands your screen** — captures screenshots, analyzes with vision LLM, detects UI elements
- **Chains multi-step commands** — "set up my dev environment" executes a DAG of linked steps
- **Browses the web** — opens sites, clicks elements, fills forms, reads content via Playwright
- **Sends messages** — Telegram, Email, Discord, Slack, WhatsApp, Signal, SMS
- **Explains** its decisions with evidence chains and counterarguments
- **Learns** from every interaction and consolidates memories over time
- **Proactively observes** your screen and suggests actions without being asked

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
                   (DAG with               (consolidated over
                    evidence,               time, strengthened
                    confidence,             with access)
                    counterargs)
```

---

## The 6 Phases

### Phase 1: Sensory Layer
- **25+ tools** — file ops, git, shell, scaffolding, HTTP, Docker, screen monitoring
- **20+ services** — chat, coding, search, system, reminders, files, notifications, monitor, automations, context, proactive, desktop-control, browser-control, command-chain, screen-understanding, file-processor, send-message, scheduled-notifications, game-updater, spotify, vs-code, terminal, slack-discord
- **15+ sensors** — git, filesystem, clipboard, battery, idle, audio, Docker, Kubernetes, SSH, Spotify, notifications, screen, system-health, window-tracker, browser-context
- **Attention system** — priority scoring, policy filtering, observation buffering, summarization
- **Voice I/O** — push-to-talk, local Whisper STT + espeak-ng TTS

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
- **Screen understanding** — capture + vision LLM analysis + UI element detection
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

## Services (20+)

### Core Services
| Service | Description |
|---------|-------------|
| **chat** | General conversational AI (Jarvis personality) |
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
| `volume up/down` | `pamixer` | PowerShell音量 |
| `brightness up/down` | `brightnessctl` | PowerShell亮度 |
| `screenshot` | `grim` | PowerShell截图 |
| `clipboard copy/paste` | `wl-copy`/`wl-paste` | PowerShell剪贴板 |
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
| `run test <name>` | Run specific test | Terminal command |
| `install extension <name>` | Install extension | `code --install-extension` |
| `remove extension <name>` | Remove extension | `code --uninstall-extension` |
| `list extensions` | List installed | `code --list-extensions` |
| `change theme <name>` | Change color theme | VS Code CLI + settings |
| `format document` | Format current file | VS Code command |
| `toggle sidebar` | Toggle sidebar | VS Code command |
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
| `tmux kill <name>` | Kill session | `tmux kill-session -t` |
| `tmux list` | List sessions | `tmux list-sessions` |
| `tmux split` | Split pane | `tmux split-window` |
| `tmux next/prev` | Switch pane | `tmux select-pane` |
| `run background <cmd>` | Run in background | `nohup` / `Start-Process` |
| `list processes` | List running processes | `ps aux` / `Get-Process` |
| `kill process <name>` | Kill process | `pkill` / `Stop-Process` |

#### Slack / Discord Automation
| Command | Action | Method |
|---------|--------|--------|
| `read slack <channel>` | Read channel messages | Slack API (Bot Token) |
| `send slack <channel> <msg>` | Send message | Slack API |
| `react slack <channel> <emoji>` | React to last message | Slack API |
| `read discord <channel>` | Read channel messages | Discord Bot API |
| `send discord <channel> <msg>` | Send message | Discord Bot API |
| `react discord <emoji>` | React to last message | Discord Bot API |
| `list slack channels` | List channels | Slack API |
| `list discord channels` | List channels | Discord Bot API |
| `search slack <query>` | Search messages | Slack API |
| `thread slack <channel> <msg>` | Reply in thread | Slack API |

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

### Screenshot Capture (Cross-Platform)
| Platform | Method |
|----------|--------|
| **Windows 11** | PowerShell + `System.Drawing` |
| **macOS** | `screencapture -x` |
| **Linux Wayland** | `grim` |
| **Linux X11** | `import -window root` |

### Vision Analysis (Ollama + llava)
- **Screen description**: What's on screen, what user is doing
- **UI element detection**: Buttons, text fields, links, menus with coordinates
- **Text extraction**: OCR-like reading of all visible text
- **Active app identification**: Application name and window title

### Proactive Screen Observation
- Every 10th tick (~30s), captures + analyzes screenshot
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
| **Browser Context** | Active browser tab, URL | Browser extension / Playwright |
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
├── services/                  # 20+ specialized services
│   ├── core/                  # Service interface, Orchestrator, Intent Classifier
│   ├── chat/                  # General conversation (Jarvis personality)
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
│   ├── browser-control/       # Playwright browser automation (20+ sites)
│   ├── command-chain/         # Multi-step command DAG execution
│   ├── screen-understanding/  # Screenshot + vision LLM + UI element detection
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
    ├── tts/                   # Text-to-speech (espeak-ng)
    └── pipeline/              # Record → STT → Text → TTS → Play

apps/
├── cli/                       # Terminal interface (rich TUI)
├── api/                       # HTTP API server (port 3141)
└── desktop/                   # Tauri v2 desktop app
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Send a message, get a reply |
| POST | `/chat/stream` | Send a message, get streaming SSE reply |
| GET | `/health` | Health check |
| GET | `/events` | SSE event stream (ticks, proactive, speech) |
| GET | `/state` | Runtime state |
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

```bash
# Chat
curl -X POST http://localhost:3141/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Flux!"}'

# Multi-step command
curl -X POST http://localhost:3141/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Set up my dev environment — open terminal, start docker, open vs code"}'

# Screen understanding
curl -X POST http://localhost:3141/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What'\''s on my screen?"}'
```

---

## Requirements

- Node.js 22+
- pnpm 10+
- Rust + Cargo (for Tauri desktop app)
- Ollama running locally (for LLM + vision models)
- Playwright (for browser control, auto-installed)

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

---

## Quick Start

```bash
git clone <repository-url>
cd ai-coding-agent
pnpm install
pnpm build
```

### Run the CLI
```bash
pnpm --filter @ai-agent/cli dev
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

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 6+ / Rust |
| Runtime | Node.js 22+ |
| Build | Turborepo + tsc |
| LLM | Ollama (qwen2.5-coder, llava for vision) |
| Desktop | Tauri v2 |
| Frontend | Vanilla JS (glassmorphism UI) |
| Voice STT | Whisper (@xenova/transformers) |
| Voice TTS | espeak-ng |
| Search | DuckDuckGo API |
| Browser | Playwright (Chromium) |
| File Watch | fs.watch (inotify/fsevents) |
| Sensors | D-Bus, xdotool, xclip, playerctl, pamixer, brightnessctl |
| Clipboard | wl-copy/wl-paste (Linux), PowerShell (Win), pbpaste (mac) |
| Window Mgmt | hyprctl (Hyprland), Win32 API (Win11), screencapture (mac) |
| Testing | Vitest (788+ tests, 82 test files) |
| Platforms | Linux (Hyprland/X11), Windows 11, macOS |

---

## License

MIT
