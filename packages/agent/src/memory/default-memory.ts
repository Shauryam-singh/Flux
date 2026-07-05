import type { Memory } from "./memory.js";

type Message = {
  role: string;
  content: string;
};

export class DefaultMemory implements Memory {
  private readonly messages: Message[] = [];

  public async add(
    role: string,
    content: string,
  ): Promise<void> {
    this.messages.push({
      role,
      content,
    });
  }

  public async history(): Promise<Message[]> {
    return [...this.messages];
  }

  public async clear(): Promise<void> {
    this.messages.length = 0;
  }
}