# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

All development commands are pnpm scripts that can be run with `pnpm run <script>` or via `turbo` directly:

```
- Build all packages: pnpm run build
- Type checking: pnpm run typecheck
- Linting: pnpm run lint
- Format code: pnpm run format
- Run tests: pnpm run test

Built with pnpm 11.3.0, TypeScript 6.0.3, and Turbo 2.10.3.
```

## Code Architecture

### Monorepo Structure
```
├── apps/
│   ├── api/
│   ├── cli/
│   ├── vscode/
│   └── web/
└── packages/
    ├── agent/
    ├── config/
    ├── providers/
    ├── router/
    ├── shared/
    └── tools/
```

### Key Components
1. **Providers**: LLM abstraction layer (Anthropic, OpenAI, etc.)
2. **Router**: Routes requests to providers using configurable strategies
3. **Tools**: Registry and execution system for external operations
4. **Agent**: Coordinates routing, providers, tools, and memory
5. **Memory**: Persistent context storage (stored in /memory/)
6. **Sessions**: Manage conversation state

### Workflow
1. Commands are executed through the CLI tools package
2. Requests are routed through the router to providers
3. Tools handle file system, terminal, and code execution operations
4. Agent orchestrates the entire process with memory context

## Foundational Files

- `README.md`: Documentation and setup instructions
- `trace.txt`: Execution history
- `.claude/memory/`: Context storage
- `.claude/worktrees/`: Isolated development contexts
- `scripts/`: Custom utilities

This modular architecture enables incremental development and maintainability.