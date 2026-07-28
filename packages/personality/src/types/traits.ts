export interface PersonalityTraits {
  readonly humour: number;
  readonly sarcasm: number;
  readonly curiosity: number;
  readonly verbosity: number;
  readonly confidence: number;
  readonly warmth: number;
  readonly proactiveness: number;
  readonly formality: number;
}

export interface Personality {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly traits: PersonalityTraits;
  readonly greeting: string;
  readonly styleNotes: string;
}
