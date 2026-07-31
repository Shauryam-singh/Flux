import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionSummaryStore } from "../impl/session-summary-store.js";

describe("SessionSummaryStore", () => {
  let store: SessionSummaryStore;
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = `/tmp/flux-test-session-summaries-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    vi.stubEnv("HOME", "/tmp");
    store = new SessionSummaryStore(tmpFile);
  });

  it("starts empty", () => {
    expect(store.count).toBe(0);
    expect(store.getUnconsumed()).toEqual([]);
  });

  it("adds a summary as unconsumed", () => {
    const entry = store.add({
      summary: "Discussed API design",
      conversationId: "conv_1",
      messageCount: 5,
    });

    expect(entry.id).toBeDefined();
    expect(entry.consumed).toBe(false);
    expect(entry.consumedAt).toBeNull();
    expect(entry.summary).toBe("Discussed API design");
    expect(store.count).toBe(1);
    expect(store.unconsumedCount).toBe(1);
  });

  it("returns unconsumed summaries sorted oldest first", () => {
    store.add({ summary: "First", conversationId: "c1", messageCount: 3 });
    store.add({ summary: "Second", conversationId: "c2", messageCount: 4 });

    const unconsumed = store.getUnconsumed();
    expect(unconsumed).toHaveLength(2);
    expect(unconsumed[0]!.summary).toBe("First");
    expect(unconsumed[1]!.summary).toBe("Second");
  });

  it("marks a summary as consumed", () => {
    const entry = store.add({ summary: "Test", conversationId: "c1", messageCount: 3 });
    const ok = store.markConsumed(entry.id);

    expect(ok).toBe(true);
    expect(store.unconsumedCount).toBe(0);
    expect(store.getUnconsumed()).toEqual([]);
  });

  it("returns false for unknown id", () => {
    const ok = store.markConsumed("nonexistent");
    expect(ok).toBe(false);
  });

  it("marks all unconsumed as consumed", () => {
    store.add({ summary: "A", conversationId: "c1", messageCount: 3 });
    store.add({ summary: "B", conversationId: "c2", messageCount: 4 });

    const count = store.markAllConsumed();
    expect(count).toBe(2);
    expect(store.unconsumedCount).toBe(0);
  });

  it("persists to disk and reloads", () => {
    store.add({ summary: "Persist me", conversationId: "c1", messageCount: 3 });
    const entry = store.add({ summary: "Me too", conversationId: "c2", messageCount: 4 });
    store.markConsumed(entry.id);

    // Reload
    const reloaded = new SessionSummaryStore(tmpFile);
    expect(reloaded.count).toBe(2);
    expect(reloaded.unconsumedCount).toBe(1);
    expect(reloaded.getUnconsumed()[0]!.summary).toBe("Persist me");
  });

  it("prunes old consumed summaries", () => {
    store.add({ summary: "Keep", conversationId: "c1", messageCount: 3 });
    const entry = store.add({ summary: "Prune me", conversationId: "c2", messageCount: 4 });
    store.markConsumed(entry.id);

    // Prune summaries consumed more than 0ms ago
    const pruned = store.prune(0);
    expect(pruned).toBe(1);
    expect(store.count).toBe(1);
    expect(store.getUnconsumed()[0]!.summary).toBe("Keep");
  });

  it("does not prune unconsumed summaries", () => {
    store.add({ summary: "Keep me", conversationId: "c1", messageCount: 3 });

    const pruned = store.prune(0);
    expect(pruned).toBe(0);
    expect(store.count).toBe(1);
  });
});
