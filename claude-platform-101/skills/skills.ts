import Anthropic, { toFile } from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

const client = new Anthropic();

// Папка, де лежить цей .ts файл. Від неї рахуємо всі шляхи,
// тому неважливо, з якої папки запускає IDE.
const here = import.meta.dirname;

// ---------------------------------------------------------------
// filesFromDir: збирає ВСІ файли з папки скіла (разом з підпапками)
// і готує їх до завантаження в API.
// Для кожного файлу:
//   1) пропускає папки, бере лише файли;
//   2) рахує "upload-ім'я" відносно батьківської папки,
//      наприклад "status-report-skill/SKILL.md". API очікує, що всі
//      файли лежать в одній кореневій папці скіла;
//   3) обгортає файл через toFile(), щоб SDK зміг відправити його як upload.
// Повертає масив файлів, готових для skills.create().
// ---------------------------------------------------------------
async function filesFromDir (dir: string) :Promise<File[]>{
  const result = [];
  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(entry.parentPath, entry.name);
    // "status-report-skill/SKILL.md" (слеші "/" навіть на Windows)
    const uploadName = path.relative(path.dirname(dir), fullPath).split(path.sep).join("/");
    result.push(await toFile(fs.createReadStream(fullPath), uploadName));
  }
  return result;
}

// ---------------------------------------------------------------
// КРОК 1 (варіант А). Створюємо (завантажуємо) кастомний скіл в Anthropic.
// Беремо всі файли з папки status-report-skill (головне SKILL.md).
// У відповідь отримуємо skill.id, по якому далі підключаємо скіл.
// ---------------------------------------------------------------
const skill1 = await client.skills.create({
  display_name: "Status Reppport Generator",
  files: await filesFromDir(path.join(here, "status-report-skill")),
});
console.log("***SKILL ID:***\n"+skill1.id+"\n");

// ---------------------------------------------------------------
// КРОК 1 (варіант Б). Створюємо скіл з ОДНОГО файлу, без filesFromDir.
// API не отримує шлях до папки: ми самі читаємо файл і відправляємо
// його вміст. toFile() потрібен, щоб дати файлу upload-ім'я.
//  - upload-ім'я "status-report-skill/SKILL.md": SKILL.md має лежати
//    в корені однієї папки скіла;
//  - name і description API бере з frontmatter (--- ... ---)
//    на початку SKILL.md, а не з параметрів create();
//  - display_name - це лише назва для людей (у консолі).
// У відповідь отримуємо skill.id, по якому далі підключаємо скіл.
// ---------------------------------------------------------------

const skill2 = await client.skills.create({
  display_name: "Status Report Generator",
  files: [
    await toFile(
      fs.createReadStream(path.join(here, "status-report-skill/SKILL.md")),
      "status-report-skill/SKILL.md",
    ),
  ],
});
console.log("***SKILL ID:***\n"+skill2.id+"\n");

// ---------------------------------------------------------------
// КРОК 2. Читаємо вхідні дані: сирий лог активності з файлу.
// ---------------------------------------------------------------
const activityLog = fs.readFileSync(path.join(here, "activity-log.txt"), "utf-8");
console.log("Activity log: \n" + activityLog);

// ---------------------------------------------------------------
// КРОК 3. Запит до моделі зі скілом.
//  - container.skills: робить скіл ДОСТУПНИМ, але не змушує його
//    використати. Файли скіла кладуться в контейнер, а в контекст
//    моделі потрапляють лише name і description з SKILL.md.
//    Модель сама вирішує, чи скіл підходить до завдання, і тільки
//    тоді читає повний SKILL.md (progressive disclosure).
//    Тому description має чітко казати, КОЛИ юзати скіл ("Use when...").
//    Перевірити, чи скіл спрацював, можна в response.content:
//    там буде code_execution, який читає SKILL.md;
//  - tools: code_execution обов'язковий, бо скіли працюють усередині
//    контейнера з виконанням коду (там модель читає файли скіла);
//  - messages: саме завдання + лог.
// ---------------------------------------------------------------
const response = await client.messages.create({
  model: "claude-haiku-5-5",
  max_tokens: 4096,
  container: {
    skills: [{ type: "custom", skill_id: skill1.id, version: "latest" }],
  },
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  output_config: {effort:"low"},
  messages: [
    { role: "user", content: `Generate the daily status report from this activity log:\n\n${activityLog}` },
  ],
});

// ---------------------------------------------------------------
// КРОК 4. Дебаг-вивід.
// stop_reason показує, чому модель зупинилась: "end_turn" означає норм,
// "max_tokens" означає, що відповідь обрізано.
// Далі друкуємо всю відповідь як JSON, щоб бачити всі блоки:
// текст, виклики code_execution, їхні результати.
// ---------------------------------------------------------------
let stopReason = response.stop_reason;
console.log(`------------\n Stop reason: ${stopReason}\n------------`);
console.log("*** Response as array ***\n", JSON.stringify(response.content, null, 2) + "\n");

// ---------------------------------------------------------------
// КРОК 5. Фінальний результат: друкуємо лише текстові блоки,
// тобто сам статус-репорт.
// ---------------------------------------------------------------
for (const block of response.content) {
  if (block.type === "text") console.log(block.text);
}