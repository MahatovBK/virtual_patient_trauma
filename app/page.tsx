"use client";

import { useEffect, useState } from "react";

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
  const [diagnosisResult, setDiagnosisResult] = useState<"correct" | "incorrect" | null>(null);

  useEffect(() => {
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

  function handleLogin() {
    if (!login.trim() || !password.trim()) {
      setError("Введите логин и пароль");
      return;
    }

    setError("");
    setIsLoggedIn(true);
  }

  function handleStartScenario() {
    const scenario = scenarios.find((item) => item.id === selectedScenarioId);
    if (scenario) {
      setActiveScenario(scenario);
      setMessages([]);
      setQuestion("");
      setAnswerError("");
      setScenarioCompleted(false);
      setDiagnosisResult(null);
    }
  }

  async function handleAskQuestion() {
    if (!activeScenario || !question.trim() || isSending) return;

    const currentQuestion = question.trim();
    const questionNumber = messages.filter((message) => message.role === "student").length + 1;
    setMessages((currentMessages) => [...currentMessages, { role: "student", text: currentQuestion }]);
    setQuestion("");
    setAnswerError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: activeScenario.id, question: currentQuestion, questionNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось получить ответ");
      setMessages((currentMessages) => [...currentMessages, { role: "patient", text: data.answer, imageUrl: data.imageUrl }]);
      if (data.scenarioCompleted) {
        setScenarioCompleted(true);
        setDiagnosisResult(data.diagnosisResult ?? null);
      }
    } catch (requestError) {
      setAnswerError(requestError instanceof Error ? requestError.message : "Не удалось получить ответ");
    } finally {
      setIsSending(false);
    }
  }

  if (activeScenario) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-800">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex items-center justify-between rounded-2xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium text-blue-600">Активный сценарий</p>
              <h1 className="mt-1 text-2xl font-bold">{activeScenario.title}</h1>
            </div>
            <button onClick={() => setActiveScenario(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50">
              К сценариям
            </button>
          </header>
          <section className="grid gap-6 md:grid-cols-[280px_1fr]">
            <aside className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Пациент</p>
              <p className="mt-2 text-lg font-semibold">{activeScenario.patient}</p>
              <p className="mt-5 text-sm text-slate-500">Сложность</p>
              <p className="mt-1 font-medium">{activeScenario.difficulty}</p>
              <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                Сценарий начат. Задавайте вопросы и фиксируйте клинические решения.
              </div>
            </aside>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="rounded-xl bg-blue-50 p-5 text-sm leading-7 text-blue-950">
                Пациент будет раскрывать сведения о состоянии только в ответах на ваши вопросы.
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
                        <img src={message.imageUrl} alt="Рентгеновский снимок правого плечевого сустава" className="mt-4 w-full rounded-lg border border-slate-300 bg-slate-950" />
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
              }} rows={4} placeholder={scenarioCompleted ? "Сценарий завершён" : "Например: Когда началась боль?"} className="mt-6 w-full resize-none rounded-lg border border-slate-300 p-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" />
              <button onClick={handleAskQuestion} disabled={!question.trim() || isSending || scenarioCompleted} className="mt-4 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {isSending ? "Пациент отвечает..." : "Задать вопрос"}
              </button>
              {scenarioCompleted && (
                <div className={`mt-4 rounded-lg p-4 text-sm font-semibold ${diagnosisResult === "correct" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                  Сценарий завершён. {diagnosisResult === "correct" ? "Диагноз принят." : "Диагноз требует исправления."}
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
              <p className="text-sm text-slate-500">Прогресс обучения</p>
              <p className="mt-2 text-4xl font-bold text-blue-600">0%</p>
              <div className="mt-5 h-2 rounded-full bg-slate-100">
                <div className="h-2 w-0 rounded-full bg-blue-600" />
              </div>
              <p className="mt-4 text-sm text-slate-500">Сценариев завершено: 0 из 3</p>
            </div>
          </section>
          <a href="/admin" className="mt-6 inline-block rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-50">
            Загрузить новую клиническую задачу
          </a>
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
              Логин
            </label>

            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Введите логин"
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