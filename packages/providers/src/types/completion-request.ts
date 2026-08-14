export interface CompletionRequest {
  readonly model: string;

  readonly prompt: string;

  /** Structured chat messages (system/user/assistant). When provided,
   *  providers should prefer this over the flat `prompt`. */
  readonly messages?: readonly { role: string; content: string }[];

  readonly temperature?: number;

  readonly maxTokens?: number;

  readonly stream?: boolean;

  readonly images?: readonly string[];
}
