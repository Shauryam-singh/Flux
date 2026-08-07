/**
 * File Creator Service
 *
 * Creates, generates, and writes files based on natural language prompts.
 * Supports code generation, documentation, presentations, and more.
 *
 * Commands:
 *   "create a Python script that..." → write code file
 *   "write a README for this project" → analyze codebase, generate docs
 *   "make a presentation about..." → generate slides
 *   "generate a Dockerfile" → create Dockerfile
 *   "write tests for..." → generate test files
 *   "create a config file for..." → generate configuration
 *   "write documentation for..." → generate API docs
 *   "make a shell script that..." → create bash script
 *   "generate a package.json for..." → create project config
 *   "write a proposal for..." → generate document
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname, basename, resolve, relative } from "node:path";
import { homedir } from "node:os";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── File Templates ─────────────────────────────────────────────

interface FileTemplate {
  extension: string;
  language: string;
  template: (name: string, description: string) => string;
}

const FILE_TEMPLATES: Record<string, FileTemplate> = {
  python: {
    extension: ".py",
    language: "python",
    template: (name, desc) => `#!/usr/bin/env python3
"""
${name}

${desc}
"""

import sys
import argparse
from typing import Optional, List


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="${desc}")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose output")
    args = parser.parse_args()

    if args.verbose:
        print(f"Running {__file__}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
`,
  },

  javascript: {
    extension: ".js",
    language: "javascript",
    template: (name, desc) => `#!/usr/bin/env node
/**
 * ${name}
 *
 * ${desc}
 */

"use strict";

/**
 * Main function
 * @param {string[]} args - Command line arguments
 * @returns {number} Exit code
 */
function main(args) {
  console.log("${name} - ${desc}");
  return 0;
}

// Run if called directly
if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { main };
`,
  },

  typescript: {
    extension: ".ts",
    language: "typescript",
    template: (name, desc) => `#!/usr/bin/env node
/**
 * ${name}
 *
 * ${desc}
 */

interface Config {
  verbose: boolean;
}

/**
 * Main function
 * @param config - Configuration options
 * @returns Promise that resolves when complete
 */
async function main(config: Config): Promise<void> {
  if (config.verbose) {
    console.log("Running ${name}...");
  }

  console.log("${desc}");
}

// Run if called directly
if (require.main === module) {
  main({ verbose: process.argv.includes("--verbose") })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { main };
export type { Config };
`,
  },

  go: {
    extension: ".go",
    language: "go",
    template: (name, desc) => `package main

import (
\t"flag"
\t"fmt"
\t"os"
)

// ${name} - ${desc}
func main() {
\tverbose := flag.Bool("v", false, "Enable verbose output")
\tflag.Parse()

\tif *verbose {
\t\tfmt.Printf("Running %s\\n", os.Args[0])
\t}

\tfmt.Println("${desc}")
}
`,
  },

  rust: {
    extension: ".rs",
    language: "rust",
    template: (name, desc) => `//! ${name}
//!
//! ${desc}

use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    let verbose = args.iter().any(|a| a == "--verbose" || a == "-v");

    if verbose {
        println!("Running {}...", args[0]);
    }

    println!("${desc}");
}
`,
  },

  shell: {
    extension: ".sh",
    language: "bash",
    template: (name, desc) => `#!/usr/bin/env bash
#
# ${name}
#
# ${desc}
#

set -euo pipefail

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Default values
VERBOSE=false

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -v, --verbose    Enable verbose output"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "${desc}"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "\${RED}Error: Unknown option $1\${NC}"
            usage
            exit 1
            ;;
    esac
done

# Main function
main() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "\${GREEN}Running $0...\${NC}"
    fi

    echo "${desc}"
}

main "$@"
`,
  },

  dockerfile: {
    extension: "",
    language: "dockerfile",
    template: (name, desc) => `# ${name}
# ${desc}

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node dist/healthcheck.js

# Start application
CMD ["node", "dist/index.js"]
`,
  },

  readme: {
    extension: ".md",
    language: "markdown",
    template: (name, desc) => `# ${name}

${desc}

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/your-username/${name.toLowerCase().replace(/\s+/g, "-")}.git

# Navigate to project directory
cd ${name.toLowerCase().replace(/\s+/g, "-")}

# Install dependencies
npm install
\`\`\`

## Usage

\`\`\`bash
# Run the application
npm start
\`\`\`

## Configuration

Create a \`.env\` file in the root directory:

\`\`\`env
NODE_ENV=development
PORT=3000
\`\`\`

## API Documentation

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/status | Get status |

## Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all contributors
- Inspired by various open-source projects
`,
  },

  presentation: {
    extension: ".md",
    language: "markdown-slides",
    template: (name, desc) => `---
marp: true
theme: default
paginate: true
backgroundColor: #fff
backgroundImage: url('https://marp.app/assets/hero.jpg')
---

# ${name}

${desc}

---

## Overview

- Topic 1
- Topic 2
- Topic 3
- Topic 4

---

## Key Points

- **Point 1**: Description
- **Point 2**: Description
- **Point 3**: Description

---

## Analysis

| Metric | Value | Change |
|--------|-------|--------|
| Metric 1 | 100 | +10% |
| Metric 2 | 200 | +5% |
| Metric 3 | 300 | -2% |

---

## Timeline

1. **Phase 1** - Planning (Week 1-2)
2. **Phase 2** - Development (Week 3-8)
3. **Phase 3** - Testing (Week 9-10)
4. **Phase 4** - Launch (Week 11)

---

## Code Example

\`\`\`python
def hello_world():
    print("Hello, World!")
    return True

if __name__ == "__main__":
    hello_world()
\`\`\`

---

## Next Steps

- Complete Phase 1
- Review with stakeholders
- Begin Phase 2

---

# Thank You!

Questions?
`,
  },

  "package.json": {
    extension: ".json",
    language: "json",
    template: (name, desc) => `{
  "name": "${name.toLowerCase().replace(/\s+/g, "-")}",
  "version": "1.0.0",
  "description": "${desc}",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest",
    "lint": "eslint .",
    "build": "tsc"
  },
  "keywords": [],
  "author": "",
  "license": "MIT",
  "dependencies": {},
  "devDependencies": {}
}
`,
  },

  "tsconfig.json": {
    extension: ".json",
    language: "json",
    template: (name, desc) => `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,
  },

  pytest: {
    extension: ".py",
    language: "python",
    template: (name, desc) => `"""
Tests for ${name}

${desc}
"""

import pytest


class Test${name.replace(/[^a-zA-Z0-9]/g, "")}:
    """Test suite for ${name}."""

    def test_example(self):
        """Test example function."""
        assert True

    def test_addition(self):
        """Test basic addition."""
        assert 1 + 1 == 2

    @pytest.mark.parametrize("input,expected", [
        (1, 2),
        (2, 3),
        (3, 4),
    ])
    def test_increment(self, input: int, expected: int):
        """Test increment function."""
        assert input + 1 == expected
`,
  },

  jest: {
    extension: ".test.js",
    language: "javascript",
    template: (name, desc) => `/**
 * Tests for ${name}
 *
 * ${desc}
 */

describe("${name}", () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it("should return true", () => {
    expect(true).toBe(true);
  });

  it("should add two numbers", () => {
    expect(1 + 1).toBe(2);
  });

  describe("example function", () => {
    it("should handle basic case", () => {
      const result = 42;
      expect(result).toBe(42);
    });

    it("should handle edge case", () => {
      const result = null;
      expect(result).toBeNull();
    });
  });
});
`,
  },
};

// ─── Code Analysis Helpers ──────────────────────────────────────

interface ProjectInfo {
  name: string;
  description: string;
  language: string;
  framework: string;
  files: string[];
  packageJson?: Record<string, unknown>;
  readme?: string;
}

function analyzeProject(dir: string): ProjectInfo {
  const info: ProjectInfo = {
    name: basename(dir),
    description: "",
    language: "unknown",
    framework: "unknown",
    files: [],
  };

  try {
    // Read package.json if exists
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      info.name = pkg.name ?? info.name;
      info.description = pkg.description ?? "";
      info.packageJson = pkg;

      if (pkg.dependencies) {
        const deps = Object.keys(pkg.dependencies);
        if (deps.includes("react") || deps.includes("react-dom")) info.framework = "React";
        else if (deps.includes("vue")) info.framework = "Vue";
        else if (deps.includes("express")) info.framework = "Express";
        else if (deps.includes("fastify")) info.framework = "Fastify";
        else if (deps.includes("next")) info.framework = "Next.js";
        else if (deps.includes("nuxt")) info.framework = "Nuxt";
      }
    }

    // Read README if exists
    const readmePath = join(dir, "README.md");
    if (existsSync(readmePath)) {
      info.readme = readFileSync(readmePath, "utf-8");
    }

    // Detect language by file extensions
    const files = readdirSync(dir, { withFileTypes: true });
    const extCounts: Record<string, number> = {};

    for (const file of files) {
      if (file.isFile() && !file.name.startsWith(".") && file.name !== "node_modules") {
        info.files.push(file.name);
        const ext = extname(file.name);
        if (ext) {
          extCounts[ext] = (extCounts[ext] ?? 0) + 1;
        }
      }
    }

    // Find most common extension
    let maxCount = 0;
    for (const [ext, count] of Object.entries(extCounts)) {
      if (count > maxCount) {
        maxCount = count;
        info.language = ext;
      }
    }
  } catch {
    // Ignore errors
  }

  return info;
}

function readCodebase(dir: string, maxFiles = 50): string {
  const contents: string[] = [];
  let fileCount = 0;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (fileCount >= maxFiles) break;

      const fullPath = join(dir, entry.name);
      if (entry.isFile() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        try {
          const content = readFileSync(fullPath, "utf-8");
          const lines = content.split("\n").slice(0, 100); // First 100 lines
          contents.push(`--- ${entry.name} ---\n${lines.join("\n")}\n`);
          fileCount++;
        } catch {
          // Skip binary files
        }
      } else if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        contents.push(`--- ${entry.name}/ (directory) ---`);
      }
    }
  } catch {
    // Ignore errors
  }

  return contents.join("\n");
}

// ─── LLM Integration ────────────────────────────────────────────

async function generateWithLlm(
  provider: { complete: (opts: { model: string; prompt: string; temperature: number; max_tokens?: number }) => Promise<{ text: string }> } | null,
  prompt: string,
  temperature = 0.7,
): Promise<string | null> {
  if (!provider) return null;
  try {
    const result = await provider.complete({
      model: "qwen2.5-coder:7b",
      prompt,
      temperature,
      max_tokens: 4096,
    });
    return result.text.trim();
  } catch {
    return null;
  }
}

// ─── Intent Parsing ─────────────────────────────────────────────

interface CreateIntent {
  action: "create" | "generate" | "write" | "make";
  fileType: string;
  targetPath: string | undefined;
  description: string;
  language: string | undefined;
  options: Record<string, string>;
}

function parseCreateIntent(input: string): CreateIntent | null {
  const lower = input.toLowerCase();

  // Detect file type - check for test/spec first as they override other types
  let fileType = "unknown";
  let language: string | undefined;

  // Check for test files first (they override other language types)
  if (/\b(test|spec|tests)\b/.test(lower)) {
    if (/\b(python|pytest|\.py)\b/.test(lower)) {
      fileType = "pytest";
      language = "python";
    } else {
      fileType = "jest";
      language = "javascript";
    }
  } else if (/\b(python|\.py)\b/.test(lower)) {
    fileType = "python";
    language = "python";
  } else if (/\b(javascript|\.js)\b/.test(lower) && !/\b(node\.?js)\b/.test(lower)) {
    fileType = "javascript";
    language = "javascript";
  } else if (/\b(typescript|\.ts)\b/.test(lower)) {
    fileType = "typescript";
    language = "typescript";
  } else if (/\b(go|golang)\b/.test(lower)) {
    fileType = "go";
    language = "go";
  } else if (/\b(rust|\.rs)\b/.test(lower)) {
    fileType = "rust";
    language = "rust";
  } else if (/\b(shell|bash|\.sh)\b/.test(lower)) {
    fileType = "shell";
    language = "bash";
  } else if (/\b(dockerfile|docker)\b/.test(lower)) {
    fileType = "dockerfile";
    language = "dockerfile";
  } else if (/\b(readme|documentation|docs?)\b/.test(lower)) {
    fileType = "readme";
    language = "markdown";
  } else if (/\b(presentation|slides?|slideshow)\b/.test(lower)) {
    fileType = "presentation";
    language = "markdown-slides";
  } else if (/\b(package\.json)\b/.test(lower)) {
    fileType = "package.json";
    language = "json";
  } else if (/\b(tsconfig)\b/.test(lower)) {
    fileType = "tsconfig.json";
    language = "json";
  }

  // Extract target path
  const pathMatch = input.match(/(?:to|in|at|into)\s+([\/\w.-]+)/i);
  const targetPath = pathMatch ? pathMatch[1] : undefined;

  // Extract description
  const descMatch = input.match(/(?:that|which|for|to)\s+(.+)/i);
  const description = descMatch?.[1]?.trim() ?? input;

  // Extract options
  const options: Record<string, string> = {};
  const optMatches = input.matchAll(/(\w+):\s*(\w+)/g);
  for (const match of optMatches) {
    if (match[1] && match[2]) {
      options[match[1]] = match[2];
    }
  }

  return {
    action: "create",
    fileType,
    targetPath,
    description,
    language,
    options,
  };
}

// ─── File Writing ───────────────────────────────────────────────

function writeGeneratedFile(
  dir: string,
  fileName: string,
  content: string,
  overwrite = false,
): { success: boolean; path: string; error?: string } {
  try {
    const filePath = join(dir, fileName);

    // Check if file exists
    if (existsSync(filePath) && !overwrite) {
      return { success: false, path: filePath, error: "File already exists. Use overwrite option." };
    }

    // Create directory if it doesn't exist
    const dirPath = dirname(filePath);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    // Write file
    writeFileSync(filePath, content, "utf-8");
    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, path: "", error: e instanceof Error ? e.message : String(e) };
  }
}

function generateFileName(description: string, template: FileTemplate): string {
  // Handle special cases with fixed filenames
  if (template.language === "markdown" && template.extension === ".md") {
    // Check if it's a README or presentation
    if (description.toLowerCase().includes("readme") || description.toLowerCase().includes("documentation")) {
      return "README.md";
    }
    if (description.toLowerCase().includes("presentation") || description.toLowerCase().includes("slides")) {
      return "presentation.md";
    }
  }

  if (template.language === "json") {
    if (description.toLowerCase().includes("package")) {
      return "package.json";
    }
    if (description.toLowerCase().includes("tsconfig")) {
      return "tsconfig.json";
    }
  }

  // Clean description for filename
  const clean = description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);

  return `${clean}${template.extension}`;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(create|generate|write|make)\s+(a\s+)?(python|javascript|typescript|go|rust|shell|bash|dockerfile|readme|documentation|presentation|slides?|package\.json|tsconfig|test|spec|script|file)\b/i;

export function createFileCreatorService(): Service {
  return {
    name: "file-creator",
    description: "File creation & generation — code, documentation, presentations, configs, tests",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      try {
        const intent = parseCreateIntent(input);
        if (!intent) {
          return { text: "Could not parse file creation request. Try: create a Python script, write a README, make a presentation" };
        }

        const template = FILE_TEMPLATES[intent.fileType];
        if (!template) {
          return { text: `Unknown file type: ${intent.fileType}. Supported: python, javascript, typescript, go, rust, shell, dockerfile, readme, presentation, package.json, tsconfig.json, test/spec` };
        }

        // Generate content with LLM if available
        let content: string;
        if (ctx.provider) {
          const llmPrompt = `Generate a ${template.language} file for: ${intent.description}

Requirements:
- Follow best practices for ${template.language}
- Include proper error handling
- Add helpful comments
- Make it production-ready

Provide ONLY the code, no explanations.`;

          const llmContent = await generateWithLlm(ctx.provider, llmPrompt);
          content = llmContent ?? template.template(intent.description, intent.description);
        } else {
          content = template.template(intent.description, intent.description);
        }

        // Determine output path
        const outputDir = intent.targetPath
          ? resolve(process.cwd(), intent.targetPath)
          : process.cwd();

        const fileName = generateFileName(intent.description, template);

        // Write the file
        const result = writeGeneratedFile(outputDir, fileName, content, lower.includes("overwrite"));

        if (!result.success) {
          return { text: `Error creating file: ${result.error}` };
        }

        // Build response
        const response = [
          `Created: ${result.path}`,
          "",
          `File type: ${intent.fileType}`,
          `Language: ${template.language}`,
          "",
          "Content preview:",
          "```" + template.language,
          content.split("\n").slice(0, 20).join("\n"),
          content.split("\n").length > 20 ? "\n... (truncated)" : "",
          "```",
        ].join("\n");

        return { text: response };
      } catch (e) {
        return { text: `File creation error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}

// ─── Export Templates for Testing ───────────────────────────────

export { FILE_TEMPLATES, type FileTemplate, type CreateIntent, parseCreateIntent, generateFileName };
