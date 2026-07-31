import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type {
  FluxPlugin,
  PluginContext,
  PluginLoader,
  PluginManifest,
} from "../interfaces/plugin.js";
import type { SensorManager } from "@ai-agent/sensors";

const PLUGIN_DIR = join(homedir(), ".flux", "plugins");

export class DefaultPluginLoader implements PluginLoader {
  private loaded: Map<string, FluxPlugin> = new Map();
  private pluginDir: string;
  private sensorManager: SensorManager;

  constructor(sensorManager: SensorManager, pluginDir?: string) {
    this.sensorManager = sensorManager;
    this.pluginDir = pluginDir ?? PLUGIN_DIR;
  }

  async loadAll(): Promise<ReadonlyArray<FluxPlugin>> {
    const plugins: FluxPlugin[] = [];

    try {
      const entries = await readdir(this.pluginDir);

      for (const entry of entries) {
        const entryPath = join(this.pluginDir, entry);
        const entryStat = await stat(entryPath);

        if (!entryStat.isDirectory()) continue;

        const plugin = await this.loadFromDir(entryPath);
        if (plugin) {
          plugins.push(plugin);
        }
      }
    } catch {
      // Plugins directory doesn't exist — that's fine
    }

    return plugins;
  }

  async load(name: string): Promise<FluxPlugin | null> {
    if (this.loaded.has(name)) return this.loaded.get(name)!;

    const pluginPath = join(this.pluginDir, name);
    return this.loadFromDir(pluginPath);
  }

  getLoaded(): ReadonlyArray<FluxPlugin> {
    return Array.from(this.loaded.values());
  }

  async unload(name: string): Promise<void> {
    const plugin = this.loaded.get(name);
    if (plugin) {
      if (plugin.destroy) {
        await plugin.destroy();
      }
      this.loaded.delete(name);
    }
  }

  private async loadFromDir(dirPath: string): Promise<FluxPlugin | null> {
    try {
      // Read manifest
      const manifestPath = join(dirPath, "manifest.json");
      const manifestRaw = await readFile(manifestPath, "utf-8");
      const manifest: PluginManifest = JSON.parse(manifestRaw);

      // Load the main module
      const mainPath = resolve(dirPath, manifest.main);
      const module = await import(mainPath);

      // Get the default export or look for a plugin factory
      const pluginFactory = module.default ?? module.createPlugin ?? module;
      const plugin: FluxPlugin =
        typeof pluginFactory === "function"
          ? pluginFactory()
          : pluginFactory;

      if (!plugin?.name) {
        console.warn(`[plugins] Plugin in ${dirPath} has no name, skipping`);
        return null;
      }

      // Register custom sensors
      if (plugin.sensors) {
        for (const sensorDef of plugin.sensors) {
          this.sensorManager.register(sensorDef.create());
        }
      }

      // Initialize plugin
      const context: PluginContext = {
        sensorManager: this.sensorManager,
        config: {},
        pluginDir: dirPath,
      };

      if (plugin.init) {
        await plugin.init(context);
      }

      this.loaded.set(plugin.name, plugin);
      console.log(`[plugins] Loaded plugin: ${plugin.name}@${plugin.version}`);
      return plugin;
    } catch (err) {
      console.warn(
        `[plugins] Failed to load plugin from ${dirPath}:`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }
}
