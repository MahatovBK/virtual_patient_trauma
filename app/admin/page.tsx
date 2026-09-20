"use client";

import { FormEvent, useRef, useState } from "react";

export default function AdminPage() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [xray, setXray] = useState<File | null>(null);
  const [ecg, setEcg] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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
      setMessage(`Сценарий «${data.scenario?.title ?? "Травма плечевого сустава"}» сохранён. Он появится в списке после обновления страницы.`);
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

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-800">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-blue-600">Управление содержанием</p>
          <h1 className="mt-1 text-3xl font-bold">Загрузить клиническую задачу</h1>
          <p className="mt-3 leading-7 text-slate-600">
            Вставьте текст задачи или выберите файл .txt. Система создаст сценарий в формате, который использует API виртуального пациента.
          </p>
        </header>

        <form ref={formRef} onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700" htmlFor="case-file">Файл задачи</label>
          <input id="case-file" type="file" accept=".txt,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm" />

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> или вставьте текст <span className="h-px flex-1 bg-slate-200" />
          </div>

          <label className="block text-sm font-medium text-slate-700" htmlFor="case-text">Текст клинической задачи</label>
          <textarea id="case-text" value={text} onChange={(event) => setText(event.target.value)} rows={14} placeholder={'Название: Боль в животе\nПациент: ...\n\nОписание клинической ситуации...'} className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="xray-file">Рентген</label>
              <input id="xray-file" name="xray" type="file" accept="image/*" onChange={(event) => setXray(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="ecg-file">ЭКГ</label>
              <input id="ecg-file" name="ecg" type="file" accept="image/*,.pdf,application/pdf" onChange={(event) => setEcg(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm" />
            </div>
          </div>

          <button type="submit" disabled={isSaving || (!text.trim() && !file)} className="mt-5 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
            {isSaving ? "Сохраняем..." : "Создать и сохранить сценарий"}
          </button>
          {message && <p className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-800">{message}</p>}
          {error && <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        </form>

        <a href="/" className="mt-6 inline-block text-sm font-medium text-blue-600 hover:text-blue-800">Вернуться в приложение</a>
      </div>
    </main>
  );
}
