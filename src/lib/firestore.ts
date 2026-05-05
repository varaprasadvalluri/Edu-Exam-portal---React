// ============================================================
// FIRESTORE DATABASE OPERATIONS
// ============================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  increment,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser, Exam, Question, ExamAttempt, Result, ClassLevel } from '@/types';

// ─── COLLECTION NAMES ──────────────────────────────────────
export const COLLECTIONS = {
  USERS: 'users',
  EXAMS: 'exams',
  QUESTIONS: 'questions',
  ATTEMPTS: 'attempts',
  RESULTS: 'results',
  SCHOOLS: 'schools',
} as const;

// ─── UTILITY ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serializeDoc = <T>(data: Record<string, any>): T => {
  const serialized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      serialized[key] = value.toDate().toISOString();
    } else {
      serialized[key] = value;
    }
  }
  return serialized as T;
};

// ─── USER OPERATIONS ───────────────────────────────────────
export const createUserProfile = async (uid: string, data: Partial<AppUser>) => {
  const ref = doc(db, COLLECTIONS.USERS, uid);
  const now = new Date().toISOString();
  await setDoc(ref, {
    ...data,
    uid,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
};

export const getSchools = async (): Promise<{ id: string; name: string }[]> => {
  const snap = await getDocs(collection(db, COLLECTIONS.SCHOOLS));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
};

export const getUserProfile = async (uid: string): Promise<AppUser | null> => {
  const ref = doc(db, COLLECTIONS.USERS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return serializeDoc<AppUser>({ id: snap.id, ...snap.data() });
};

export const updateUserProfile = async (uid: string, data: Partial<AppUser>) => {
  const ref = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() });
};

export const getAllStudents = async (): Promise<AppUser[]> => {
  const q = query(
    collection(db, COLLECTIONS.USERS),
    where('role', '==', 'student')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => serializeDoc<AppUser>({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
};

export const deleteUser = async (uid: string) => {
  await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
};

// ─── EXAM OPERATIONS ───────────────────────────────────────
export const createExam = async (data: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, COLLECTIONS.EXAMS), {
    ...data,
    questionCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
};

export const getExam = async (id: string): Promise<Exam | null> => {
  const snap = await getDoc(doc(db, COLLECTIONS.EXAMS, id));
  if (!snap.exists()) return null;
  return serializeDoc<Exam>({ id: snap.id, ...snap.data() });
};

export const getExams = async (classLevel?: ClassLevel, schoolId?: string): Promise<Exam[]> => {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (classLevel) constraints.unshift(where('classLevel', '==', classLevel));
  if (schoolId) constraints.unshift(where('schoolId', '==', schoolId));
  const q = query(collection(db, COLLECTIONS.EXAMS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => serializeDoc<Exam>({ id: d.id, ...d.data() }));
};

export const getPublishedExams = async (classLevel: ClassLevel, schoolId?: string): Promise<Exam[]> => {
  const constraints: QueryConstraint[] = [where('classLevel', '==', classLevel), where('isPublished', '==', true), orderBy('startTime', 'desc')];
  if (schoolId) constraints.unshift(where('schoolId', '==', schoolId));
  const q = query(collection(db, COLLECTIONS.EXAMS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => serializeDoc<Exam>({ id: d.id, ...d.data() }));
};

export const updateExam = async (id: string, data: Partial<Exam>) => {
  await updateDoc(doc(db, COLLECTIONS.EXAMS, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteExam = async (id: string) => {
  // Delete all questions for this exam first
  const q = query(collection(db, COLLECTIONS.QUESTIONS), where('examId', '==', id));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, COLLECTIONS.EXAMS, id));
  await batch.commit();
};

// ─── QUESTION OPERATIONS ───────────────────────────────────
export const addQuestion = async (data: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, COLLECTIONS.QUESTIONS), {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  // Update exam question count and total marks
  await updateDoc(doc(db, COLLECTIONS.EXAMS, data.examId), {
    questionCount: increment(1),
    totalMarks: increment(data.marks),
    updatedAt: now,
  });
  return ref.id;
};

export const getExamQuestions = async (examId: string): Promise<Question[]> => {
  const q = query(
    collection(db, COLLECTIONS.QUESTIONS),
    where('examId', '==', examId),
    orderBy('order', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => serializeDoc<Question>({ id: d.id, ...d.data() }));
};

export const updateQuestion = async (id: string, data: Partial<Question>) => {
  await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteQuestion = async (id: string, examId: string, marks: number) => {
  await deleteDoc(doc(db, COLLECTIONS.QUESTIONS, id));
  await updateDoc(doc(db, COLLECTIONS.EXAMS, examId), {
    questionCount: increment(-1),
    totalMarks: increment(-marks),
    updatedAt: new Date().toISOString(),
  });
};

export const reorderQuestions = async (questions: { id: string; order: number }[]) => {
  const batch = writeBatch(db);
  questions.forEach(({ id, order }) => {
    batch.update(doc(db, COLLECTIONS.QUESTIONS, id), { order });
  });
  await batch.commit();
};

// ─── ATTEMPT OPERATIONS ────────────────────────────────────
export const createAttempt = async (data: Omit<ExamAttempt, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, COLLECTIONS.ATTEMPTS), {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
};

export const getAttempt = async (id: string): Promise<ExamAttempt | null> => {
  const snap = await getDoc(doc(db, COLLECTIONS.ATTEMPTS, id));
  if (!snap.exists()) return null;
  return serializeDoc<ExamAttempt>({ id: snap.id, ...snap.data() });
};

export const getStudentAttemptForExam = async (
  studentId: string,
  examId: string
): Promise<ExamAttempt | null> => {
  const q = query(
    collection(db, COLLECTIONS.ATTEMPTS),
    where('studentId', '==', studentId),
    where('examId', '==', examId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return serializeDoc<ExamAttempt>({ id: snap.docs[0].id, ...snap.docs[0].data() });
};

export const updateAttempt = async (id: string, data: Partial<ExamAttempt>) => {
  await updateDoc(doc(db, COLLECTIONS.ATTEMPTS, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
};

export const getExamAttempts = async (examId: string): Promise<ExamAttempt[]> => {
  const q = query(
    collection(db, COLLECTIONS.ATTEMPTS),
    where('examId', '==', examId),
    where('status', '==', 'submitted'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => serializeDoc<ExamAttempt>({ id: d.id, ...d.data() }));
};

// ─── RESULT OPERATIONS ─────────────────────────────────────
export const createResult = async (data: Omit<Result, 'id'>): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTIONS.RESULTS), data);
  return ref.id;
};

export const getResult = async (attemptId: string): Promise<Result | null> => {
  const q = query(
    collection(db, COLLECTIONS.RESULTS),
    where('attemptId', '==', attemptId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return serializeDoc<Result>({ id: snap.docs[0].id, ...snap.docs[0].data() });
};

export const getStudentResults = async (studentId: string): Promise<Result[]> => {
  const q = query(
    collection(db, COLLECTIONS.RESULTS),
    where('studentId', '==', studentId),
    orderBy('submittedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => serializeDoc<Result>({ id: d.id, ...d.data() }));
};

export const getAllResults = async (schoolId?: string): Promise<Result[]> => {
  const constraints: QueryConstraint[] = [orderBy('submittedAt', 'desc'), limit(100)];
  if (schoolId) constraints.unshift(where('schoolId', '==', schoolId));
  const q = query(collection(db, COLLECTIONS.RESULTS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => serializeDoc<Result>({ id: d.id, ...d.data() }));
};

// ─── EVALUATION ENGINE ─────────────────────────────────────
export const evaluateAndSaveResult = async (
  attempt: ExamAttempt,
  questions: Question[]
): Promise<Result> => {
  const exam = await getExam(attempt.examId);
  if (!exam) throw new Error('Exam not found');

  let obtainedMarks = 0;
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let skippedAnswers = 0;

  for (const question of questions) {
    const answer = attempt.answers[question.id];
    if (!answer || !answer.isAnswered) {
      skippedAnswers++;
      continue;
    }

    if (question.type === 'text') {
      // Simple text comparison (case-insensitive, trimmed)
      const correctText = question.correctAnswers[0]?.toLowerCase().trim();
      const givenText = answer.selectedOptions[0]?.toLowerCase().trim();
      if (correctText && givenText === correctText) {
        obtainedMarks += question.marks;
        correctAnswers++;
      } else {
        wrongAnswers++;
      }
    } else {
      // Single/Multiple choice - check if selected options match correct options
      const selected = new Set(answer.selectedOptions);
      const correct = new Set(question.correctAnswers);
      const isCorrect =
        selected.size === correct.size &&
        [...selected].every(s => correct.has(s));
      if (isCorrect) {
        obtainedMarks += question.marks;
        correctAnswers++;
      } else {
        wrongAnswers++;
      }
    }
  }

  const percentage = exam.totalMarks > 0
    ? Math.round((obtainedMarks / exam.totalMarks) * 100)
    : 0;
  const passed = obtainedMarks >= exam.passingMarks;

  const result: Omit<Result, 'id'> = {
    attemptId: attempt.id,
    examId: attempt.examId,
    examTitle: exam.title,
    studentId: attempt.studentId,
    studentName: attempt.studentName,
    classLevel: attempt.classLevel,
    totalMarks: exam.totalMarks,
    obtainedMarks,
    percentage,
    passed,
    correctAnswers,
    wrongAnswers,
    skippedAnswers,
    timeSpent: attempt.timeSpent,
    submittedAt: attempt.submitTime || new Date().toISOString(),
  };

  const resultId = await createResult(result);

  // Update attempt with score
  await updateAttempt(attempt.id, {
    status: 'evaluated',
    score: obtainedMarks,
    percentage,
    passed,
  });

  return { ...result, id: resultId };
};
