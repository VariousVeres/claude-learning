import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const client = new Anthropic();

// Wrap the same two lookups we ran by hand, each with a short Zod schema
const weatherTool = betaZodTool({
  name: "get_weather",
  description: "Get today's current weather for a city.",
  inputSchema: z.object({
    city: z.string().describe("The city to check"),
  }),
  run: async ({ city }) => getWeather(city),
});

const forecastTool = betaZodTool({
  name: "get_forecast",
  description: "Get the weather forecast for the next few days for a city.",
  inputSchema: z.object({
    city: z.string().describe("The city to check"),
  }),
  run: async ({ city }) => getForecast(city),
});

const runner = client.beta.messages.toolRunner({
  model: "claude-haiku-5-5",
  max_tokens: 1024,
  output_config: {effort:"low"},
  messages: [
    {
      role: "user",
      content:
        "I'm packing for a three-day trip to Denver. What's the weather today and over the next few days?",
    },
  ],
  tools: [weatherTool, forecastTool],
});

// Await the runner to get the final message after all the tool ping-pong has settled
const finalMessage = await runner;