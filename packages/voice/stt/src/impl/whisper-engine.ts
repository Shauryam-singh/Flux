import type { STTEngine } from "../interfaces/stt-engine.js";

let whisperPipeline: ((audio: Float32Array) => Promise<{ text: string }>) | null = null;
let ready = false;

export class WhisperEngine implements STTEngine {
  readonly name = "whisper";
  private model: string;

  constructor(options?: { model?: string }) {
    this.model = options?.model ?? "whisper-small";
  }

  async initialize(): Promise<void> {
    if (ready) return;

    try {
      // @ts-expect-error — @xenova/transformers is an optional runtime dependency
      const mod = await import("@xenova/transformers");
      const loadPipeline = mod.pipeline;
      const pipe = await loadPipeline("automatic-speech-recognition", this.model);
      whisperPipeline = pipe as (audio: Float32Array) => Promise<{ text: string }>;
      ready = true;
    } catch (err) {
      throw new Error(
        `Failed to initialize Whisper. Ensure @xenova/transformers is installed: npm install @xenova/transformers\n${err}`,
      );
    }
  }

  async transcribe(audio: Float32Array, sampleRate: number): Promise<string> {
    if (!ready || !whisperPipeline) {
      throw new Error("Whisper engine not initialized. Call initialize() first.");
    }

    const input = sampleRate !== 16000 ? resample(audio, sampleRate, 16000) : audio;
    const result = await whisperPipeline(input);
    return result.text;
  }

  isReady(): boolean {
    return ready;
  }
}

function resample(audio: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate;
  const newLength = Math.round(audio.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const idx = Math.floor(srcIdx);
    const frac = srcIdx - idx;
    result[i] = (audio[idx] ?? 0) * (1 - frac) + ((audio[idx + 1] ?? 0) * frac);
  }
  return result;
}
