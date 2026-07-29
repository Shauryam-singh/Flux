import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  TTSEngine,
  TTSSynthesizeOptions,
} from "../interfaces/tts-engine.js";

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
    const piperBinary = join(
      cacheDir,
      platform === "win32" ? "piper.exe" : "piper",
    );

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

  async synthesize(
    text: string,
    options?: TTSSynthesizeOptions,
  ): Promise<Buffer> {
    const voice = options?.voice ?? this.voice;
    const speed = options?.speed ?? 1.0;
    if (this.piperPath) {
      return this.synthesizeWithPiper(text, voice);
    }
    return this.synthesizeWithEspeak(text, voice, speed);
  }

  private async synthesizeWithPiper(
    text: string,
    voice?: string,
  ): Promise<Buffer> {
    const cacheDir = getCacheDir();
    const wavPath = join(cacheDir, "tts_output.wav");
    const piperVoice = voice || this.voice;

    try {
      execSync(
        `echo ${JSON.stringify(text)} | ${this.piperPath} --model ${piperVoice} --output_file ${wavPath}`,
        { stdio: "pipe", timeout: 30000 },
      );

      return readFileSync(wavPath);
    } catch {
      return this.synthesizeWithEspeak(text);
    }
  }

  private stripEmoji(text: string): string {
    // Remove emoji characters, symbols, and decorative unicode
    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, "") // emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, "") // symbols & pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // transport & map
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "") // flags
      .replace(/[\u{2600}-\u{26FF}]/gu, "") // misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, "") // dingbats
      .replace(/[\u{FE00}-\u{FE0F}]/gu, "") // variation selectors
      .replace(/[\u{200D}]/gu, "") // zero width joiner
      .replace(/[\u{20E3}]/gu, "") // combining enclosing keycap
      .replace(/[\u{E0020}-\u{E007F}]/gu, "") // tags
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, "") // supplemental symbols
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "") // chess symbols
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "") // symbols extended-A
      .replace(/[\u{2000}-\u{200F}]/gu, "") // general punctuation
      .replace(/[\u{2028}-\u{202F}]/gu, "") // separators
      .replace(/[\u{2030}-\u{2038}]/gu, "") // punctuation
      .replace(/[\u{203C}-\u{2047}]/gu, "") // punctuation
      .replace(/[\u{2049}-\u{2053}]/gu, "") // punctuation
      .replace(/[\u{2055}-\u{205E}]/gu, "") // punctuation
      .replace(/[\u{2190}-\u{21FF}]/gu, "") // arrows
      .replace(/[\u{2300}-\u{23FF}]/gu, "") // misc technical
      .replace(/[\u{25A0}-\u{25FF}]/gu, "") // geometric shapes
      .replace(/[\u{2B00}-\u{2BFF}]/gu, "") // misc symbols and arrows
      .replace(/[\u{3000}-\u{303F}]/gu, "") // CJK symbols
      .replace(/[\u{1F000}-\u{1F02F}]/gu, "") // mahjong tiles
      .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, "") // playing cards
      .replace(/[\u{1F100}-\u{1F1FF}]/gu, "") // enclosed alphanumeric
      .replace(/\s{2,}/g, " ") // collapse whitespace
      .trim();
  }

  private async synthesizeWithEspeak(
    text: string,
    voice?: string,
    speed?: number,
  ): Promise<Buffer> {
    const cacheDir = getCacheDir();
    const wavPath = join(cacheDir, "tts_output.wav");
    const espeakVoice = voice || "en-us+m3";
    // Convert speed multiplier (0.6-1.8) to espeak -s value (80-250, default 175)
    const espeakSpeed = Math.round(175 * (speed || 1.0));

    try {
      if (getPlatform() === "win32") {
        const psScript = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak(${JSON.stringify(text)})`;
        execSync(`powershell -Command "${psScript}"`, {
          stdio: "pipe",
          timeout: 30000,
        });
        return Buffer.alloc(0);
      }

      const cleanText = this.stripEmoji(text);
      if (!cleanText) return Buffer.alloc(0);

      const safeText = cleanText.replace(/"/g, '\\"').replace(/\$/g, "\\$");
      for (const cmd of [
        `espeak-ng -v ${espeakVoice} -s ${espeakSpeed} -p 35 -a 170 -w ${wavPath} "${safeText}"`,
        `espeak-ng -v en-us -s ${espeakSpeed} -p 35 -a 170 -w ${wavPath} "${safeText}"`,
        `espeak -v en-us -s ${espeakSpeed} -p 35 -a 170 -w ${wavPath} "${safeText}"`,
      ]) {
        try {
          execSync(`${cmd} 2>/dev/null`, { stdio: "pipe", timeout: 30000 });
          if (existsSync(wavPath)) {
            const buf = readFileSync(wavPath);
            if (buf.length > 44) {
              try {
                unlinkSync(wavPath);
              } catch {
                /* ignore */
              }
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
