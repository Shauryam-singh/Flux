import { describe, it, expect, beforeEach } from "vitest";
import type { HabitDiscovery } from "../interfaces/habit-discovery.js";

describe("DefaultHabitDiscovery", () => {
  let discovery: HabitDiscovery;

  beforeEach(async () => {
    const { DefaultHabitDiscovery } = await import("../impl/default-habit-discovery.js");
    discovery = new DefaultHabitDiscovery();
  });

  it("observes a new habit", () => {
    discovery.observe("coding", "Uses const over let", "prefer-const");
    expect(discovery.count()).toBe(1);
  });

  it("increments frequency for duplicate pattern in same category", () => {
    discovery.observe("coding", "Uses const", "prefer-const");
    discovery.observe("coding", "Prefers const", "prefer-const");
    const habit = discovery.getAll()[0];
    expect(habit!.frequency).toBe(2);
  });

  it("creates separate habits for different categories", () => {
    discovery.observe("coding", "Uses const", "prefer-const");
    discovery.observe("research", "Reads docs first", "docs-first");
    expect(discovery.count()).toBe(2);
  });

  it("adds examples to existing habit", () => {
    discovery.observe("coding", "Uses const", "prefer-const", "example1");
    discovery.observe("coding", "Uses const", "prefer-const", "example2");
    const habit = discovery.getAll()[0];
    expect(habit!.examples).toContain("example1");
    expect(habit!.examples).toContain("example2");
  });

  it("retrieves habit by id", () => {
    discovery.observe("coding", "Uses const", "prefer-const");
    const habit = discovery.getAll()[0];
    expect(discovery.get(habit!.id)).toEqual(habit);
    expect(discovery.get("nonexistent")).toBeNull();
  });

  it("filters by category", () => {
    discovery.observe("coding", "Uses const", "prefer-const");
    discovery.observe("research", "Reads docs", "docs-first");
    expect(discovery.getByCategory("coding")).toHaveLength(1);
  });

  it("filters by minimum frequency", () => {
    discovery.observe("coding", "Uses const", "prefer-const");
    discovery.observe("coding", "Uses const", "prefer-const");
    discovery.observe("coding", "Uses const", "prefer-const");
    discovery.observe("research", "Reads docs", "docs-first");
    expect(discovery.getFrequent(3)).toHaveLength(1);
  });

  it("returns recent habits", () => {
    for (let i = 0; i < 5; i++) {
      discovery.observe("coding", `Habit ${i}`, `pattern-${i}`);
    }
    expect(discovery.getRecent(2)).toHaveLength(2);
  });

  it("deletes a habit", () => {
    discovery.observe("coding", "Uses const", "prefer-const");
    const habit = discovery.getAll()[0];
    discovery.delete(habit!.id);
    expect(discovery.count()).toBe(0);
    expect(discovery.get(habit!.id)).toBeNull();
  });
});
