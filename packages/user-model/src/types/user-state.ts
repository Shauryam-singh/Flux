export type UserStateType =
  | "focused"
  | "distracted"
  | "learning"
  | "debugging"
  | "researching"
  | "meeting"
  | "idle"
  | "exploring"
  | "frustrated"
  | "deep_work";

export interface UserState {
  readonly current: UserStateType;
  readonly confidence: number;
  readonly since: number;
  readonly factors: ReadonlyArray<string>;
  readonly previousState: UserStateType | null;
}
