import { BaseSensor } from "../base-sensor.js";
import type { SensorMetadata, SensorEvent } from "../../types/sensor.js";
import type { ObservationSource, ObservationPriority } from "@ai-agent/attention";

export interface ClipboardState {
  readonly text: string;
  readonly length: number;
  readonly lastChanged: number;
  readonly changeCount: number;
}

const METADATA: SensorMetadata = {
  id: "clipboard",
  name: "Clipboard Sensor",
  description: "Monitors clipboard content changes",
  category: "linux",
  platform: "all",
  version: "1.0.0",
};

export class ClipboardSensor extends BaseSensor<ClipboardState> {
  private lastContent = "";
  private changeCount = 0;
  private lastChanged = 0;

  constructor(pollIntervalMs = 2000) {
    super(METADATA, pollIntervalMs);
  }

  protected async onStart(): Promise<void> {
    this.lastContent = (await this.getClipboard()) ?? "";
  }

  protected async onStop(): Promise<void> {
    this.lastContent = "";
  }

  protected async onSnapshot(): Promise<ClipboardState> {
    const text = (await this.getClipboard()) ?? "";
    return {
      text,
      length: text.length,
      lastChanged: this.lastChanged,
      changeCount: this.changeCount,
    };
  }

  protected async onRefresh(): Promise<ClipboardState | null> {
    const text = (await this.getClipboard()) ?? "";
    if (text !== this.lastContent && text.length > 0) {
      this.lastContent = text;
      this.changeCount++;
      this.lastChanged = Date.now();
      return {
        text,
        length: text.length,
        lastChanged: this.lastChanged,
        changeCount: this.changeCount,
      };
    }
    return null;
  }

  protected getEventSource(): ObservationSource {
    return "system";
  }

  protected getEventPriority(data: ClipboardState): ObservationPriority {
    if (data.length > 1000) return "medium"; // Large clipboard content
    if (data.length > 100) return "low";
    return "background";
  }

  private async getClipboard(): Promise<string | null> {
    const platform = process.platform;

    if (platform === "linux") {
      return this.execCommand("xclip -selection clipboard -o 2>/dev/null");
    }
    if (platform === "darwin") {
      return this.execCommand("pbpaste 2>/dev/null");
    }
    if (platform === "win32") {
      return this.execCommand("powershell -command \"Get-Clipboard\" 2>/dev/null");
    }
    return null;
  }
}
