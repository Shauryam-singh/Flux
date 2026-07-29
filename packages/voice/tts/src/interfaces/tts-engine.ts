export interface TTSSynthesizeOptions {
  readonly voice?: string;
  readonly speed?: number;
  readonly pitch?: number;
  readonly volume?: number;
}

export interface TTSEngine {
  name: string;
  initialize(): Promise<void>;
  synthesize(text: string, options?: TTSSynthesizeOptions): Promise<Buffer>;
  isReady(): boolean;
  setVoice?(voice: string): void;
}
