import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { TTSEngine } from "../interfaces/tts-engine.js";

function getCacheDir(): string {
  const dir = join(homedir(), ".flux", "voice");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getPlatform(): "linux" | "win32" | "darwin" {
  return process.platform as "linux" | "win32" | "darwin";
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export class PiperEngine implements TTSEngine {
  readonly name = "piper";
  private voice: string;
  private piperPath: string | null = null;

  constructor(options?: { voice?: string }) {
    this.voice = options?.voice ?? "en_US-lessac-medium";
  }

  setVoice(voice: string): void {
    this.voice = voice;
  }

  async initialize(): Promise<void> {
    if (this.piperPath) return;

    const cacheDir = getCacheDir();
    const platform = getPlatform();
    const piperBinary = join(cacheDir, platform === "win32" ? "piper.exe" : "piper");

    if (existsSync(piperBinary)) {
      this.piperPath = piperBinary;
      return;
    }

    // Try system-installed piper
    if (commandExists("piper")) {
      this.piperPath = "piper";
      return;
    }

    // Piper not available — will fall back to espeak
    this.piperPath = null;
  }

  async synthesize(text: string): Promise<Buffer> {
    if (this.piperPath) {
      return this.synthesizeWithPiper(text);
    }
    return this.synthesizeWithEspeak(text);
  }

  private async synthesizeWithPiper(text: string): Promise<Buffer> {
    const cacheDir = getCacheDir();
    const wavPath = join(cacheDir, "tts_output.wav");

    try {
      execSync(
        `echo ${JSON.stringify(text)} | ${this.piperPath} --model ${this.voice} --output_file ${wavPath}`,
        { stdio: "pipe", timeout: 30000 },
      );

      return readFileSync(wavPath);
    } catch {
      return this.synthesizeWithEspeak(text);
    }
  }

  private async synthesizeWithEspeak(text: string): Promise<Buffer> {
    const cacheDir = getCacheDir();
    const wavPath = join(cacheDir, "tts_output.wav");

    try {
      if (getPlatform() === "win32") {
        const psScript = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak(${JSON.stringify(text)})`;
        execSync(`powershell -Command "${psScript}"`, { stdio: "pipe", timeout: 30000 });
        return Buffer.alloc(0);
      }

      // Write to temp file, then read back (avoids /dev/stdout issues with execSync)
      const safeText = text.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      for (const cmd of [
        `espeak-ng -v en-us -s 155 -p 40 -a 180 -w ${wavPath} "${safeText}"`,
        `espeak -v en-us -s 155 -p 40 -a 180 -w ${wavPath} "${safeText}"`,
      ]) {
        try {
          execSync(`${cmd} 2>/dev/null`, { stdio: "pipe", timeout: 30000 });
          if (existsSync(wavPath)) {
            const buf = readFileSync(wavPath);
            if (buf.length > 44) {
              try { unlinkSync(wavPath); } catch { /* ignore */ }
              return buf;
            }
          }
        } catch {
          // Try next
        }
      }
      return Buffer.alloc(0);
    } catch {
      return Buffer.alloc(0);
    }
  }

  isReady(): boolean {
    return true;
  }
}
