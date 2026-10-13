import { createClient } from "@supabase/supabase-js";
import type { ScenarioDefinition, StudentSession } from "./scenarios";

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
    diagnosisTerms: row.diagnosis_terms ?? undefined,
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
    diagnosis_terms: scenario.diagnosisTerms ?? null,
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

export async function readSupabaseStudentSessions(filter?: { studentName?: string; scenarioId?: string }): Promise<StudentSession[] | null> {
  const client = getClient();
  if (!client) return null;
  try {
    let query = client.from("student_sessions").select("*").order("created_at", { ascending: false });
    if (filter?.studentName) {
      query = query.ilike("student_name", `%${filter.studentName}%`);
    }
    if (filter?.scenarioId) {
      query = query.eq("scenario_id", filter.scenarioId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn("Supabase student_sessions query warning:", error.message);
      return null;
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      studentName: row.student_name,
      scenarioId: row.scenario_id,
      scenarioTitle: row.scenario_title,
      questionsCount: row.questions_count ?? 0,
      diagnosisStated: Boolean(row.diagnosis_stated),
      imageRequested: Boolean(row.image_requested),
      diagnosisCorrect: Boolean(row.diagnosis_correct),
      diagnosisMatchesCount: row.diagnosis_matches_count ?? 0,
      diagnosisTotalTerms: row.diagnosis_total_terms ?? 0,
      matchedTerms: Array.isArray(row.matched_terms) ? row.matched_terms : [],
      missingTerms: Array.isArray(row.missing_terms) ? row.missing_terms : [],
      userDiagnosis: row.user_diagnosis ?? "",
      targetDiagnosis: row.target_diagnosis ?? "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) as StudentSession[];
  } catch (err) {
    console.warn("Supabase student_sessions read failed:", err);
    return null;
  }
}

export async function saveSupabaseStudentSession(session: StudentSession): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    const { error } = await client.from("student_sessions").upsert({
      id: session.id,
      student_name: session.studentName,
      scenario_id: session.scenarioId,
      scenario_title: session.scenarioTitle,
      questions_count: session.questionsCount,
      diagnosis_stated: session.diagnosisStated,
      image_requested: session.imageRequested,
      diagnosis_correct: session.diagnosisCorrect,
      diagnosis_matches_count: session.diagnosisMatchesCount,
      diagnosis_total_terms: session.diagnosisTotalTerms,
      matched_terms: session.matchedTerms,
      missing_terms: session.missingTerms,
      user_diagnosis: session.userDiagnosis,
      target_diagnosis: session.targetDiagnosis,
      created_at: session.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn("Supabase student_sessions upsert warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase student_sessions upsert failed:", err);
    return false;
  }
}

export async function deleteSupabaseStudentSession(id: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    const { error } = await client.from("student_sessions").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
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
