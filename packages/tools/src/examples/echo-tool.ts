import { DefaultTool } from "../tool/default-tool.js";

export const echoTool = new DefaultTool("echo", async (input) => ({
  success: true,
  output: input,
}));
