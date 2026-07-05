export interface EventBus {
  publish(event: unknown): Promise<void>;

  subscribe(
    event: string,
    handler: (payload: unknown) => void | Promise<void>,
  ): void;
}
