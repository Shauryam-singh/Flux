import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFileCreatorService, FILE_TEMPLATES, parseCreateIntent, generateFileName } from "../impl/file-creator-service.js";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

describe("fileCreatorService", () => {
  let service: ReturnType<typeof createFileCreatorService>;
  const mockContext = {
    provider: {
      complete: vi.fn().mockResolvedValue({ text: "Generated code content" }),
    },
    memory: {
      add: vi.fn(),
      history: vi.fn().mockResolvedValue([]),
    },
  } as any;

  const testDir = join(tmpdir(), "flux-file-creator-test");

  beforeEach(() => {
    service = createFileCreatorService();
    vi.clearAllMocks();
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should have correct name", () => {
    expect(service.name).toBe("file-creator");
  });

  it("should have canHandle method", () => {
    expect(typeof service.canHandle).toBe("function");
  });

  it("should handle file creation queries", () => {
    expect(service.canHandle("create a Python script")).toBe(true);
    expect(service.canHandle("generate a Dockerfile")).toBe(true);
    expect(service.canHandle("write a README")).toBe(true);
    expect(service.canHandle("make a presentation")).toBe(true);
    expect(service.canHandle("create a test file")).toBe(true);
  });

  it("should not handle non-creation queries", () => {
    expect(service.canHandle("read the file")).toBe(false);
    expect(service.canHandle("what time is it")).toBe(false);
  });

  it("should have execute method", () => {
    expect(typeof service.execute).toBe("function");
  });
});

describe("parseCreateIntent", () => {
  it("should parse Python script creation", () => {
    const intent = parseCreateIntent("create a Python script that monitors disk usage");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("python");
    expect(intent?.language).toBe("python");
    expect(intent?.description).toContain("monitors disk usage");
  });

  it("should parse JavaScript file creation", () => {
    const intent = parseCreateIntent("write a JavaScript file for user authentication");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("javascript");
    expect(intent?.language).toBe("javascript");
  });

  it("should parse TypeScript file creation", () => {
    const intent = parseCreateIntent("create a TypeScript file that handles API requests");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("typescript");
    expect(intent?.language).toBe("typescript");
  });

  it("should parse Go file creation", () => {
    const intent = parseCreateIntent("write a Go program for web scraping");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("go");
    expect(intent?.language).toBe("go");
  });

  it("should parse Rust file creation", () => {
    const intent = parseCreateIntent("create a Rust script for file compression");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("rust");
    expect(intent?.language).toBe("rust");
  });

  it("should parse shell script creation", () => {
    const intent = parseCreateIntent("make a shell script that backs up files");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("shell");
    expect(intent?.language).toBe("bash");
  });

  it("should parse Dockerfile creation", () => {
    const intent = parseCreateIntent("generate a Dockerfile for a Node.js app");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("dockerfile");
    expect(intent?.language).toBe("dockerfile");
  });

  it("should parse README creation", () => {
    const intent = parseCreateIntent("write a README for this project");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("readme");
    expect(intent?.language).toBe("markdown");
  });

  it("should parse presentation creation", () => {
    const intent = parseCreateIntent("make a presentation about Q4 results");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("presentation");
    expect(intent?.language).toBe("markdown-slides");
  });

  it("should parse package.json creation", () => {
    const intent = parseCreateIntent("create a package.json for a new project");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("package.json");
    expect(intent?.language).toBe("json");
  });

  it("should parse test file creation", () => {
    const intent = parseCreateIntent("write tests for the login function");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("jest");
    expect(intent?.language).toBe("javascript");
  });

  it("should parse Python test file creation", () => {
    const intent = parseCreateIntent("write Python tests for the API");
    expect(intent).not.toBeNull();
    expect(intent?.fileType).toBe("pytest");
    expect(intent?.language).toBe("python");
  });
});

describe("FILE_TEMPLATES", () => {
  it("should have templates for all supported file types", () => {
    expect(FILE_TEMPLATES["python"]).toBeDefined();
    expect(FILE_TEMPLATES["javascript"]).toBeDefined();
    expect(FILE_TEMPLATES["typescript"]).toBeDefined();
    expect(FILE_TEMPLATES["go"]).toBeDefined();
    expect(FILE_TEMPLATES["rust"]).toBeDefined();
    expect(FILE_TEMPLATES["shell"]).toBeDefined();
    expect(FILE_TEMPLATES["dockerfile"]).toBeDefined();
    expect(FILE_TEMPLATES["readme"]).toBeDefined();
    expect(FILE_TEMPLATES["presentation"]).toBeDefined();
    expect(FILE_TEMPLATES["package.json"]).toBeDefined();
    expect(FILE_TEMPLATES["pytest"]).toBeDefined();
    expect(FILE_TEMPLATES["jest"]).toBeDefined();
  });

  it("should generate valid Python template", () => {
    const template = FILE_TEMPLATES["python"];
    expect(template).toBeDefined();
    const content = template!.template("test.py", "A test script");
    expect(content).toContain("#!/usr/bin/env python3");
    expect(content).toContain("test.py");
    expect(content).toContain("A test script");
  });

  it("should generate valid JavaScript template", () => {
    const template = FILE_TEMPLATES["javascript"];
    expect(template).toBeDefined();
    const content = template!.template("test.js", "A test script");
    expect(content).toContain("#!/usr/bin/env node");
    expect(content).toContain("test.js");
    expect(content).toContain("A test script");
  });

  it("should generate valid Dockerfile template", () => {
    const template = FILE_TEMPLATES["dockerfile"];
    expect(template).toBeDefined();
    const content = template!.template("MyApp", "A web application");
    expect(content).toContain("FROM node:18-alpine");
    expect(content).toContain("MyApp");
    expect(content).toContain("A web application");
  });

  it("should generate valid README template", () => {
    const template = FILE_TEMPLATES["readme"];
    expect(template).toBeDefined();
    const content = template!.template("MyProject", "An awesome project");
    expect(content).toContain("# MyProject");
    expect(content).toContain("An awesome project");
    expect(content).toContain("## Features");
    expect(content).toContain("## Installation");
  });

  it("should generate valid presentation template", () => {
    const template = FILE_TEMPLATES["presentation"];
    expect(template).toBeDefined();
    const content = template!.template("Q4 Results", "Quarterly review");
    expect(content).toContain("marp: true");
    expect(content).toContain("# Q4 Results");
    expect(content).toContain("Quarterly review");
  });
});

describe("generateFileName", () => {
  it("should generate Python filename", () => {
    const template = FILE_TEMPLATES["python"];
    expect(template).toBeDefined();
    const name = generateFileName("monitor disk usage", template!);
    expect(name).toMatch(/\.py$/);
    expect(name).toContain("monitor-disk-usage");
  });

  it("should generate JavaScript filename", () => {
    const template = FILE_TEMPLATES["javascript"];
    expect(template).toBeDefined();
    const name = generateFileName("user authentication", template!);
    expect(name).toMatch(/\.js$/);
    expect(name).toContain("user-authentication");
  });

  it("should generate README filename", () => {
    const template = FILE_TEMPLATES["readme"];
    expect(template).toBeDefined();
    const name = generateFileName("README for my project", template!);
    expect(name).toBe("README.md");
  });

  it("should generate package.json filename", () => {
    const template = FILE_TEMPLATES["package.json"];
    expect(template).toBeDefined();
    const name = generateFileName("package.json for my app", template!);
    expect(name).toBe("package.json");
  });
});
