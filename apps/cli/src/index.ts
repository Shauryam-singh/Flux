#!/usr/bin/env node

import { DefaultAgent } from "@ai-agent/agent";
import {
  DefaultToolRegistry,
  DefaultToolExecutor,
} from "@ai-agent/tools";

import { echoTool } from "@ai-agent/tools";

// -------------------------
// Setup system
// -------------------------

const registry = new DefaultToolRegistry();
registry.register(echoTool);

const executor = new DefaultToolExecutor(registry);

const agent = new DefaultAgent(registry, executor);

// -------------------------
// CLI parsing
// -------------------------

const [, , command, ...args] = process.argv;

async function main() {
  if (!command) {
    console.log(`
Usage:
  cli echo <message>
    `);
    process.exit(1);
  }

  // -------------------------
  // echo command
  // -------------------------
  if (command === "echo") {
    const message = args.join(" ");

    const result = await agent.run({
      input: { message },
    });

    console.dir(result, { depth: null, colors: true });
    return;
  }

  // -------------------------
  // fallback
  // -------------------------
  console.log(`Unknown command: ${command}`);
}

main();