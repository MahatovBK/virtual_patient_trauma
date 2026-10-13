import type { ScenarioDefinition, DiagnosisTerm } from "../data/scenarios";

export type DiagnosisEvaluation = {
  diagnosisStated: boolean;
  isCorrect: boolean;
  isPartial: boolean;
  matchedCount: number;
  totalCount: number;
  matchedTerms: string[];
  missingTerms: string[];
  userDiagnosis: string;
  targetDiagnosis: string;
  feedback: string;
};

// Check if a question or statement from student is proposing a diagnosis
export function isDiagnosisStatement(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return /диагноз|мой вердикт|заключение|считаю|предполага|полагаю|думаю|это (вывих|перелом|растяжение|разрыв|травма|ушиб)|у пациента|у вас (вывих|перелом|травма)|(закрытый|свежий|передний|открытый) (вывих|перелом)/i.test(normalized);
}

// Evaluate terminology matches against target diagnosis
export function evaluateDiagnosis(userText: string, scenario: ScenarioDefinition): DiagnosisEvaluation {
  const target = scenario.diagnosis || "";
  const normalizedUser = userText.toLowerCase().trim();

  let terms: DiagnosisTerm[] = scenario.diagnosisTerms || [];

  // Fallback: if no explicit diagnosisTerms are defined on scenario, derive from diagnosis string
  if (terms.length === 0 && target) {
    const rawWords = target
      .split(/\s+/)
      .map((w) => w.replace(/[.,:;!?]/g, "").trim())
      .filter((w) => w.length > 2);
    const stopWords = new Set(["или", "при", "для", "под", "над", "без", "как", "так", "все", "этого"]);
    const filtered = rawWords.filter((w) => !stopWords.has(w.toLowerCase()));
    terms = filtered.map((w) => {
      const stem = w.slice(0, Math.min(w.length, 5)).toLowerCase();
      return { term: w, keywords: [stem] };
    });
  }

  const matchedTerms: string[] = [];
  const missingTerms: string[] = [];

  for (const item of terms) {
    const hasMatch = item.keywords.some((kw) => normalizedUser.includes(kw.toLowerCase()));
    if (hasMatch) {
      matchedTerms.push(item.term);
    } else {
      missingTerms.push(item.term);
    }
  }

  const totalCount = terms.length;
  const matchedCount = matchedTerms.length;

  // Determine correctness
  const targetLower = target.toLowerCase();
  const isShoulderDislocation = targetLower.includes("вывих") && targetLower.includes("плеч");
  const isAnkleFracture = targetLower.includes("перелом") && targetLower.includes("лодыж");

  let isCorrect = false;
  let isPartial = false;

  if (isShoulderDislocation) {
    // For "Закрытый свежий вывих правого плеча":
    // Core terms: вывих, плеч, прав
    const hasCore = normalizedUser.includes("вывих") && normalizedUser.includes("плеч");
    const isFull = matchedCount === totalCount && totalCount > 0;
    if (isFull) {
      isCorrect = true;
    } else if (hasCore && matchedCount >= 4) {
      isCorrect = true;
      isPartial = matchedCount < totalCount;
    } else if (hasCore || matchedCount >= 2) {
      isPartial = true;
    }
  } else if (isAnkleFracture) {
    // For "Закрытый перелом наружной лодыжки левой голени без смещения":
    // Core terms: перелом, лодыж, лев, голен
    const hasCore = normalizedUser.includes("перелом") && (normalizedUser.includes("лодыж") || normalizedUser.includes("голен"));
    const isFull = matchedCount === totalCount && totalCount > 0;
    if (isFull) {
      isCorrect = true;
    } else if (hasCore && matchedCount >= 5) {
      isCorrect = true;
      isPartial = matchedCount < totalCount;
    } else if (hasCore || matchedCount >= 2) {
      isPartial = true;
    }
  } else {
    const isFull = matchedCount === totalCount && totalCount > 0;
    if (isFull) {
      isCorrect = true;
    } else if (totalCount > 0 && matchedCount >= Math.ceil(totalCount * 0.75)) {
      isCorrect = true;
      isPartial = true;
    } else if (totalCount > 0 && matchedCount >= Math.ceil(totalCount * 0.4)) {
      isPartial = true;
    }
  }

  let feedback = "";
  if (matchedCount === totalCount && totalCount > 0) {
    feedback = `Диагноз полностью правильный (совпадений терминологии: ${matchedCount} из ${totalCount}). Совпали термины: ${matchedTerms.join(", ")}. Эталонный диагноз: ${target}. Сценарий завершён.`;
  } else if (isCorrect || isPartial) {
    const matchedStr = matchedTerms.length > 0 ? `Совпали термины: ${matchedTerms.join(", ")}.` : "";
    const missingStr = missingTerms.length > 0 ? ` Не указаны термины: ${missingTerms.join(", ")}.` : "";
    feedback = `Диагноз частично правильный (совпадений терминологии: ${matchedCount} из ${totalCount}). ${matchedStr}${missingStr} Эталонный диагноз: ${target}. Сценарий завершён.`;
  } else {
    feedback = `Диагноз неправильный (совпадений терминологии: ${matchedCount} из ${totalCount}). Эталонный диагноз: ${target}. Сценарий завершён.`;
  }

  return {
    diagnosisStated: true,
    isCorrect,
    isPartial,
    matchedCount,
    totalCount,
    matchedTerms,
    missingTerms,
    userDiagnosis: userText.trim(),
    targetDiagnosis: target,
    feedback,
  };
}
