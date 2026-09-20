import { NextResponse } from "next/server";
import { requestGemini } from "../../lib/gemini";

export async function GET() {
  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ configured: false, reachable: false, model });
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