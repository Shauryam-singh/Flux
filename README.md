# Flux

An AI operating system that thinks. Built as a TypeScript monorepo with a 6-phase architecture, 14-stage cognition pipeline, 11 real-world sensors, and a 7-type cognitive memory system. Powered by Ollama for fully offline, local AI.

---

## What Flux Is

Flux is not a chatbot. It's an AI that:

- **Thinks every 5 seconds** through a 14-stage cognition pipeline
- **Remembers** with 7 memory types based on cognitive science
- **Senses** the real world through 11 sensors (git, filesystem, Docker, clipboard, battery, audio...)
- **Explains** its decisions with evidence chains and counterarguments
- **Learns** from every interaction and consolidates memories over time

---

## Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Desktop App │  │   CLI (TUI)  │  │   REST API   │
│   (Tauri)    │  │              │  │              │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └────────┬────────┘────────┬────────┘
                ▼                 ▼
        ┌─────────────────────────────────┐
        │         FluxRuntime             │
        │   (central nervous system)      │
        └─────────────┬───────────────────┘
                      │
    ┌─────────────────┼─────────────────────┐
    │                 │                     │
    ▼                 ▼                     ▼
┌─────────┐   ┌─────────────┐   ┌──────────────────┐
│ Sensors │   │ Cognition   │   │ Memory System    │
│ (11)    │   │ Pipeline    │   │ (7 types)        │
│         │   │ (14 stages) │   │                  │
└────┬────┘   └──────┬──────┘   └────────┬─────────┘
     │               │                   │
     ▼               ▼                   ▼
 Observations   Thought Graph      Cognitive Memory
                (DAG with          (Semantic, Episodic,
                 evidence,         Procedural, Relationship,
                 confidence,       Project, Timeline,
                 counterargs)      Reflection)
```

---

## The 6 Phases

### Phase 1: Sensory Layer
- **25+ tools** — file ops, git, shell, scaffolding, HTTP, Docker, screen monitoring
- **12 services** — chat, coding, search, system, reminders, files, notifications, monitor, automations, context, proactive
- **Attention system** — priority scoring, policy filtering, observation buffering, summarization
- **Voice I/O** — push-to-talk, local Whisper STT + Piper/espeak TTS

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
- **Vision** — screen capture and analysis
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
- **Agent framework** — 7 built-in agents
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
10. Interrupt Eval → Evaluate whether to interrupt the user
11. Choose Action  → Select the best action based on all analysis
12. Store          → Store thoughts and edges in the graph
13. Explain        → Generate explanation chain for the decision
14. Sleep          → Wait for next tick
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

## Real-World Sensors (11)

| Sensor | What it senses | How |
|--------|---------------|-----|
| **Git** | Commits, branches, merges, pushes, stashes | `git status/log` polling |
| **File System** | File create/modify/delete | `fs.watch` (inotify/fsevents) |
| **Clipboard** | Clipboard content changes | `xclip`/`pbpaste` polling |
| **Battery** | Charge level, charging state | `/sys/class/power_supply` |
| **Idle** | User activity/inactivity | `xprintidle`/screensaver |
| **Audio** | Volume, mute, active device | PulseAudio/PipeWire |
| **Docker** | Container start/stop/die | `docker ps` polling |
| **Kubernetes** | Pod status, restarts, failures | `kubectl get pods` |
| **SSH** | Active SSH sessions | `ps aux` filtering |
| **Spotify** | Playback state, track, artist | `playerctl` (MPRIS) |
| **Notifications** | Desktop notifications | `dbus-monitor` |

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

## Workspace Structure

```
packages/
├── shared/                 # Core types, Result<T,E>, EventBus
├── config/                 # Configuration management
├── providers/              # LLM providers (Ollama, OpenAI, Anthropic)
├── router/                 # Request routing with middleware
├── tools/                  # 25+ tools (file, git, shell, docker, screen...)
├── agent/                  # Agent orchestration
├── attention/              # Observation scoring, buffering, summarization
├── world-model/            # Project, application, system state tracking
├── working-memory/         # Short-term memory with weight-based eviction
├── goals/                  # Goal tracking with blocker detection
├── reasoning/              # Rule-based + LLM thought generation
├── decisions/              # Action scoring and interrupt control
├── cognitive/              # Cognitive orchestrator (think cycle)
├── cognitive-types/        # Shared cognitive types
├── cognitive-memory/       # 7-type cognitive memory system
├── thought-graph/          # DAG of thoughts with evidence + confidence
├── sensors/                # 11 real-world sensors
├── flux-runtime/           # Central runtime connecting all systems
├── experience-db/          # Past action outcomes
├── meta-cognition/         # Thinking about thinking
├── strategy-library/       # Reusable problem-solving strategies
├── confidence-calibration/ # Accuracy tracking
├── knowledge-consolidation/# Long-term knowledge management
├── habit-discovery/        # Behavioral pattern detection
├── self-evolution-core/    # Self-improvement orchestrator
├── personality/            # 8 personality presets
├── user-model/             # User preference tracking
├── relationship/           # Interaction history and rapport
├── timeline/               # 23 event types for life logging
├── speech/                 # Response generation
├── learning/               # Pattern recognition
├── reflection/             # Meta-cognitive analysis
├── companion/              # Companion personality
├── vision/                 # Screen capture and analysis
├── workspace/              # File system monitoring
├── calendar/               # Event tracking
├── email/                  # Inbox monitoring
├── notification-intel/     # Priority-based alerting
├── presence/               # User activity detection
├── multi-device/           # Cross-device sync
├── context-fusion/         # Merging observations
├── prediction/             # User intent forecasting
├── ambient-core/           # Ambient intelligence orchestrator
├── ambient-types/          # Ambient system types
├── exec-types/             # Executive intelligence types
├── agent-protocol/         # Autonomous agent execution
├── agent-framework/        # 7 built-in agents
├── agent-registry/         # Agent lifecycle management
├── task-graph/             # Dependency-aware task scheduling
├── executive-planner/      # High-level goal decomposition
├── delegation/             # Task assignment to agents
├── execution-supervisor/   # Progress monitoring
├── resource-manager/       # Capacity allocation
├── approval-pipeline/      # Human-in-the-loop approvals
├── verification/           # Action verification
├── background-projects/    # Long-running task tracking
├── long-goals/             # Multi-session goal persistence
├── executive-core/         # Executive intelligence orchestrator
├── automation-builder/     # Automatic workflow creation
├── cognitive-health/       # System health monitoring
├── simulation-engine/      # What-if analysis
├── research-mode/          # Deep exploration capability
├── skill-library/          # Learned capability registry
├── workflow-discovery/     # Automatic workflow detection
├── services/               # 12 specialized services
│   ├── core/               # Service interface, Orchestrator
│   ├── chat/               # General conversation
│   ├── coding/             # Code assistant
│   ├── search/             # DuckDuckGo web search
│   ├── system/             # OS control
│   ├── reminders/          # Notes & tasks
│   ├── files/              # File browsing
│   ├── notifications/      # Desktop notifications
│   ├── monitor/            # System monitoring
│   ├── automations/        # Task automation
│   ├── context/            # Context management
│   └── proactive/          # Proactive suggestions
└── voice/
    ├── stt/                # Speech-to-text (Whisper)
    ├── tts/                # Text-to-speech (Piper/espeak)
    └── pipeline/           # Record → STT → Text → TTS → Play

apps/
├── cli/                    # Terminal interface (rich TUI)
├── api/                    # HTTP API server (port 3141)
└── desktop/                # Tauri v2 desktop app
```

---

## Requirements

- Node.js 22+
- pnpm 10+
- Rust + Cargo (for Tauri desktop app)
- Ollama running locally (for LLM responses)

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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Send a message, get a reply |
| GET | `/health` | Health check |
| GET | `/services` | List available services |

```bash
curl -X POST http://localhost:3141/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Flux!"}'
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/history` | View message history |
| `/models` | Configure providers and models |
| `/mode` | Switch between plan/normal/auto |
| `/daemon start` | Start background cognition |
| `/daemon stop` | Stop background cognition |
| `/daemon status` | Show daemon status and stats |
| `/save` | Save current session |
| `/load` | Load a saved session |
| `/clear` | Clear screen |
| `/exit` | Quit |

---

## Voice

Voice uses fully local engines (no cloud APIs):

- **STT**: Whisper via `@xenova/transformers` (pure JS, ~150MB model)
- **TTS**: Piper (neural, fast) or espeak-ng (fallback)
- **Activation**: Push-to-talk (hold key to record)

---

## Configuration

`settings.json` at project root:

```json
{
  "providers": {
    "ollama": {
      "enabled": true,
      "baseUrl": "http://localhost:11434",
      "defaultModel": "qwen2.5-coder:7b"
    }
  }
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 6+ / Rust |
| Runtime | Node.js 22+ |
| Build | Turborepo + tsc |
| LLM | Ollama (local) |
| Desktop | Tauri v2 |
| Frontend | Vanilla JS (no framework) |
| Voice STT | Whisper (@xenova/transformers) |
| Voice TTS | Piper / espeak-ng |
| Search | DuckDuckGo API |
| File Watch | fs.watch (inotify/fsevents) |
| Sensors | D-Bus, xdotool, xclip, playerctl |
| Testing | Vitest (550+ tests, 66 test files) |

---

## License

MIT
