import { DefaultTool } from "../tool/default-tool.js";

export const echoTool = new DefaultTool(
  "echo",
  "Echoes the input back to the user. Use this for general conversation or when no other tool is appropriate.",
  async (input) => ({
    success: true,
    output: input,
  }),
);
