import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { appendScenario, readScenarios } from "../../../data/scenario-store";
import { requestGemini } from "../../../lib/gemini";

type AnswerRule = { keywords: string[]; answer: string; imageUrl?: string };
type StoredScenario = {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  patient: string;
  diagnosis?: string;
  answerRules: AnswerRule[];
  defaultAnswer: string;
  media?: Array<{ type: "xray" | "ecg"; label: string; url: string }>;
};

function makeId(title: string) {
  const id = title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  return `${id || "clinical-case"}-${Date.now()}`;
}

function createScenarioFromText(text: string): StoredScenario {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const title = "Травма плечевого сустава";
  const patientLine = lines.find((line) => /пациент|больной|больная/i.test(line));
  const patient = patientLine?.replace(/^(пациент|больной|больная)\s*:\s*/i, "") || "Пациент из клинической задачи";
  const description = lines.slice(1).join(" ") || text.trim();

  const answerRules: AnswerRule[] = [
    { keywords: ["жалоб", "беспокоит", "симптом"], answer: "Основные жалобы пациента указаны в клинической задаче: " + description },
    { keywords: ["когда", "начал", "началась", "длител"], answer: "Время начала и длительность симптомов нужно уточнить у пациента." },
    { keywords: ["лекарств", "приним", "лечен"], answer: "Сведения о лечении указаны в исходной задаче. Уточните, какие препараты и когда принимались." },
    { keywords: ["анамнез", "истори", "болезн"], answer: "Анамнез пациента описан в исходной клинической задаче. Задайте более конкретный вопрос." },
  ];

  return {
    id: makeId(title),
    title,
    description: description.slice(0, 500),
    difficulty: "Не указана",
    patient,
    answerRules,
    defaultAnswer: "Я не понял вопрос.",
  };
}

async function createScenarioWithGemini(text: string): Promise<StoredScenario | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const data = await requestGemini(process.env.GEMINI_MODEL ?? "gemini-3.6-flash", process.env.GEMINI_API_KEY, {
      systemInstruction: { parts: [{ text: "Ты преобразуешь медицинскую клиническую задачу в JSON-сценарий для виртуального пациента. Не ставь диагноз в описании для студента. Извлеки факты пациента, жалобы, анамнез, нормальные показатели, ответы на вопросы и правильный диагноз. Верни только валидный JSON без markdown." }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            patient: { type: "STRING" },
            description: { type: "STRING" },
            difficulty: { type: "STRING" },
            diagnosis: { type: "STRING" },
            answerRules: { type: "ARRAY", items: { type: "OBJECT", properties: { keywords: { type: "ARRAY", items: { type: "STRING" } }, answer: { type: "STRING" } }, required: ["keywords", "answer"] } },
          },
          required: ["patient", "description", "difficulty", "diagnosis", "answerRules"],
        },
      },
    });
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof generatedText !== "string") return null;

    const generated = JSON.parse(generatedText);
    return {
      id: makeId("Ситуационная задача"),
      title: "Ситуационная задача",
      patient: generated.patient,
      description: generated.description,
      difficulty: generated.difficulty,
      diagnosis: generated.diagnosis,
      answerRules: generated.answerRules,
      defaultAnswer: "Я не понял вопрос.",
    };
  } catch (error) {
    console.error("Gemini scenario generation failed; using local parser", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get("file");
    const pastedText = formData.get("text");
    const xrayFile = formData.get("xray");
    const ecgFile = formData.get("ecg");
    const text = uploadedFile instanceof File ? await uploadedFile.text() : typeof pastedText === "string" ? pastedText : "";

    if (!text.trim()) {
      return NextResponse.json({ error: "Загрузите файл или вставьте текст клинической задачи" }, { status: 400 });
    }

    const newScenario = (await createScenarioWithGemini(text)) ?? createScenarioFromText(text);
    const existingScenarios = await readScenarios();
    const scenarioNumber = existingScenarios.length + 1;
    newScenario.id = `scenario-${scenarioNumber}-${Date.now()}`;
    newScenario.title = `Ситуационная задача №${scenarioNumber}`;
    const mediaDirectory = path.join(process.cwd(), "public", "uploads");
    await mkdir(mediaDirectory, { recursive: true });
    const media: StoredScenario["media"] = [];

    for (const [file, type, label] of [[xrayFile, "xray", "Рентгеновский снимок"], [ecgFile, "ecg", "ЭКГ"]] as const) {
      if (!(file instanceof File) || file.size === 0) continue;
      const extension = path.extname(file.name) || ".bin";
      const fileName = `${newScenario.id}-${type}-${Date.now()}${extension}`;
      await writeFile(path.join(mediaDirectory, fileName), Buffer.from(await file.arrayBuffer()));
      media.push({ type, label, url: `/uploads/${fileName}` });
    }

    if (media.length > 0) {
      newScenario.media = media;
      for (const item of media) {
        newScenario.answerRules.push({ keywords: item.type === "xray" ? ["рентген", "снимок", "снимке"] : ["экг", "кардиограмм"], answer: `${item.label} готов.`, imageUrl: item.url });
      }
    }
    await appendScenario(newScenario);

    return NextResponse.json({ scenario: newScenario }, { status: 201 });
  } catch (error) {
    console.error("Scenario import failed", error);
    return NextResponse.json({ error: "Не удалось создать сценарий. Проверьте текст задачи и повторите попытку." }, { status: 500 });
  }
}
