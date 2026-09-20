import { NextResponse } from "next/server";
import type { ScenarioDefinition } from "../../data/scenarios";
import { readScenarios } from "../../data/scenario-store";

export async function GET() {
  const scenarios = (await readScenarios()) as ScenarioDefinition[];
  return NextResponse.json(
    scenarios.map(({ id, title, difficulty }) => ({ id, title, difficulty, patient: "Пациент" })),
  );
}
