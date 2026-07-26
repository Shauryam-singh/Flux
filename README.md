# Flux

A JARVIS-inspired AI assistant platform built as a TypeScript monorepo. Supports text and voice I/O, multiple specialized services, and runs on both desktop (Tauri) and terminal (CLI). Powered by Ollama for fully offline, local AI.

---

## Features

- **Multi-service architecture** — Chat, coding, web search, system control, reminders, file manager
- **Voice I/O** — Push-to-talk with local Whisper STT + Piper/espeak TTS (fully offline)
- **Desktop app** — Tauri v2 + vanilla JS frontend (Windows & Linux)
- **Terminal CLI** — Rich interactive TUI with syntax highlighting
- **REST API** — HTTP server for desktop/external clients
- **Provider abstraction** — Ollama, OpenAI, Anthropic, OpenRouter
- **Tool system** — 22+ tools: file ops, git, shell, scaffolding, undo/redo
- **Mode system** — Plan (preview), Normal (execute), Auto (no approval)
- **Session persistence** — Conversation history saved to disk

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
        ┌──────────────┐  ┌──────────────┐
        │ Orchestrator │  │    Agent     │
        │ (services)   │  │  (tools)     │
        └──────┬───────┘  └──────┬───────┘
               │                 │
     ┌────┬────┼────┬────┬───┐   │
     ▼    ▼    ▼    ▼    ▼   ▼   ▼
   chat coding search  system   tools
   reminders files       │
                         │
                  ┌──────┼──────┐
                  ▼      ▼      ▼
              Providers Router Memory
```

---

## Workspace Structure

```
packages/
├── shared/                 # Core types, Result<T,E>, EventBus
├── config/                 # Configuration management
├── providers/              # LLM providers (Ollama, OpenAI, Anthropic)
├── router/                 # Request routing with middleware
├── tools/                  # Tool registry + implementations
├── agent/                  # Agent orchestration (planner + tools)
├── services/
│   ├── core/               # Service interface, Orchestrator, IntentClassifier
│   ├── chat/               # General conversation
│   ├── coding/             # Code assistant (wraps tools)
│   ├── search/             # DuckDuckGo web search
│   ├── system/             # OS control (open apps, volume, info)
│   ├── reminders/          # Notes & tasks (JSON-backed)
│   └── files/              # File browser
└── voice/
    ├── stt/                # Speech-to-text (Whisper via @xenova/transformers)
    ├── tts/                # Text-to-speech (Piper / espeak)
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

### Build the Desktop App

```bash
cd apps/desktop
npx tauri build
# Binary: src-tauri/target/release/flux-desktop
# Deb:    src-tauri/target/release/bundle/deb/Flux_0.1.0_amd64.deb
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
| `/save` | Save current session |
| `/load` | Load a saved session |
| `/clear` | Clear screen |
| `/exit` | Quit |

| Key | Action |
|-----|--------|
| `Shift+Tab` | Cycle modes |
| `Tab` | Autocomplete |
| `↑/↓` | Command history |
| `Ctrl+C` | Exit |

---

## Voice

Voice uses fully local engines (no cloud APIs):

- **STT**: Whisper via `@xenova/transformers` (pure JS, ~150MB model)
- **TTS**: Piper (neural, fast) or espeak-ng (fallback)
- **Activation**: Push-to-talk (hold key to record)

Install voice dependencies when needed:

```bash
npm install @xenova/transformers  # For Whisper STT
```

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

## Services

| Service | Keywords | Description |
|---------|----------|-------------|
| `chat` | (fallback) | General conversation, Q&A |
| `coding` | code, file, function, bug, git | Code assistant with tools |
| `search` | search, look up, what is | DuckDuckGo web search |
| `system` | open, volume, battery | OS control |
| `reminders` | remind, note, task, todo | Notes & task management |
| `files` | find file, list, directory | File browsing |

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

---

## License

MIT
