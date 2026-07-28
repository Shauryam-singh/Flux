import type { HabitDiscovery } from "../interfaces/habit-discovery.js";
import type { Habit, HabitCategory } from "@ai-agent/evo-types";

let counter = 0;

export class DefaultHabitDiscovery implements HabitDiscovery {
  private readonly habits = new Map<string, Habit>();
  private readonly order: string[] = [];

  observe(category: HabitCategory, description: string, pattern: string, example?: string): void {
    const existing = this.findByPattern(category, pattern);
    if (existing) {
      const updated = {
        ...existing,
        frequency: existing.frequency + 1,
        examples: example !== undefined ? [...existing.examples, example] : existing.examples,
        lastObserved: Date.now(),
      };
      this.habits.set(existing.id, updated);
      return;
    }

    const id = `hb_${++counter}`;
    const habit: Habit = {
      id,
      category,
      description,
      pattern,
      frequency: 1,
      confidence: 0,
      examples: example !== undefined ? [example] : [],
      firstObserved: Date.now(),
      lastObserved: Date.now(),
    };
    this.habits.set(id, habit);
    this.order.push(id);
  }

  get(habitId: string): Habit | null {
    return this.habits.get(habitId) ?? null;
  }

  getAll(): ReadonlyArray<Habit> {
    return this.order.map((id) => this.habits.get(id)!).filter(Boolean);
  }

  getByCategory(category: HabitCategory): ReadonlyArray<Habit> {
    return this.getAll().filter((h) => h.category === category);
  }

  getFrequent(minFrequency: number = 3): ReadonlyArray<Habit> {
    return this.getAll().filter((h) => h.frequency >= minFrequency);
  }

  getRecent(count: number): ReadonlyArray<Habit> {
    return this.getAll().slice(-count);
  }

  count(): number {
    return this.habits.size;
  }

  delete(habitId: string): void {
    this.habits.delete(habitId);
    const idx = this.order.indexOf(habitId);
    if (idx !== -1) this.order.splice(idx, 1);
  }

  private findByPattern(category: HabitCategory, pattern: string): Habit | undefined {
    return this.getAll().find((h) => h.category === category && h.pattern === pattern);
  }
}
