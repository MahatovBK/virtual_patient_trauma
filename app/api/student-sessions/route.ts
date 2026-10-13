import { NextResponse } from "next/server";
import { readStudentSessions, saveStudentSession } from "../../data/session-store";
import type { StudentSession } from "../../data/scenarios";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const studentName = url.searchParams.get("student") || undefined;
    const scenarioId = url.searchParams.get("scenario") || undefined;

    const sessions = await readStudentSessions({ studentName, scenarioId });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Failed to read student sessions", error);
    return NextResponse.json({ error: "Failed to read sessions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<StudentSession>;
    if (!body.studentName || !body.scenarioId) {
      return NextResponse.json({ error: "Требуются studentName и scenarioId" }, { status: 400 });
    }

    const session: StudentSession = {
      id: body.id || `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      studentName: body.studentName.trim(),
      scenarioId: body.scenarioId,
      scenarioTitle: body.scenarioTitle || "Клинический случай",
      questionsCount: Number(body.questionsCount) || 0,
      diagnosisStated: Boolean(body.diagnosisStated),
      imageRequested: Boolean(body.imageRequested),
      diagnosisCorrect: Boolean(body.diagnosisCorrect),
      diagnosisMatchesCount: Number(body.diagnosisMatchesCount) || 0,
      diagnosisTotalTerms: Number(body.diagnosisTotalTerms) || 0,
      matchedTerms: Array.isArray(body.matchedTerms) ? body.matchedTerms : [],
      missingTerms: Array.isArray(body.missingTerms) ? body.missingTerms : [],
      userDiagnosis: body.userDiagnosis || "",
      targetDiagnosis: body.targetDiagnosis || "",
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveStudentSession(session);
    return NextResponse.json({ session: saved }, { status: 201 });
  } catch (error) {
    console.error("Failed to save student session", error);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}
