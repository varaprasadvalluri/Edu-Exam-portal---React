import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, writeBatch, setDoc, onSnapshot } from 'firebase/firestore';
import { Exam, Question, Attempt } from '../types';
import { MathInputToolbar } from './MathInputToolbar';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Clock, ChevronLeft, ChevronRight, Send, HelpCircle, ShieldAlert, PauseCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

// Specialized Subject-Specific Modules
import { ScratchpadCanvas } from './ScratchpadCanvas';
import { PeriodicTableHelper } from './PeriodicTableHelper';
import { EmbeddedCodeEditor } from './EmbeddedCodeEditor';
import { RichTextKeyboardEditor } from './RichTextKeyboardEditor';
import { LazyExamAsset } from './LazyExamAsset';
import { ExamSyncProvider, useExamSync } from './ExamSyncContext';
import { OfflineSubmissionSafeWall } from './OfflineSubmissionSafeWall';

const ExamInterfaceCore: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { isOnline, isSynced, syncAnswers, forceBackgroundSync } = useExamSync();
  
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | string | number[] | null)[]>([]);
  const [visited, setVisited] = useState<boolean[]>([]);
  const [markedForReview, setMarkedForReview] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  
  const [timePerQuestion, setTimePerQuestion] = useState<Record<number, number>>({});
  const [violationsCount, setViolationsCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [extraTime, setExtraTime] = useState<number>(0);
  const [showOfflineWall, setShowOfflineWall] = useState(false);
  const [offlineAnswersSnapshot, setOfflineAnswersSnapshot] = useState<(number | string | number[] | null)[]>([]);

  const logProctorAnomaly = useCallback(async (type: string, description: string) => {
    if (!attemptId || !attempt) return;
    try {
      const logRef = doc(collection(db, 'proctor_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        attemptId,
        studentId: attempt.studentId,
        studentName: attempt.studentName,
        studentEmail: attempt.studentEmail || '',
        examId: attempt.examId,
        examTitle: exam?.title || 'E-Exam Assessment',
        type,
        timestamp: new Date().toISOString(),
        description
      });
    } catch (e) {
      console.error("Proctor anomaly save fail", e);
    }
  }, [attemptId, attempt, exam]);

  const fetchData = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      const attemptRef = doc(db, 'attempts', attemptId);
      let attemptSnap;
      try {
        attemptSnap = await getDoc(attemptRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `attempts/${attemptId}`);
        return;
      }

      if (!attemptSnap.exists()) {
        toast.error("Attempt not found");
        return;
      }

      const aData = { id: attemptSnap.id, ...attemptSnap.data() } as Attempt;
      if (aData.status === 'completed') {
        navigate(`/result/${attemptId}`);
        return;
      }
      setAttempt(aData);
      setAnswers(aData.answers || []);
      setViolationsCount(aData.violationsCount || 0);
      setTimePerQuestion(aData.timePerQuestion || {});

      const examRef = doc(db, 'exams', aData.examId);
      let examSnap;
      try {
        examSnap = await getDoc(examRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `exams/${aData.examId}`);
        return;
      }
      
      if (!examSnap.exists()) {
        toast.error("Exam not found");
        return;
      }
      const eData = { id: examSnap.id, ...examSnap.data() } as Exam;
      setExam(eData);

      const qsQuery = query(collection(db, 'questions'), where('examId', '==', aData.examId));
      let qsSnap;
      try {
        qsSnap = await getDocs(qsQuery);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'questions');
        return;
      }
      
      const qList = qsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      
      const seed = attemptId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const seededShuffle = (array: any[], seed: number) => {
        const arr = [...array];
        let currentSeed = seed;
        for (let i = arr.length - 1; i > 0; i--) {
          currentSeed = (currentSeed * 9301 + 49297) % 233280;
          const rnd = currentSeed / 233280;
          const j = Math.floor(rnd * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };
      
      const shuffledQuestions = seededShuffle(qList, seed);
      setQuestions(shuffledQuestions);

      // Restore visited and review tags from localStorage if they exist
      const cachedVisited = localStorage.getItem(`exam_visited_${attemptId}`);
      const cachedReview = localStorage.getItem(`exam_review_${attemptId}`);
      
      if (cachedVisited) {
        try { setVisited(JSON.parse(cachedVisited)); } catch (e) { console.error(e); }
      } else {
        const initVisited = Array(shuffledQuestions.length).fill(false);
        initVisited[0] = true;
        setVisited(initVisited);
      }

      if (cachedReview) {
        try { setMarkedForReview(JSON.parse(cachedReview)); } catch (e) { console.error(e); }
      } else {
        setMarkedForReview(Array(shuffledQuestions.length).fill(false));
      }

      const startTime = new Date(aData.startTime).getTime();
      const durationMs = eData.duration * 60 * 1000;
      const elapsedMs = Date.now() - startTime;
      const remaining = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));
      setTimeLeft(remaining);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load attempt data");
    } finally {
      setLoading(false);
    }
  }, [attemptId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // MODULE 2: Emergency Pause & Dynamic Time Extension Real-Time Sync Engine
  useEffect(() => {
    if (!attemptId || !attempt) return;

    // 1. Subscribe to specific student attempt updates
    const unsubAttempt = onSnapshot(doc(db, 'attempts', attemptId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        
        // Handle student-specific extra time allocated by primary admins (minutes)
        if (typeof data.extraTime === 'number') {
          setExtraTime(prev => {
            if (data.extraTime > prev) {
              toast.success(`⏰ Dynamic Time Extension: School admin has extended your session by ${data.extraTime} extra minutes!`, {
                duration: 6000,
                icon: <Clock className="text-indigo-600 animate-spin" />
              });
            }
            return data.extraTime;
          });
        }

        // Handle specific student pause triggers
        const isStudentPaused = !!data.isPaused || !!data.paused;
        setIsPaused(prev => {
          if (isStudentPaused && !prev) {
            toast.error("⏸️ Exam paused by administrator. Your countdown timer is locked.", {
              duration: 5000,
              icon: <PauseCircle className="text-amber-500 animate-pulse" />
            });
          } else if (!isStudentPaused && prev) {
            toast.success("▶️ Exam resumed by administrator. Countdown active.", {
              duration: 4000
            });
          }
          return isStudentPaused;
        });
      }
    });

    // 2. Subscribe to general Exam updates
    const unsubExam = onSnapshot(doc(db, 'exams', attempt.examId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const isExamPaused = !!data.isPaused || !!data.paused;
        if (isExamPaused) {
          setIsPaused(true);
        }
      }
    });

    return () => {
      unsubAttempt();
      unsubExam();
    };
  }, [attemptId, attempt]);

  useEffect(() => {
    if (questions.length > 0 && visited.length > 0) {
      if (!visited[currentIndex]) {
        const nextVisited = [...visited];
        nextVisited[currentIndex] = true;
        setVisited(nextVisited);
      }
    }
  }, [currentIndex, questions.length, visited]);

  useEffect(() => {
    if (attemptId && visited.length > 0) {
      localStorage.setItem(`exam_visited_${attemptId}`, JSON.stringify(visited));
    }
  }, [visited, attemptId]);

  useEffect(() => {
    if (attemptId && markedForReview.length > 0) {
      localStorage.setItem(`exam_review_${attemptId}`, JSON.stringify(markedForReview));
    }
  }, [markedForReview, attemptId]);

  // Periodic Auto-Save for time tracking and statistics
  useEffect(() => {
    if (!attemptId || loading || !attempt || attempt.status === 'completed') return;

    const autoSaveInterval = setInterval(async () => {
      try {
        await updateDoc(doc(db, 'attempts', attemptId), {
          timePerQuestion,
          status: 'in-progress'
        });
      } catch (err) {
        console.error("Implicit stats tick update missed:", err);
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [attemptId, loading, attempt, timePerQuestion]);

  const handleAnswer = async (optionValue: number | string | number[] | null) => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = optionValue;
    setAnswers(newAnswers);
    
    if (attemptId) {
      await syncAnswers(newAnswers, attemptId);
    }
  };

  const handleClearResponse = async () => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = null;
    setAnswers(newAnswers);

    if (attemptId) {
      await syncAnswers(newAnswers, attemptId);
    }
  };

  const handleMarkForReview = () => {
    const nextMarked = [...markedForReview];
    nextMarked[currentIndex] = true;
    setMarkedForReview(nextMarked);
    
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      toast.info("You are at the final item. Review response states or submit.");
    }
  };

  const handleSaveAndNext = () => {
    const nextMarked = [...markedForReview];
    nextMarked[currentIndex] = false;
    setMarkedForReview(nextMarked);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      toast.info("End of sequence. Complete exam or jump to target cards.");
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!attemptId || !exam || questions.length === 0 || !attempt) return;
    
    setIsSubmitConfirmOpen(false);

    // MODULE 3: Offline Safe-Wall Intercept
    if (!isOnline) {
      setOfflineAnswersSnapshot([...answers]);
      setShowOfflineWall(true);
      return;
    }
    
    setLoading(true);
    try {
      let score = 0;
      let correctCount = 0;
      const errorBookEntries: any[] = [];

      questions.forEach((q, idx) => {
        const studentAns = answers[idx];
        const qType = q.type || 'single';
        let isCorrect = false;

        if (qType === 'numerical') {
          isCorrect = studentAns !== null && studentAns !== undefined && 
                      String(studentAns).trim() === String(q.numericalAnswer || '').trim();
        } else if (qType === 'multiple') {
          if (Array.isArray(studentAns)) {
            isCorrect = studentAns.includes(q.correctAnswerIndex);
          } else {
            isCorrect = studentAns === q.correctAnswerIndex;
          }
        } else {
          isCorrect = studentAns === q.correctAnswerIndex;
        }

        if (isCorrect) {
          score += q.marks;
          correctCount++;
        } else if (studentAns !== null && studentAns !== undefined) {
          // Negative marking deduction (-1) for incorrect single or multiple choice MCQs
          if (qType !== 'numerical') {
            score = Math.max(0, score - 1);
          }
          
          errorBookEntries.push({
            studentId: attempt.studentId,
            examId: exam.id,
            questionId: q.id || idx.toString(),
            questionText: q.text,
            selectedAnswer: qType === 'numerical' ? String(studentAns) : (Array.isArray(studentAns) ? studentAns.join(', ') : studentAns),
            correctAnswer: qType === 'numerical' ? String(q.numericalAnswer) : q.correctAnswerIndex,
            subject: q.subject || exam.subject || 'General',
            explanation: q.explanation || "Review the step-by-step formula and solution logic.",
            createdAt: new Date().toISOString()
          });
        }
      });

      const accuracy = (correctCount / questions.length) * 100;
      const totalTimeSpent = Object.values(timePerQuestion).reduce((a, b) => a + b, 0);
      const avgTimePerCorrect = correctCount > 0 ? totalTimeSpent / correctCount : 0;

      try {
        await updateDoc(doc(db, 'attempts', attemptId), {
          score,
          accuracy,
          avgTimePerCorrect,
          status: 'completed',
          answers,
          timePerQuestion,
          endTime: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `attempts/${attemptId}`);
        return;
      }
      
      if (errorBookEntries.length > 0) {
        try {
          const batch = writeBatch(db);
          errorBookEntries.forEach(entry => {
            const ebRef = doc(collection(db, 'error_books'));
            batch.set(ebRef, entry);
          });
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'error_books');
          return;
        }
      }

      localStorage.removeItem(`exam_visited_${attemptId}`);
      localStorage.removeItem(`exam_review_${attemptId}`);
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4F46E5', '#3B82F6', '#10B981', '#F59E0B']
      });

      toast.success("Exam finalization sequence complete.");
      setTimeout(() => navigate(`/result/${attemptId}`), 2000);
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit exam");
    } finally {
      setLoading(false);
    }
  }, [attemptId, exam, questions, answers, navigate, timePerQuestion, attempt]);

  const lastViolationRef = React.useRef<number>(0);

  useEffect(() => {
    // Sync initial state
    setIsFullscreen(!!document.fullscreenElement);

    const handleViolationTrigger = async (eventType: string, eventDetail: string) => {
      if (loading || !attempt || attempt.status !== 'started' && attempt.status !== 'in-progress' || !attemptId) return;
      
      const now = Date.now();
      if (now - lastViolationRef.current < 3000) {
        return;
      }
      lastViolationRef.current = now;

      const newCount = violationsCount + 1;
      setViolationsCount(newCount);

      try {
        await updateDoc(doc(db, 'attempts', attemptId), { 
          violationsCount: newCount 
        });
      } catch (err) {
        console.error("Error updates:", err);
      }

      if (newCount === 1) {
        setIsWarningModalOpen(true);
        toast.error(`SECURITY WARNING: ${eventDetail} (Violation 1 of 2 logged).`, {
          icon: <ShieldAlert className="h-5 w-5 text-red-600" />,
          duration: 6000,
        });
        await logProctorAnomaly(eventType, `First level warning: ${eventDetail}`);
      } else if (newCount >= 2) {
        toast.error(`CRITICAL SECURITY ALERT: ${eventDetail} (Violation ${newCount}). FORCING SUBMISSION.`);
        await logProctorAnomaly(eventType + '_force_submit', `Force-submitted owing to multiple violations: ${eventDetail}`);
        handleSubmit();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolationTrigger('tab_switch', 'Tab switched or browser minimized');
      }
    };
    
    const handleBlur = () => {
      if (!document.hidden && !isWarningModalOpen) {
        handleViolationTrigger('blur', 'Active window/screen focus lost');
      }
    };

    const handleFullscreenChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);
      if (!isFS && !loading && attempt && (attempt?.status === 'started' || attempt?.status === 'in-progress')) {
        handleViolationTrigger('fullscreen_exit', 'Student exited secure full-screen mode');
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [loading, attempt, attemptId, violationsCount, isWarningModalOpen, handleSubmit, logProctorAnomaly]);

  useEffect(() => {
    if (!attempt || attempt.status === 'completed' || loading) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast.warning("PROCTOR ALERT: Right-click menu is locked on the exam portal.", {
        icon: <ShieldAlert className="h-4 w-4 text-orange-500" />
      });
      logProctorAnomaly('right_click', 'Student triggered context menu right-click');
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.warning("PROCTOR ALERT: Copying text is strictly restricted during live testing.", {
        icon: <ShieldAlert className="h-4 w-4 text-red-500" />
      });
      logProctorAnomaly('copy_blocked', 'Student attempted to copy questions/options text');
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.warning("PROCTOR ALERT: Cutting text is strictly restricted during live testing.", {
        icon: <ShieldAlert className="h-4 w-4 text-red-500" />
      });
      logProctorAnomaly('cut_blocked', 'Student attempted to cut exam content');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.warning("PROCTOR ALERT: Pasting from clipboard is disabled.", {
        icon: <ShieldAlert className="h-4 w-4 text-red-500" />
      });
      logProctorAnomaly('paste_blocked', 'Student attempted to paste into on-screen fields');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.key === 'Snapshot' || e.keyCode === 44) {
        e.preventDefault();
        toast.error("PROCTOR ALERT: PrintScreen capture is prohibited.", {
          icon: <ShieldAlert className="h-5 w-5 text-red-650" />
        });
        logProctorAnomaly('print_screen', 'Student pressed PrintScreen/Snapshot shortcut key');
      }

      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'p', 's', 'r', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        toast.error(`PROCTOR ALERT: Command shortcut (Ctrl/Cmd + ${e.key.toUpperCase()}) is blocked.`, {
          icon: <ShieldAlert className="h-5 w-5 text-red-650" />
        });
        logProctorAnomaly('shortcut_blocked', `Student triggered blocked keyboard combination: Ctrl/Cmd + ${e.key.toUpperCase()}`);
      }
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopy as any);
    window.addEventListener('cut', handleCut as any);
    window.addEventListener('paste', handlePaste as any);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('selectstart', handleSelectStart);

    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopy as any);
      window.removeEventListener('cut', handleCut as any);
      window.removeEventListener('paste', handlePaste as any);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('selectstart', handleSelectStart);
      document.body.style.userSelect = 'auto';
      document.body.style.webkitUserSelect = 'auto';
    };
  }, [attempt, loading, logProctorAnomaly]);

  useEffect(() => {
    if (!exam || !attempt || attempt.status === 'completed' || loading) return;

    // 1. Freeze timer tick completely if admin triggered an active Emergency Pause
    if (isPaused) return;

    const startTime = new Date(attempt.startTime).getTime();
    // 2. Compute dynamic time bounds: base duration + school-allocated extraTime minutes
    const durationMs = (exam.duration + extraTime) * 60 * 1000;
    const endTime = startTime + durationMs;

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(remaining);

      setTimePerQuestion(prev => ({
        ...prev,
        [currentIndex]: (prev[currentIndex] || 0) + 1
      }));

      // 3. Auto-submit when time has fully run out
      if (remaining <= 0) {
        clearInterval(timer);
        handleSubmit();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [exam, attempt, loading, handleSubmit, currentIndex, isPaused, extraTime]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getStatusCounts = () => {
    let answered = 0;
    let notAnswered = 0;
    let markedReview = 0;
    let answeredMarkedReview = 0;
    let notVisited = 0;

    questions.forEach((_, i) => {
      const isMarked = markedForReview[i];
      const isAns = answers[i] !== null && answers[i] !== undefined;
      const isVis = visited[i];

      if (isMarked) {
        if (isAns) answeredMarkedReview++;
        else markedReview++;
      } else if (isAns) {
        answered++;
      } else if (isVis) {
        notAnswered++;
      } else {
        notVisited++;
      }
    });

    return { answered, notAnswered, markedReview, answeredMarkedReview, notVisited };
  };

  if (loading && !attempt) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 font-medium animate-pulse">Syncing with Secure Servers...</p>
    </div>
  );
  
  if (!exam || questions.length === 0 || !attempt) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        No questions or attempt node loaded.
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const counts = getStatusCounts();

  // Dynamic segments/subject lists derived directly from the test questions
  const uniqueSubjects = Array.from(new Set(questions.map(q => q.subject || exam.subject || 'General')));
  const currentSubject = currentQuestion?.subject || exam.subject || 'General';

  const jumpToSubject = (subjectName: string) => {
    const idx = questions.findIndex(q => (q.subject || exam.subject || 'General') === subjectName);
    if (idx !== -1) {
      setCurrentIndex(idx);
    } else {
      toast.error(`No questions found in segment: ${subjectName}`);
    }
  };

  const handleCheckboxToggle = async (optionIdx: number) => {
    const currentSelection = Array.isArray(answers[currentIndex])
      ? (answers[currentIndex] as number[])
      : (answers[currentIndex] !== null ? [Number(answers[currentIndex])] : []);

    let nextSelection: number[];
    if (currentSelection.includes(optionIdx)) {
      nextSelection = currentSelection.filter(x => x !== optionIdx);
    } else {
      nextSelection = [...currentSelection, optionIdx].sort();
    }

    const newAnswers = [...answers];
    newAnswers[currentIndex] = nextSelection.length > 0 ? nextSelection : null;
    setAnswers(newAnswers);

    if (attemptId) {
      await syncAnswers(newAnswers, attemptId);
    }
  };

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        toast.error("Could not activate full-screen mode. Please click to allow permissions.");
        console.error(err);
      });
    } else {
      setIsFullscreen(true); // Fallback for unsupported browsers
    }
  };

  if (!isFullscreen && !loading && attempt && attempt.status !== 'completed') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-[32px] space-y-6 shadow-2xl"
        >
          <div className="p-4 bg-rose-500/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto text-rose-500 border border-rose-500/20">
            <ShieldAlert size={40} className="text-rose-500 animate-pulse" />
          </div>
          <div className="space-y-2">
            <Badge className="bg-rose-500/20 text-rose-400 font-bold tracking-wider text-[10px] uppercase">Proctor Lockout Active</Badge>
            <h2 className="text-2xl font-display font-black tracking-tight text-white">Secure Examination Mode</h2>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              This digital assessment is fully proctored under secure national guidelines. You must enter and maintain full-screen mode to proceed. Switching tabs, losing focus, or exiting full-screen is logged as a security infraction.
            </p>
          </div>
          <Button 
            onClick={enterFullscreen}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase tracking-wider text-xs border-b-4 border-indigo-800 active:border-b-0 transition-all cursor-pointer shadow-lg shadow-indigo-500/20"
          >
            Enter Secure Exam Mode (Fullscreen)
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4">
      {/* EMERGENCY PAUSE OVERLAY GATE */}
      {isPaused && (
        <div className="fixed inset-0 bg-slate-950/90 z-[9999] backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="text-center space-y-6 max-w-md p-8 bg-slate-900 border border-slate-800 rounded-[32px] shadow-2xl">
            <div className="h-20 w-20 bg-amber-500/10 border border-amber-450 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
              <PauseCircle className="h-10 w-10 text-amber-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight text-white font-display">Assessment Session Paused</h2>
              <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                The institutional administration has triggered an emergency pause. Your answers are safe, and your countdown clock has been locked at {formatTime(timeLeft)}.
              </p>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl font-sans">
              <span className="text-[10px] tracking-wider font-extrabold uppercase text-[#FFE28A] block font-mono">
                System Signal Locked &bull; Synced
              </span>
              <p className="text-[10px] text-slate-500 mt-1">
                Your remaining seconds will resume immediately when the administrator lifts the pause.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE SUBMISSION SAFE-WALL BLOCK */}
      {showOfflineWall && (
        <OfflineSubmissionSafeWall
          answers={offlineAnswersSnapshot}
          studentId={attempt.studentId}
          studentName={attempt.studentName}
          examId={exam.id}
          examTitle={exam.title}
          isOnline={isOnline}
          onOnlineSubmit={handleSubmit}
        />
      )}

      {/* Security alert header */}
      {violationsCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl flex items-center justify-center gap-2 text-rose-600 text-[10px] font-black uppercase tracking-widest animate-bounce">
          <ShieldAlert size={14} />
          Lockout Warning: {violationsCount} of 3 Security Violations Logged
        </div>
      )}

      {/* Control Navigation Header */}
      <div className="flex items-center justify-between sticky top-4 z-30 bg-white/85 backdrop-blur-xl py-4 px-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-indigo-600">Narayana E-Exam Platform</span>
          <h1 className="text-xl font-display font-black text-slate-950 tracking-tight leading-none mt-1">{exam.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono font-bold text-sm ${timeLeft < 600 ? 'bg-rose-600 text-white animate-bounce shadow-lg border-2 border-rose-300' : 'bg-slate-900 text-white shadow-lg'}`}>
             <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
          </span>
          <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 px-8 h-12 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 border-b-4 border-emerald-800 active:border-b-0 transition-all text-white border-0 cursor-pointer" onClick={() => setIsSubmitConfirmOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Finish Assessment
          </Button>
        </div>
      </div>

      {/* Narayana Segment Tabs for Subjects */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0 mr-2">Subject Segments:</span>
        {uniqueSubjects.map((sub) => (
          <button
            key={sub}
            onClick={() => jumpToSubject(sub)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${sub === currentSubject ? 'bg-indigo-600 text-white border-indigo-750 shadow-md shadow-indigo-100' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            {sub} Segment ({questions.filter(q => (q.subject || exam.subject || 'General') === sub).length})
          </button>
        ))}
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Question Board */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white/50 relative h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="absolute left-0 top-0 h-full bg-indigo-600"
            />
          </div>

          <Card className="shadow-2xl shadow-slate-200/70 border-0 rounded-[32px] overflow-hidden bg-white">
            <div className="bg-slate-900 px-8 py-5 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                    {currentIndex + 1}
                  </span>
                  <span className="text-white font-display font-bold text-sm">Question {currentIndex + 1} of {questions.length} ({currentSubject})</span>
               </div>
               <div className="flex items-center gap-4">
                  <span className="bg-indigo-505/10 bg-white/10 px-3 py-1 rounded-md text-[10px] font-black text-white uppercase tracking-widest">
                    Type: {currentQuestion.type || 'single'} MCQ (+{currentQuestion.marks}M)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">ELAPSED: {formatTime(timePerQuestion[currentIndex] || 0)}</span>
               </div>
            </div>
            
            <CardContent className="p-8 space-y-6 bg-white min-h-[300px]">
              {/* Dynamic Staggered Asset Lazy-Loader */}
              {(currentQuestion?.imageUrl || currentQuestion?.audioUrl) ? (
                <div className="mb-4 animate-in fade-in duration-300">
                  <LazyExamAsset 
                    src={currentQuestion.imageUrl || currentQuestion.audioUrl || ""} 
                    type={currentQuestion.audioUrl ? 'audio' : 'image'} 
                    isActive={true} 
                  />
                </div>
              ) : (
                currentSubject === 'Languages' && (
                  <div className="mb-4 animate-in fade-in duration-300">
                    <LazyExamAsset 
                      src="https://actions.google.com/sounds/v1/ambiences/morning_birds.ogg" 
                      type="audio" 
                      isActive={true} 
                    />
                  </div>
                )
              )}

              <h3 className="text-slate-800 text-xl font-display font-black leading-relaxed">{currentQuestion.text}</h3>

              {/* Dynamic Answer Components / Subject Modules */}
              {currentSubject === 'Computer Science' ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <EmbeddedCodeEditor 
                    value={answers[currentIndex] !== null && answers[currentIndex] !== undefined ? String(answers[currentIndex]) : ""}
                    onChange={(val) => handleAnswer(val)}
                    questionId={currentQuestion?.id || currentIndex.toString()}
                  />
                </div>
              ) : (currentSubject === 'Languages' || currentSubject === 'Literature') ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <RichTextKeyboardEditor 
                    value={answers[currentIndex] !== null && answers[currentIndex] !== undefined ? String(answers[currentIndex]) : ""}
                    onChange={(val) => handleAnswer(val)}
                  />
                </div>
              ) : currentQuestion.type === 'math' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="p-4 bg-white border border-slate-200 rounded-3xl max-w-3xl mx-auto text-left">
                    <MathInputToolbar 
                      value={answers[currentIndex] !== null && answers[currentIndex] !== undefined ? String(answers[currentIndex]) : ""}
                      onChange={(val) => handleAnswer(val)}
                      placeholder="Type your equations (e.g. \int_0^\pi \sin(x) dx) or use the quick key buttons..."
                      inputId="live-exam-math-editor"
                      isTextArea={true}
                    />
                  </div>
                </div>
              ) : currentQuestion.type === 'numerical' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                   <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-205 rounded-2xl max-w-sm mx-auto">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">On-Screen Keypad Entry</span>
                      <input
                         type="text"
                         value={answers[currentIndex] !== null && answers[currentIndex] !== undefined ? String(answers[currentIndex]) : ""}
                         readOnly
                         placeholder="NOT ANSWERED"
                         className="w-full text-center font-mono text-3xl font-black bg-white py-4 px-6 border-2 border-indigo-600 rounded-2xl text-indigo-950 focus:outline-none"
                      />
                   </div>
                   
                   <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto bg-slate-100 p-4 rounded-3xl border border-slate-200">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', '.'].map(key => (
                         <button
                            key={key}
                            type="button"
                            onClick={() => {
                               const currentVal = answers[currentIndex] !== null && answers[currentIndex] !== undefined
                                  ? String(answers[currentIndex])
                                  : "";
                               if (currentVal.length < 12) {
                                  handleAnswer(currentVal + key);
                               }
                            }}
                            className="h-12 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-mono text-lg font-bold text-slate-800 transition-colors shadow-sm active:scale-95 cursor-pointer"
                         >
                            {key}
                         </button>
                      ))}
                      <button
                         type="button"
                         onClick={() => {
                            const currentVal = answers[currentIndex] !== null && answers[currentIndex] !== undefined
                               ? String(answers[currentIndex])
                               : "";
                            if (currentVal.length > 0) {
                               handleAnswer(currentVal.slice(0, -1));
                            } else {
                               handleAnswer(null);
                            }
                         }}
                         className="col-span-1 h-12 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 rounded-xl font-bold transition-colors shadow-sm active:scale-95 text-xs uppercase cursor-pointer"
                      >
                         BkSp
                      </button>
                      <button
                         type="button"
                         onClick={handleClearResponse}
                         className="col-span-2 h-12 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black transition-all shadow-md active:scale-95 text-xs uppercase tracking-wider border-none cursor-pointer"
                      >
                         Clear Value
                      </button>
                   </div>
                </div>
              ) : currentQuestion.type === 'multiple' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 pt-2 animate-in fade-in duration-300">
                     {(currentQuestion.options || []).map((opt, i) => {
                        const isSelected = Array.isArray(answers[currentIndex]) 
                           ? (answers[currentIndex] as number[]).includes(i)
                           : answers[currentIndex] === i;

                        return (
                           <button
                             key={i}
                             type="button"
                             onClick={() => handleCheckboxToggle(i)}
                             className={`group relative p-6 rounded-2xl border-2 text-left transition-all hover:scale-[1.005] active:scale-[0.99] cursor-pointer ${isSelected ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-100' : 'border-slate-100 hover:border-indigo-200 bg-white'}`}
                           >
                             <div className="flex items-center gap-5">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-400 rotate-12' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-400'}`}>
                                   {String.fromCharCode(65 + i)}
                                </div>
                                <span className={`text-lg transition-colors ${isSelected ? 'text-indigo-950 font-bold' : 'text-slate-600'}`}>{opt}</span>
                             </div>
                             <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                <input type="checkbox" checked={isSelected} readOnly className="pointer-events-none rounded border-slate-300 text-indigo-600" />
                             </div>
                           </button>
                        );
                     })}
                  </div>
                  {currentSubject === 'Chemistry' && (
                    <div className="mt-8 pt-6 border-t border-slate-100 animate-in slide-in-from-bottom-2 duration-300">
                      <PeriodicTableHelper 
                        onInsertSymbol={(sym) => {
                          const currentVal = answers[currentIndex] !== null && answers[currentIndex] !== undefined ? String(answers[currentIndex]) : "";
                          handleAnswer(currentVal + sym);
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 pt-2 animate-in fade-in duration-300">
                     {(currentQuestion.options || []).map((opt, i) => (
                       <button
                         key={i}
                         type="button"
                         onClick={() => handleAnswer(i)}
                         className={`group relative p-6 rounded-2xl border-2 text-left transition-all hover:scale-[1.005] active:scale-[0.99] cursor-pointer ${answers[currentIndex] === i ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-100' : 'border-slate-100 hover:border-indigo-200 bg-white'}`}
                       >
                         <div className="flex items-center gap-5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${answers[currentIndex] === i ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-400 rotate-12' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-400'}`}>
                               {String.fromCharCode(65 + i)}
                            </div>
                            <span className={`text-lg transition-colors ${answers[currentIndex] === i ? 'text-indigo-950 font-bold' : 'text-slate-600'}`}>{opt}</span>
                         </div>
                         {answers[currentIndex] === i && (
                           <div className="absolute right-6 top-1/2 -translate-y-1/2">
                             <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                           </div>
                         )}
                       </button>
                     ))}
                  </div>
                  {currentSubject === 'Chemistry' && (
                    <div className="mt-8 pt-6 border-t border-slate-100 animate-in slide-in-from-bottom-2 duration-300">
                      <PeriodicTableHelper 
                        onInsertSymbol={(sym) => {
                          const currentVal = answers[currentIndex] !== null && answers[currentIndex] !== undefined ? String(answers[currentIndex]) : "";
                          handleAnswer(currentVal + sym);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border-t border-slate-100 px-8 py-5">
               <div className="flex items-center gap-2">
                  <Button variant="ghost" className="h-12 px-6 rounded-xl font-bold text-slate-400 hover:text-slate-900 cursor-pointer" disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-2" /> Prev
                  </Button>
                  <Button variant="outline" className="h-12 px-5 rounded-xl font-bold text-rose-600 border-rose-200 hover:bg-rose-50 cursor-pointer" onClick={handleClearResponse}>
                    Clear Response
                  </Button>
               </div>
               <div className="flex items-center gap-2">
                  <Button className="h-12 px-5 rounded-xl font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-100 border-none cursor-pointer" onClick={handleMarkForReview}>
                     Mark for Review & Next
                  </Button>
                  <Button className="h-12 px-6 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 border-none cursor-pointer" onClick={handleSaveAndNext}>
                     Save & Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
               </div>
            </CardFooter>
          </Card>
        </div>

        {/* Right Side: Command Board & Interactive Palette */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Student details */}
          <Card className="border border-slate-100 rounded-[24px] shadow-sm bg-white overflow-hidden">
             <div className="p-5 flex items-center gap-4 border-b border-slate-100 bg-slate-50/50">
                <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg">
                   {attempt.studentName ? attempt.studentName.slice(0, 2).toUpperCase() : 'ST'}
                </div>
                <div>
                   <p className="text-sm font-black text-slate-800 leading-tight">{attempt.studentName}</p>
                   <p className="text-[10px] text-slate-400 font-mono mt-0.5">{attempt.studentEmail || "Verified Onboard ID"}</p>
                </div>
             </div>
          </Card>

          {/* Color Mapping Legend */}
          <Card className="border border-slate-100 rounded-3xl p-5 bg-white space-y-4 shadow-sm">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Legend Status Map</h4>
             <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5">
                   <span className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                     {counts.answered}
                   </span>
                   <span className="text-[9px] font-bold text-slate-600 uppercase">Answered</span>
                </div>
                <div className="flex items-center gap-2.5">
                   <span className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                     {counts.notAnswered}
                   </span>
                   <span className="text-[9px] font-bold text-slate-600 uppercase">Not Ans</span>
                </div>
                <div className="flex items-center gap-2.5 col-span-2">
                   <span className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                     {counts.markedReview}
                   </span>
                   <span className="text-[9px] font-bold text-slate-600 uppercase">Marked for Review</span>
                </div>
                <div className="flex items-center gap-2.5 col-span-2">
                   <span className="w-8 h-8 rounded-lg bg-indigo-900 border border-emerald-400 text-white flex items-center justify-center font-black text-xs relative shadow-sm">
                     {counts.answeredMarkedReview}
                     <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 border border-white" />
                   </span>
                   <span className="text-[9px] font-bold text-slate-655 uppercase leading-none">Ans & Marked for Review</span>
                </div>
                <div className="flex items-center gap-2.5 col-span-2">
                   <span className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center font-black text-xs border border-slate-200">
                     {counts.notVisited}
                   </span>
                   <span className="text-[9px] font-bold text-slate-600 uppercase">Not Visited</span>
                </div>
             </div>
          </Card>

          {/* Interactive Question Board Palette */}
          <Card className="border border-slate-100 rounded-3xl p-6 bg-white space-y-4 shadow-sm">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Interactive Question Grid</h4>
             <div className="grid grid-cols-5 gap-2.5 justify-items-center">
                {questions.map((_, i) => {
                   const isMarked = markedForReview[i];
                   const isAns = answers[i] !== null && answers[i] !== undefined;
                   const isVis = visited[i];
                   
                   let statusClass = "bg-slate-50 text-slate-450 border border-slate-150 hover:bg-slate-100 cursor-pointer";
                   let badgeDot = false;
                   
                   if (isMarked) {
                      if (isAns) {
                         statusClass = "bg-indigo-900 text-white border border-emerald-400 font-bold shadow-md relative cursor-pointer";
                         badgeDot = true;
                      } else {
                         statusClass = "bg-violet-600 text-white font-bold shadow-md cursor-pointer";
                      }
                   } else if (isAns) {
                      statusClass = "bg-emerald-500 text-white font-bold shadow-md cursor-pointer";
                   } else if (isVis) {
                      statusClass = "bg-rose-500 text-white font-bold shadow-md cursor-pointer";
                   }
                   
                   if (currentIndex === i) {
                      statusClass += " ring-4 ring-indigo-500 ring-offset-2 scale-110 z-10 font-black";
                   }

                   return (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        className={`w-11 h-11 rounded-xl text-xs font-black flex items-center justify-center transition-all ${statusClass}`}
                      >
                        {i + 1}
                        {badgeDot && (
                          <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                   );
                })}
             </div>
          </Card>

          {/* Secure Live Video Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-5 shadow-xl overflow-hidden">
             <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                   <span className="text-[9px] font-black text-white uppercase tracking-wider">Live Video Stream</span>
                </div>
                <span className="text-[8px] font-mono text-emerald-400 uppercase animate-pulse">Proctor Active</span>
             </div>
             <div className="aspect-video bg-black rounded-xl relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="text-[8px] font-mono text-emerald-400 absolute top-2 left-2">REC ● 1080P</div>
                <ShieldAlert size={28} className="text-white/20 animate-pulse" />
                <div className="absolute inset-3 border border-dashed border-emerald-500/20 rounded-full animate-pulse" />
             </div>
             <div className="space-y-2 mt-3 text-[9px]">
                <div className="flex items-center justify-between text-slate-400">
                   <span>BIOMETRIC FOCUS</span>
                   <span className="text-emerald-400 font-bold">98% MATCH</span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-400 w-[98%]" />
                </div>
             </div>
          </div>

        </div>
      </div>

      <Dialog open={isSubmitConfirmOpen} onOpenChange={setIsSubmitConfirmOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl border-0 shadow-2xl">
          <DialogHeader>
            <div className="mx-auto w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-6 border border-indigo-100">
               <HelpCircle className="h-10 w-10 text-indigo-600" />
            </div>
            <DialogTitle className="text-center text-2xl font-display font-black tracking-tight">Final Submission</DialogTitle>
            <DialogDescription className="text-center text-slate-500 font-medium pt-2">
              You have completed {answers.filter(a => a !== null).length} out of {questions.length} responses. Are you ready to transmit your final exam data to the valuation core?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-4 mt-8">
            <Button variant="outline" className="h-12 rounded-xl font-bold border-slate-200 cursor-pointer" onClick={() => setIsSubmitConfirmOpen(false)} disabled={loading}>
              Return
            </Button>
            <Button className="h-12 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 text-white border-none cursor-pointer" onClick={handleSubmit} disabled={loading}>
              {loading ? "Transmitting..." : "Confirm & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWarningModalOpen} onOpenChange={(open) => {
        if (!open) return;
        setIsWarningModalOpen(open);
      }}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl border-4 border-rose-500 shadow-2xl p-6 select-none">
          <DialogHeader>
            <div className="mx-auto w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mb-4 border border-rose-100 animate-pulse">
               <ShieldAlert className="h-10 w-10 text-rose-600" />
            </div>
            <DialogTitle className="text-center text-2xl font-display font-black tracking-tight text-rose-850 uppercase">PROCTOR WARNING OVERLAY</DialogTitle>
            <DialogDescription className="text-center text-slate-700 font-bold pt-3 leading-relaxed">
              Active window focus loss or browser tab switch detected.
              <br/>
              <span className="text-rose-600 font-black underline">This is Violation 1 of 2 logged.</span>
              <br/><br/>
              According to the strict security rules of the Online Examination core, any subsequent screen deviations or tab switching will trigger 
              <span className="text-red-700 font-black"> immediate automatic exam submission</span> with the current answers.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 text-[11px] font-bold text-slate-500 leading-relaxed text-center my-2">
             🔒 Proctor monitoring is active. Do not touch keyboard combinations, minimize, right-click, or leave full-screen mode.
          </div>
          <DialogFooter className="mt-6">
            <Button 
              className="w-full h-12 rounded-xl font-black bg-slate-900 hover:bg-rose-600 text-white shadow-xl transition-all border-none cursor-pointer uppercase tracking-wider text-xs" 
              onClick={() => setIsWarningModalOpen(false)}
            >
              I Understand, Resume Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Free-hand drawing whiteboard rough tool */}
      {(currentSubject === 'Mathematics' || currentSubject === 'Physics') && (
        <ScratchpadCanvas />
      )}
    </div>
  );
};

export const ExamInterface: React.FC = () => {
  return (
    <ExamSyncProvider>
      <ExamInterfaceCore />
    </ExamSyncProvider>
  );
};
