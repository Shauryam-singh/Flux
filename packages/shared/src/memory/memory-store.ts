export interface MemoryStore {
  insert(text: string): Promise<void>;

  search(query: string): Promise<string[]>;
}
