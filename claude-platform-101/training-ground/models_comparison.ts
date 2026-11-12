import Anthropic from "@anthropic-ai/sdk";

// API-ключ береться зі змінної середовища ANTHROPIC_API_KEY
const client = new Anthropic();

const prompt = "Поясни eфект спостерігача";
const MAX_ANSWER_CHARS = 350;

const models = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"];

async function main() {
  for (const model of models) {
      const start = performance.now();
      const response = await client.messages.create({
        model,
        max_tokens: 1000, // сюди входять і "думки" моделі, тому ліміт має бути з запасом
        system:
      "Ти лаконічний помічник. Відповідай мовою користувача, " +
      `двома-трьома реченнями, не більше ${MAX_ANSWER_CHARS} символів.`,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      const ms = Math.round(performance.now() - start);
      const { input_tokens, output_tokens } = response.usage;

      console.log(`\n[${model}]  ${ms}ms  in=${input_tokens} out=${output_tokens}`);
      console.log(text);
      if (response.stop_reason === "max_tokens") {
        console.log("⚠️ Відповідь обрізана: не вистачило max_tokens");
      }
      
    
  }
}

main();