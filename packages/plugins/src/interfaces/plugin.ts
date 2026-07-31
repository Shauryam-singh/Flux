import type { Sensor, SensorManager } from "@ai-agent/sensors";

/**
 * A Flux plugin is a JS module loaded from ~/.flux/plugins/
 * that extends Flux with custom sensors or services.
 */
export interface FluxPlugin {
  /** Unique plugin name */
  readonly name: string;
  /** Plugin version */
  readonly version: string;
  /** Description */
  readonly description?: string;
  /** Custom sensors to register */
  readonly sensors?: ReadonlyArray<{
    name: string;
    create: () => Sensor;
  }>;
  /** Custom services to register (future) */
  readonly services?: ReadonlyArray<{
    name: string;
    create: () => unknown;
  }>;
  /** Plugin initialization hook */
  init?: (context: PluginContext) => void | Promise<void>;
  /** Plugin cleanup hook */
  destroy?: () => void | Promise<void>;
}

export interface PluginContext {
  sensorManager: SensorManager;
  config: Record<string, unknown>;
  pluginDir: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  main: string;
  sensors?: ReadonlyArray<{ name: string; entry: string }>;
  services?: ReadonlyArray<{ name: string; entry: string }>;
}

export interface PluginLoader {
  /** Load all plugins from the plugins directory */
  loadAll(): Promise<ReadonlyArray<FluxPlugin>>;
  /** Load a specific plugin by name */
  load(name: string): Promise<FluxPlugin | null>;
  /** Get all loaded plugins */
  getLoaded(): ReadonlyArray<FluxPlugin>;
  /** Unload a plugin */
  unload(name: string): Promise<void>;
}
