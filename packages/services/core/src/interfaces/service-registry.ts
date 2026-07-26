import type { Service } from "./service.js";

export interface ServiceRegistry {
  register(service: Service): void;
  unregister(name: string): void;
  get(name: string): Service | undefined;
  getAll(): Service[];
  findBest(input: string): Promise<Service | null>;
}
