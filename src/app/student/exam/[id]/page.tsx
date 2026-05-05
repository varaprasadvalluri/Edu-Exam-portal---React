'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  getExam, getExamQuestions, getStudentAttemptForExam,
  createAttempt, updateAttempt, evaluateAndSaveResult
} from '@/lib/firestore';
import type { Exam, Question, ExamAttempt, StudentAnswer } from '@/types';
import toast from 'react-hot-toast';
import Image from 'next/image';

type Phase = 'loading' | 'instructions' | 'exam' | 'submitted';

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; percentage: number; passed: boolean } | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const questionStartRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Load exam data
  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        const [examData, questionsData] = await Promise.all([getExam(id), getExamQuestions(id)]);
        if (!examData) { router.push('/student'); return; }

        // Check for existing attempt
        const existing = await getStudentAttemptForExam(profile.uid, id);
        if (existing?.status === 'submitted' || existing?.status === 'evaluated') {
          router.push('/student/results');
          return;
        }

        setExam(examData);
        setQuestions(examData.shuffleQuestions ? shuffleArray(questionsData) : questionsData);

        if (existing?.status === 'in_progress') {
          // Resume attempt
          setAttempt(existing);
          setAnswers(existing.answers || {});
          const elapsed = Math.floor((Date.now() - new Date(existing.startTime).getTime()) / 1000);
          const remaining = examData.duration * 60 - elapsed;
          setTimeLeft(Math.max(0, remaining));
          setPhase('exam');
        } else {
          setTimeLeft(examData.duration * 60);
          setPhase('instructions');
        }
      } catch { toast.error('Failed to load exam'); router.push('/student'); }
    };
    load();
  }, [id, profile, router]);

  // Anti-cheat: tab visibility
  useEffect(() => {
    if (phase !== 'exam') return;
    const handleVisibility = () => {
      if (document.hidden) {
        setTabWarnings(prev => {
          const next = prev + 1;
          if (next >= 3) {
            toast.error('Exam auto-submitted due to repeated tab switching!', { duration: 6000 });
            handleSubmit(true);
          } else {
            toast.error(`⚠️ Warning ${next}/3: Don't switch tabs during exam!`, { duration: 5000 });
          }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase]);

  // Anti-cheat: prevent copy/paste/right-click
  useEffect(() => {
    if (phase !== 'exam') return;
    const prevent = (e: Event) => e.preventDefault();
    const preventCtrl = (e: KeyboardEvent) => {
      if (e.ctrlKey && ['c','v','a','u','s'].includes(e.key.toLowerCase())) e.preventDefault();
    };
    document.addEventListener('copy', prevent);
    document.addEventListener('paste', prevent);
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('keydown', preventCtrl);
    return () => {
      document.removeEventListener('copy', prevent);
      document.removeEventListener('paste', prevent);
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('keydown', preventCtrl);
    };
  }, [phase]);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'exam' || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          toast.error('Time is up! Auto-submitting...', { duration: 4000 });
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (phase !== 'exam' || !attempt) return;
    autoSaveRef.current = setInterval(async () => {
      try {
        await updateAttempt(attempt.id, {
          answers,
          timeSpent: Math.floor((Date.now() - startTimeRef.current) / 1000),
          updatedAt: new Date().toISOString(),
        });
      } catch { /* silent */ }
    }, 30000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [phase, attempt, answers]);

  const startExam = async () => {
    if (!exam || !profile) return;
    try {
      const now = new Date().toISOString();
      const attemptId = await createAttempt({
        examId: id,
        studentId: profile.uid,
        studentName: profile.displayName,
        classLevel: profile.classLevel!,
        answers: {},
        startTime: now,
        autoSubmitted: false,
        status: 'in_progress',
        timeSpent: 0,
        createdAt: now,
        updatedAt: now,
      });
      const newAttempt: ExamAttempt = {
        id: attemptId,
        examId: id,
        studentId: profile.uid,
        studentName: profile.displayName,
        classLevel: profile.classLevel!,
        answers: {},
        startTime: now,
        autoSubmitted: false,
        status: 'in_progress',
        timeSpent: 0,
        createdAt: now,
        updatedAt: now,
      };
      setAttempt(newAttempt);
      startTimeRef.current = Date.now();
      questionStartRef.current = Date.now();
      setPhase('exam');
    } catch { toast.error('Failed to start exam'); }
  };

  const handleAnswer = (questionId: string, optionId: string, questionType: string) => {
    setAnswers(prev => {
      const current = prev[questionId] || { questionId, selectedOptions: [], isAnswered: false, isMarkedForReview: false, timeTaken: 0 };
      let selectedOptions: string[];
      if (questionType === 'single') {
        selectedOptions = [optionId];
      } else if (questionType === 'multiple') {
        const has = current.selectedOptions.includes(optionId);
        selectedOptions = has
          ? current.selectedOptions.filter(id => id !== optionId)
          : [...current.selectedOptions, optionId];
      } else {
        selectedOptions = [optionId];
      }
      return {
        ...prev,
        [questionId]: {
          ...current,
          selectedOptions,
          isAnswered: selectedOptions.length > 0,
          timeTaken: Math.floor((Date.now() - questionStartRef.current) / 1000),
        },
      };
    });
  };

  const handleTextAnswer = (questionId: string, text: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        questionId,
        selectedOptions: [text],
        isAnswered: text.trim().length > 0,
        isMarkedForReview: prev[questionId]?.isMarkedForReview ?? false,
        timeTaken: Math.floor((Date.now() - questionStartRef.current) / 1000),
      },
    }));
  };

  const toggleFlag = (questionId: string) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const navigateToQuestion = (idx: number) => {
    questionStartRef.current = Date.now();
    setCurrentIdx(idx);
  };

  const handleSubmit = useCallback(async (auto = false) => {
    if (!attempt || !exam || submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const now = new Date().toISOString();
      await updateAttempt(attempt.id, {
        answers,
        submitTime: now,
        autoSubmitted: auto,
        status: 'submitted',
        timeSpent,
      });

      const updatedAttempt: ExamAttempt = {
        ...attempt,
        answers,
        submitTime: now,
        autoSubmitted: auto,
        status: 'submitted',
        timeSpent,
      };

      const evaluatedResult = await evaluateAndSaveResult(updatedAttempt, questions);
      setResult({
        score: evaluatedResult.obtainedMarks,
        total: evaluatedResult.totalMarks,
        percentage: evaluatedResult.percentage,
        passed: evaluatedResult.passed,
      });
      setPhase('submitted');
    } catch (err) {
      toast.error('Failed to submit. Please try again.');
      setSubmitting(false);
    }
  }, [attempt, exam, answers, questions, submitting]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const answeredCount = Object.values(answers).filter(a => a.isAnswered).length;
  const currentQuestion = questions[currentIdx];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const isTimeLow = timeLeft > 0 && timeLeft <= 300; // 5 min warning

  // ── LOADING ──
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-3 h-3 bg-primary-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
          <p className="text-gray-500 font-medium text-sm">Loading exam...</p>
        </div>
      </div>
    );
  }

  // ── INSTRUCTIONS ──
  if (phase === 'instructions' && exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-card border border-gray-100 w-full max-w-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">{exam.title}</h1>
                <p className="text-primary-200 text-sm">{exam.subject} · {exam.classLevel}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Questions', value: exam.questionCount, icon: '📝' },
                { label: 'Duration', value: `${exam.duration} min`, icon: '⏱' },
                { label: 'Total Marks', value: exam.totalMarks, icon: '🏆' },
              ].map(s => (
                <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center backdrop-blur">
                  <p className="text-xl mb-1">{s.icon}</p>
                  <p className="font-display font-bold text-lg leading-none">{s.value}</p>
                  <p className="text-primary-200 text-xs mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8">
            <h2 className="font-display font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Instructions
            </h2>
            <ol className="space-y-2.5 mb-6">
              {(exam.instructions || []).map((inst, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {inst}
                </li>
              ))}
              <li className="flex items-start gap-3 text-sm text-amber-700 bg-amber-50 p-3 rounded-xl">
                <span className="text-xl">⚠️</span>
                Do not switch browser tabs or windows. Repeated violations will auto-submit your exam.
              </li>
            </ol>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl mb-6">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-primary-700 font-bold text-sm">{profile?.displayName.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{profile?.displayName}</p>
                <p className="text-gray-400 text-xs">{profile?.classLevel} · {profile?.rollNumber || profile?.email}</p>
              </div>
            </div>

            <button onClick={startExam}
              className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-display font-bold text-lg rounded-2xl transition-all shadow-glow hover:shadow-glow-lg flex items-center justify-center gap-3">
              Start Exam
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SUBMITTED ──
  if (phase === 'submitted' && result && exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-card w-full max-w-lg overflow-hidden">
          <div className={`p-8 text-center ${result.passed ? 'bg-gradient-to-b from-success-500 to-success-600' : 'bg-gradient-to-b from-danger-500 to-danger-600'}`}>
            <div className="text-5xl mb-4">{result.passed ? '🎉' : '📚'}</div>
            <h2 className="text-2xl font-display font-bold text-white mb-1">
              {result.passed ? 'Congratulations!' : 'Keep Practicing!'}
            </h2>
            <p className="text-white/80 text-sm">
              {result.passed ? 'You passed the exam!' : 'You did not meet the passing score this time.'}
            </p>
          </div>

          <div className="p-8">
            {/* Score circle */}
            <div className="flex justify-center mb-6">
              <div className={`relative w-32 h-32 rounded-full border-8 ${
                result.passed ? 'border-success-200' : 'border-danger-200'
              } flex items-center justify-center`}>
                <div className="text-center">
                  <p className={`text-3xl font-display font-bold ${result.passed ? 'text-success-600' : 'text-danger-600'}`}>
                    {result.percentage}%
                  </p>
                  <p className="text-xs text-gray-500">{result.score}/{result.total}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Correct', value: Object.values(answers).filter(a => a.isAnswered).length, color: 'text-success-600 bg-success-50' },
                { label: 'Skipped', value: questions.length - Object.values(answers).filter(a => a.isAnswered).length, color: 'text-gray-600 bg-gray-50' },
                { label: 'Pass Mark', value: exam.passingMarks, color: 'text-primary-600 bg-primary-50' },
              ].map(s => (
                <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
                  <p className="text-xl font-display font-bold">{s.value}</p>
                  <p className="text-xs font-medium mt-0.5 opacity-80">{s.label}</p>
                </div>
              ))}
            </div>

            {exam.showResultImmediately ? (
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/student/results')}
                  className="w-full btn-primary py-3">
                  View Detailed Results
                </button>
                <button
                  onClick={() => router.push('/student')}
                  className="w-full btn-secondary py-3">
                  Back to Dashboard
                </button>
              </div>
            ) : (
              <button onClick={() => router.push('/student')} className="w-full btn-primary py-3">
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── EXAM INTERFACE ──
  if (phase === 'exam' && currentQuestion && exam) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col exam-mode">
        {/* Top Bar */}
        <div className={`sticky top-0 z-40 border-b shadow-sm ${
          isTimeLow ? 'bg-danger-600' : 'bg-primary-950'
        }`}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                </svg>
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="text-white font-bold text-sm truncate">{exam.title}</p>
                <p className="text-white/60 text-xs">{exam.classLevel}</p>
              </div>
            </div>

            {/* Timer */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg ${
              isTimeLow ? 'bg-white/20 text-white animate-pulse-slow' : 'bg-white/10 text-white'
            }`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(timeLeft)}
            </div>

            {/* Progress */}
            <div className="hidden sm:flex items-center gap-3 text-white/80 text-xs font-semibold">
              <span>{answeredCount}/{questions.length} answered</span>
              {tabWarnings > 0 && (
                <span className="bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full">
                  ⚠️ {tabWarnings} warning{tabWarnings > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="px-4 py-2 bg-white text-primary-700 font-bold text-sm rounded-xl hover:bg-gray-100 transition-all flex-shrink-0"
            >
              Submit
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-0.5 bg-white/10">
            <div
              className="h-full bg-white/40 transition-all duration-500"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 flex gap-6">
          {/* Question Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              {/* Question header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center">
                    {currentIdx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${
                      currentQuestion.type === 'single' ? 'badge-primary' :
                      currentQuestion.type === 'multiple' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {currentQuestion.type === 'single' ? 'Single Choice' :
                       currentQuestion.type === 'multiple' ? 'Multiple Choice' : 'Text'}
                    </span>
                    <span className="badge badge-gray">{currentQuestion.marks} mark{currentQuestion.marks !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    flagged.has(currentQuestion.id)
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                >
                  🚩 {flagged.has(currentQuestion.id) ? 'Flagged' : 'Flag'}
                </button>
              </div>

              {/* Question body */}
              <div className="p-6">
                <p className="text-gray-900 font-medium text-base leading-relaxed mb-5">
                  {currentQuestion.text}
                </p>

                {currentQuestion.imageText && (
                  <div className="relative h-48 w-full max-w-sm rounded-xl overflow-hidden border border-gray-200 mb-5">
                    <Image src={currentQuestion.imageText} alt="Question" fill className="object-contain" />
                  </div>
                )}

                {/* Single / Multiple choice options */}
                {currentQuestion.type !== 'text' && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, optIdx) => {
                      const isSelected = currentAnswer?.selectedOptions.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleAnswer(currentQuestion.id, option.id, currentQuestion.type)}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-${currentQuestion.type === 'single' ? 'full' : 'md'} border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-primary-800' : 'text-gray-700'}`}>
                            {option.text}
                          </span>
                          {option.imageUrl && (
                            <div className="relative h-10 w-14 rounded overflow-hidden border flex-shrink-0">
                              <Image src={option.imageUrl} alt="Option" fill className="object-cover" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Text answer */}
                {currentQuestion.type === 'text' && (
                  <div>
                    <label className="label">Your Answer</label>
                    <input
                      value={currentAnswer?.selectedOptions[0] || ''}
                      onChange={e => handleTextAnswer(currentQuestion.id, e.target.value)}
                      placeholder="Type your answer here..."
                      className="input text-base py-3"
                    />
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
                <button
                  onClick={() => navigateToQuestion(Math.max(0, currentIdx - 1))}
                  disabled={currentIdx === 0}
                  className="btn-secondary disabled:opacity-40"
                >
                  ← Previous
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button
                    onClick={() => navigateToQuestion(currentIdx + 1)}
                    className="btn-primary"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    onClick={() => setShowSubmitConfirm(true)}
                    className="btn-primary bg-success-600 hover:bg-success-700"
                  >
                    Submit Exam ✓
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Question Navigator Sidebar */}
          <div className="w-52 flex-shrink-0 hidden lg:block">
            <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-4 sticky top-24">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Questions</p>
              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id]?.isAnswered;
                  const isFlagged = flagged.has(q.id);
                  const isCurrent = idx === currentIdx;
                  return (
                    <button
                      key={q.id}
                      onClick={() => navigateToQuestion(idx)}
                      className={`exam-nav-btn ${
                        isFlagged ? 'flagged' :
                        isAnswered ? 'answered' :
                        'unanswered'
                      } ${isCurrent ? 'current' : ''}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="space-y-1.5 text-xs">
                {[
                  { color: 'bg-success-500', label: 'Answered' },
                  { color: 'bg-amber-400', label: 'Flagged' },
                  { color: 'bg-gray-200', label: 'Unanswered' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${l.color}`} />
                    <span className="text-gray-500">{l.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-2xl font-display font-bold text-gray-900">{answeredCount}</p>
                  <p className="text-xs text-gray-500">of {questions.length} answered</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Confirmation Modal */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center mb-5">
                <div className="text-4xl mb-3">📤</div>
                <h3 className="font-display font-bold text-gray-900 text-xl mb-2">Submit Exam?</h3>
                <p className="text-gray-500 text-sm">
                  You have answered <span className="font-bold text-gray-800">{answeredCount}/{questions.length}</span> questions.
                  {answeredCount < questions.length && (
                    <span className="text-amber-600 block mt-1 font-medium">
                      ⚠️ {questions.length - answeredCount} question(s) left unanswered.
                    </span>
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="w-full btn-primary py-3 bg-success-600 hover:bg-success-700"
                >
                  {submitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Submitting...
                    </>
                  ) : 'Yes, Submit'}
                </button>
                <button onClick={() => setShowSubmitConfirm(false)} className="w-full btn-secondary py-3">
                  Review Answers
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
