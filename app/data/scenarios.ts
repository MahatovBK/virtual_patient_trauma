export type ScenarioDefinition = {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  patient: string;
  xrayImage?: string;
  diagnosis?: string;
  diagnosisKeywords?: string[];
  media?: Array<{ type: "xray" | "ecg"; label: string; url: string }>;
  answerRules: Array<{
    keywords: string[];
    answer?: string;
    answerVariants?: string[];
    imageUrl?: string;
  }>;
  defaultAnswer: string;
};
