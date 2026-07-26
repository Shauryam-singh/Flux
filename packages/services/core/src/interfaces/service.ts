import type { ServiceContext } from "./service-context.js";
import type { ServiceResponse } from "./service-response.js";

export interface Service {
  readonly name: string;
  readonly description: string;

  canHandle(input: string): boolean | Promise<boolean>;

  execute(input: string, ctx: ServiceContext): Promise<ServiceResponse>;
}
