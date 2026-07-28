import type { Habit, HabitCategory } from "@ai-agent/evo-types";

export interface HabitDiscovery {
  observe(category: HabitCategory, description: string, pattern: string, example?: string): void;
  get(habitId: string): Habit | null;
  getAll(): ReadonlyArray<Habit>;
  getByCategory(category: HabitCategory): ReadonlyArray<Habit>;
  getFrequent(minFrequency?: number): ReadonlyArray<Habit>;
  getRecent(count: number): ReadonlyArray<Habit>;
  count(): number;
  delete(habitId: string): void;
}
