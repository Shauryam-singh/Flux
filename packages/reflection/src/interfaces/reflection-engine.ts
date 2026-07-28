import type { Reflection, ReflectionRequest } from "../types/reflection.js";

export interface ReflectionEngine {
  generate(request: ReflectionRequest): Promise<Reflection>;
  getById(id: string): Reflection | null;
  getRange(start: string, end: string): ReadonlyArray<Reflection>;
  getLatest(): Reflection | null;
}
