'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getStudentResults } from '@/lib/firestore';
import type { Result } from '@/types';
import { format } from 'date-fns';

export default function StudentResultsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    if (authLoading) return;
    if (!profile) { setResults([]); setLoading(false); return; }
    let mounted = true;
    getStudentResults(profile.uid)
      .then(r => { if (mounted) setResults(r); })
      .catch(err => { console.error(err); if (mounted) setResults([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [profile, authLoading]);

  useEffect(() => { setPage(1); setSelectedResult(null); }, [profile?.uid]);

  const pagedResults = results.slice((page - 1) * pageSize, page * pageSize);
  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0;
  const passed = results.filter(r => r.passed).length;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="section-title">My Results</h1>
          <p className="text-gray-500 text-sm mt-1">{results.length} exams completed</p>
        </div>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Exams Taken', value: results.length, icon: '✍️', color: 'text-blue-600 bg-blue-50' },
            { label: 'Passed', value: `${passed}/${results.length}`, icon: '✅', color: 'text-green-600 bg-green-50' },
            { label: 'Avg Score', value: `${avgScore}%`, icon: '📊', color: 'text-purple-600 bg-purple-50' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center text-xl mx-auto mb-2`}>{s.icon}</div>
              <p className={`text-2xl font-display font-bold ${s.color.split(' ')[0]}`}>{loading ? '—' : s.value}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-40 w-full rounded-2xl" />)}
        </div>
      ) : results.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-display font-bold text-gray-800 mb-2">No Results Yet</h3>
          <p className="text-gray-500 text-sm">Complete an exam to see your results here.</p>
        </div>
      ) : (
        <div>
          <div className="grid sm:grid-cols-2 gap-4">
            {pagedResults.map(result => (
              <button
                key={result.id}
                onClick={() => setSelectedResult(result)}
                className="card text-left hover:shadow-soft transition-all duration-200 hover:border-primary-200 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-gray-900 text-base truncate group-hover:text-primary-700 transition-colors">
                      {result.examTitle}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">{result.classLevel}</p>
                  </div>
                  <span className={`badge ml-2 flex-shrink-0 ${result.passed ? 'badge-success' : 'badge-danger'}`}>
                    {result.passed ? 'Passed' : 'Failed'}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500 font-medium">Score</span>
                    <span className="font-bold text-gray-800">{result.obtainedMarks}/{result.totalMarks}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${result.percentage >= 75 ? 'bg-success-500' : result.percentage >= 50 ? 'bg-amber-400' : 'bg-danger-500'}`}
                      style={{ width: `${result.percentage}%` }}
                    />
                  </div>

                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-400">0</span>
                    <span className={`text-sm font-display font-bold ${result.percentage >= 75 ? 'text-success-600' : result.percentage >= 50 ? 'text-amber-600' : 'text-danger-600'}`}>{result.percentage}%</span>
                    <span className="text-xs text-gray-400">100</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex gap-3">
                    <span className="text-success-600 font-semibold">✓{result.correctAnswers} correct</span>
                    <span className="text-danger-500 font-semibold">✗{result.wrongAnswers} wrong</span>
                  </div>
                  <span>{format(new Date(result.submittedAt), 'MMM d, yyyy')}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p-1))} className="btn-secondary">Prev</button>
              <button disabled={page >= Math.ceil(results.length / pageSize)} onClick={() => setPage(p => Math.min(Math.ceil(results.length / pageSize), p+1))} className="btn-secondary">Next</button>
              <span className="text-sm text-gray-500">Page {page} of {Math.max(1, Math.ceil(results.length / pageSize))}</span>
            </div>
          </div>
        </div>
      )}

      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className={`p-6 ${selectedResult.passed ? 'bg-gradient-to-r from-success-500 to-success-600' : 'bg-gradient-to-r from-danger-500 to-danger-600'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display font-bold text-white text-lg mb-0.5">{selectedResult.examTitle}</h2>
                  <p className="text-white/70 text-sm">{selectedResult.classLevel}</p>
                </div>
                <button onClick={() => setSelectedResult(null)} className="p-2 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm font-medium text-gray-500">Score</span>
                <span className="text-xl font-display font-bold text-gray-900">{selectedResult.obtainedMarks}/{selectedResult.totalMarks}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm font-medium text-gray-500">Percentage</span>
                <span className={`text-xl font-display font-bold ${selectedResult.passed ? 'text-success-600' : 'text-danger-600'}`}>{selectedResult.percentage}%</span>
              </div>

              {[
                { label: 'Correct Answers', value: selectedResult.correctAnswers, color: 'text-success-600' },
                { label: 'Wrong Answers', value: selectedResult.wrongAnswers, color: 'text-danger-600' },
                { label: 'Skipped', value: selectedResult.skippedAnswers, color: 'text-gray-600' },
                { label: 'Time Spent', value: `${Math.floor(selectedResult.timeSpent / 60)}m ${selectedResult.timeSpent % 60}s`, color: 'text-gray-600' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-medium text-gray-500">{row.label}</span>
                  <span className={`font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}

              <p className="text-xs text-gray-400 text-center">Submitted {format(new Date(selectedResult.submittedAt), 'MMMM d, yyyy h:mm a')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
