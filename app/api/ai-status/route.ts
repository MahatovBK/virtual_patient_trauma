import https from "node:https";
import { NextResponse } from "next/server";
import { requestGemini } from "../../lib/gemini";

function listModels(apiKey: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`,
      timeout: 15000,
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try {
          if (response.statusCode && response.statusCode >= 400) return reject(new Error(`Gemini HTTP ${response.statusCode}`));
          const data = JSON.parse(body) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
          resolve((data.models ?? []).filter((item) => item.supportedGenerationMethods?.includes("generateContent")).map((item) => item.name.replace(/^models\//, "")));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

export async function GET(request: Request) {
  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ configured: false, reachable: false, model });
  }

  // ?models=1 показывает идентификаторы моделей, доступных ключу
  if (new URL(request.url).searchParams.get("models")) {
    try {
      return NextResponse.json({ model, availableModels: await listModels(process.env.GEMINI_API_KEY) });
    } catch (error) {
      return NextResponse.json({ model, error: error instanceof Error ? error.message : "Не удалось получить список моделей" });
    }
  }

  try {
    await requestGemini(model, process.env.GEMINI_API_KEY, {
      contents: [{ role: "user", parts: [{ text: "Ответь одним словом: да" }] }],
      generationConfig: { maxOutputTokens: 5 },
    });
    return NextResponse.json({ configured: true, reachable: true, model });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      reachable: false,
      model,
      error: error instanceof Error ? error.message : "Gemini request failed",
    });
  }
}