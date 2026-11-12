/**
 * Мінімальний локальний сервер: віддає index.html і проксює запити до Claude API.
 *
 * Ключ API лишається на сервері (ANTHROPIC_API_KEY з файлу .env.local),
 * браузер його ніколи не бачить.
 *
 * Запуск:
 *   npm install
 *   вставити ключ у .env.local
 *   npm start
 *   відкрити http://localhost:8000
 */

import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-5-5";
const MAX_INPUT_CHARS = 70;
const MAX_ANSWER_CHARS = 150;
const PORT = 8000;

const INDEX_HTML = new URL("./index.html", import.meta.url);

// Ключ зберігається у .env.local (файл у .gitignore, тож у git не потрапить).
// Змінні, вже задані в терміналі, мають пріоритет над файлом.
try {
  process.loadEnvFile(new URL("./.env.local", import.meta.url));
} catch {
  console.warn("Файл .env.local не знайдено — створи його з рядком ANTHROPIC_API_KEY=sk-ant-...");
}

const client = new Anthropic(); // бере ключ з ANTHROPIC_API_KEY

async function askClaude(question: string): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048, // з запасом: thinking теж витрачає ці токени
    output_config: { effort: "low" }, // коротка відповідь — мінімум міркувань
    system:
      "Ти лаконічний помічник. Відповідай мовою користувача, " +
      `одним-двома реченнями, не більше ${MAX_ANSWER_CHARS} символів.`,
    messages: [{ role: "user", content: question }],
  });

  
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  // Модель уперлась у max_tokens — відповідь обрізана або взагалі порожня
  if (response.stop_reason === "max_tokens") {
    console.warn(`Відповідь обрізана по max_tokens (використано ${response.usage.output_tokens})`);
    if (!text) return "Модель не встигла відповісти — збільш max_tokens у server.ts";
  }
  
  return text.slice(0, MAX_ANSWER_CHARS);
}

function sendJson(res: ServerResponse, status: number, data: object): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

async function handleIndex(res: ServerResponse): Promise<void> {
  // Підставляємо модель і ліміти з цього файлу в сторінку, щоб вони були в одному місці
  const html = (await readFile(INDEX_HTML, "utf-8"))
    .replaceAll("{{MODEL}}", MODEL)
    .replaceAll("{{MAX_INPUT_CHARS}}", String(MAX_INPUT_CHARS))
    .replaceAll("{{MAX_ANSWER_CHARS}}", String(MAX_ANSWER_CHARS));
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let question: string;
  try {
    question = String(JSON.parse(await readBody(req)).message ?? "").trim();
  } catch {
    return sendJson(res, 400, { error: "Некоректний JSON" });
  }

  if (!question) return sendJson(res, 400, { error: "Порожнє повідомлення" });
  question = question.slice(0, MAX_INPUT_CHARS); // дублюємо обмеження з фронтенду

  try {
    sendJson(res, 200, { answer: await askClaude(question) });
  } catch (err) {
    // Порядок важливий: APIConnectionError — підклас APIError
    if (err instanceof Anthropic.AuthenticationError) {
      sendJson(res, 401, { error: "Невірний ANTHROPIC_API_KEY" });
    } else if (err instanceof Anthropic.RateLimitError) {
      sendJson(res, 429, { error: "Забагато запитів, спробуй трохи пізніше" });
    } else if (err instanceof Anthropic.APIConnectionError) {
      sendJson(res, 502, { error: "Немає з'єднання з Claude API" });
    } else if (err instanceof Anthropic.APIError) {
      sendJson(res, 502, { error: `Помилка API (${err.status}): ${err.message}` });
    } else if (!process.env.ANTHROPIC_API_KEY) {
      // без ключа SDK кидає звичайний Error ще до запиту
      sendJson(res, 401, { error: "Не заданий ANTHROPIC_API_KEY" });
    } else {
      throw err;
    }
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      await handleIndex(res);
    } else if (req.method === "POST" && req.url === "/api/chat") {
      await handleChat(req, res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    }
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "Внутрішня помилка сервера" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Сервер запущено: http://localhost:${PORT}  (модель: ${MODEL})`);
});
