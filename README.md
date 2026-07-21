# Flux

A production-quality, modular AI Coding Agent platform built as a TypeScript monorepo.

The project is designed around composable packages that separate concerns such as providers, routing, tools, memory, configuration, and agent orchestration. The goal is to provide a flexible foundation for building AI-powered coding assistants that can run in the terminal, VS Code, web applications, or APIs.

---

# Features

- Modular monorepo architecture
- Provider abstraction layer (OpenAI, Anthropic, Ollama, OpenRouter)
- Intelligent request routing
- Tool registry and execution system
- Streaming responses with real-time token display
- Multi-turn conversation with chat history
- Interactive CLI with syntax highlighting
- Mode system (Plan, Auto, Normal)
- Git integration tools
- File system tools (read, write, edit, list)
- Shell command execution
- Session persistence
- Type-safe throughout the entire project

---

# Project Overview

The architecture is split into independent packages.

```
                +----------------+
                |      CLI       |
                +----------------+
                        │
                        ▼
                +----------------+
                |     Agent      |
                +----------------+
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Router         Tool System      Memory
        │               │               │
        ▼               ▼               ▼
    Providers      Registered Tools   Sessions
```

Each package has a single responsibility and can be developed independently.

---

# Requirements

- Node.js 22+
- pnpm 10+
- TypeScript 5+

Verify your environment:

```bash
node -v
pnpm -v
```

---

# Installation

Clone the repository.

```bash
git clone <repository-url>

cd ai-coding-agent
```

Install dependencies.

```bash
pnpm install
```

---

# Workspace Structure

```
apps/
├── cli/                    # Interactive CLI interface
├── api/                    # REST API (planned)
├── vscode/                 # VS Code extension (planned)
└── web/                    # Web UI (planned)

packages/
├── agent/                  # Agent orchestration
├── config/                 # Configuration management
├── providers/              # LLM provider abstraction
├── router/                 # Request routing
├── shared/                 # Shared utilities
└── tools/                  # Tool registry and implementations

docs/
scripts/
```

---

# Completed Features

## Core Architecture
- ✅ Monorepo setup with pnpm workspaces
- ✅ Shared package with common types
- ✅ Configuration system with auto-generation
- ✅ Provider abstraction layer
- ✅ Request router with middleware pipeline
- ✅ Tool registry and execution framework

## LLM Providers
- ✅ Ollama provider (local models)
- ✅ OpenAI provider
- ✅ Anthropic provider
- ✅ OpenRouter provider
- ✅ Streaming response support

## Tools
- ✅ File operations (read, write, edit, list directory)
- ✅ Shell command execution
- ✅ Git operations (status, diff, log, add, commit, branch, checkout, push, pull)
- ✅ Echo tool for conversational responses
- ✅ Multi-file editing in single response
- ✅ Multi-tool execution support

## CLI Features
- ✅ Interactive terminal interface
- ✅ Real-time streaming token display
- ✅ Syntax highlighting for code blocks
- ✅ Diff preview for file operations
- ✅ Chat history persistence
- ✅ Session save/load
- ✅ Command suggestions and autocomplete
- ✅ Provider/model selection with `/models`
- ✅ Multi-turn conversation context
- ✅ Multiple tool result display

## Agent Capabilities
- ✅ LLM-based planning with tool selection
- ✅ Mode system:
  - **Plan mode** (⊙): Preview what would be done, no execution
  - **Normal mode** (○): Execute operations directly
  - **Auto mode** (⚡): Execute without restrictions
- ✅ Memory system for conversation history
- ✅ Multi-tool orchestration
- ✅ Batch file creation
- ✅ Session management

---

# Usage

## Starting the CLI

```bash
pnpm --filter @ai-agent/cli dev
```

## Interactive Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/history` | View message history |
| `/models` | Configure providers and models |
| `/mode` | Switch between plan/normal/auto modes |
| `/save` | Save current session |
| `/load` | Load a saved session |
| `/clear` | Clear the screen |
| `/exit` | Quit the application |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Shift+Tab` | Cycle through modes |
| `Tab` | Autocomplete commands |
| `↑/↓` | Navigate command history |
| `Ctrl+C` | Exit |

## Mode System

### Plan Mode (⊙)
- Shows what would be done without executing
- Displays diff preview for file operations
- Safe for exploring changes

### Normal Mode (○)
- Executes operations directly
- Default mode for most tasks

### Auto Mode (⚡)
- Executes without restrictions
- For trusted operations

## Example Session

```
> Create a React component file

✦ Agent
  📝 Creating file: src/App.tsx
  ────────────────────────────────────────
  │ import React from 'react';
  │ 
  │ interface AppProps {
  │   title: string;
  │ }
  │ 
  │ export const App: React.FC<AppProps> = ({ title }) => {
  │   return <div>{title}</div>;
  │ };
  ────────────────────────────────────────
  15 in · 120 out · 2.1s · ollama/qwen2.5-coder:7b
```

---

# Development

Install dependencies.

```bash
pnpm install
```

Build every package.

```bash
pnpm build
```

Type check.

```bash
pnpm typecheck
```

Lint.

```bash
pnpm lint
```

Format source.

```bash
pnpm format
```

---

# Future Implementations

## High Priority
- 🔲 Interactive approval with arrow key navigation
- 🔲 Multi-file editing in single response
- 🔲 Undo/redo support for file operations
- 🔲 Better error recovery and retry logic
- 🔲 Web search integration

## Medium Priority
- 🔲 REST API server
- 🔲 VS Code extension
- 🔲 Web UI with React
- 🔲 Plugin system for custom tools
- 🔲 Code execution sandbox

## Low Priority
- 🔲 Voice input support
- 🔲 Image understanding
- 🔲 Multi-language support
- 🔲 Team collaboration features
- 🔲 Cloud session sync

---

# Configuration

Configuration is stored in `settings.json` at the project root:

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "defaultModel": "qwen2.5-coder:7b"
    },
    "openai": {
      "apiKey": "your-api-key",
      "defaultModel": "gpt-4"
    }
  }
}
```

---

# Philosophy

This project follows a modular architecture where every subsystem has a single responsibility.

- **Providers** generate AI responses
- **Router** selects providers
- **Tools** perform external actions
- **Agent** orchestrates execution
- **Memory** stores context
- **Sessions** manage conversations

This separation keeps the codebase maintainable, testable and easily extensible.

---

# License

MIT
