'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getExam, getExamQuestions, addQuestion, updateQuestion, deleteQuestion, updateExam } from '@/lib/firestore';
import { uploadImage } from '@/lib/storage';
import type { Exam, Question, QuestionType, Option } from '@/types';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';

const EMPTY_OPTION = (): Option => ({ id: crypto.randomUUID(), text: '', imgText: '' });

interface QuestionForm {
  type: QuestionType;
  text: string;
  imgText: string;
  imageFile: File | null;
  options: Option[];
  correctAnswers: string[];
  marks: number;
  explanation: string;
}

const defaultForm = (): QuestionForm => ({
  type: 'single',
  text: '',
  imgText: '',
  imageFile: null,
  options: [EMPTY_OPTION(), EMPTY_OPTION(), EMPTY_OPTION(), EMPTY_OPTION()],
  correctAnswers: [],
  marks: 1,
  explanation: '',
});

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [form, setForm] = useState<QuestionForm>(defaultForm());
  const [activeTab, setActiveTab] = useState<'questions' | 'settings'>('questions');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [qPage, setQPage] = useState(1);
  const qPageSize = 10;

  const loadData = useCallback(async () => {
    if (!id) {
      // If id is not available yet, avoid calling firestore with undefined
      setLoading(false);
      return;
    }

    try {
      const [examData, questionsData] = await Promise.all([
        getExam(id),
        getExamQuestions(id),
      ]);
      if (!examData) { router.push('/admin/exams'); return; }
      setExam(examData);
      setQuestions(questionsData);
    } catch (err) {
      console.error('Failed to load exam:', err);
      toast.error('Failed to load exam');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { loadData(); }, [loadData]);

  const openAddQuestion = () => {
    setEditingQuestion(null);
    setForm(defaultForm());
    setImagePreview(null);
    setShowAddQuestion(true);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setForm({
      type: q.type,
      text: q.text,
      imgText: q.imgText || '',
      imageFile: null,
      options: q.options.length > 0 ? q.options : [EMPTY_OPTION(), EMPTY_OPTION()],
      correctAnswers: q.correctAnswers,
      marks: q.marks,
      explanation: q.explanation || '',
    });
    setImagePreview(q.imgText || null);
    setShowAddQuestion(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(prev => ({ ...prev, imageFile: file }));
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleOptionChange = (idx: number, field: 'text' | 'imageUrl', value: string) => {
    setForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === idx ? { ...opt, [field]: value } : opt),
    }));
  };

  const toggleCorrectAnswer = (optionId: string) => {
    if (form.type === 'single') {
      setForm(prev => ({ ...prev, correctAnswers: [optionId] }));
    } else if (form.type === 'multiple') {
      setForm(prev => ({
        ...prev,
        correctAnswers: prev.correctAnswers.includes(optionId)
          ? prev.correctAnswers.filter(id => id !== optionId)
          : [...prev.correctAnswers, optionId],
      }));
    }
  };

  const addOption = () => {
    if (form.options.length >= 6) { toast.error('Max 6 options allowed'); return; }
    setForm(prev => ({ ...prev, options: [...prev.options, EMPTY_OPTION()] }));
  };

  const removeOption = (idx: number) => {
    if (form.options.length <= 2) { toast.error('Minimum 2 options required'); return; }
    const removed = form.options[idx].id;
    setForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx),
      correctAnswers: prev.correctAnswers.filter(id => id !== removed),
    }));
  };

  const validateForm = (): string | null => {
    if (!form.text.trim()) return 'Question text is required';
    if (form.type !== 'text') {
      const filledOptions = form.options.filter(o => o.text.trim());
      if (filledOptions.length < 2) return 'At least 2 options are required';
      if (form.correctAnswers.length === 0) return 'Please select the correct answer(s)';
    } else {
      if (form.correctAnswers.length === 0 || !form.correctAnswers[0]) return 'Please provide the correct text answer';
    }
    return null;
  };

  const handleSaveQuestion = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      console.warn('Question validation failed:', error);
      return;
    }

    console.log('handleSaveQuestion invoked', { examId: id, editing: !!editingQuestion });
    setSaving(true);
    try {
      if (!id) {
        toast.error('Invalid exam id');
        console.error('Invalid exam id in handleSaveQuestion');
        setSaving(false);
        return;
      }

      let imgText = form.imgText;
      if (form.imageFile) {
        try {
          imgText = await uploadImage(form.imageFile, 'questions', crypto.randomUUID());
          console.log('Image uploaded, url:', imgText);
        } catch (uploadErr) {
          console.error('Upload failed:', uploadErr);
          toast.error('Image upload failed: ' + (uploadErr instanceof Error ? uploadErr.message : String(uploadErr)));
          console.warn('Continuing to save question without image due to upload failure');
          // continue and save the question without an image
          imgText = undefined;
        }
      }

      const questionData: any = {
        examId: id,
        type: form.type,
        text: form.text.trim(),
        options: form.type !== 'text' ? form.options.filter(o => o.text.trim()) : [],
        correctAnswers: form.correctAnswers,
        marks: form.marks,
        order: editingQuestion ? editingQuestion.order : questions.length + 1,
      };

      if (imgText) questionData.imgText = imgText;
      if (form.explanation?.trim()) questionData.explanation = form.explanation.trim();

      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, questionData);
        toast.success('Question updated');
      } else {
        await addQuestion(questionData);
        toast.success('Question added!');
      }

      await loadData();
      setShowAddQuestion(false);
      setForm(defaultForm());
      setImagePreview(null);
      setEditingQuestion(null);
    } catch (err) {
      console.error('Failed to save question:', err);
      toast.error('Failed to save question: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (q: Question) => {
    if (!confirm('Delete this question?')) return;
    setDeletingId(q.id);
    try {
      await deleteQuestion(q.id, id, q.marks);
      await loadData();
      toast.success('Question deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async () => {
    if (!exam) return;
    try {
      await updateExam(id, { isPublished: !exam.isPublished });
      setExam(prev => prev ? { ...prev, isPublished: !prev.isPublished } : null);
      toast.success(exam.isPublished ? 'Exam unpublished' : 'Exam published!');
    } catch {
      toast.error('Failed to update');
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

  if (!exam) return null;

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        <div className="flex items-center gap-3 flex-1">
          <Link href="/admin/exams" className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-bold text-gray-900">{exam.title}</h1>
              <span className={`badge ${exam.isPublished ? 'badge-success' : 'badge-gray'}`}>
                {exam.isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">
              {exam.classLevel} · {exam.subject} · {exam.questionCount} questions · {exam.totalMarks} marks
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleTogglePublish}
            className={`btn-secondary text-sm ${exam.isPublished ? 'text-amber-600' : 'text-success-600'}`}>
            {exam.isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button onClick={openAddQuestion} className="btn-primary text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Question
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(['questions', 'settings'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
              activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'questions' && (
        <div>
          {questions.length === 0 ? (
            <div className="card text-center py-16">
              <div className="text-5xl mb-4">❓</div>
              <h3 className="text-lg font-display font-bold text-gray-800 mb-2">No Questions Yet</h3>
              <p className="text-gray-500 text-sm mb-6">Add questions to make this exam ready</p>
              <button onClick={openAddQuestion} className="btn-primary inline-flex">
                Add First Question
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.slice((qPage - 1) * qPageSize, qPage * qPageSize).map((q, idx) => (
                <div key={q.id} className="card hover:shadow-soft transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-2 flex-wrap">
                        <span className={`badge ${
                          q.type === 'single' ? 'badge-primary' :
                          q.type === 'multiple' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                        } flex-shrink-0`}>
                          {q.type === 'single' ? 'Single Choice' : q.type === 'multiple' ? 'Multiple Choice' : 'Text Answer'}
                        </span>
                        <span className="badge badge-gray">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                      </div>
                      <p className="text-gray-800 font-medium text-sm">{q.text}</p>
                      {q.imgText && (
                        <div className="mt-2 relative h-24 w-40 rounded-lg overflow-hidden border border-gray-200">
                          <Image src={q.imgText} alt="Question" fill className="object-cover" />
                        </div>
                      )}
                      {q.type !== 'text' && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {q.options.map(opt => (
                            <div key={opt.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                              q.correctAnswers.includes(opt.id)
                                ? 'bg-success-50 border border-success-200 text-success-700'
                                : 'bg-gray-50 border border-gray-100 text-gray-600'
                            }`}>
                              {q.correctAnswers.includes(opt.id) && (
                                <svg className="w-3 h-3 text-success-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              <span>{opt.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {q.type === 'text' && (
                        <p className="mt-2 text-xs text-success-700 bg-success-50 px-3 py-1.5 rounded-lg border border-success-200 inline-block">
                          ✓ Answer: {q.correctAnswers[0]}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditQuestion(q)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteQuestion(q)}
                        disabled={deletingId === q.id}
                        className="p-1.5 hover:bg-danger-50 rounded-lg text-danger-400 transition-colors">
                        {deletingId === q.id ? (
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <button disabled={qPage <= 1} onClick={() => setQPage(p => Math.max(1, p-1))} className="btn-secondary">Prev</button>
                  <button disabled={qPage >= Math.ceil(questions.length / qPageSize)} onClick={() => setQPage(p => Math.min(Math.ceil(questions.length / qPageSize), p+1))} className="btn-secondary">Next</button>
                  <span className="text-sm text-gray-500">Page {qPage} of {Math.max(1, Math.ceil(questions.length / qPageSize))}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="card max-w-2xl">
          <h3 className="font-display font-bold text-gray-800 mb-4">Exam Settings</h3>
          <div className="space-y-3 text-sm">
            {[
              ['Title', exam.title],
              ['Subject', exam.subject],
              ['Class', exam.classLevel],
              ['Duration', `${exam.duration} minutes`],
              ['Total Marks', exam.totalMarks],
              ['Passing Marks', exam.passingMarks],
              ['Questions', exam.questionCount],
              ['Max Attempts', exam.maxAttempts],
              ['Show Results', exam.showResultImmediately ? 'Yes' : 'No'],
              ['Shuffle Questions', exam.shuffleQuestions ? 'Yes' : 'No'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-500 font-medium">{label}</span>
                <span className="font-semibold text-gray-800">{value}</span>
              </div>
            ))}
          </div>
          <Link href={`/admin/exams/${id}/edit`}
            className="btn-secondary mt-5 text-sm">
            Edit Settings
          </Link>
        </div>
      )}

      {/* Add/Edit Question Modal */}
      {showAddQuestion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-4 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-gray-900 text-lg">
                  {editingQuestion ? 'Edit Question' : 'Add New Question'}
                </h2>
                <button onClick={() => setShowAddQuestion(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Question Type */}
              <div>
                <label className="label">Question Type</label>
                <div className="flex gap-2">
                  {([
                    { value: 'single', label: 'Single Choice', icon: '🔘' },
                    { value: 'multiple', label: 'Multiple Choice', icon: '☑️' },
                    { value: 'text', label: 'Text Answer', icon: '✏️' },
                  ] as const).map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, type: t.value, correctAnswers: [] }))}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                        form.type === t.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="label">Question Text *</label>
                <textarea
                  value={form.text}
                  onChange={e => setForm(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Enter your question here..."
                  rows={3}
                  className="input resize-none"
                />
              </div>

              {/* Question Image */}
              <div>
                <label className="label">Question Image (Optional)</label>
                <div className="flex items-center gap-3">
                  <label className="btn-secondary text-sm cursor-pointer">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Image
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                  {imagePreview && (
                    <div className="relative h-16 w-24 rounded-lg overflow-hidden border border-gray-200">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setImagePreview(null); setForm(prev => ({ ...prev, imageFile: null, imgText: '' })); }}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full text-white flex items-center justify-center text-xs"
                      >×</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Options (for choice questions) */}
              {form.type !== 'text' && (
                <div>
                  <label className="label">
                    Answer Options *
                    <span className="text-gray-400 font-normal ml-2">
                      (click {form.type === 'single' ? 'radio' : 'checkbox'} to mark correct answer{form.type === 'multiple' ? 's' : ''})
                    </span>
                  </label>
                  <div className="space-y-2">
                    {form.options.map((opt, idx) => (
                      <div key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        form.correctAnswers.includes(opt.id)
                          ? 'border-success-300 bg-success-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}>
                        <button
                          type="button"
                          onClick={() => toggleCorrectAnswer(opt.id)}
                          className={`flex-shrink-0 transition-all ${
                            form.type === 'single'
                              ? `w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  form.correctAnswers.includes(opt.id)
                                    ? 'border-success-500 bg-success-500'
                                    : 'border-gray-300'
                                }`
                              : `w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                                  form.correctAnswers.includes(opt.id)
                                    ? 'border-success-500 bg-success-500'
                                    : 'border-gray-300'
                                }`
                          }`}
                        >
                          {form.correctAnswers.includes(opt.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="text-xs font-bold text-gray-400 w-4">{String.fromCharCode(65 + idx)}.</span>
                        <input
                          value={opt.text}
                          onChange={e => handleOptionChange(idx, 'text', e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                          className="flex-1 bg-transparent text-sm font-medium text-gray-700 placeholder-gray-400 outline-none"
                        />
                        {form.options.length > 2 && (
                          <button type="button" onClick={() => removeOption(idx)}
                            className="text-gray-300 hover:text-danger-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {form.options.length < 6 && (
                    <button type="button" onClick={addOption}
                      className="mt-2 text-sm text-primary-600 font-semibold flex items-center gap-1 hover:text-primary-700 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Option
                    </button>
                  )}
                </div>
              )}

              {/* Text answer */}
              {form.type === 'text' && (
                <div>
                  <label className="label">Correct Answer *</label>
                  <input
                    value={form.correctAnswers[0] || ''}
                    onChange={e => setForm(prev => ({ ...prev, correctAnswers: [e.target.value] }))}
                    placeholder="Enter the expected correct answer..."
                    className="input"
                  />
                  <p className="text-xs text-gray-400 mt-1">Answer comparison is case-insensitive</p>
                </div>
              )}

              {/* Marks + Explanation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Marks</label>
                  <input
                    type="number"
                    value={form.marks}
                    onChange={e => setForm(prev => ({ ...prev, marks: Number(e.target.value) }))}
                    min={0.5} step={0.5}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Explanation (Optional)</label>
                  <input
                    value={form.explanation}
                    onChange={e => setForm(prev => ({ ...prev, explanation: e.target.value }))}
                    placeholder="Why is this the answer?"
                    className="input"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAddQuestion(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveQuestion} disabled={saving} className="btn-primary">
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : editingQuestion ? 'Update Question' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
