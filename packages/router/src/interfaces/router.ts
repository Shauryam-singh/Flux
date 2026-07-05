import type { RouteRequest } from "../types/route-request.js";
import type { RouteResponse } from "../types/route-response.js";

export interface Router {
  route(request: RouteRequest): Promise<RouteResponse>;
}
