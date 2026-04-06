"use client";

import { useEffect, useState, useCallback } from "react";

interface TrainingModule {
  id: string;
  title: string;
  sequence_order: number | null;
  content_length: number;
  progress: {
    started_at: string | null;
    completed_at: string | null;
    quiz_passed: boolean;
    quiz_attempts: number;
  } | null;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

type View = "list" | "read" | "quiz" | "result";

export default function TrainingFlow() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  // Active module flow
  const [view, setView] = useState<View>("list");
  const [activeModule, setActiveModule] = useState<{ id: string; title: string; content: string } | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number; passed: boolean; attempts: number } | null>(null);

  const fetchProgress = useCallback(async () => {
    const res = await fetch("/api/training/progress");
    const data = await res.json();
    setModules(data.data ?? []);
    setCompleted(data.completed ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  async function openModule(mod: TrainingModule) {
    const res = await fetch(`/api/training/${mod.id}`);
    const data = await res.json();
    setActiveModule({ id: mod.id, title: mod.title, content: data.data?.content ?? "" });
    setView("read");
    setQuestions([]);
    setAnswers([]);
    setResult(null);
  }

  async function startQuiz() {
    if (!activeModule) return;
    setQuizLoading(true);
    const res = await fetch(`/api/training/${activeModule.id}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setQuestions(data.questions ?? []);
    setAnswers(new Array(data.questions?.length ?? 0).fill(null));
    setView("quiz");
    setQuizLoading(false);
  }

  async function submitQuiz() {
    if (!activeModule || answers.some((a) => a === null)) return;
    const res = await fetch(`/api/training/${activeModule.id}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, questions }),
    });
    const data = await res.json();
    setResult(data);
    setView("result");
    await fetchProgress();
  }

  function isUnlocked(mod: TrainingModule, idx: number): boolean {
    if (idx === 0) return true;
    const prev = modules[idx - 1];
    return prev?.progress?.quiz_passed === true;
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1,2,3,4,5].map((i) => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  // ── Module list ────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Training Program</h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete each module in order, then pass the quiz to unlock the next.</p>
        </div>

        {/* Progress bar */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Your Progress</p>
            <p className="text-sm font-semibold text-blue-600">{completed}/{modules.length} completed</p>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all"
              style={{ width: `${modules.length ? (completed / modules.length) * 100 : 0}%` }}
            />
          </div>
          {completed === modules.length && modules.length > 0 && (
            <p className="text-xs text-green-600 font-medium mt-2">Training complete! You are certified.</p>
          )}
        </div>

        {/* Module list */}
        <div className="flex flex-col gap-2">
          {modules.map((mod, idx) => {
            const unlocked = isUnlocked(mod, idx);
            const passed = mod.progress?.quiz_passed;
            const started = mod.progress?.started_at;

            return (
              <button
                key={mod.id}
                disabled={!unlocked}
                onClick={() => openModule(mod)}
                className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  passed
                    ? "border-green-200 bg-green-50 hover:bg-green-100"
                    : unlocked
                    ? "border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 shadow-sm"
                    : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                }`}
              >
                {/* Status icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                  passed ? "bg-green-500 text-white" : unlocked ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-400"
                }`}>
                  {passed ? "✓" : unlocked ? (idx + 1) : "🔒"}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${passed ? "text-green-800" : "text-gray-900"}`}>
                    {mod.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {passed
                      ? `Passed${mod.progress?.quiz_attempts ? ` · ${mod.progress.quiz_attempts} attempt${mod.progress.quiz_attempts !== 1 ? "s" : ""}` : ""}`
                      : started
                      ? "In progress"
                      : unlocked
                      ? "Ready to start"
                      : "Complete previous module first"}
                  </p>
                </div>

                {unlocked && !passed && (
                  <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Read module ────────────────────────────────────────────────────────────
  if (view === "read" && activeModule) {
    return (
      <div className="flex flex-col gap-5 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
          <h1 className="text-lg font-semibold text-gray-900">{activeModule.title}</h1>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-6 py-5 max-h-[55vh] overflow-y-auto">
          <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed text-sm">
            {activeModule.content || "Content not available."}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Read the material above, then take the quiz to complete this module.</p>
          <button
            onClick={startQuiz}
            disabled={quizLoading}
            className="rounded-xl bg-blue-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {quizLoading ? "Generating quiz…" : "Take Quiz →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────
  if (view === "quiz" && activeModule) {
    const allAnswered = answers.every((a) => a !== null);

    return (
      <div className="flex flex-col gap-5 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("read")} className="text-sm text-gray-400 hover:text-gray-600">← Back to reading</button>
          <h1 className="text-lg font-semibold text-gray-900">Quiz: {activeModule.title}</h1>
        </div>
        <p className="text-sm text-gray-500">Answer all 3 questions. You need 2/3 correct to pass.</p>

        <div className="flex flex-col gap-5">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-2xl border border-gray-100 bg-white shadow-sm px-5 py-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">{qi + 1}. {q.question}</p>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => setAnswers((prev) => { const n = [...prev]; n[qi] = oi; return n; })}
                    className={`rounded-xl border px-4 py-2.5 text-sm text-left transition-colors ${
                      answers[qi] === oi
                        ? "border-blue-400 bg-blue-50 text-blue-800 font-medium"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={submitQuiz}
          disabled={!allAnswered}
          className="rounded-xl bg-blue-500 text-white px-5 py-3 text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Quiz
        </button>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  if (view === "result" && result && activeModule) {
    return (
      <div className="flex flex-col gap-5 max-w-2xl">
        <h1 className="text-lg font-semibold text-gray-900">Quiz Results</h1>

        <div className={`rounded-2xl border px-6 py-6 text-center ${
          result.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        }`}>
          <p className="text-4xl font-black mb-2">{result.passed ? "✓" : "✗"}</p>
          <p className={`text-lg font-bold ${result.passed ? "text-green-700" : "text-red-700"}`}>
            {result.passed ? "Passed!" : "Not quite — try again"}
          </p>
          <p className={`text-sm mt-1 ${result.passed ? "text-green-600" : "text-red-600"}`}>
            {result.correct}/{result.total} correct
          </p>
        </div>

        {/* Show correct answers */}
        <div className="flex flex-col gap-3">
          {questions.map((q, qi) => {
            const userAnswer = answers[qi];
            const correct = q.correct;
            const isRight = userAnswer === correct;
            return (
              <div key={qi} className={`rounded-xl border px-4 py-3 ${isRight ? "border-green-200 bg-green-50" : "border-red-100 bg-red-50"}`}>
                <p className="text-xs font-semibold text-gray-700 mb-1">{qi + 1}. {q.question}</p>
                {!isRight && userAnswer !== null && (
                  <p className="text-xs text-red-600 mb-0.5">Your answer: {q.options[userAnswer]}</p>
                )}
                <p className="text-xs text-green-700 font-medium">Correct: {q.options[correct]}</p>
                <p className="text-xs text-gray-500 mt-1">{q.explanation}</p>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          {!result.passed && (
            <button
              onClick={startQuiz}
              disabled={quizLoading}
              className="flex-1 rounded-xl border border-blue-300 text-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-50 transition-colors"
            >
              {quizLoading ? "Loading…" : "Retry Quiz"}
            </button>
          )}
          <button
            onClick={() => { setView("list"); setActiveModule(null); }}
            className="flex-1 rounded-xl bg-blue-500 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
          >
            {result.passed ? "Next Module →" : "Back to List"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
