import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StudentSession } from "./scenarios";
import {
  isSupabaseConfigured,
  readSupabaseStudentSessions,
  saveSupabaseStudentSession,
  deleteSupabaseStudentSession,
} from "./supabase-store";

const sessionsPath = path.join(process.cwd(), "app", "data", "student-sessions.json");

let memorySessions: StudentSession[] = [];

async function readLocalFileSessions(): Promise<StudentSession[]> {
  try {
    const content = await readFile(sessionsPath, "utf8");
    return JSON.parse(content) as StudentSession[];
  } catch {
    return memorySessions;
  }
}

async function writeLocalFileSessions(sessions: StudentSession[]): Promise<void> {
  memorySessions = sessions;
  try {
    await writeFile(sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
  } catch {
    // on environments with read-only filesystem, memorySessions maintains state
  }
}

export async function readStudentSessions(filter?: { studentName?: string; scenarioId?: string }): Promise<StudentSession[]> {
  if (isSupabaseConfigured()) {
    const supabaseData = await readSupabaseStudentSessions(filter);
    if (supabaseData !== null) {
      return supabaseData;
    }
  }

  let list = await readLocalFileSessions();
  if (filter?.studentName) {
    const search = filter.studentName.toLowerCase().trim();
    list = list.filter((s) => s.studentName.toLowerCase().includes(search));
  }
  if (filter?.scenarioId) {
    list = list.filter((s) => s.scenarioId === filter.scenarioId);
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveStudentSession(session: StudentSession): Promise<StudentSession> {
  if (isSupabaseConfigured()) {
    const saved = await saveSupabaseStudentSession(session);
    if (saved) return session;
  }

  const list = await readLocalFileSessions();
  const index = list.findIndex((s) => s.id === session.id);
  if (index >= 0) {
    list[index] = { ...session, updatedAt: new Date().toISOString() };
  } else {
    list.unshift(session);
  }
  await writeLocalFileSessions(list);
  return session;
}

export async function removeStudentSession(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const deleted = await deleteSupabaseStudentSession(id);
    if (deleted) return true;
  }

  const list = await readLocalFileSessions();
  const filtered = list.filter((s) => s.id !== id);
  await writeLocalFileSessions(filtered);
  return true;
}
