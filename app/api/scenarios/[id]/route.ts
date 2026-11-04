import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readScenarios, removeScenario } from "../../../data/scenario-store";
import { isSupabaseConfigured, saveSupabaseScenario, uploadSupabaseMedia } from "../../../data/supabase-store";
import type { ScenarioDefinition } from "../../../data/scenarios";

const scenariosPath = path.join(process.cwd(), "app", "data", "scenarios.json");

type MediaType = "xray" | "ecg";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const scenarios = await readScenarios();
  const remaining = scenarios.filter((scenario) => scenario.id !== id);

  if (remaining.length === scenarios.length) {
    return NextResponse.json({ error: "Сценарий не найден" }, { status: 404 });
  }

  await removeScenario(id);
  return NextResponse.json({ deleted: id });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const scenario = (await readScenarios() as ScenarioDefinition[]).find((item) => item.id === id);
  if (!scenario) return NextResponse.json({ error: "Сценарий не найден" }, { status: 404 });
  return NextResponse.json({ description: scenario.description, diagnosis: scenario.diagnosis ?? "" });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const diagnosis = typeof body.diagnosis === "string" ? body.diagnosis.trim() : "";
    if (!description) return NextResponse.json({ error: "Текст задачи не может быть пустым" }, { status: 400 });

    const scenarios = await readScenarios() as ScenarioDefinition[];
    const scenario = scenarios.find((item) => item.id === id);
    if (!scenario) return NextResponse.json({ error: "Сценарий не найден" }, { status: 404 });

    scenario.description = description;
    if (diagnosis !== (scenario.diagnosis ?? "")) {
      scenario.diagnosis = diagnosis;
      scenario.diagnosisTerms = undefined;
      scenario.diagnosisKeywords = undefined;
    }

    if (isSupabaseConfigured()) {
      await saveSupabaseScenario(scenario);
    } else {
      await writeFile(scenariosPath, `${JSON.stringify(scenarios, null, 2)}\n`, "utf8");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
    return NextResponse.json({ error: `Не удалось сохранить: ${reason}` }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const mediaType = formData.get("mediaType");
    const type = mediaType === "ecg" ? "ecg" : mediaType === "xray" ? "xray" : null;

    if (!(file instanceof File) || file.size === 0 || !type) {
      return NextResponse.json({ error: "Нужны file и mediaType (xray или ecg)" }, { status: 400 });
    }

    const scenarios = await readScenarios() as ScenarioDefinition[];
    const scenario = scenarios.find((item) => item.id === id);
    if (!scenario) return NextResponse.json({ error: "Сценарий не найден" }, { status: 404 });

    let url: string;
    if (isSupabaseConfigured()) {
      url = (await uploadSupabaseMedia(file, id, type)) as string;
    } else {
      const uploadDirectory = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDirectory, { recursive: true });
      const extension = path.extname(file.name) || ".bin";
      const fileName = `${id}-${type}-${Date.now()}${extension}`;
      url = `/uploads/${fileName}`;
      await writeFile(path.join(uploadDirectory, fileName), Buffer.from(await file.arrayBuffer()));
    }

  scenario.media = [...(scenario.media ?? []).filter((item) => item.type !== type), {
    type,
    label: type === "xray" ? "Рентгеновский снимок" : "ЭКГ",
    url,
  }];

  const rule = scenario.answerRules.find((item) => type === "xray"
    ? item.keywords.some((keyword) => keyword === "рентген" || keyword === "снимок")
    : item.keywords.some((keyword) => keyword === "экг" || keyword === "кардиограмм"));
  if (rule) {
    rule.imageUrl = url;
  } else {
    scenario.answerRules.push({
      keywords: type === "xray" ? ["рентген", "снимок"] : ["экг", "кардиограмм"],
      answer: `${type === "xray" ? "Рентгеновский снимок" : "ЭКГ"} готово.`,
      imageUrl: url,
    });
  }

  if (type === "xray") scenario.xrayImage = url;
    if (isSupabaseConfigured()) {
      await saveSupabaseScenario(scenario);
    } else {
      await writeFile(scenariosPath, `${JSON.stringify(scenarios, null, 2)}\n`, "utf8");
    }
    return NextResponse.json({ scenario });
  } catch (error) {
    console.error("Media replacement failed", error);
    return NextResponse.json({ error: "Онлайн-хранилище не подключено. На Vercel замена файлов требует Supabase Storage или Vercel Blob." }, { status: 503 });
  }
}
