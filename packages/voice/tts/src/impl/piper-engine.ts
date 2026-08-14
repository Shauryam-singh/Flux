import { execFileSync, execSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  chmodSync,
  createWriteStream,
  readdirSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, parse } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  TTSEngine,
  TTSSynthesizeOptions,
} from "../interfaces/tts-engine.js";

const PIPER_RELEASE_URL = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2";
const PIPER_VOICE_BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

// Fast, natural-sounding default voice (medium quality for speed).
const DEFAULT_PIPER_VOICE = "en_US-ryan-medium";

// Legacy espeak-style voice ids -> modern Piper voice names.
// Using medium quality for faster synthesis.
const VOICE_ALIASES: Record<string, string> = {
  "en-us+m3": "en_US-ryan-medium",
  "en-us+m7": "en_US-joe-medium",
  "en-us+f2": "en_US-hfc_female-medium",
  "en-us+f3": "en_US-hfc_female-medium",
  "en-us+f4": "en_US-hfc_female-medium",
  "en-us+nrc": "en_US-lessac-medium",
  "en-gb+x-rp": "en_GB-cori-medium",
  "en-gb-scotland": "en_GB-northern_english_male-medium",
};

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

function getArch(): "x86_64" | "aarch64" {
  return process.arch === "arm64" ? "aarch64" : "x86_64";
}

/**
 * Map the current platform + arch to a real Piper release asset.
 * Piper 2023.11.14-2 ships: piper_windows_amd64.zip,
 * piper_macos_{x64,aarch64}.tar.gz, piper_linux_{x86_64,aarch64,armv7l}.tar.gz
 */
function getAsset(): { name: string; ext: string } | null {
  const platform = getPlatform();
  const arch = getArch();
  switch (platform) {
    case "win32":
      return { name: "piper_windows_amd64", ext: ".zip" };
    case "darwin":
      return { name: arch === "aarch64" ? "piper_macos_aarch64" : "piper_macos_x64", ext: ".tar.gz" };
    case "linux":
      return { name: arch === "aarch64" ? "piper_linux_aarch64" : "piper_linux_x86_64", ext: ".tar.gz" };
    default:
      return null;
  }
}

/** Recursively locate the piper executable inside an extracted directory. */
function findPiperBinary(dir: string): string | null {
  const target = getPlatform() === "win32" ? "piper.exe" : "piper";
  const direct = join(dir, target);
  try {
    if (existsSync(direct) && statSync(direct).isFile()) return direct;
  } catch {}
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = join(dir, entry.name, target);
      try {
        if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
      } catch {}
    }
  } catch {}
  return null;
}

/** Walk the working directory and its ancestors looking for the archive. */
function findLocalArchive(
  filename: string,
  minSize: number,
): string | null {
  let dir = process.cwd();
  const root = parse(dir).root;
  while (true) {
    const candidate = join(dir, filename);
    try {
      if (existsSync(candidate) && statSync(candidate).size >= minSize) {
        return candidate;
      }
    } catch {}
    if (dir === root) break;
    dir = dirname(dir);
  }
  return null;
}

/** Walk up the directory tree looking for an extracted piper binary. */
function findPiperBinaryInTree(startDir: string): string | null {
  let dir = startDir;
  const root = parse(dir).root;
  while (true) {
    const found = findPiperBinary(dir);
    if (found) return found;
    if (dir === root) break;
    dir = dirname(dir);
  }
  return null;
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

  // Truncated downloads (interrupted connection) corrupt the model and make
  // piper crash. Verify the full length when the server reports one.
  const expectedSize = response.headers.get("content-length");
  if (expectedSize && Number(expectedSize) > 0) {
    const existing = existsSync(dest) ? statSync(dest).size : 0;
    if (existing >= Number(expectedSize)) {
      process.stdout.write(`Skipping already-downloaded file (${existing} bytes) at ${dest}\n`);
      return;
    }
  }

  const nodeStream = Readable.fromWeb(response.body as unknown as ReadableStream<Uint8Array>);
  const fileStream = createWriteStream(dest);
  await pipeline(nodeStream, fileStream);

  if (expectedSize && Number(expectedSize) > 0) {
    const actual = existsSync(dest) ? statSync(dest).size : 0;
    if (actual < Number(expectedSize)) {
      try { unlinkSync(dest); } catch { /* ignore */ }
      throw new Error(`Incomplete download: got ${actual}/${expectedSize} bytes for ${url}`);
    }
  }
}

async function downloadPiperBinary(): Promise<string | null> {
  const cacheDir = getCacheDir();
  const platform = getPlatform();

  // Already installed?
  const existing = findPiperBinary(cacheDir);
  if (existing) return existing;

  const asset = getAsset();
  if (!asset) return null;

  try {
    const filename = `${asset.name}${asset.ext}`;
    const url = `${PIPER_RELEASE_URL}/${filename}`;
    const archivePath = join(cacheDir, filename);

    // Reuse an existing archive instead of re-downloading. Look in the
    // cache dir first, then the working directory (and its ancestors — the
    // user may keep the ZIP in the project root while the API runs from a
    // subfolder). A valid piper ZIP is multi-MB; anything tiny is a
    // truncated/failed download and gets replaced.
    const MIN_VALID_ZIP = 1024 * 1024;
    const localArchive =
      existsSync(archivePath) && statSync(archivePath).size >= MIN_VALID_ZIP
        ? archivePath
        : findLocalArchive(filename, MIN_VALID_ZIP);
    if (localArchive && localArchive !== archivePath) {
      process.stdout.write(`Using existing Piper archive at ${localArchive}\n`);
      await extractPiperArchive(localArchive, cacheDir, platform);
      const binary = findPiperBinary(cacheDir);
      if (binary) {
        process.stdout.write(`Piper binary installed at ${binary}\n`);
        return binary;
      }
      // Extraction failed — fall through and re-download
    } else if (localArchive === archivePath) {
      process.stdout.write(`Using cached Piper archive at ${archivePath}\n`);
      await extractPiperArchive(archivePath, cacheDir, platform);
      const binary = findPiperBinary(cacheDir);
      if (binary) {
        process.stdout.write(`Piper binary installed at ${binary}\n`);
        return binary;
      }
      // Extraction failed — fall through and re-download
    }

    process.stdout.write(`Downloading Piper TTS binary from ${url}...\n`);
    await downloadFile(url, archivePath);

    await extractPiperArchive(archivePath, cacheDir, platform);

    try { unlinkSync(archivePath); } catch { /* ignore */ }

    const binary = findPiperBinary(cacheDir);
    if (binary) {
      if (platform !== "win32") {
        try { chmodSync(binary, 0o755); } catch { /* ignore */ }
      }
      process.stdout.write(`Piper binary installed at ${binary}\n`);
      return binary;
    }
  } catch (err) {
    process.stdout.write(`Failed to auto-download Piper: ${err}\n`);
  }

  return null;
}

async function extractPiperArchive(
  archivePath: string,
  cacheDir: string,
  platform: string,
): Promise<void> {
  if (platform === "win32") {
    execFileSync("powershell", [
      "-Command",
      `Expand-Archive -Path '${archivePath}' -DestinationPath '${cacheDir}' -Force`,
    ], { stdio: "pipe" });
  } else {
    execFileSync("tar", ["xzf", archivePath, "-C", cacheDir], { stdio: "pipe" });
  }
}

/** Normalize any voice id (piper or legacy espeak style) to a Piper voice name. */
function normalizeVoice(voice?: string): string {
  const v = (voice ?? "").trim();
  if (!v) return DEFAULT_PIPER_VOICE;
  if (VOICE_ALIASES[v]) return VOICE_ALIASES[v];
  // Looks like a piper voice id: lang_region-name-quality, e.g. en_US-ryan-high
  if (/^[a-z]{2,3}_[A-Z]+-/.test(v)) return v;
  return DEFAULT_PIPER_VOICE;
}

async function downloadVoiceModel(voice: string): Promise<string | null> {
  const modelsDir = getModelsDir();
  const modelPath = join(modelsDir, `${voice}.onnx`);
  // A valid piper onnx voice is many MB; a tiny file is a truncated/failed
  // download and must be re-fetched (otherwise piper crashes on load).
  if (existsSync(modelPath) && statSync(modelPath).size >= 1024 * 1024) {
    return modelPath;
  }
  try { unlinkSync(modelPath); } catch { /* ignore */ }

  try {
    // Piper voice repos live at {lang}/{lang_region}/{name}/{quality}/{voice}.onnx
    const [langRegion = "en_US", name = "ryan", ...qualityParts] = voice.split("-");
    const lang = langRegion.split("_")[0];
    const quality = qualityParts.join("-") || "medium";
    const url = `${PIPER_VOICE_BASE_URL}/${lang}/${langRegion}/${name}/${quality}/${voice}.onnx`;
    process.stdout.write(`Downloading voice model: ${voice}...\n`);
    // Voice models are ~120MB; a dropped connection is common, so retry.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await downloadFile(url, modelPath);
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        process.stdout.write(`Download interrupted (${err}), retrying (${attempt + 1}/3)...\n`);
      }
    }

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
  // Keep-alive: persistent piper process for faster synthesis
  private piperProcess: import("node:child_process").ChildProcess | null = null;
  private currentModelPath: string | null = null;
  private piperBusy = false;
  private piperStdoutBuffer = Buffer.alloc(0);

  constructor(options?: { voice?: string }) {
    this.voice = normalizeVoice(options?.voice);
  }

  setVoice(voice: string): void {
    this.voice = normalizeVoice(voice);
    this.voiceModelPath = null; // Reset cached model path
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const cacheDir = getCacheDir();

    // Check for an existing binary (downloaded, in cache, or pointed at by
    // the PIPER_BINARY env var / present in the working directory tree)
    const envBinary = process.env.PIPER_BINARY;
    const existing =
      (envBinary && existsSync(envBinary) ? envBinary : null) ??
      findPiperBinary(cacheDir) ??
      findPiperBinaryInTree(process.cwd());
    if (existing) {
      this.piperPath = existing;
    } else if (commandExists("piper")) {
      this.piperPath = "piper";
    } else {
      // Auto-download Piper binary
      this.piperPath = await downloadPiperBinary();
    }

    // Pre-download voice model if Piper is available
    if (this.piperPath) {
      this.voiceModelPath = await downloadVoiceModel(this.voice);
      // Start persistent piper process for faster synthesis
      this.startPersistentProcess();
    }
  }

  /**
   * Start a persistent piper process that stays alive between synthesis calls.
   * This eliminates the 200-800ms cold-start overhead of reloading the ONNX model.
   */
  private startPersistentProcess(): void {
    if (!this.piperPath || !this.voiceModelPath) return;
    if (this.piperProcess && !this.piperProcess.killed) return;

    try {
      const args = ["--model", this.voiceModelPath, "--output-raw"];
      this.piperProcess = spawn(this.piperPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
      this.currentModelPath = this.voiceModelPath;

      // Collect stdout data
      this.piperProcess.stdout?.on("data", (chunk: Buffer) => {
        this.piperStdoutBuffer = Buffer.concat([this.piperStdoutBuffer, chunk]);
      });

      this.piperProcess.on("error", () => {
        this.piperProcess = null;
      });

      this.piperProcess.on("close", () => {
        this.piperProcess = null;
      });

      console.log("[piper] persistent process started");
    } catch {
      this.piperProcess = null;
    }
  }

  /**
   * Ensure the persistent piper process is using the correct model.
   * If the model changed, restart the process.
   */
  private ensureCorrectModel(): void {
    if (!this.voiceModelPath) return;
    if (this.currentModelPath === this.voiceModelPath && this.piperProcess && !this.piperProcess.killed) {
      return; // Already using correct model
    }
    // Kill old process and start new one with correct model
    this.killPersistentProcess();
    this.startPersistentProcess();
  }

  /**
   * Kill the persistent piper process.
   */
  private killPersistentProcess(): void {
    if (this.piperProcess) {
      try { this.piperProcess.kill(); } catch {}
      this.piperProcess = null;
    }
  }

  async synthesize(
    text: string,
    options?: TTSSynthesizeOptions,
  ): Promise<Buffer> {
    const voice = normalizeVoice(options?.voice);
    const speed = options?.speed ?? 1.0;
    if (this.piperPath) {
      const result = await this.synthesizeWithPiper(text, voice, speed);
      if (result.length > 0) return result;
    }
    return this.synthesizeWithEspeak(text, voice, speed);
  }

  private async synthesizeWithPiper(
    text: string,
    voice?: string,
    speed = 1.0,
  ): Promise<Buffer> {
    const piperVoice = normalizeVoice(voice);

    try {
      const modelPath = this.voiceModelPath ?? join(
        getModelsDir(),
        `${piperVoice}.onnx`,
      );
      
      // Use stdout pipe for faster output (no file I/O)
      const args = ["--model", modelPath, "--output-raw"];
      
      // If model doesn't exist, try with voice name (piper will download)
      if (!existsSync(modelPath)) {
        args[1] = piperVoice;
      }

      // Try persistent process first (faster - no model reload)
      this.ensureCorrectModel();
      if (this.piperProcess && !this.piperProcess.killed && !this.piperBusy) {
        return await this.synthesizeWithPersistentProcess(text);
      }

      // Fallback: spawn new process
      const proc = spawn(
        this.piperPath!,
        args,
        { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
      );

      // Collect raw PCM output from stdout
      const chunks: Buffer[] = [];
      if (proc.stdout) {
        proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      }

      if (proc.stdin) {
        proc.stdin.write(this.stripEmoji(text));
        proc.stdin.end();
      }

      // Wait for process to finish
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          proc.kill();
          reject(new Error("Piper timed out"));
        }, 15000);
        proc.on("close", (code) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error(`Piper exited with code ${code}`));
        });
        proc.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const rawPcm = Buffer.concat(chunks);
      if (rawPcm.length > 0) {
        // Convert raw 16-bit PCM to WAV
        return this.rawPcmToWav(rawPcm, 22050);
      }
    } catch {
      // Fall through to espeak
    }

    return Buffer.alloc(0);
  }

  /**
   * Synthesize using the persistent piper process (faster - no model reload).
   */
  private async synthesizeWithPersistentProcess(text: string): Promise<Buffer> {
    if (!this.piperProcess || !this.piperProcess.stdin) {
      return Buffer.alloc(0);
    }

    this.piperBusy = true;
    this.piperStdoutBuffer = Buffer.alloc(0);

    try {
      // Write text to stdin
      this.piperProcess.stdin.write(this.stripEmoji(text));
      this.piperProcess.stdin.write("\n"); // newline signals end of input

      // Wait for output with timeout
      const rawPcm = await new Promise<Buffer>((resolve) => {
        const timer = setTimeout(() => {
          resolve(this.piperStdoutBuffer);
        }, 5000); // 5 second timeout for persistent process

        const checkOutput = () => {
          if (this.piperStdoutBuffer.length > 0) {
            // Small delay to ensure all data is received
            setTimeout(() => {
              clearTimeout(timer);
              resolve(this.piperStdoutBuffer);
            }, 100);
          } else {
            setTimeout(checkOutput, 10);
          }
        };
        checkOutput();
      });

      this.piperBusy = false;

      if (rawPcm.length > 0) {
        return this.rawPcmToWav(rawPcm, 22050);
      }
    } catch {
      this.piperBusy = false;
    }

    return Buffer.alloc(0);
  }

  /** Convert raw 16-bit PCM to WAV format */
  private rawPcmToWav(pcm: Buffer, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcm.length;
    const headerSize = 44;
    const wav = Buffer.alloc(headerSize + dataSize);

    // RIFF header
    wav.write("RIFF", 0);
    wav.writeUInt32LE(36 + dataSize, 4);
    wav.write("WAVE", 8);
    // fmt chunk
    wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); // PCM
    wav.writeUInt16LE(numChannels, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(byteRate, 28);
    wav.writeUInt16LE(blockAlign, 32);
    wav.writeUInt16LE(bitsPerSample, 34);
    // data chunk
    wav.write("data", 36);
    wav.writeUInt32LE(dataSize, 40);
    pcm.copy(wav, headerSize);
    return wav;
  }

  private stripEmoji(text: string): string {
    // Fast path: skip if no high Unicode chars (avoids 28 regex calls)
    if (!/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/u.test(text)) {
      return text;
    }
    // Single regex pass for emoji removal
    return text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
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
    const espeakVoice = "en-us+m3";
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
    const voice = normalizeVoice(voiceName ?? this.voice);
    const result = await downloadVoiceModel(voice);
    if (result) {
      this.voiceModelPath = result;
      return true;
    }
    return false;
  }
}
