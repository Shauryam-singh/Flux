import { spawn, execSync } from "node:child_process";
import type { AudioRecorder, AudioPlayer } from "../interfaces/audio.js";

export class SoxAudioRecorder implements AudioRecorder {
  private process: ReturnType<typeof spawn> | null = null;
  private chunks: Buffer[] = [];
  private readonly sampleRate = 16000;
  private recording = false;

  start(): void {
    if (this.recording) return;
    this.chunks = [];
    this.recording = true;

    this.process = spawn("sox", [
      "-t", "pulseaudio", "default",
      "-t", "wav",
      "-r", String(this.sampleRate),
      "-e", "signed-integer",
      "-b", "16",
      "-c", "1",
      "-",
    ]);

    this.process.stdout?.on("data", (chunk: Buffer) => {
      this.chunks.push(chunk);
    });

    this.process.on("error", () => {
      // Fallback: try arecord on Linux
      this.startArecord();
    });
  }

  private startArecord(): void {
    this.process = spawn("arecord", [
      "-f", "S16_LE",
      "-r", String(this.sampleRate),
      "-c", "1",
      "-t", "wav",
      "-",
    ]);

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

export class SoxAudioPlayer implements AudioPlayer {
  private process: ReturnType<typeof spawn> | null = null;

  async play(buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn("play", ["-t", "wav", "-"]);

      this.process.on("close", () => resolve());
      this.process.on("error", (err) => reject(err));

      if (this.process.stdin) {
        this.process.stdin.write(buffer);
        this.process.stdin.end();
      }
    });
  }

  stop(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
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
