#!/usr/bin/env node

import { DefaultAgent, DefaultPlanner } from "@ai-agent/agent";
import {
  DefaultToolRegistry,
  DefaultToolExecutor,
} from "@ai-agent/tools";

import { echoTool } from "@ai-agent/tools";
import { DefaultSession } from "../../../packages/agent/src/session/default-session.js";

// -------------------------
// Setup system
// -------------------------

const registry = new DefaultToolRegistry();
registry.register(echoTool);

const executor = new DefaultToolExecutor(registry);
const session = new DefaultSession("demo");
const planner = new DefaultPlanner();

const agent = new DefaultAgent(planner, executor);

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

    const result = await agent.run(session, {
      input: {
          message,
      },
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