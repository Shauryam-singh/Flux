# Flux

A production-quality, modular AI Coding Agent platform built as a TypeScript monorepo.

The project is designed around composable packages that separate concerns such as providers, routing, tools, memory, configuration, and agent orchestration. The goal is to provide a flexible foundation for building AI-powered coding assistants that can run in the terminal, VS Code, web applications, or APIs.

---

# Features

- Modular monorepo architecture
- Provider abstraction layer
- Intelligent request routing
- Tool registry and execution system
- Configurable middleware pipeline
- Extensible agent framework
- CLI interface
- Web/API ready architecture
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
├── api/
├── cli/
├── vscode/
└── web/

packages/
├── agent/
├── config/
├── providers/
├── router/
├── shared/
└── tools/

docs/

scripts/
```

## Packages

### `packages/shared`

Shared interfaces, utilities, common types and abstractions.

---

### `packages/config`

Application configuration loading, validation and defaults.

---

### `packages/providers`

LLM provider abstraction.

Examples:

- OpenAI
- Anthropic
- Gemini
- Ollama

---

### `packages/router`

Routes requests to providers using configurable strategies.

Includes:

- Middleware pipeline
- Retry policies
- Failover policies
- Routing strategies

---

### `packages/tools`

Tool registry and execution framework.

Current example:

- Echo Tool

Future tools may include:

- File system
- Terminal
- Git
- Search
- Web
- Code execution

---

### `packages/agent`

Coordinates routing, providers, memory, sessions and tools into a complete AI agent.

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

# Running the CLI

Development mode:

```bash
pnpm --filter @ai-agent/cli dev echo "Hello World"
```

Example output:

```text
{
  success: true,
  result: {
    success: true,
    output: {
      message: "Hello World"
    }
  }
}
```

---

# Project Status

## Completed

- Monorepo setup
- Shared package
- Configuration system
- Provider abstraction
- Router
- Retry middleware
- Timeout middleware
- Failover middleware
- Tool registry
- Tool executor
- Default tool implementation
- Echo tool example
- Agent integration
- CLI integration

---

## In Progress

- Planner
- Memory system
- Sessions
- Multi-tool orchestration

---

## Planned

- OpenAI Provider
- Anthropic Provider
- Gemini Provider
- Ollama Provider
- File tools
- Git tools
- Shell tools
- Web search
- Streaming responses
- VS Code extension
- REST API
- Web UI

---

# Philosophy

This project follows a modular architecture where every subsystem has a single responsibility.

- Providers generate AI responses.
- Router selects providers.
- Tools perform external actions.
- Agent orchestrates execution.
- Memory stores context.
- Sessions manage conversations.

This separation keeps the codebase maintainable, testable and easily extensible.

---

# License

MIT