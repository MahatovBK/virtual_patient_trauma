import { createClient } from "@supabase/supabase-js";
import type { ScenarioDefinition } from "./scenarios";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function readSupabaseScenarios() {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client.from("scenarios").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    difficulty: row.difficulty,
    patient: row.patient,
    description: row.description,
    diagnosis: row.diagnosis ?? undefined,
    diagnosisKeywords: row.diagnosis_keywords ?? undefined,
    xrayImage: row.xray_image ?? undefined,
    media: row.media ?? [],
    answerRules: row.answer_rules ?? [],
    defaultAnswer: row.default_answer,
  })) as ScenarioDefinition[];
}

export async function saveSupabaseScenario(scenario: ScenarioDefinition) {
  const client = getClient();
  if (!client) return false;
  const { error } = await client.from("scenarios").upsert({
    id: scenario.id,
    title: scenario.title,
    difficulty: scenario.difficulty,
    patient: scenario.patient,
    description: scenario.description,
    diagnosis: scenario.diagnosis ?? null,
    diagnosis_keywords: scenario.diagnosisKeywords ?? null,
    xray_image: scenario.xrayImage ?? null,
    media: scenario.media ?? [],
    answer_rules: scenario.answerRules,
    default_answer: scenario.defaultAnswer,
  });
  if (error) throw error;
  return true;
}

export async function deleteSupabaseScenario(id: string) {
  const client = getClient();
  if (!client) return false;
  const { error } = await client.from("scenarios").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function uploadSupabaseMedia(file: File, scenarioId: string, type: "xray" | "ecg") {
  const client = getClient();
  if (!client) return null;
  const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : ".bin";
  const path = `${scenarioId}/${type}-${Date.now()}${extension}`;
  const { error } = await client.storage.from("scenario-media").upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw error;
  return client.storage.from("scenario-media").getPublicUrl(path).data.publicUrl;
}
