'use client';
import { useEffect, useState } from 'react';
import { getExams, deleteExam, updateExam } from '@/lib/firestore';
import type { Exam } from '@/types';
import Link from 'next/link';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadExams = async () => {
    try {
      const data = await getExams();
      setExams(data);
    } catch (err) {
      toast.error('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExams(); }, []);

  const handleDelete = async (exam: Exam) => {
    if (!confirm(`Delete "${exam.title}"? This will also delete all questions.`)) return;
    setDeleting(exam.id);
    try {
      await deleteExam(exam.id);
      setExams(prev => prev.filter(e => e.id !== exam.id));
      toast.success('Exam deleted');
    } catch {
      toast.error('Failed to delete exam');
    } finally {
      setDeleting(null);
    }
  };

  const handleTogglePublish = async (exam: Exam) => {
    try {
      await updateExam(exam.id, { isPublished: !exam.isPublished });
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, isPublished: !e.isPublished } : e));
      toast.success(exam.isPublished ? 'Exam unpublished' : 'Exam published!');
    } catch {
      toast.error('Failed to update exam');
    }
  };

  const q = searchQuery.toLowerCase();
  const filtered = exams.filter(e =>
    (e.title || '').toLowerCase().includes(q) ||
    (e.subject || '').toLowerCase().includes(q) ||
    (e.classLevel || '').toLowerCase().includes(q)
  );
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="section-title">Exams</h1>
          <p className="text-gray-500 text-sm mt-1">{exams.length} total exams</p>
        </div>
        <Link href="/admin/exams/create" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Exam
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search exams by title, subject, or class..."
          className="input pl-10 max-w-md"
        />
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-display font-bold text-gray-800 mb-2">
            {searchQuery ? 'No exams found' : 'No exams yet'}
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            {searchQuery ? 'Try a different search term' : 'Create your first exam to get started'}
          </p>
          {!searchQuery && (
            <Link href="/admin/exams/create" className="btn-primary inline-flex">
              Create First Exam
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {paged.map(exam => (
            <div key={exam.id} className="card hover:shadow-soft transition-all duration-200 group">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Left */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                    <span className="text-primary-700 font-display font-bold text-sm">
                      {exam.subject.substring(0, 3).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-display font-bold text-gray-900 text-base truncate">
                        {exam.title}
                      </h3>
                      <span className={`badge ${exam.isPublished ? 'badge-success' : 'badge-gray'}`}>
                        {exam.isPublished ? '● Live' : '○ Draft'}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        {exam.classLevel}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {exam.questionCount} questions
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {exam.duration} min
                      </span>
                      <span>{exam.totalMarks} marks</span>
                      {exam.startTime && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {format(new Date(exam.startTime), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleTogglePublish(exam)}
                    className={`btn-secondary text-xs px-3 py-2 ${
                      exam.isPublished ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-success-600 border-success-200 hover:bg-success-50'
                    }`}
                  >
                    {exam.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <Link
                    href={`/admin/exams/${exam.id}`}
                    className="btn-secondary text-xs px-3 py-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(exam)}
                    disabled={deleting === exam.id}
                    className="btn-ghost text-danger-500 hover:bg-danger-50 text-xs px-3 py-2"
                  >
                    {deleting === exam.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p-1))} className="btn-secondary">Prev</button>
              <button disabled={page >= Math.ceil(filtered.length / pageSize)} onClick={() => setPage(p => Math.min(Math.ceil(filtered.length / pageSize), p+1))} className="btn-secondary">Next</button>
              <span className="text-sm text-gray-500">Page {page} of {Math.max(1, Math.ceil(filtered.length / pageSize))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
