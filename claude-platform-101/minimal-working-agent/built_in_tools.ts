import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Виклик 1: web search — пошук виконує Anthropic на своєму боці
const searchResponse = await client.messages.create({
  model: "claude-haiku-5-5",
  max_tokens: 1024,
  tools: [{ type: "web_search_20260209", name: "web_search" }],
  system: "Відповідай одним реченням",
  output_config: {effort:"low"},
  messages: [
    { role: "user", content: "Треба бути гандоном для успіху в цій жизні?" },
  ],
});

console.log("------------\n Stop reason:", searchResponse.stop_reason +"\n------------")

console.log("*** Response ass array ***\n",JSON.stringify(searchResponse.content, null, 2)+"\n");

for (const block of searchResponse.content) {
  if (block.type === "server_tool_use") {
    console.log(`Tool call: ${block.name} — ${JSON.stringify(block.input)}`);
  } else if (block.type === "text") {
    console.log(block.text);
  }
}

// Виклик 2: code execution — Claude пише і запускає Python у пісочниці
const codeResponse = await client.messages.create({
  model: "claude-haiku-5-5",
  max_tokens: 1024,
  tools: [{ type: "code_execution_20260120", name: "code_execution" }],
  output_config: {effort:"low"},
  messages: [
    { role: "user", content: "Calculate the mean and standard deviation of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]" },
  ],
});

for (const block of codeResponse.content) {
  if (block.type === "server_tool_use") {
    console.log(`Tool call: ${block.name} — ${JSON.stringify(block.input)}`);
  } else if (block.type === "bash_code_execution_tool_result") {
    // content може бути або результатом, або помилкою, тому перевіряємо тип
    if (block.content.type === "bash_code_execution_result") {
      console.log(`stdout: ${block.content.stdout}`);
    }
  } else if (block.type === "text") {
    console.log(block.text);
  }
}

console.log("------------\n Stop reason:", codeResponse.stop_reason +"\n------------")

console.log("*** Response ass array ***\n",JSON.stringify(codeResponse.content, null, 2)+"\n");