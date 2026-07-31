import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFileProcessorService } from "../impl/file-processor-service.js";
import type { ServiceContext } from "@ai-agent/services-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function makeCtx(): ServiceContext {
  return {
    sessionId: "test",
    memory: {
      add: vi.fn(),
      history: vi.fn().mockResolvedValue([]),
      clear: vi.fn(),
    } as never,
    provider: null,
    reply: vi.fn(),
    speak: vi.fn(),
    emit: vi.fn(),
  };
}

const testDir = "/tmp/flux-file-processor-test";

describe("FileProcessorService", () => {
  let svc: ReturnType<typeof createFileProcessorService>;
  let ctx: ServiceContext;

  beforeEach(() => {
    svc = createFileProcessorService();
    ctx = makeCtx();
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, "test.ts"), "export function hello() {\n  return 'world';\n}\n");
    writeFileSync(join(testDir, "README.md"), "# Test Project\n\nThis is a test.\n");
    writeFileSync(join(testDir, "package.json"), '{"name":"test","version":"1.0.0"}\n');
  });

  it("has correct name", () => {
    expect(svc.name).toBe("file-processor");
  });

  it("can handle file-related input", () => {
    expect(svc.canHandle("read src/index.ts")).toBe(true);
    expect(svc.canHandle("summarise README.md")).toBe(true);
    expect(svc.canHandle("explain what this file does")).toBe(true);
    expect(svc.canHandle("what does test.ts do")).toBe(true);
    expect(svc.canHandle("compare a.ts and b.ts")).toBe(true);
    expect(svc.canHandle("ask about test.ts: what is this")).toBe(true);
    expect(svc.canHandle("show me the file")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
  });

  it("reads a file", async () => {
    const result = await svc.execute(`read ${join(testDir, "test.ts")}`, ctx);
    expect(result.text).toContain("hello");
    expect(result.text).toContain("export");
  });

  it("reads a directory", async () => {
    const result = await svc.execute(`list ${testDir}`, ctx);
    expect(result.text).toContain("test.ts");
    expect(result.text).toContain("README.md");
  });

  it("summarises a file", async () => {
    const result = await svc.execute(`summarise ${join(testDir, "test.ts")}`, ctx);
    expect(result.text).toContain("test.ts");
    // Without LLM, falls back to structural summary
    expect(result.text).toContain("lines");
  });

  it("explains a file", async () => {
    const result = await svc.execute(`explain ${join(testDir, "test.ts")}`, ctx);
    expect(result.text).toContain("test.ts");
  });

  it("asks a question about a file", async () => {
    const result = await svc.execute(`ask about ${join(testDir, "test.ts")}: what does hello return?`, ctx);
    expect(result.text).toContain("test.ts");
    expect(result.text).toContain("hello");
  });

  it("returns error for missing file", async () => {
    const result = await svc.execute("read /nonexistent/file.txt", ctx);
    expect(result.text).toContain("Could not read");
  });

  it("returns help when unparseable", async () => {
    const result = await svc.execute("file processor", ctx);
    expect(result.text).toContain("Try");
  });
});
