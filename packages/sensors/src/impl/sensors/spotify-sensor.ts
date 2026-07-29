import type {
  ObservationPriority,
  ObservationSource,
} from "@ai-agent/attention";
import type { SensorEvent, SensorMetadata } from "../../types/sensor.js";
import { BaseSensor } from "../base-sensor.js";

export interface SpotifyState {
  readonly isPlaying: boolean;
  readonly track: string | null;
  readonly artist: string | null;
  readonly album: string | null;
  readonly duration: number; // seconds
  readonly position: number; // seconds
  readonly volume: number; // 0-100
  readonly shuffle: boolean;
  readonly repeat: "off" | "track" | "context";
}

const METADATA: SensorMetadata = {
  id: "spotify",
  name: "Spotify Sensor",
  description: "Monitors Spotify playback state via D-Bus MPRIS",
  category: "service",
  platform: "linux",
  version: "1.0.0",
};

export class SpotifySensor extends BaseSensor<SpotifyState> {
  private lastTrack: string | null = null;

  constructor(pollIntervalMs = 3000) {
    super(METADATA, pollIntervalMs);
  }

  protected async onStart(): Promise<void> {
    const state = await this.readSpotifyState();
    this.lastTrack = state?.track ?? null;
  }

  protected async onStop(): Promise<void> {
    this.lastTrack = null;
  }

  protected async onSnapshot(): Promise<SpotifyState | null> {
    return this.readSpotifyState();
  }

  protected async onRefresh(): Promise<SpotifyState | null> {
    const state = await this.readSpotifyState();
    if (state && state.track !== this.lastTrack) {
      this.lastTrack = state.track;
      return state;
    }
    return null;
  }

  protected getEventSource(): ObservationSource {
    return "system";
  }

  protected getEventPriority(data: SpotifyState): ObservationPriority {
    return "background";
  }

  private async readSpotifyState(): Promise<SpotifyState | null> {
    // Use playerctl (MPRIS D-Bus interface)
    const metadata = this.execCommand(
      "playerctl metadata --format '{{title}}\\n{{artist}}\\n{{album}}\\n{{duration(m)}}\\n{{position(m)}}' 2>/dev/null",
    );
    if (!metadata) return null;

    const lines = metadata.split("\n");
    const title = lines[0]?.trim() || null;
    const artist = lines[1]?.trim() || null;
    const album = lines[2]?.trim() || null;
    const duration = parseFloat(lines[3] ?? "0") * 60;
    const position = parseFloat(lines[4] ?? "0") * 60;

    const status = this.execCommand("playerctl status 2>/dev/null");
    const isPlaying = status?.trim().toLowerCase() === "playing";

    const volume = this.execCommand("playerctl volume 2>/dev/null");
    const shuffle = this.execCommand("playerctl shuffle 2>/dev/null");
    const repeat = this.execCommand("playerctl loop 2>/dev/null");

    return {
      isPlaying,
      track: title,
      artist,
      album,
      duration: isNaN(duration) ? 0 : duration,
      position: isNaN(position) ? 0 : position,
      volume: volume ? parseFloat(volume) * 100 : 50,
      shuffle: shuffle?.trim().toLowerCase() === "on",
      repeat:
        repeat?.trim().toLowerCase() === "track"
          ? "track"
          : repeat?.trim().toLowerCase() === "playlist"
            ? "context"
            : "off",
    };
  }
}
