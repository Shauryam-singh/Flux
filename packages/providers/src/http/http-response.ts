export interface HttpResponse<T = unknown> {
  readonly status: number;

  readonly headers: Readonly<Record<string, string>>;

  readonly data: T;
}
