import { NextResponse } from "next/server";
import { removeStudentSession } from "../../../data/session-store";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ok = await removeStudentSession(id);
    if (!ok) {
      return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
    }
    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error("Failed to delete student session", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
