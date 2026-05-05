'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getExam, updateExam } from '@/lib/firestore';
import { CLASS_LEVELS, type ClassLevel, type Exam } from '@/types';
import toast from 'react-hot-toast';
import Link from 'next/link';

const SUBJECTS = [
  'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies',
  'Computer Science', 'General Knowledge', 'EVS', 'History',
  'Geography', 'Physics', 'Chemistry', 'Biology', 'Other',
];

export default function EditExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', subject: '', description: '', classLevel: '' as ClassLevel | '',
    duration: 60, startTime: '', endTime: '', passingMarks: 40,
    instructions: [] as string[],
    isPublished: false, showResultImmediately: true,
    shuffleQuestions: false, shuffleOptions: false, maxAttempts: 1,
  });
  const [newInstruction, setNewInstruction] = useState('');

  useEffect(() => {
    if (!id) return;
    
    const loadExam = async () => {
      try {
        const exam = await getExam(id);
        if (!exam) {
          toast.error('Exam not found');
          router.push('/admin/exams');
          return;
        }
        
        // Convert ISO timestamps to datetime-local format (YYYY-MM-DDTHH:mm)
        const formatDateTime = (isoString?: string): string => {
          if (!isoString) return '';
          try {
            const date = new Date(isoString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
          } catch (e) {
            console.error('Failed to format datetime:', isoString, e);
            return '';
          }
        };
        
        setForm({
          title: exam.title || '',
          subject: exam.subject || '',
          description: exam.description || '',
          classLevel: (exam.classLevel || '') as ClassLevel | '',
          duration: exam.duration || 60,
          startTime: formatDateTime(exam.startTime),
          endTime: formatDateTime(exam.endTime),
          passingMarks: exam.passingMarks || 40,
          instructions: exam.instructions || [],
          isPublished: exam.isPublished || false,
          showResultImmediately: exam.showResultImmediately !== false,
          shuffleQuestions: exam.shuffleQuestions || false,
          shuffleOptions: exam.shuffleOptions || false,
          maxAttempts: exam.maxAttempts || 1,
        });
      } catch (error) {
        console.error('Error loading exam:', error);
        toast.error('Failed to load exam: ' + (error instanceof Error ? error.message : 'Unknown error'));
        router.push('/admin/exams');
      } finally {
        setLoading(false);
      }
    };
    
    loadExam();
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked
        : type === 'number' ? Number(value) : value,
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
      toast.error('Title, subject and class are required');
      return;
    }
    if (form.startTime && form.endTime && new Date(form.endTime) <= new Date(form.startTime)) {
      toast.error('End time must be after start time');
      return;
    }
    setSaving(true);
    try {
      const startTimeISO = form.startTime 
        ? new Date(form.startTime).toISOString() 
        : new Date().toISOString();
      const endTimeISO = form.endTime 
        ? new Date(form.endTime).toISOString() 
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      await updateExam(id, {
        title: form.title.trim(),
        subject: form.subject,
        description: form.description.trim(),
        classLevel: form.classLevel as ClassLevel,
        duration: form.duration,
        startTime: startTimeISO,
        endTime: endTimeISO,
        passingMarks: form.passingMarks,
        instructions: form.instructions,
        isPublished: form.isPublished,
        showResultImmediately: form.showResultImmediately,
        shuffleQuestions: form.shuffleQuestions,
        shuffleOptions: form.shuffleOptions,
        maxAttempts: form.maxAttempts,
      });
      toast.success('Exam settings saved!');
      router.push(`/admin/exams/${id}`);
    } catch (error) {
      console.error('Error saving exam:', error);
      toast.error('Failed to save exam: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i*0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/admin/exams/${id}`}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="section-title">Edit Exam Settings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Update exam configuration</p>
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
            <input name="title" value={form.title} onChange={handleChange} className="input" maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div>
            <label className="label">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange}
              rows={3} className="input resize-none" />
          </div>
        </div>

        {/* Schedule */}
        <div className="card space-y-5">
          <h2 className="font-display font-bold text-gray-800 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">2</span>
            Schedule & Duration
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Duration (min)</label>
              <input type="number" name="duration" value={form.duration} onChange={handleChange}
                min={5} max={360} className="input" />
            </div>
            <div>
              <label className="label">Start Time</label>
              <input type="datetime-local" name="startTime" value={form.startTime} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="datetime-local" name="endTime" value={form.endTime} onChange={handleChange} className="input" />
            </div>
          </div>
        </div>

        {/* Scoring & Settings */}
        <div className="card space-y-5">
          <h2 className="font-display font-bold text-gray-800 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">3</span>
            Scoring & Settings
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Passing Marks</label>
              <input type="number" name="passingMarks" value={form.passingMarks} onChange={handleChange}
                min={0} className="input" />
            </div>
            <div>
              <label className="label">Max Attempts</label>
              <input type="number" name="maxAttempts" value={form.maxAttempts} onChange={handleChange}
                min={1} max={10} className="input" />
            </div>
          </div>
          <div className="space-y-3">
            {[
              { name: 'showResultImmediately', label: 'Show result immediately after submission' },
              { name: 'shuffleQuestions', label: 'Shuffle questions for each student' },
              { name: 'shuffleOptions', label: 'Shuffle answer options' },
              { name: 'isPublished', label: 'Exam is published and available to students' },
            ].map(opt => (
              <label key={opt.name} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" name={opt.name}
                    checked={form[opt.name as keyof typeof form] as boolean}
                    onChange={handleChange} className="sr-only" />
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
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="card space-y-4">
          <h2 className="font-display font-bold text-gray-800 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">4</span>
            Instructions
          </h2>
          <div className="space-y-2">
            {form.instructions.map((inst, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl group">
                <span className="text-xs font-bold text-gray-400 mt-0.5 w-4 flex-shrink-0">{idx + 1}.</span>
                <p className="text-sm text-gray-700 flex-1">{inst}</p>
                <button type="button" onClick={() => removeInstruction(idx)}
                  className="text-gray-300 hover:text-danger-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newInstruction} onChange={e => setNewInstruction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addInstruction())}
              placeholder="Add instruction..." className="input flex-1" />
            <button type="button" onClick={addInstruction} className="btn-secondary flex-shrink-0">Add</button>
          </div>
        </div>

        <div className="flex gap-3 justify-end pb-6">
          <Link href={`/admin/exams/${id}`} className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              <>Save Changes</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
