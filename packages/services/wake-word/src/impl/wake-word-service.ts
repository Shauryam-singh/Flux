import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { STTEngine } from "@ai-agent/voice-stt";

export interface WakeWordOptions {
  wakeWord?: string;
  stt?: STTEngine;
  sampleRate?: number;
  chunkDurationMs?: number;
  confidenceThreshold?: number;
}

export interface WakeWordEvent {
  type: "detected" | "listening" | "error";
  wakeWord: string;
  transcript: string;
  confidence: number;
  timestamp: number;
}

export type WakeWordListener = (event: WakeWordEvent) => void;

interface AudioRecorder {
  start(): void;
  stop(): Promise<Float32Array>;
  getSampleRate(): number;
  isRecording(): boolean;
}

class PulseAudioRecorder implements AudioRecorder {
  private process: ReturnType<typeof spawn> | null = null;
  private chunks: Buffer[] = [];
  private readonly sampleRate: number;
  private recording = false;

  constructor(sampleRate = 16000) {
    this.sampleRate = sampleRate;
  }

  start(): void {
    if (this.recording) return;
    this.chunks = [];
    this.recording = true;

    // Try PulseAudio first, then ALSA
    try {
      this.process = spawn("sox", [
        "-t", "pulseaudio", "default",
        "-t", "wav",
        "-r", String(this.sampleRate),
        "-e", "signed-integer",
        "-b", "16",
        "-c", "1",
        "-",
      ]);
    } catch {
      this.process = spawn("arecord", [
        "-f", "S16_LE",
        "-r", String(this.sampleRate),
        "-c", "1",
        "-t", "wav",
        "-",
      ]);
    }

    this.process.stdout?.on("data", (chunk: Buffer) => {
      this.chunks.push(chunk);
    });

    this.process.on("error", () => {
      this.recording = false;
    });
  }

  async stop(): Promise<Float32Array> {
    this.recording = false;

    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }

    const wavBuffer = Buffer.concat(this.chunks);
    return wavToFloat32(wavBuffer);
  }

  getSampleRate(): number {
    return this.sampleRate;
  }

  isRecording(): boolean {
    return this.recording;
  }
}

function wavToFloat32(buffer: Buffer): Float32Array {
  if (buffer.length < 44) return new Float32Array(0);

  const dataOffset = 44;
  const dataLength = buffer.length - dataOffset;
  const sampleCount = Math.floor(dataLength / 2);
  const result = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const offset = dataOffset + i * 2;
    const sample = buffer.readInt16LE(offset);
    result[i] = sample / 32768;
  }

  return result;
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

export class WakeWordDetector {
  private readonly wakeWord: string;
  private readonly stt: STTEngine | null;
  private readonly sampleRate: number;
  private readonly chunkDurationMs: number;
  private readonly listeners: WakeWordListener[] = [];
  private recorder: AudioRecorder;
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: WakeWordOptions) {
    this.wakeWord = (options?.wakeWord ?? "flux").toLowerCase();
    this.stt = options?.stt ?? null;
    this.sampleRate = options?.sampleRate ?? 16000;
    this.chunkDurationMs = options?.chunkDurationMs ?? 2000;
    this.recorder = new PulseAudioRecorder(this.sampleRate);
  }

  onWakeWord(listener: WakeWordListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: WakeWordEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Best-effort
      }
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Initialize STT if provided
    if (this.stt && !this.stt.isReady()) {
      await this.stt.initialize();
    }

    this.emit({
      type: "listening",
      wakeWord: this.wakeWord,
      transcript: "",
      confidence: 0,
      timestamp: Date.now(),
    });

    // Start continuous listening loop
    this.timer = setInterval(() => {
      void this.listenChunk();
    }, this.chunkDurationMs);

    // Run first chunk immediately
    void this.listenChunk();
  }

  stop(): void {
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.recorder.isRecording()) {
      this.recorder.stop();
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private async listenChunk(): Promise<void> {
    if (!this.running || this.recorder.isRecording()) return;

    try {
      this.recorder.start();

      // Record for chunk duration
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          if (this.recorder.isRecording()) {
            this.recorder.stop();
          }
          resolve();
        }, this.chunkDurationMs);
      });

      const audio = await this.recorder.stop();
      if (audio.length === 0) return;

      // Transcribe with Whisper
      const transcript = await this.transcribe(audio);
      if (!transcript) return;

      // Check for wake word
      const lower = transcript.toLowerCase();
      if (lower.includes(this.wakeWord)) {
        this.emit({
          type: "detected",
          wakeWord: this.wakeWord,
          transcript,
          confidence: this.calculateConfidence(transcript, lower),
          timestamp: Date.now(),
        });
      }
    } catch {
      // Best-effort — continue listening
    }
  }

  private async transcribe(audio: Float32Array): Promise<string> {
    // Use provided STT engine if available
    if (this.stt && this.stt.isReady()) {
      const input = this.sampleRate !== 16000
        ? resample(audio, this.sampleRate, 16000)
        : audio;
      return this.stt.transcribe(input, 16000);
    }

    // Fallback: try using local Whisper CLI
    return this.transcribeWithCli(audio);
  }

  private async transcribeWithCli(audio: Float32Array): Promise<string> {
    try {
      const cacheDir = join(homedir(), ".flux", "voice");
      if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

      const wavPath = join(cacheDir, "wake_chunk.wav");
      const pcmData = float32ToWav(audio, this.sampleRate);

      const { writeFileSync } = await import("node:fs");
      writeFileSync(wavPath, pcmData);

      // Try whisper CLI (if installed via pip)
      const result = execSync(
        `whisper "${wavPath}" --model tiny --language en --output_format txt --output_dir "${cacheDir}" 2>/dev/null`,
        { stdio: "pipe", timeout: 15000 },
      );

      const txtPath = join(cacheDir, "wake_chunk.txt");
      if (existsSync(txtPath)) {
        return readFileSync(txtPath, "utf-8").trim();
      }

      return result.toString().trim();
    } catch {
      return "";
    }
  }

  private calculateConfidence(transcript: string, lower: string): number {
    const wakeWordIdx = lower.indexOf(this.wakeWord);
    if (wakeWordIdx === -1) return 0;

    // Higher confidence if wake word is at start or end of utterance
    const wordCount = transcript.split(/\s+/).length;
    const position = wakeWordIdx / lower.length;
    const lengthFactor = Math.max(0.3, 1 - wordCount * 0.1);
    const positionFactor = position < 0.3 ? 1.0 : position > 0.7 ? 0.9 : 0.7;

    return Math.min(1.0, lengthFactor * positionFactor);
  }

  getWakeWord(): string {
    return this.wakeWord;
  }
}

function float32ToWav(audio: Float32Array, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = audio.length * (bitsPerSample / 8);
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 30);
  buffer.writeUInt16LE(bitsPerSample, 32);

  // data chunk
  buffer.write("data", 34);
  buffer.writeUInt32LE(dataSize, 38);

  // Write audio samples
  for (let i = 0; i < audio.length; i++) {
    const sample = Math.max(-1, Math.min(1, audio[i]!));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

export function createWakeWordService(options?: WakeWordOptions): {
  readonly name: string;
  readonly description: string;
  canHandle(input: string): boolean;
  execute(input: string): Promise<{ text: string }>;
  startListening(): Promise<void>;
  stopListening(): void;
  isListening(): boolean;
  onWakeWord(listener: WakeWordListener): () => void;
  detector: WakeWordDetector;
} {
  const detector = new WakeWordDetector(options);

  return {
    name: "wake-word",
    description: "Local wake word detection using Whisper — listens for 'flux' (or custom word) and triggers when heard",

    canHandle(input: string): boolean {
      const lower = input.toLowerCase();
      return /(?:start|enable|toggle)\s+(?:wake|always[\s-]?on)\s*(?:word|listening|mode)?/i.test(lower) ||
        /(?:stop|disable)\s+(?:wake|always[\s-]?on)\s*(?:word|listening|mode)?/i.test(lower) ||
        /is\s+(?:wake|always[\s-]?on)\s*(?:word|listening|mode)\s+(?:on|enabled|active)/i.test(lower);
    },

    async execute(input: string): Promise<{ text: string }> {
      const lower = input.toLowerCase();

      if (/^is\s+/.test(lower)) {
        return {
          text: detector.isRunning()
            ? `Wake word detection is active (listening for "${detector.getWakeWord()}")`
            : "Wake word detection is inactive",
        };
      }

      if (/^stop|^disable/.test(lower)) {
        detector.stop();
        return { text: "Wake word detection stopped" };
      }

      if (/^start|^enable/.test(lower)) {
        await detector.start();
        return { text: `Wake word detection started — listening for "${detector.getWakeWord()}"` };
      }

      return { text: "Usage: start/stop/is wake word listening" };
    },

    async startListening(): Promise<void> {
      await detector.start();
    },

    stopListening(): void {
      detector.stop();
    },

    isListening(): boolean {
      return detector.isRunning();
    },

    onWakeWord(listener: WakeWordListener): () => void {
      return detector.onWakeWord(listener);
    },

    detector,
  };
}
