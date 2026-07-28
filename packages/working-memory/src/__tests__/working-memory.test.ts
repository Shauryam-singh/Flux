import { describe, it, expect, vi } from "vitest";
import { DefaultWorkingMemory } from "../impl/default-working-memory.js";

describe("DefaultWorkingMemory", () => {
  it("should add entries", () => {
    const mem = new DefaultWorkingMemory();
    const entry = mem.add({ type: "observation", content: "test", weight: 50, source: "test" });
    expect(entry.id).toBeDefined();
    expect(entry.content).toBe("test");
    expect(entry.weight).toBe(50);
  });

  it("should enforce capacity", () => {
    const mem = new DefaultWorkingMemory({ capacity: 3 });
    mem.add({ type: "observation", content: "1", weight: 10, source: "test" });
    mem.add({ type: "observation", content: "2", weight: 20, source: "test" });
    mem.add({ type: "observation", content: "3", weight: 30, source: "test" });
    mem.add({ type: "observation", content: "4", weight: 40, source: "test" });
    expect(mem.snapshot().entries.length).toBe(3);
  });

  it("should evict lowest weight when full", () => {
    const mem = new DefaultWorkingMemory({ capacity: 3 });
    mem.add({ type: "observation", content: "low", weight: 5, source: "test" });
    mem.add({ type: "observation", content: "mid", weight: 50, source: "test" });
    mem.add({ type: "observation", content: "high", weight: 90, source: "test" });
    mem.add({ type: "observation", content: "highest", weight: 100, source: "test" });
    const snap = mem.snapshot();
    expect(snap.entries[0]!.content).toBe("highest");
    expect(snap.entries.some((e) => e.content === "low")).toBe(false);
  });

  it("should remove entries", () => {
    const mem = new DefaultWorkingMemory();
    const entry = mem.add({ type: "observation", content: "test", weight: 50, source: "test" });
    expect(mem.remove(entry.id)).toBe(true);
    expect(mem.snapshot().entries.length).toBe(0);
  });

  it("should return false for non-existent remove", () => {
    const mem = new DefaultWorkingMemory();
    expect(mem.remove("nonexistent")).toBe(false);
  });

  it("should get entries by type", () => {
    const mem = new DefaultWorkingMemory();
    mem.add({ type: "observation", content: "obs", weight: 50, source: "test" });
    mem.add({ type: "thought", content: "thought", weight: 50, source: "test" });
    mem.add({ type: "observation", content: "obs2", weight: 50, source: "test" });
    expect(mem.getByType("observation")).toHaveLength(2);
    expect(mem.getByType("thought")).toHaveLength(1);
  });

  it("should search by content", () => {
    const mem = new DefaultWorkingMemory();
    mem.add({ type: "observation", content: "Build failed", weight: 50, source: "test" });
    mem.add({ type: "observation", content: "Test passed", weight: 50, source: "test" });
    expect(mem.search("build")).toHaveLength(1);
    expect(mem.search("Test")).toHaveLength(1);
  });

  it("should return sorted snapshot", () => {
    const mem = new DefaultWorkingMemory();
    mem.add({ type: "observation", content: "low", weight: 10, source: "test" });
    mem.add({ type: "observation", content: "high", weight: 90, source: "test" });
    const snap = mem.snapshot();
    expect(snap.entries[0]!.weight).toBe(90);
    expect(snap.entries[1]!.weight).toBe(10);
  });

  it("should calculate utilization", () => {
    const mem = new DefaultWorkingMemory({ capacity: 10 });
    mem.add({ type: "observation", content: "1", weight: 50, source: "test" });
    mem.add({ type: "observation", content: "2", weight: 50, source: "test" });
    expect(mem.snapshot().utilization).toBe(0.2);
  });

  it("should clear all entries", () => {
    const mem = new DefaultWorkingMemory();
    mem.add({ type: "observation", content: "1", weight: 50, source: "test" });
    mem.add({ type: "observation", content: "2", weight: 50, source: "test" });
    mem.clear();
    expect(mem.snapshot().entries.length).toBe(0);
  });

  it("should gc expired entries", () => {
    const mem = new DefaultWorkingMemory();
    mem.add({ type: "observation", content: "expired", weight: 50, source: "test", expiresAt: Date.now() - 1000 });
    mem.add({ type: "observation", content: "valid", weight: 50, source: "test" });
    const removed = mem.gc();
    expect(removed).toBe(1);
    expect(mem.snapshot().entries.length).toBe(1);
  });

  it("should emit onChange", () => {
    const mem = new DefaultWorkingMemory();
    const handler = vi.fn();
    mem.onChange(handler);
    mem.add({ type: "observation", content: "test", weight: 50, source: "test" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should unsubscribe from onChange", () => {
    const mem = new DefaultWorkingMemory();
    const handler = vi.fn();
    const unsub = mem.onChange(handler);
    mem.add({ type: "observation", content: "test", weight: 50, source: "test" });
    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
    mem.add({ type: "observation", content: "test2", weight: 50, source: "test" });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
