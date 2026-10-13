"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { StudentSession } from "../data/scenarios";

type Scenario = { id: string; title: string; difficulty: string; patient: string };

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"stats" | "scenarios">("stats");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [xray, setXray] = useState<File | null>(null);
  const [ecg, setEcg] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Record<string, File | null>>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Студенческая статистика
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [studentFilter, setStudentFilter] = useState("");
  const [scenarioFilter, setScenarioFilter] = useState("");
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  async function loadScenarios() {
    try {
      const response = await fetch("/api/scenarios");
      if (response.ok) setScenarios(await response.json());
    } catch {
      // ignore
    }
  }

  async function loadStudentSessions() {
    setIsLoadingStats(true);
    try {
      const response = await fetch("/api/student-sessions");
      if (response.ok) {
        setSessions(await response.json());
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingStats(false);
    }
  }

  useEffect(() => {
    void loadScenarios();
    void loadStudentSessions();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSaving(true);

    const formData = new FormData();
    if (file) formData.append("file", file);
    if (text.trim()) formData.append("text", text);
    if (xray) formData.append("xray", xray);
    if (ecg) formData.append("ecg", ecg);

    try {
      const response = await fetch("/api/scenarios/import", { method: "POST", body: formData });
      const responseText = await response.text();
      let data: { scenario?: { title?: string }; error?: string } = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Сервер вернул ошибку ${response.status}. Перезапустите npm run dev и повторите попытку.`);
      }
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить сценарий");
      setMessage(`Сценарий «${data.scenario?.title ?? "Ситуационная задача"}» сохранён. Он появится в списке после обновления страницы.`);
      await loadScenarios();
      setText("");
      setFile(null);
      setXray(null);
      setEcg(null);
      formRef.current?.reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить сценарий");
    } finally {
      setIsSaving(false);
    }
  }

  async function replaceMedia(scenarioId: string, mediaType: "xray" | "ecg") {
    const targetFile = selectedMedia[`${scenarioId}-${mediaType}`];
    if (!targetFile) return;
    const formData = new FormData();
    formData.append("file", targetFile);
    formData.append("mediaType", mediaType);
    const response = await fetch(`/api/scenarios/${scenarioId}`, { method: "PATCH", body: formData });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage("Изображение заменено.");
    } else {
      setError(data.error ?? "Не удалось заменить изображение.");
    }
  }

  async function deleteScenario(scenarioId: string) {
    if (!window.confirm("Удалить этот сценарий?")) return;
    const response = await fetch(`/api/scenarios/${scenarioId}`, { method: "DELETE" });
    if (response.ok) {
      setScenarios((items) => items.filter((item) => item.id !== scenarioId));
      setMessage("Сценарий удалён.");
    } else {
      setError("Не удалось удалить сценарий.");
    }
  }

  async function deleteStudentSession(sessionId: string) {
    if (!window.confirm("Удалить эту запись статистики студента?")) return;
    const response = await fetch(`/api/student-sessions/${sessionId}`, { method: "DELETE" });
    if (response.ok) {
      setSessions((items) => items.filter((item) => item.id !== sessionId));
      setMessage("Запись удалена.");
    } else {
      setError("Не удалось удалить запись.");
    }
  }

  // Фильтрация сессий
  const filteredSessions = sessions.filter((s) => {
    if (studentFilter.trim()) {
      const match = s.studentName.toLowerCase().includes(studentFilter.toLowerCase().trim());
      if (!match) return false;
    }
    if (scenarioFilter) {
      if (s.scenarioId !== scenarioFilter) return false;
    }
    return true;
  });

  const uniqueStudentsCount = new Set(sessions.map((s) => s.studentName.toLowerCase().trim())).size;
  const correctCount = sessions.filter((s) => s.diagnosisCorrect).length;
  const imageCount = sessions.filter((s) => s.imageRequested).length;

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-800">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-600">Панель управления симуляцией</p>
            <h1 className="mt-1 text-3xl font-bold">Управление и статистика</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("stats")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === "stats" ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              📊 Статистика студентов ({sessions.length})
            </button>
            <button
              onClick={() => setActiveTab("scenarios")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === "scenarios" ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              ⚙️ Сценарии и задачи
            </button>
          </div>
        </header>

        {message && <p className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-800 shadow-xs">{message}</p>}
        {error && <p className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-xs">{error}</p>}

        {activeTab === "stats" ? (
          <div>
            {/* Сводные карточки по 4 критериям */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs uppercase font-semibold text-slate-400">Всего симуляций</p>
                <p className="mt-2 text-3xl font-extrabold text-blue-600">{sessions.length}</p>
                <p className="mt-1 text-xs text-slate-500">Уникальных студентов: {uniqueStudentsCount}</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs uppercase font-semibold text-slate-400">1. Среднее число вопросов</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-800">
                  {sessions.length > 0 ? (sessions.reduce((acc, s) => acc + s.questionsCount, 0) / sessions.length).toFixed(1) : 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">на одну попытку</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs uppercase font-semibold text-slate-400">2. Запросов снимков</p>
                <p className="mt-2 text-3xl font-extrabold text-indigo-600">{imageCount}</p>
                <p className="mt-1 text-xs text-slate-500">{sessions.length > 0 ? `${Math.round((imageCount / sessions.length) * 100)}% попыток` : "—"}</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs uppercase font-semibold text-slate-400">3-4. Правильных диагнозов</p>
                <p className="mt-2 text-3xl font-extrabold text-emerald-600">{correctCount}</p>
                <p className="mt-1 text-xs text-slate-500">{sessions.length > 0 ? `${Math.round((correctCount / sessions.length) * 100)}% успешности` : "—"}</p>
              </div>
            </div>

            {/* Фильтры и таблица */}
            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Журнал симуляций по 4 критериям</h2>
                  <p className="text-xs text-slate-500">Хранение данных под логином студента (фамилия, имя)</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={studentFilter}
                    onChange={(e) => setStudentFilter(e.target.value)}
                    placeholder="Поиск по фамилии или имени..."
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <select
                    value={scenarioFilter}
                    onChange={(e) => setScenarioFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Все сценарии</option>
                    {scenarios.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => void loadStudentSessions()}
                    disabled={isLoadingStats}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium hover:bg-slate-100"
                  >
                    {isLoadingStats ? "Обновление..." : "Обновить 🔄"}
                  </button>
                </div>
              </div>

              {filteredSessions.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-lg">Записей пока нет</p>
                  <p className="mt-1 text-xs">После того как студенты пройдут симуляцию под своим логином, статистика появится здесь.</p>
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="p-3">Студент (Фамилия, Имя)</th>
                        <th className="p-3">Сценарий</th>
                        <th className="p-3 text-center">1. Вопросов</th>
                        <th className="p-3 text-center">2. Снимок</th>
                        <th className="p-3 text-center">3. Диагноз выставлен</th>
                        <th className="p-3">4. Терминология (совпадений)</th>
                        <th className="p-3">Диагноз студента</th>
                        <th className="p-3">Дата</th>
                        <th className="p-3 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-900">{session.studentName}</td>
                          <td className="p-3 text-xs text-slate-600">{session.scenarioTitle}</td>
                          <td className="p-3 text-center font-bold text-blue-600">{session.questionsCount}</td>
                          <td className="p-3 text-center">
                            {session.imageRequested ? (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">Да 📷</span>
                            ) : (
                              <span className="text-xs text-slate-400">Нет</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {session.diagnosisStated ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Да ✍️</span>
                            ) : (
                              <span className="text-xs text-slate-400">Не выставлен</span>
                            )}
                          </td>
                          <td className="p-3">
                            {session.diagnosisStated ? (
                              <div>
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                                  session.diagnosisCorrect ? "bg-green-100 text-green-800" :
                                  session.diagnosisMatchesCount > 0 ? "bg-amber-100 text-amber-800" :
                                  "bg-red-100 text-red-800"
                                }`}>
                                  {session.diagnosisCorrect ? "Правильно" : session.diagnosisMatchesCount > 0 ? "Частично" : "Неверно"} ({session.diagnosisMatchesCount} из {session.diagnosisTotalTerms})
                                </span>
                                {session.matchedTerms.length > 0 && (
                                  <p className="mt-1 text-[11px] text-emerald-700">
                                    + {session.matchedTerms.join(", ")}
                                  </p>
                                )}
                                {session.missingTerms.length > 0 && (
                                  <p className="text-[11px] text-amber-700">
                                    - {session.missingTerms.join(", ")}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-slate-600 max-w-xs truncate" title={session.userDiagnosis}>
                            {session.userDiagnosis || "—"}
                          </td>
                          <td className="p-3 text-xs text-slate-400 whitespace-nowrap">
                            {new Date(session.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => void deleteStudentSession(session.id)}
                              className="text-xs text-red-600 hover:text-red-800 hover:underline"
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div>
            {/* Вкладка управления сценариями */}
            <form ref={formRef} onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Загрузить клиническую задачу</h2>
              <p className="mb-4 text-xs leading-5 text-slate-500">
                Вставьте текст задачи или выберите файл .txt. Система автоматически выделит жалобы, анамнез, симптомы и создаст сценарий.
              </p>

              <label className="block text-sm font-medium text-slate-700" htmlFor="case-file">Файл задачи</label>
              <input id="case-file" type="file" accept=".txt,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm" />

              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-200" /> или вставьте текст <span className="h-px flex-1 bg-slate-200" />
              </div>

              <label className="block text-sm font-medium text-slate-700" htmlFor="case-text">Текст клинической задачи</label>
              <textarea id="case-text" value={text} onChange={(event) => setText(event.target.value)} rows={10} placeholder={'Пациент ..., возраст ...\nЖалобы: ...\nАнамнез травмы: ...'} className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="xray-file">Рентген (снимок)</label>
                  <input id="xray-file" name="xray" type="file" accept="image/*" onChange={(event) => setXray(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="ecg-file">ЭКГ (или другое исследование)</label>
                  <input id="ecg-file" name="ecg" type="file" accept="image/*,.pdf,application/pdf" onChange={(event) => setEcg(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm" />
                </div>
              </div>

              <button type="submit" disabled={isSaving || (!text.trim() && !file)} className="mt-5 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {isSaving ? "Сохраняем..." : "Создать и сохранить сценарий"}
              </button>
            </form>

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Сохранённые сценарии</h2>
              <div className="mt-4 space-y-4">
                {scenarios.map((scenario) => (
                  <article key={scenario.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">{scenario.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">Сложность: {scenario.difficulty}</p>
                      </div>
                      <button onClick={() => void deleteScenario(scenario.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                        Удалить
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {(["xray", "ecg"] as const).map((mediaType) => {
                        const key = `${scenario.id}-${mediaType}`;
                        return (
                          <div key={mediaType}>
                            <label className="block text-xs font-medium uppercase text-slate-500">Заменить {mediaType === "xray" ? "рентген" : "ЭКГ"}</label>
                            <input type="file" accept="image/*,.pdf,application/pdf" onChange={(event) => setSelectedMedia((items) => ({ ...items, [key]: event.target.files?.[0] ?? null }))} className="mt-2 block w-full text-sm" />
                            <button onClick={() => void replaceMedia(scenario.id, mediaType)} disabled={!selectedMedia[key]} className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:bg-slate-300">
                              Заменить файл
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        <div className="mt-6">
          <a href="/" className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800">
            ← Вернуться к симуляции (панель студента)
          </a>
        </div>
      </div>
    </main>
  );
}
