import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRemindersService } from "../impl/reminders-service.js";
import type { ServiceContext } from "@ai-agent/services-core";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// We need to mock the fs module to avoid writing to the real filesystem
vi.mock("node:fs", () => {
  const store = new Map<string, string>();
  return {
    readFileSync: vi.fn((p: string) => {
      return store.get(p) ?? "";
    }),
    writeFileSync: vi.fn((p: string, data: string | Buffer) => {
      store.set(p, typeof data === "string" ? data : data.toString());
    }),
    existsSync: vi.fn((p: string) => {
      return store.has(p);
    }),
    mkdirSync: vi.fn(),
  };
});

function createMockContext(): ServiceContext {
  return {
    sessionId: "test-session",
    memory: {
      add: vi.fn().mockResolvedValue(undefined),
      history: vi.fn().mockResolvedValue([]),
    } as unknown as ServiceContext["memory"],
    provider: null,
    reply: vi.fn(),
    speak: vi.fn(),
    emit: vi.fn(),
  };
}

describe("reminders service", () => {
  let service: ReturnType<typeof createRemindersService>;
  let ctx: ServiceContext;

  beforeEach(() => {
    service = createRemindersService();
    ctx = createMockContext();
    // Clear the mocked fs store between tests
    vi.mocked(fs.writeFileSync).mockClear();
    vi.mocked(fs.readFileSync).mockReturnValue("");
  });

  it("should add a reminder", async () => {
    const result = await service.execute("add buy groceries", ctx);
    expect(result.text).toMatch(/buy groceries/);
    expect(ctx.reply).toHaveBeenCalled();
    expect(ctx.memory.add).toHaveBeenCalledWith("user", "add buy groceries");
  });

  it("should list reminders", async () => {
    // First add a reminder so there's something to list
    await service.execute("add buy milk", ctx);
    // Reset mocks to check list output
    vi.mocked(ctx.reply).mockClear();

    // Set up the mock to return the previously written data
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    if (writeCall) {
      vi.mocked(fs.readFileSync).mockReturnValue(
        writeCall[1] as string,
      );
    }

    const result = await service.execute("list my reminders", ctx);
    expect(result.text).toContain("buy milk");
  });

  it("should complete a reminder", async () => {
    // Add a reminder
    await service.execute("add clean the house", ctx);

    // Grab the written data to feed back to readFileSync
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    if (writeCall) {
      vi.mocked(fs.readFileSync).mockReturnValue(
        writeCall[1] as string,
      );
    }

    const result = await service.execute("complete clean the house", ctx);
    expect(result.text).toMatch(/Completed: "clean the house"/);
  });
});
