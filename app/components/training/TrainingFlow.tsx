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

// Sent from server before grading (no correct/explanation)
interface QuizQuestion {
  question: string;
  options: string[];
}

// Sent from server after grading (includes correct + explanation)
interface GradedQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  user_answer: number;
  is_correct: boolean;
}

type View = "list" | "read" | "quiz" | "result";

const OPTION_LABELS = ["A", "B", "C", "D"];

// ── Step Progress Bubble ───────────────────────────────────────────────────
function StepProgress({ current }: { current: "read" | "quiz" | "result" }) {
  const steps = [
    { key: "read",   label: "Read" },
    { key: "quiz",   label: "Quiz" },
    { key: "result", label: "Result" },
  ] as const;
  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-0 rounded-xl border border-white/10 bg-white/5 p-1 w-fit">
      {steps.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              active  ? "bg-blue-600 text-white" :
              done    ? "text-emerald-400" :
                        "text-gray-600"
            }`}>
              {done ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  active ? "bg-white/20" : "bg-white/5"
                }`}>{i + 1}</span>
              )}
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-4 h-px mx-0.5 ${done ? "bg-emerald-500/40" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TrainingFlow() {
  const [modules, setModules]   = useState<TrainingModule[]>([]);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading]   = useState(true);

  const [view, setView]                 = useState<View>("list");
  const [activeModule, setActiveModule] = useState<{ id: string; title: string; content: string } | null>(null);
  const [questions, setQuestions]       = useState<QuizQuestion[]>([]);
  const [graded, setGraded]             = useState<GradedQuestion[]>([]);
  const [answers, setAnswers]           = useState<(number | null)[]>([]);
  const [quizLoading, setQuizLoading]   = useState(false);
  const [quizError, setQuizError]       = useState<string | null>(null);
  const [result, setResult]             = useState<{ correct: number; total: number; passed: boolean; attempts: number; pass_threshold?: number } | null>(null);
  const [readProgress, setReadProgress] = useState(0);

  const fetchProgress = useCallback(async () => {
    const res  = await fetch("/api/training/progress");
    const data = await res.json();
    setModules(data.data ?? []);
    setCompleted(data.completed ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // Track how far the rep has scrolled through the reading pane
  useEffect(() => {
    if (view !== "read") { setReadProgress(0); return; }
    const el = document.getElementById("module-content-scroll");
    if (!el) return;
    const onScroll = () => {
      const pct = el.scrollHeight <= el.clientHeight
        ? 100
        : Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
      setReadProgress(Math.min(100, pct));
    };
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [view, activeModule]);

  async function openModule(mod: TrainingModule) {
    const res  = await fetch(`/api/training/${mod.id}`);
    const data = await res.json();
    setActiveModule({ id: mod.id, title: mod.title, content: data.data?.content ?? "" });
    setView("read");
    setQuestions([]);
    setGraded([]);
    setAnswers([]);
    setResult(null);
    setQuizError(null);
    setReadProgress(0);
  }

  async function startQuiz() {
    if (!activeModule) return;
    setQuizLoading(true);
    setQuizError(null);
    // GET — returns questions with correct answers stripped
    const res  = await fetch(`/api/training/${activeModule.id}/quiz`);
    const data = await res.json();
    if (!res.ok || !data.questions?.length) {
      setQuizError(data.error ?? "Quiz not available for this module yet.");
      setQuizLoading(false);
      return;
    }
    setQuestions(data.questions);
    setAnswers(new Array(data.questions.length).fill(null));
    setView("quiz");
    setQuizLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitQuiz() {
    if (!activeModule || answers.some((a) => a === null)) return;
    // POST — send only answers; server grades against stored quiz
    const res  = await fetch(`/api/training/${activeModule.id}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();
    setResult(data);
    setGraded(data.graded ?? []);
    setView("result");
    await fetchProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function isUnlocked(mod: TrainingModule, idx: number) {
    if (idx === 0) return true;
    return modules[idx - 1]?.progress?.quiz_passed === true;
  }

  const allComplete = modules.length > 0 && completed === modules.length;
  const pct         = modules.length ? Math.round((completed / modules.length) * 100) : 0;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-3 max-w-2xl">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Module list ────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-white">Field Training Program</h1>
          </div>
          <p className="text-sm text-gray-400 ml-10.5">Read each module, score 80%+ on the quiz, and unlock the next. Pass everything to become promotion eligible.</p>
        </div>

        {/* Progress card */}
        <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-300">Overall Progress</p>
            <p className="text-sm font-bold text-blue-400">{completed} of {modules.length} passed</p>
          </div>
          <div className="relative h-2 rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          {allComplete && (
            <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400 font-semibold">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Training complete — you are now promotion eligible!
            </div>
          )}
        </div>

        {/* Module cards */}
        <div className="flex flex-col gap-3">
          {modules.map((mod, idx) => {
            const unlocked = isUnlocked(mod, idx);
            const passed   = mod.progress?.quiz_passed;
            const started  = mod.progress?.started_at;
            const attempts = mod.progress?.quiz_attempts ?? 0;

            return (
              <button
                key={mod.id}
                disabled={!unlocked}
                onClick={() => openModule(mod)}
                className={`group relative flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all ${
                  unlocked && !passed
                    ? "border-blue-500/40 bg-blue-600/10 hover:bg-blue-600/15 hover:border-blue-400/60 shadow-lg shadow-blue-900/20"
                    : "border-white/5 bg-white/[0.03] opacity-40 cursor-not-allowed"
                }`}
              >
                {/* Greyed overlay for non-active modules */}
                {(passed || !unlocked) && (
                  <div className="absolute inset-0 rounded-2xl bg-slate-950/30 pointer-events-none" />
                )}

                {/* Step circle */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm transition-all ${
                  passed    ? "bg-slate-700 text-slate-400"
                  : unlocked ? "bg-blue-600 text-white shadow-md shadow-blue-700/40"
                  :            "bg-white/10 text-gray-600"
                }`}>
                  {passed ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : unlocked ? (
                    idx + 1
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${
                    passed ? "text-slate-500" : unlocked ? "text-white" : "text-gray-600"
                  }`}>
                    {mod.title}
                  </p>
                  <p className={`text-xs mt-0.5 ${passed ? "text-slate-600" : unlocked ? "text-blue-400/80" : "text-gray-600"}`}>
                    {passed
                      ? `Completed · ${attempts} attempt${attempts !== 1 ? "s" : ""}`
                      : started    ? "In progress — quiz not yet passed"
                      : unlocked   ? "Ready to start"
                      :              "Complete the previous module first"}
                  </p>
                </div>

                {unlocked && !passed && (
                  <svg className="w-4 h-4 text-blue-400/60 group-hover:text-blue-300 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 border-t border-white/5 pt-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Passed (80%+)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-600/60 inline-block" /> In progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-white/10 inline-block" /> Locked
          </span>
        </div>
      </div>
    );
  }

  // ── Read module ────────────────────────────────────────────────────────────
  if (view === "read" && activeModule) {
    const canTakeQuiz = readProgress >= 50;

    return (
      <div className="flex flex-col gap-5 max-w-2xl text-white">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Modules
          </button>
          <span className="text-gray-700">/</span>
          <span className="text-gray-300 truncate">{activeModule.title}</span>
        </div>

        {/* Step progress bubble */}
        <StepProgress current="read" />

        {/* Read scroll progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${readProgress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-16 text-right shrink-0">
            {readProgress < 100 ? `${readProgress}% read` : "Fully read"}
          </span>
        </div>

        {/* Content */}
        <div
          id="module-content-scroll"
          className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-6 max-h-[55vh] overflow-y-auto"
        >
          <div className="text-slate-100 text-sm whitespace-pre-wrap leading-relaxed">
            {activeModule.content || "Content not available."}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {quizError && (
            <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-3 py-2">
              {quizError}
            </p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {canTakeQuiz
                ? "Ready — take the quiz when you feel prepared."
                : "Keep scrolling to unlock the quiz."}
            </p>
            <button
              onClick={startQuiz}
              disabled={quizLoading || !canTakeQuiz || !!quizError}
              className="flex items-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {quizLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading…
                </>
              ) : (
                <>
                  Take Quiz
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────
  if (view === "quiz" && activeModule) {
    const allAnswered  = answers.every((a) => a !== null);
    const answeredCount = answers.filter((a) => a !== null).length;

    return (
      <div className="flex flex-col gap-5 max-w-2xl text-white">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setView("read")}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to reading
          </button>
        </div>

        {/* Step bubble + header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-white">{activeModule.title}</h1>
            <p className="text-sm text-gray-400 mt-0.5">Score 4 out of 5 (80%) to pass.</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StepProgress current="quiz" />
            <span className="text-xs text-gray-500">{answeredCount}/{questions.length} answered</span>
          </div>
        </div>

        {/* Questions */}
        <div className="flex flex-col gap-4">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5">
              <p className="text-sm font-semibold text-white mb-4">
                <span className="text-blue-400 mr-2">{qi + 1}.</span>{q.question}
              </p>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => setAnswers((prev) => { const n = [...prev]; n[qi] = oi; return n; })}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-left transition-all ${
                        selected
                          ? "border-blue-500 bg-blue-600/20 text-white"
                          : "border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        selected ? "bg-blue-500 text-white" : "bg-white/10 text-gray-400"
                      }`}>
                        {OPTION_LABELS[oi]}
                      </span>
                      <span>{opt.replace(/^[A-D]\.\s*/, "")}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={submitQuiz}
          disabled={!allAnswered}
          className="rounded-xl bg-blue-600 text-white px-5 py-3 text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Submit Answers
        </button>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  if (view === "result" && result && activeModule) {
    const threshold = result.pass_threshold ?? 4;
    const scorePct  = Math.round((result.correct / result.total) * 100);

    return (
      <div className="flex flex-col gap-5 max-w-2xl text-white">

        {/* Step bubble */}
        <StepProgress current="result" />

        {/* Score card */}
        <div className={`rounded-2xl border px-6 py-8 text-center ${
          result.passed
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-red-500/20 bg-red-500/5"
        }`}>
          <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center mx-auto mb-5 border-4 ${
            result.passed ? "border-emerald-500 bg-emerald-500/20" : "border-red-500/40 bg-red-500/10"
          }`}>
            <p className={`text-3xl font-black leading-none ${result.passed ? "text-emerald-300" : "text-red-300"}`}>
              {result.correct}/{result.total}
            </p>
            <p className={`text-sm font-bold mt-1 ${result.passed ? "text-emerald-400" : "text-red-400"}`}>
              {scorePct}%
            </p>
          </div>
          <p className={`text-2xl font-bold mb-1.5 ${result.passed ? "text-emerald-300" : "text-red-300"}`}>
            {result.passed ? "Module Passed!" : "Not quite — try again"}
          </p>
          <p className={`text-sm ${result.passed ? "text-emerald-500/80" : "text-gray-500"}`}>
            {result.passed
              ? `Great work! You hit ${scorePct}% — above the 80% required.`
              : `You need ${threshold}/${result.total} correct. You got ${result.correct}/${result.total} — keep studying!`}
          </p>
          {result.attempts > 1 && (
            <p className="text-xs text-gray-600 mt-2">Attempt {result.attempts}</p>
          )}
        </div>

        {/* Answer review — uses server-graded results */}
        {graded.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Answer Review</p>
            <div className="flex flex-col gap-2.5">
              {graded.map((q, qi) => (
                <div key={qi} className={`rounded-xl border px-4 py-3.5 ${
                  q.is_correct ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
                }`}>
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      q.is_correct ? "bg-emerald-500" : "bg-red-500"
                    }`}>
                      {q.is_correct ? (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs font-medium text-gray-200">{q.question}</p>
                  </div>
                  {!q.is_correct && (
                    <p className="text-xs text-red-400 ml-7 mb-0.5">
                      Your answer: {q.options[q.user_answer]?.replace(/^[A-D]\.\s*/, "")}
                    </p>
                  )}
                  <p className="text-xs text-emerald-400 font-medium ml-7">
                    Correct: {q.options[q.correct]?.replace(/^[A-D]\.\s*/, "")}
                  </p>
                  <p className="text-xs text-gray-500 ml-7 mt-1">{q.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!result.passed && (
            <button
              onClick={startQuiz}
              disabled={quizLoading}
              className="flex-1 rounded-xl border border-blue-500/40 text-blue-400 px-4 py-2.5 text-sm font-semibold hover:bg-blue-600/10 transition-colors disabled:opacity-50"
            >
              {quizLoading ? "Loading…" : "Retry Quiz"}
            </button>
          )}
          <button
            onClick={() => { setView("list"); setActiveModule(null); }}
            className="flex-1 rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-500 transition-colors"
          >
            {result.passed ? "Next Module →" : "Back to List"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
