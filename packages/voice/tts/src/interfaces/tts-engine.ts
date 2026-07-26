export interface TTSEngine {
  name: string;
  initialize(): Promise<void>;
  synthesize(text: string): Promise<Buffer>;
  isReady(): boolean;
  setVoice?(voice: string): void;
}
