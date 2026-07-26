export interface STTEngine {
  name: string;
  initialize(): Promise<void>;
  transcribe(audio: Float32Array, sampleRate: number): Promise<string>;
  isReady(): boolean;
}
