import type {
  ObservationPriority,
  ObservationSource,
} from "@ai-agent/attention";
import type { SensorEvent, SensorMetadata } from "../../types/sensor.js";
import { BaseSensor } from "../base-sensor.js";

export interface AudioState {
  readonly outputVolume: number; // 0-100
  readonly inputVolume: number; // 0-100
  readonly isMuted: boolean;
  readonly activeSink: string | null;
  readonly activeSource: string | null;
  readonly isPlaying: boolean;
}

const METADATA: SensorMetadata = {
  id: "audio",
  name: "Audio Sensor",
  description: "Monitors audio output/input levels via PulseAudio/PipeWire",
  category: "hardware",
  platform: "linux",
  version: "1.0.0",
};

export class AudioSensor extends BaseSensor<AudioState> {
  constructor(pollIntervalMs = 5000) {
    super(METADATA, pollIntervalMs);
  }

  protected async onStart(): Promise<void> {
    // No initialization needed
  }

  protected async onStop(): Promise<void> {
    // No cleanup needed
  }

  protected async onSnapshot(): Promise<AudioState | null> {
    return this.readAudioState();
  }

  protected async onRefresh(): Promise<AudioState | null> {
    return this.readAudioState();
  }

  protected getEventSource(): ObservationSource {
    return "system";
  }

  protected getEventPriority(data: AudioState): ObservationPriority {
    return "background";
  }

  private async readAudioState(): Promise<AudioState | null> {
    // Try PipeWire first (newer systems)
    const pwState = await this.readPipeWireState();
    if (pwState) return pwState;

    // Fall back to PulseAudio
    return this.readPulseAudioState();
  }

  private async readPipeWireState(): Promise<AudioState | null> {
    const output = this.execCommand(
      "wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null",
    );
    if (!output) return null;

    const volumeMatch = output.match(/Volume:\s+(\d+\.?\d*)/);
    const volume = volumeMatch
      ? Math.round(parseFloat(volumeMatch[1]!) * 100)
      : 0;
    const isMuted = output.includes("[MUTED]");

    const sourceOutput = this.execCommand(
      "wpctl get-volume @DEFAULT_AUDIO_SOURCE@ 2>/dev/null",
    );
    const sourceVolumeMatch = sourceOutput?.match(/Volume:\s+(\d+\.?\d*)/);
    const inputVolume = sourceVolumeMatch
      ? Math.round(parseFloat(sourceVolumeMatch[1]!) * 100)
      : 0;

    const activeSink = this.execCommand(
      "wpctl status 2>/dev/null | grep 'Sinks:' -A 100 | grep '*' | head -1 | awk '{print $2}'",
    );
    const activeSource = this.execCommand(
      "wpctl status 2>/dev/null | grep 'Sources:' -A 100 | grep '*' | head -1 | awk '{print $2}'",
    );

    return {
      outputVolume: volume,
      inputVolume,
      isMuted,
      activeSink: activeSink || null,
      activeSource: activeSource || null,
      isPlaying: false,
    };
  }

  private async readPulseAudioState(): Promise<AudioState | null> {
    const output = this.execCommand(
      "pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null",
    );
    if (!output) return null;

    const volumeMatch = output.match(/(\d+)%/);
    const volume = volumeMatch ? parseInt(volumeMatch[1]!, 10) : 0;

    const muteOutput = this.execCommand(
      "pactl get-sink-mute @DEFAULT_SINK@ 2>/dev/null",
    );
    const isMuted = muteOutput?.includes("yes") ?? false;

    const sourceOutput = this.execCommand(
      "pactl get-source-volume @DEFAULT_SOURCE@ 2>/dev/null",
    );
    const sourceVolumeMatch = sourceOutput?.match(/(\d+)%/);
    const inputVolume = sourceVolumeMatch
      ? parseInt(sourceVolumeMatch[1]!, 10)
      : 0;

    const activeSink = this.execCommand(
      "pactl info 2>/dev/null | grep 'Default Sink' | cut -d: -f2",
    );
    const activeSource = this.execCommand(
      "pactl info 2>/dev/null | grep 'Default Source' | cut -d: -f2",
    );

    return {
      outputVolume: volume,
      inputVolume,
      isMuted,
      activeSink: activeSink?.trim() || null,
      activeSource: activeSource?.trim() || null,
      isPlaying: false,
    };
  }
}
