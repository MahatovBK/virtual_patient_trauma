import { NextResponse } from "next/server";
import type { ScenarioDefinition } from "../../data/scenarios";
import { readScenarios } from "../../data/scenario-store";
import { requestGemini } from "../../lib/gemini";
import { evaluateDiagnosis, isDiagnosisStatement } from "../../lib/diagnosis-evaluator";

export async function POST(request: Request) {
  const body = await request.json();
  const scenarios = (await readScenarios()) as ScenarioDefinition[];
  const scenario = scenarios.find((item) => item.id === body.scenarioId);
  const rawQuestion = typeof body.question === "string" ? body.question.trim() : "";
  const question = rawQuestion.toLowerCase();
  const questionNumber = typeof body.questionNumber === "number" ? body.questionNumber : 0;

  if (!scenario || !question) {
    return NextResponse.json({ error: "Нужны scenarioId и question" }, { status: 400 });
  }

  // Проверка: выставил ли студент диагноз
  if (isDiagnosisStatement(rawQuestion)) {
    const evaluation = evaluateDiagnosis(rawQuestion, scenario);
    return NextResponse.json({
      answer: evaluation.feedback,
      diagnosisResult: evaluation.isCorrect ? "correct" : evaluation.isPartial ? "partial" : "incorrect",
      scenarioCompleted: true,
      evaluation,
    });
  }

  if (questionNumber === 10) {
    return NextResponse.json({ answer: "Что со мной, доктор?", promptForDiagnosis: true });
  }

  // Проверка: запрошен ли снимок (рентген, ЭКГ, КТ и т.д.)
  const isImageInquiry = /рентген|снимок|снимк|экг|кардиограмм|кт|мрт|исследован/i.test(question);

  const mediaRule = scenario.answerRules.find((rule) =>
    rule.imageUrl && rule.keywords.some((keyword) => question.includes(keyword)),
  );
  if (mediaRule?.imageUrl) {
    return NextResponse.json({
      answer: mediaRule.answer ?? "Снимок готов.",
      imageUrl: mediaRule.imageUrl,
      provider: "scenario-media",
      imageRequested: true,
    });
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const aiData = await requestGemini(process.env.GEMINI_MODEL ?? "gemini-3.6-flash", process.env.GEMINI_API_KEY, {
        systemInstruction: {
            parts: [{ text: `Ты виртуальный пациент в учебной клинической симуляции. Отвечай только от лица пациента, естественно и понятно, полными предложениями. Отвечай по существу заданного вопроса, обычно 2-5 предложений. Не обрывай ответ, не ставь диагноз, не давай подсказок студенту и не придумывай факты, которых нет в сценарии. Сценарий: ${scenario.description}. Пациент: ${scenario.patient}.` }],
        },
        contents: [{ role: "user", parts: [{ text: body.question }] }],
        generationConfig: { temperature: 0.65, maxOutputTokens: 600 },
      });
      const aiAnswer = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof aiAnswer === "string" && aiAnswer.trim()) {
        return NextResponse.json({ answer: aiAnswer.trim(), provider: "gemini", imageRequested: isImageInquiry });
      }
    } catch (error) {
      console.error("Gemini request failed; using scenario rules", error);
    }
  }

  const matchingRule = scenario.answerRules
    .map((rule) => ({ rule, matchLength: Math.max(0, ...rule.keywords.filter((keyword) => question.includes(keyword)).map((keyword) => keyword.length)) }))
    .filter((item) => item.matchLength > 0)
    .sort((left, right) => right.matchLength - left.matchLength)[0]?.rule;
  const variants = matchingRule?.answerVariants;
  const answer = variants?.length
    ? variants[question.length % variants.length]
    : matchingRule?.answer;

  return NextResponse.json({
    answer: answer ?? scenario.defaultAnswer,
    imageUrl: matchingRule?.imageUrl,
    imageRequested: Boolean(matchingRule?.imageUrl || isImageInquiry),
  });
}