export interface SessionStore {
  save(id: string, data: unknown): Promise<void>;

  load(id: string): Promise<unknown>;
}
