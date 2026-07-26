import type { STTEngine } from "@ai-agent/voice-stt";
import type { TTSEngine } from "@ai-agent/voice-tts";
import type { AudioRecorder, AudioPlayer } from "../interfaces/audio.js";

export interface VoicePipelineOptions {
  stt: STTEngine;
  tts: TTSEngine;
  recorder: AudioRecorder;
  player: AudioPlayer;
}

export interface VoicePipelineCallbacks {
  onTranscript?: (text: string) => void;
  onThinking?: () => void;
  onReply?: (text: string) => void;
  onSpeak?: (audio: Buffer) => void;
  onError?: (error: Error) => void;
}

export class VoicePipeline {
  private readonly stt: STTEngine;
  private readonly tts: TTSEngine;
  private readonly recorder: AudioRecorder;
  private readonly player: AudioPlayer;

  constructor(options: VoicePipelineOptions) {
    this.stt = options.stt;
    this.tts = options.tts;
    this.recorder = options.recorder;
    this.player = options.player;
  }

  async initialize(): Promise<void> {
    await Promise.all([this.stt.initialize(), this.tts.initialize()]);
  }

  async startListening(): Promise<void> {
    this.recorder.start();
  }

  async stopListening(): Promise<string> {
    const audio = await this.recorder.stop();
    const sampleRate = this.recorder.getSampleRate();

    if (audio.length === 0) return "";

    const transcript = await this.stt.transcribe(audio, sampleRate);
    return transcript;
  }

  async speak(text: string): Promise<void> {
    const audio = await this.tts.synthesize(text);
    if (audio.length > 0) {
      await this.player.play(audio);
    }
  }

  async processVoiceInput(
    callbacks: VoicePipelineCallbacks,
    processFn: (input: string) => Promise<string>,
  ): Promise<string> {
    try {
      const transcript = await this.stopListening();

      if (!transcript.trim()) return "";

      callbacks.onTranscript?.(transcript);
      callbacks.onThinking?.();

      const response = await processFn(transcript);

      callbacks.onReply?.(response);

      await this.speak(response);
      callbacks.onSpeak?.(Buffer.alloc(0));

      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      callbacks.onError?.(error);
      return "";
    }
  }

  isRecording(): boolean {
    return this.recorder.isRecording();
  }
}
