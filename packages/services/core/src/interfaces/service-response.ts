export interface ServiceResponse {
  text: string;
  actions?: ServiceAction[];
}

export interface ServiceAction {
  type: string;
  payload: Record<string, unknown>;
}
