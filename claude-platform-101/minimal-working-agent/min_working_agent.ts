import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Опис інструментів: назва, опис і JSON-схема вхідних даних.
//Модель буде бачити name, description і схему. По полю description буде вибирати чи юзати тулу чи ні
//В нас є опис 2ох тулів і по цим полям модель вирішить яку юзати
const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description: "Get the current weather for a city",
    //Опис обєкту котрий прилітає від моделі на тулу
    input_schema: {
      type: "object",
      //Опис пропертів обєкту
      properties: {
        city: { type: "string", description: "The city to get weather for" },
      },
      required: ["city"],
    },
  },
    {
    name: "get_forecast",
    description: "Get the weather forecast for a city for 3 days",
    //Опис обєкту котрий прилітає від моделі на тулу
    input_schema: {
      type: "object",
      //Опис пропертів обєкту
      properties: {
        city: { type: "string", description: "The city to get forecast for" },
      },
      required: ["city"],
    },
  }
];



// Заглушка. У реальному застосунку тут був би запит до БД, API тощо. 
// Ми емулюємо тут роботу обох тулів залежно від імені повертаємо що треба далі для моделі
// name  - назва тули, яку обрала модель (поле name з блоку tool_use)
// input - аргументи, які модель заповнила за input_schema
//         (бере з питання або з усієї історії messages)
function runTool(name: string, input: unknown): string {
  switch (name) {
    case "get_weather": {
      const { city } = input as { city: string };
      return `Weather in ${city}: Hurricane, blizzard, tornado, volcano eruption`;
    }
    case "get_forecast":
      return "+7 degrees Celsium, scattered precipitations";
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// const messages: Anthropic.MessageParam[] = [
//   { role: "user", content: "What should I wear in Austin today?" },
// ];

const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "What should I wear in Ternopil in the next 3 days?" },
];



// Цикл агента: відправляємо messages і дивимось на stop_reason.
while (true) {  
  const response = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1024,
    system: "Відповідай одним реченням",
    thinking: {type: "adaptive", display: "summarized"},
    output_config: {effort:"low"},
    tools,
    messages,
  });
  console.log("------------\n Stop reason:", response.stop_reason +"\n------------")

  console.log("*** Response ass array ***\n",JSON.stringify(response.content, null, 2)+"\n");

  if (response.stop_reason === "tool_use") {    
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: runTool(block.name, block.input),
        });
      }
    }

  console.log("*** Tool results ***\n", JSON.stringify(toolResults, null, 2));

    // Відповідь асистента і результати тули повертаємо в історію меседжів
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
    continue;
  }

  // end_turn (або max_tokens тощо): друкуємо текст і виходимо.
  for (const block of response.content) {
    if (block.type === "text") console.log(block.text);
  }
  break;
}