export interface AudioRecorder {
  start(): void;
  stop(): Promise<Float32Array>;
  getSampleRate(): number;
  isRecording(): boolean;
}

export interface AudioPlayer {
  play(buffer: Buffer): Promise<void>;
  stop(): void;
}
