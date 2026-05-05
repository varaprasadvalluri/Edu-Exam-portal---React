'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createExam } from '@/lib/firestore';
import { CLASS_LEVELS, type ClassLevel } from '@/types';
import { SCHOOLS } from '@/config/schools';
import toast from 'react-hot-toast';
import Link from 'next/link';

const SUBJECTS = [
  'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies',
  'Computer Science', 'General Knowledge', 'EVS', 'History',
  'Geography', 'Physics', 'Chemistry', 'Biology', 'Other'
];

export default function CreateExamPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    subject: '',
    description: '',
    classLevel: '' as ClassLevel | '',
    schoolId: '',
    duration: 60,
    startTime: '',
    endTime: '',
    passingMarks: 40,
    instructions: ['Read all questions carefully before answering.', 'Each question carries marks as specified.', 'Do not use any unfair means.'],
    isPublished: false,
    showResultImmediately: true,
    shuffleQuestions: false,
    shuffleOptions: false,
    maxAttempts: 1,
  });
  const [newInstruction, setNewInstruction] = useState('');
  const [schools] = useState(SCHOOLS);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked :
               type === 'number' ? Number(value) : value,
    }));
  };

  const addInstruction = () => {
    if (!newInstruction.trim()) return;
    setForm(prev => ({ ...prev, instructions: [...prev.instructions, newInstruction.trim()] }));
    setNewInstruction('');
  };

  const removeInstruction = (idx: number) => {
    setForm(prev => ({ ...prev, instructions: prev.instructions.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.subject || !form.classLevel) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (form.startTime && form.endTime && new Date(form.endTime) <= new Date(form.startTime)) {
      toast.error('End time must be after start time');
      return;
    }

    setLoading(true);
    try {
      const examId = await createExam({
        title: form.title.trim(),
        subject: form.subject,
        description: form.description.trim(),
        classLevel: form.classLevel as ClassLevel,
        schoolId: form.schoolId || undefined,
        duration: form.duration,
        startTime: form.startTime || new Date().toISOString(),
        endTime: form.endTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        totalMarks: 0, // calculated as questions are added
        passingMarks: form.passingMarks,
        questionCount: 0,
        instructions: form.instructions,
        isPublished: form.isPublished,
        showResultImmediately: form.showResultImmediately,
        shuffleQuestions: form.shuffleQuestions,
        shuffleOptions: form.shuffleOptions,
        maxAttempts: form.maxAttempts,
        createdBy: profile!.uid,
      });
      toast.success('Exam created! Now add questions.');
      router.push(`/admin/exams/${examId}`);
    } catch (err) {
      toast.error('Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/exams" className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="section-title">Create New Exam</h1>
          <p className="text-gray-500 text-sm mt-0.5">Fill in the details to create your exam</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card space-y-5">
          <h2 className="font-display font-bold text-gray-800 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">1</span>
            Basic Information
          </h2>

          <div>
            <label className="label">Exam Title *</label>
            <input name="title" value={form.title} onChange={handleChange}
              placeholder="e.g. Mid-Term Mathematics Test 2024"
              className="input" maxLength={100} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Subject *</label>
              <select name="subject" value={form.subject} onChange={handleChange} className="input">
                <option value="">Select Subject</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Class *</label>
              <select name="classLevel" value={form.classLevel} onChange={handleChange} className="input">
                <option value="">Select Class</option>
                {CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">School</label>
              <select name="schoolId" value={form.schoolId} onChange={handleChange} className="input">
                <option value="">Select School</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange}
              placeholder="Brief description of this exam..."
              rows={3} className="input resize-none" />
          </div>
        </div>

        {/* Schedule & Duration */}
        <div className="card space-y-5">
          <h2 className="font-display font-bold text-gray-800 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">2</span>
            Schedule & Timing
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Duration (minutes) *</label>
              <input type="number" name="duration" value={form.duration} onChange={handleChange}
                min={5} max={360} className="input" />
            </div>
            <div>
              <label className="label">Start Time</label>
              <input type="datetime-local" name="startTime" value={form.startTime} onChange={handleChange}
                className="input" />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="datetime-local" name="endTime" value={form.endTime} onChange={handleChange}
                className="input" />
            </div>
          </div>
        </div>

        {/* Scoring */}
        <div className="card space-y-5">
          <h2 className="font-display font-bold text-gray-800 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">3</span>
            Scoring
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Passing Marks</label>
              <input type="number" name="passingMarks" value={form.passingMarks} onChange={handleChange}
                min={0} className="input" />
              <p className="text-xs text-gray-400 mt-1">Total marks depend on questions added</p>
            </div>
            <div>
              <label className="label">Max Attempts</label>
              <input type="number" name="maxAttempts" value={form.maxAttempts} onChange={handleChange}
                min={1} max={10} className="input" />
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="card space-y-4">
          <h2 className="font-display font-bold text-gray-800 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">4</span>
            Settings
          </h2>

          {[
            { name: 'showResultImmediately', label: 'Show result immediately after submission', desc: 'Students can see their score right away' },
            { name: 'shuffleQuestions', label: 'Shuffle questions', desc: 'Questions appear in random order for each student' },
            { name: 'shuffleOptions', label: 'Shuffle options', desc: 'Answer choices appear in random order' },
            { name: 'isPublished', label: 'Publish exam now', desc: 'Students can see and attempt this exam immediately' },
          ].map(opt => (
            <label key={opt.name} className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  name={opt.name}
                  checked={form[opt.name as keyof typeof form] as boolean}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  form[opt.name as keyof typeof form]
                    ? 'bg-primary-600 border-primary-600'
                    : 'bg-white border-gray-300 group-hover:border-primary-400'
                }`}>
                  {form[opt.name as keyof typeof form] && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">{opt.label}</p>
                <p className="text-xs text-gray-400">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Instructions */}
        <div className="card space-y-4">
          <h2 className="font-display font-bold text-gray-800 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">5</span>
            Exam Instructions
          </h2>

          <div className="space-y-2">
            {form.instructions.map((inst, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl group">
                <span className="text-xs font-bold text-gray-400 w-5 text-center flex-shrink-0">{idx + 1}.</span>
                <p className="text-sm text-gray-700 flex-1">{inst}</p>
                <button type="button" onClick={() => removeInstruction(idx)}
                  className="text-gray-300 hover:text-danger-500 transition-colors opacity-0 group-hover:opacity-100">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input value={newInstruction} onChange={e => setNewInstruction(e.target.value)}
              placeholder="Add instruction..."
              className="input flex-1"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addInstruction())}
            />
            <button type="button" onClick={addInstruction} className="btn-secondary flex-shrink-0">
              Add
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end pb-6">
          <Link href="/admin/exams" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                Create & Add Questions
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
