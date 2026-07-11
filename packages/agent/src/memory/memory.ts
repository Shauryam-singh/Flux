export interface Memory {
  add(role: string, content: string): Promise<void>;

  history(): Promise<
    {
      role: string;
      content: string;
    }[]
  >;

  clear(): Promise<void>;
}
