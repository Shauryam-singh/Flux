import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, chmodSync, createWriteStream } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  TTSEngine,
  TTSSynthesizeOptions,
} from "../interfaces/tts-engine.js";

const PIPER_RELEASE_URL = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2";
const PIPER_VOICE_BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

function getCacheDir(): string {
  const dir = join(homedir(), ".flux", "voice");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getModelsDir(): string {
  const dir = join(getCacheDir(), "piper-voices");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getPlatform(): "linux" | "win32" | "darwin" {
  return process.platform as "linux" | "win32" | "darwin";
}

function getArch(): string {
  return process.arch === "arm64" ? "aarch64" : "x86_64";
}

function commandExists(cmd: string): boolean {
  try {
    if (getPlatform() === "win32") {
      execSync(`where ${cmd}`, { stdio: "ignore" });
    } else {
      execSync(`which ${cmd}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  const nodeStream = Readable.fromWeb(response.body as unknown as ReadableStream<Uint8Array>);
  const fileStream = createWriteStream(dest);
  await pipeline(nodeStream, fileStream);
}

async function downloadPiperBinary(): Promise<string | null> {
  const cacheDir = getCacheDir();
  const platform = getPlatform();
  const arch = getArch();

  const piperBinary = join(cacheDir, platform === "win32" ? "piper.exe" : "piper");
  if (existsSync(piperBinary)) return piperBinary;

  try {
    const ext = platform === "win32" ? ".zip" : ".tar.gz";
    const filename = `piper_${platform}_${arch}${ext}`;
    const url = `${PIPER_RELEASE_URL}/${filename}`;
    const archivePath = join(cacheDir, filename);

    process.stdout.write(`Downloading Piper TTS binary from ${url}...\n`);
    await downloadFile(url, archivePath);

    if (platform === "win32") {
      execFileSync("powershell", [
        "-Command",
        `Expand-Archive -Path '${archivePath}' -DestinationPath '${cacheDir}' -Force`,
      ], { stdio: "pipe" });
    } else {
      execFileSync("tar", ["xzf", archivePath, "-C", cacheDir], { stdio: "pipe" });
      const extracted = join(cacheDir, "piper");
      if (existsSync(extracted)) {
        chmodSync(extracted, 0o755);
      }
    }

    try { unlinkSync(archivePath); } catch { /* ignore */ }

    if (existsSync(piperBinary)) {
      process.stdout.write(`Piper binary installed at ${piperBinary}\n`);
      return piperBinary;
    }
  } catch (err) {
    process.stdout.write(`Failed to auto-download Piper: ${err}\n`);
  }

  return null;
}

async function downloadVoiceModel(voice: string): Promise<string | null> {
  const modelsDir = getModelsDir();
  const modelPath = join(modelsDir, `${voice}.onnx`);
  if (existsSync(modelPath)) return modelPath;

  try {
    const url = `${PIPER_VOICE_BASE_URL}/en/en_US/${voice.split("-").slice(1).join("-") || "lessac"}/${voice}.onnx`;
    process.stdout.write(`Downloading voice model: ${voice}...\n`);
    await downloadFile(url, modelPath);

    const jsonUrl = `${url}.json`;
    const jsonPath = join(modelsDir, `${voice}.onnx.json`);
    try {
      await downloadFile(jsonUrl, jsonPath);
    } catch {
      // JSON config is optional
    }

    if (existsSync(modelPath)) {
      process.stdout.write(`Voice model installed at ${modelPath}\n`);
      return modelPath;
    }
  } catch (err) {
    process.stdout.write(`Failed to download voice model ${voice}: ${err}\n`);
  }

  return null;
}

export class PiperEngine implements TTSEngine {
  readonly name = "piper";
  private voice: string;
  private piperPath: string | null = null;
  private voiceModelPath: string | null = null;
  private initialized = false;

  constructor(options?: { voice?: string }) {
    this.voice = options?.voice ?? "en_US-lessac-medium";
  }

  setVoice(voice: string): void {
    this.voice = voice;
    this.voiceModelPath = null; // Reset cached model path
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const cacheDir = getCacheDir();
    const platform = getPlatform();
    const piperBinary = join(
      cacheDir,
      platform === "win32" ? "piper.exe" : "piper",
    );

    // Check existing binary
    if (existsSync(piperBinary)) {
      this.piperPath = piperBinary;
    } else if (commandExists("piper")) {
      this.piperPath = "piper";
    } else {
      // Auto-download Piper binary
      this.piperPath = await downloadPiperBinary();
    }

    // Pre-download voice model if Piper is available
    if (this.piperPath) {
      this.voiceModelPath = await downloadVoiceModel(this.voice);
    }
  }

  async synthesize(
    text: string,
    options?: TTSSynthesizeOptions,
  ): Promise<Buffer> {
    const voice = options?.voice ?? this.voice;
    const speed = options?.speed ?? 1.0;
    if (this.piperPath) {
      const result = await this.synthesizeWithPiper(text, voice);
      if (result.length > 0) return result;
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
      const args = ["--model", piperVoice, "--output_file", wavPath];

      // If we have a pre-downloaded model path, use it
      const modelPath = this.voiceModelPath ?? join(
        getModelsDir(),
        `${piperVoice}.onnx`,
      );
      if (existsSync(modelPath)) {
        args[1] = modelPath;
      }

      const proc = execFile(
        this.piperPath!,
        args,
        { stdio: ["pipe", "pipe", "pipe"], timeout: 30000 },
      );

      // Write text to piper's stdin
      if (proc.stdin) {
        proc.stdin.write(this.stripEmoji(text));
        proc.stdin.end();
      }

      // Wait for process to finish
      await new Promise<void>((resolve, reject) => {
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Piper exited with code ${code}`));
        });
        proc.on("error", reject);
      });

      if (existsSync(wavPath)) {
        const buf = readFileSync(wavPath);
        try { unlinkSync(wavPath); } catch { /* ignore */ }
        if (buf.length > 44) return buf;
      }
    } catch {
      // Fall through to espeak
    }

    return Buffer.alloc(0);
  }

  private stripEmoji(text: string): string {
    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
      .replace(/[\u{2600}-\u{26FF}]/gu, "")
      .replace(/[\u{2700}-\u{27BF}]/gu, "")
      .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
      .replace(/[\u{200D}]/gu, "")
      .replace(/[\u{20E3}]/gu, "")
      .replace(/[\u{E0020}-\u{E007F}]/gu, "")
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "")
      .replace(/[\u{2000}-\u{200F}]/gu, "")
      .replace(/[\u{2028}-\u{202F}]/gu, "")
      .replace(/[\u{2030}-\u{2038}]/gu, "")
      .replace(/[\u{203C}-\u{2047}]/gu, "")
      .replace(/[\u{2049}-\u{2053}]/gu, "")
      .replace(/[\u{2055}-\u{205E}]/gu, "")
      .replace(/[\u{2190}-\u{21FF}]/gu, "")
      .replace(/[\u{2300}-\u{23FF}]/gu, "")
      .replace(/[\u{25A0}-\u{25FF}]/gu, "")
      .replace(/[\u{2B00}-\u{2BFF}]/gu, "")
      .replace(/[\u{3000}-\u{303F}]/gu, "")
      .replace(/[\u{1F000}-\u{1F02F}]/gu, "")
      .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, "")
      .replace(/[\u{1F100}-\u{1F1FF}]/gu, "")
      .replace(/\s{2,}/g, " ")
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
    return this.initialized;
  }

  async installPiper(): Promise<boolean> {
    const result = await downloadPiperBinary();
    if (result) {
      this.piperPath = result;
      return true;
    }
    return false;
  }

  async installVoice(voiceName?: string): Promise<boolean> {
    const voice = voiceName ?? this.voice;
    const result = await downloadVoiceModel(voice);
    if (result) {
      this.voiceModelPath = result;
      return true;
    }
    return false;
  }
}

function execFile(
  command: string,
  args: string[],
  options: { stdio: (string | "pipe" | "inherit")[]; timeout: number },
): ReturnType<typeof import("node:child_process").execFile> {
  const { execFile: execFileCb } = require("node:child_process") as typeof import("node:child_process");
  return execFileCb(command, args, options);
}
