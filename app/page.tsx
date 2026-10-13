"use client";

import { useEffect, useState } from "react";
import type { StudentSession } from "./data/scenarios";
import type { DiagnosisEvaluation } from "./lib/diagnosis-evaluator";

type Scenario = {
  id: string;
  title: string;
  difficulty: string;
  patient: string;
};

const fallbackScenarios: Scenario[] = [
  { id: "shoulder-dislocation", title: "Ситуационная задача №1", difficulty: "Средний", patient: "Пациент" },
];

export default function Home() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "student" | "patient"; text: string; imageUrl?: string }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [answerError, setAnswerError] = useState("");
  const [scenarioCompleted, setScenarioCompleted] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<"correct" | "partial" | "incorrect" | null>(null);

  // Статистика текущей сессии по 4 критериям
  const [sessionId, setSessionId] = useState("");
  const [questionsCount, setQuestionsCount] = useState(0);
  const [imageRequested, setImageRequested] = useState(false);
  const [diagnosisStated, setDiagnosisStated] = useState(false);
  const [evaluation, setEvaluation] = useState<DiagnosisEvaluation | null>(null);

  // История симуляций текущего студента
  const [studentHistory, setStudentHistory] = useState<StudentSession[]>([]);

  useEffect(() => {
    // Восстанавливаем ранее введённый логин (Фамилия, Имя)
    const savedLogin = typeof window !== "undefined" ? localStorage.getItem("vp_student_login") : null;
    if (savedLogin) {
      setLogin(savedLogin);
    }

    fetch("/api/scenarios")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: Scenario[]) => {
        setScenarios(data);
        setSelectedScenarioId(data[0]?.id ?? "");
      })
      .catch(() => {
        setScenarios(fallbackScenarios);
        setSelectedScenarioId(fallbackScenarios[0].id);
      });
  }, []);

  async function loadStudentHistory(studentName: string) {
    if (!studentName.trim()) return;
    try {
      const res = await fetch(`/api/student-sessions?student=${encodeURIComponent(studentName.trim())}`);
      if (res.ok) {
        const data = (await res.json()) as StudentSession[];
        setStudentHistory(data);
      }
    } catch {
      // ignore
    }
  }

  function handleLogin() {
    if (!login.trim()) {
      setError("Введите фамилию и имя");
      return;
    }

    setError("");
    setIsLoggedIn(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("vp_student_login", login.trim());
    }
    void loadStudentHistory(login);
  }

  function handleStartScenario() {
    const scenario = scenarios.find((item) => item.id === selectedScenarioId);
    if (scenario) {
      const newSid = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setSessionId(newSid);
      setActiveScenario(scenario);
      setMessages([]);
      setQuestion("");
      setAnswerError("");
      setScenarioCompleted(false);
      setDiagnosisResult(null);
      setQuestionsCount(0);
      setImageRequested(false);
      setDiagnosisStated(false);
      setEvaluation(null);
    }
  }

  async function saveSessionData(data: Partial<StudentSession>) {
    try {
      const fullSession: Partial<StudentSession> = {
        id: sessionId || `session-${Date.now()}`,
        studentName: login.trim(),
        scenarioId: activeScenario?.id || selectedScenarioId,
        scenarioTitle: activeScenario?.title || "Клинический случай",
        questionsCount,
        diagnosisStated,
        imageRequested,
        ...data,
      };

      const res = await fetch("/api/student-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullSession),
      });

      if (res.ok) {
        const result = await res.json();
        if (result?.session) {
          setStudentHistory((prev) => [result.session, ...prev.filter((s) => s.id !== result.session.id)]);
        }
      }
    } catch (e) {
      console.warn("Failed to save session", e);
    }
  }

  function handleExitScenario() {
    // Если студент выставил или не выставил диагноз, но задавал вопросы - фиксируем результат
    if (activeScenario && !scenarioCompleted && questionsCount > 0) {
      void saveSessionData({
        questionsCount,
        diagnosisStated: false,
        imageRequested,
        diagnosisCorrect: false,
        diagnosisMatchesCount: 0,
        diagnosisTotalTerms: 0,
        userDiagnosis: "",
      });
    }
    setActiveScenario(null);
    void loadStudentHistory(login);
  }

  async function handleAskQuestion() {
    if (!activeScenario || !question.trim() || isSending) return;

    const currentQuestion = question.trim();
    const nextQuestionCount = questionsCount + 1;
    setQuestionsCount(nextQuestionCount);

    setMessages((currentMessages) => [...currentMessages, { role: "student", text: currentQuestion }]);
    setQuestion("");
    setAnswerError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: activeScenario.id,
          question: currentQuestion,
          questionNumber: nextQuestionCount,
          studentName: login.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось получить ответ");

      // Проверяем запрос снимка
      const wasImageInquiry = imageRequested || Boolean(data.imageRequested) || Boolean(data.imageUrl);
      if (wasImageInquiry && !imageRequested) {
        setImageRequested(true);
      }

      setMessages((currentMessages) => [...currentMessages, { role: "patient", text: data.answer, imageUrl: data.imageUrl }]);

      // Если выставлен диагноз и сценарий завершился
      if (data.scenarioCompleted) {
        setScenarioCompleted(true);
        setDiagnosisResult(data.diagnosisResult ?? "incorrect");
        setDiagnosisStated(true);

        const evalData: DiagnosisEvaluation | null = data.evaluation ?? null;
        if (evalData) {
          setEvaluation(evalData);
        }

        // Сохраняем статистику по 4 критериям
        void saveSessionData({
          questionsCount: nextQuestionCount,
          diagnosisStated: true,
          imageRequested: wasImageInquiry,
          diagnosisCorrect: Boolean(evalData?.isCorrect),
          diagnosisMatchesCount: evalData?.matchedCount ?? 0,
          diagnosisTotalTerms: evalData?.totalCount ?? 0,
          matchedTerms: evalData?.matchedTerms ?? [],
          missingTerms: evalData?.missingTerms ?? [],
          userDiagnosis: currentQuestion,
          targetDiagnosis: evalData?.targetDiagnosis ?? "",
        });
      }
    } catch (requestError) {
      setAnswerError(requestError instanceof Error ? requestError.message : "Не удалось получить ответ");
    } finally {
      setIsSending(false);
    }
  }

  function handleSetDiagnosisPrefix() {
    setQuestion("Диагноз: ");
    const textarea = document.getElementById("question");
    if (textarea) textarea.focus();
  }

  if (activeScenario) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-800">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex items-center justify-between rounded-2xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium text-blue-600">Активный сценарий · Студент: <span className="font-semibold text-slate-800">{login}</span></p>
              <h1 className="mt-1 text-2xl font-bold">{activeScenario.title}</h1>
            </div>
            <button onClick={handleExitScenario} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50">
              К сценариям
            </button>
          </header>
          <section className="grid gap-6 md:grid-cols-[280px_1fr]">
            <aside className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Пациент</p>
              <p className="mt-2 text-lg font-semibold">{activeScenario.patient}</p>
              <p className="mt-5 text-sm text-slate-500">Сложность</p>
              <p className="mt-1 font-medium">{activeScenario.difficulty}</p>
              
              <div className="mt-6 rounded-lg bg-blue-50 p-4 text-xs leading-5 text-blue-900 space-y-2">
                <p className="font-semibold">Критерии оценки симуляции:</p>
                <p>1. Число заданных вопросов: <span className="font-bold">{questionsCount}</span></p>
                <p>2. Запрос снимка (рентген/ЭКГ): <span className="font-bold">{imageRequested ? "Да 📷" : "Нет"}</span></p>
                <p>3. Выставление диагноза: <span className="font-bold">{diagnosisStated ? "Да ✍️" : "Ожидается"}</span></p>
                <p>4. Точность терминологии диагноза</p>
              </div>
            </aside>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="rounded-xl bg-blue-50 p-5 text-sm leading-7 text-blue-950">
                Пациент будет раскрывать сведения о состоянии только в ответах на ваши вопросы. Когда будете готовы сформулировать заключение, начните фразу с «Диагноз: ...».
              </div>
              <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="question">Ваш вопрос пациенту</label>
              {messages.length > 0 && (
                <div className="mt-5 space-y-3" aria-live="polite">
                  {messages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`rounded-lg p-4 text-sm leading-6 ${message.role === "student" ? "ml-8 bg-blue-50 text-blue-950" : "mr-8 bg-slate-100 text-slate-800"}`}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {message.role === "student" ? "Вы" : "Пациент"}
                      </p>
                      {message.text}
                      {message.imageUrl && (
                        <img src={message.imageUrl} alt="Медицинский снимок" className="mt-4 w-full rounded-lg border border-slate-300 bg-slate-950" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <textarea id="question" disabled={scenarioCompleted} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleAskQuestion();
                }
              }} rows={4} placeholder={scenarioCompleted ? "Сценарий завершён. См. статистику ниже." : "Например: Когда началась боль? или Диагноз: ..."} className="mt-6 w-full resize-none rounded-lg border border-slate-300 p-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" />
              
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={handleAskQuestion} disabled={!question.trim() || isSending || scenarioCompleted} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {isSending ? "Пациент отвечает..." : "Задать вопрос"}
                </button>
                {!scenarioCompleted && (
                  <button onClick={handleSetDiagnosisPrefix} type="button" className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
                    Сформулировать диагноз ✍️
                  </button>
                )}
              </div>

              {scenarioCompleted && (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="font-bold text-slate-900">Итоговая статистика симуляции</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                      diagnosisResult === "correct" ? "bg-green-100 text-green-800" :
                      diagnosisResult === "partial" ? "bg-amber-100 text-amber-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {diagnosisResult === "correct" ? "Диагноз правильный" :
                       diagnosisResult === "partial" ? "Частично правильный" :
                       "Диагноз неверный"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-white p-3 shadow-xs">
                      <p className="text-xs text-slate-500">1. Задано вопросов</p>
                      <p className="mt-1 text-2xl font-bold text-blue-600">{questionsCount}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-xs">
                      <p className="text-xs text-slate-500">2. Снимок запрошен</p>
                      <p className="mt-1 text-2xl font-bold text-slate-800">{imageRequested ? "Да 📷" : "Нет"}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-xs">
                      <p className="text-xs text-slate-500">3. Диагноз выставлен</p>
                      <p className="mt-1 text-2xl font-bold text-slate-800">{diagnosisStated ? "Да ✍️" : "Нет"}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-xs">
                      <p className="text-xs text-slate-500">4. Совпадений терминов</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-600">
                        {evaluation ? `${evaluation.matchedCount} из ${evaluation.totalCount}` : "—"}
                      </p>
                    </div>
                  </div>

                  {evaluation && (
                    <div className="mt-4 rounded-xl bg-white p-4 text-xs leading-6 text-slate-700 shadow-xs space-y-1">
                      <p><span className="font-semibold text-slate-900">Ваш диагноз:</span> {evaluation.userDiagnosis}</p>
                      <p><span className="font-semibold text-slate-900">Эталонный диагноз:</span> {evaluation.targetDiagnosis}</p>
                      {evaluation.matchedTerms.length > 0 && (
                        <p className="text-emerald-700"><span className="font-semibold">Совпали термины:</span> {evaluation.matchedTerms.join(", ")}</p>
                      )}
                      {evaluation.missingTerms.length > 0 && (
                        <p className="text-amber-700"><span className="font-semibold">Не указаны термины:</span> {evaluation.missingTerms.join(", ")}</p>
                      )}
                    </div>
                  )}

                  <button onClick={handleExitScenario} className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
                    Вернуться к списку сценариев
                  </button>
                </div>
              )}
              {answerError && <p className="mt-3 text-sm text-red-600">{answerError}</p>}
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (isLoggedIn) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-800">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-center justify-between rounded-2xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium text-blue-600">Система клинической симуляции</p>
              <h1 className="mt-1 text-3xl font-bold">Панель виртуального пациента</h1>
              <p className="mt-1 text-sm text-slate-500">Студент: <span className="font-semibold text-slate-800">{login}</span></p>
            </div>
            <button
              onClick={() => setIsLoggedIn(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
            >
              Выйти
            </button>
          </header>

          <section className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm md:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Текущий сценарий</p>
                  <h2 className="mt-1 text-2xl font-semibold">{scenarios.find((item) => item.id === selectedScenarioId)?.title ?? "Загрузка сценариев..."}</h2>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  Не начат
                </span>
              </div>
              <select value={selectedScenarioId} onChange={(event) => setSelectedScenarioId(event.target.value)} className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" aria-label="Выберите сценарий">
                {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.title} ({scenario.difficulty})</option>)}
              </select>
              <p className="mt-4 max-w-2xl leading-7 text-slate-600">Пациент раскрывает сведения по ходу клинического интервью.</p>
              <button onClick={handleStartScenario} disabled={!selectedScenarioId} className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                Начать сценарий
              </button>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Ваша статистика</p>
              <p className="mt-2 text-4xl font-bold text-blue-600">{studentHistory.length}</p>
              <p className="mt-1 text-xs text-slate-500">Пройдено симуляций</p>
              <div className="mt-4 border-t border-slate-100 pt-3 text-xs space-y-1 text-slate-600">
                <p>Правильных диагнозов: <span className="font-semibold text-emerald-600">{studentHistory.filter((s) => s.diagnosisCorrect).length}</span></p>
                <p>Запросов снимков: <span className="font-semibold text-slate-800">{studentHistory.filter((s) => s.imageRequested).length}</span></p>
              </div>
            </div>
          </section>

          {/* История попыток текущего студента */}
          {studentHistory.length > 0 && (
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-800">История ваших симуляций</h2>
              <p className="text-xs text-slate-500 mt-1">Сохранённые результаты по 4 критериям оценки</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="p-3">Сценарий</th>
                      <th className="p-3 text-center">1. Вопросов</th>
                      <th className="p-3 text-center">2. Снимок</th>
                      <th className="p-3 text-center">3. Диагноз</th>
                      <th className="p-3">4. Терминология</th>
                      <th className="p-3">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-900">{item.scenarioTitle}</td>
                        <td className="p-3 text-center font-bold text-blue-600">{item.questionsCount}</td>
                        <td className="p-3 text-center">{item.imageRequested ? "Да 📷" : "Нет"}</td>
                        <td className="p-3 text-center">
                          {item.diagnosisStated ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Выставлен</span>
                          ) : (
                            <span className="text-xs text-slate-400">Не выставлен</span>
                          )}
                        </td>
                        <td className="p-3">
                          {item.diagnosisStated ? (
                            <div>
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                                item.diagnosisCorrect ? "bg-green-100 text-green-800" :
                                item.diagnosisMatchesCount > 0 ? "bg-amber-100 text-amber-800" :
                                "bg-red-100 text-red-800"
                              }`}>
                                {item.diagnosisMatchesCount} из {item.diagnosisTotalTerms}
                              </span>
                              {item.userDiagnosis && (
                                <p className="mt-1 text-xs text-slate-500 max-w-xs truncate" title={item.userDiagnosis}>
                                  {item.userDiagnosis}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-400">
                          {new Date(item.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="mt-6 flex items-center justify-between">
            <a href="/admin" className="inline-block rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-50">
              Панель преподавателя / Статистика студентов →
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🩺</div>

          <h1 className="text-3xl font-bold text-slate-800">
            Виртуальный пациент
          </h1>

          <p className="text-slate-500 mt-2">
            Система клинической симуляции
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Логин (Фамилия, Имя)
            </label>

            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Например: Иванов Иван"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Пароль
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            onClick={handleLogin}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Войти
          </button>

          {error && <p className="text-center text-sm text-red-600">{error}</p>}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Учебный прототип
        </p>
      </div>
    </main>
  );
}