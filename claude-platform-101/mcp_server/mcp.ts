import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";

const client = new Anthropic();

// os.environ["..."] у Python падає, якщо змінної немає. У TS process.env
// просто поверне undefined, тому перевіряємо явно.
const linearToken = process.env.LINEAR_MCP_TOKEN;
if (!linearToken) throw new Error("LINEAR_MCP_TOKEN is not set");

const response = await client.beta.messages.create({
  model: "claude-opus-5",
  max_tokens: 1024,
  messages: [{ role: "user", content: "What tools do you have available?" }],
  mcp_servers: [
    {
      type: "url",
      url: "https://mcp.linear.app/mcp",
      name: "linear",
      authorization_token: linearToken,
    },
  ],
  tools: [{ type: "mcp_toolset", mcp_server_name: "linear" }],
  betas: ["mcp-client-2025-11-20"],
});

console.log(JSON.stringify(response, null, 2));