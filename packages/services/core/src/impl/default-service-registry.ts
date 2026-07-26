import type { Service } from "../interfaces/service.js";
import type { ServiceRegistry } from "../interfaces/service-registry.js";

export class DefaultServiceRegistry implements ServiceRegistry {
  private readonly services = new Map<string, Service>();

  register(service: Service): void {
    this.services.set(service.name, service);
  }

  unregister(name: string): void {
    this.services.delete(name);
  }

  get(name: string): Service | undefined {
    return this.services.get(name);
  }

  getAll(): Service[] {
    return Array.from(this.services.values());
  }

  async findBest(input: string): Promise<Service | null> {
    for (const service of this.services.values()) {
      const can = await service.canHandle(input);
      if (can) {
        return service;
      }
    }
    return null;
  }
}
