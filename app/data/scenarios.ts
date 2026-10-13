export type DiagnosisTerm = {
  term: string;
  keywords: string[];
};

export type ScenarioDefinition = {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  patient: string;
  xrayImage?: string;
  diagnosis?: string;
  diagnosisKeywords?: string[];
  diagnosisTerms?: DiagnosisTerm[];
  media?: Array<{ type: "xray" | "ecg"; label: string; url: string }>;
  answerRules: Array<{
    keywords: string[];
    answer?: string;
    answerVariants?: string[];
    imageUrl?: string;
  }>;
  defaultAnswer: string;
};

export type StudentSession = {
  id: string;
  studentName: string; // Фамилия, Имя
  scenarioId: string;
  scenarioTitle: string;
  questionsCount: number; // 1. Сколько было задано вопросов
  diagnosisStated: boolean; // 2. Был ли выставлен диагноз
  imageRequested: boolean; // 3. Был ли запрошен снимок
  diagnosisCorrect: boolean; // 4. Был ли диагноз выставлен правильно
  diagnosisMatchesCount: number; // сколько совпадений в терминологии
  diagnosisTotalTerms: number; // всего терминов в правильном диагнозе
  matchedTerms: string[];
  missingTerms: string[];
  userDiagnosis: string;
  targetDiagnosis: string;
  createdAt: string;
  updatedAt?: string;
};
