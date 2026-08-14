import type { ServiceContext } from "./service-context.js";
import type { ServiceResponse } from "./service-response.js";

export interface Service {
  readonly name: string;
  readonly description: string;

  canHandle(input: string): boolean | Promise<boolean>;

  execute(input: string, ctx: ServiceContext): Promise<ServiceResponse>;

  executeStream?(
    input: string,
    ctx: ServiceContext,
    callbacks: {
      onToken?: (token: string) => void;
      onDone?: (text: string) => void;
      onError?: (error: Error) => void;
    },
  ): Promise<void>;
}
