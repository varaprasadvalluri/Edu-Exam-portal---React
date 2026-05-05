// ============================================================
// APPLICATION TYPE DEFINITIONS
// ============================================================

export type UserRole = 'admin' | 'student';

export type ClassLevel =
  | 'Play School'
  | 'Nursery'
  | 'KG-1'
  | 'KG-2'
  | 'Class 1'
  | 'Class 2'
  | 'Class 3'
  | 'Class 4'
  | 'Class 5'
  | 'Class 6'
  | 'Class 7'
  | 'Class 8'
  | 'Class 9'
  | 'Class 10';

export const CLASS_LEVELS: ClassLevel[] = [
  'Play School',
  'Nursery',
  'KG-1',
  'KG-2',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
];

export type QuestionType = 'single' | 'multiple' | 'text';

export interface Option {
  id: string;
  text: string;
  imgText?: string;
}

export interface Question {
  id: string;
  examId: string;
  type: QuestionType;
  text: string;
  imgText?: string;
  options: Option[];
  correctAnswers: string[]; // option ids for single/multiple, text answer for text
  marks: number;
  explanation?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  description: string;
  classLevel: ClassLevel;
  schoolId?: string;
  duration: number; // in minutes
  startTime: string; // ISO string
  endTime: string; // ISO string
  totalMarks: number;
  passingMarks: number;
  questionCount: number;
  instructions: string[];
  isPublished: boolean;
  showResultImmediately: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxAttempts: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  classLevel?: ClassLevel;
  schoolId?: string;
  rollNumber?: string;
  phone?: string;
  profileImageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentAnswer {
  questionId: string;
  selectedOptions: string[]; // option ids or text answer
  isAnswered: boolean;
  isMarkedForReview: boolean;
  timeTaken: number; // seconds spent on this question
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  classLevel: ClassLevel;
  schoolId?: string;
  answers: Record<string, StudentAnswer>;
  startTime: string;
  submitTime?: string;
  autoSubmitted: boolean;
  status: 'in_progress' | 'submitted' | 'evaluated';
  score?: number;
  percentage?: number;
  passed?: boolean;
  timeSpent: number; // total seconds
  createdAt: string;
  updatedAt: string;
}

export interface Result {
  id: string;
  attemptId: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  classLevel: ClassLevel;
  schoolId?: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  passed: boolean;
  correctAnswers: number;
  wrongAnswers: number;
  skippedAnswers: number;
  timeSpent: number;
  submittedAt: string;
  rank?: number;
}

export interface DashboardStats {
  totalStudents: number;
  totalExams: number;
  totalAttempts: number;
  averageScore: number;
  recentResults: Result[];
  examsByClass: Record<string, number>;
}

// UI State types
export interface ExamState {
  currentQuestionIndex: number;
  answers: Record<string, StudentAnswer>;
  timeRemaining: number;
  isSubmitting: boolean;
  flaggedQuestions: Set<string>;
}
