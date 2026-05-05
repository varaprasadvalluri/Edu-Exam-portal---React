'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getAllStudents, getExams, getAllResults } from '@/lib/firestore';
import { scoreBgColor } from '@/lib/utils';
import type { AppUser, Exam, Result } from '@/types';
import StatCard from '@/components/StatCard';
import Link from 'next/link';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<AppUser[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllStudents(), getExams(), getAllResults()])
      .then(([s, e, r]) => { setStudents(s); setExams(e); setResults(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const avgScore = results.length
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0;
  const passRate = results.length
    ? Math.round((results.filter(r => r.passed).length / results.length) * 100) : 0;

  return (
    <div className="animate-in space-y-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-700 p-6 text-white shadow-glow-lg">
        <div className="absolute inset-0 opacity-10 bg-grid-pattern" />
        <div className="absolute right-6 top-4 text-7xl opacity-10 select-none">🎓</div>
        <div className="relative">
          <p className="text-primary-200 text-sm font-medium mb-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
          <h2 className="text-2xl font-display font-bold mb-1">
            Welcome back, {profile?.displayName?.split(' ')[0]}! 👋
          </h2>
          <p className="text-primary-100 text-sm max-w-lg">
            Here's your school portal at a glance. You have{' '}
            <span className="font-bold text-white">{exams.filter(e => e.isPublished).length}</span> active exams
            and <span className="font-bold text-white">{students.filter(s => s.isActive).length}</span> active students.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon="👨‍🎓" label="Total Students" value={students.length}
          sub={`${students.filter(s => s.isActive).length} active`}
          loading={loading} colorClass="bg-blue-50" />
        <StatCard icon="📋" label="Total Exams" value={exams.length}
          sub={`${exams.filter(e => e.isPublished).length} published`}
          loading={loading} colorClass="bg-violet-50" />
        <StatCard icon="✍️" label="Total Attempts" value={results.length}
          loading={loading} colorClass="bg-emerald-50" />
        <StatCard icon="📊" label="Avg. Score"
          value={loading ? '—' : `${avgScore}%`}
          sub={`${passRate}% pass rate`}
          loading={loading} colorClass="bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Results table */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-gray-900">Recent Submissions</h3>
            <Link href="/admin/results" className="text-primary-600 text-sm font-semibold hover:underline">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3.5 w-1/2 rounded" />
                    <div className="skeleton h-3 w-1/3 rounded" />
                  </div>
                  <div className="skeleton h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-gray-500 text-sm">No submissions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Student', 'Exam', 'Score', 'Status', 'Date'].map(h => (
                      <th key={h} className="text-left text-xs text-gray-400 font-semibold uppercase tracking-wide pb-3 px-2 first:pl-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.slice(0, 8).map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-2 pl-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {r.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-xs leading-none mb-0.5">{r.studentName}</p>
                            <p className="text-gray-400 text-xs">{r.classLevel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <p className="text-gray-700 text-xs font-medium truncate max-w-[130px]">{r.examTitle}</p>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${scoreBgColor(r.percentage)}`}
                              style={{ width: `${r.percentage}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-700 tabular-nums">{r.percentage}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`badge ${r.passed ? 'badge-success' : 'badge-danger'}`}>
                          {r.passed ? 'Pass' : 'Fail'}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-xs text-gray-400 tabular-nums">
                          {format(new Date(r.submittedAt), 'MMM d')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Quick actions */}
          <div className="card">
            <h3 className="font-display font-bold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Create Exam', href: '/admin/exams/create', emoji: '➕', primary: true },
                { label: 'Add Student', href: '/admin/students', emoji: '👤', primary: false },
                { label: 'View Results', href: '/admin/results', emoji: '📈', primary: false },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 hover:scale-[0.99] ${
                    a.primary ? 'bg-primary-600 text-white shadow-glow' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}>
                  <span>{a.emoji}</span>
                  {a.label}
                  <svg className="w-4 h-4 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent exams */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-gray-900">Recent Exams</h3>
              <Link href="/admin/exams" className="text-primary-600 text-xs font-semibold hover:underline">
                All →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
              </div>
            ) : exams.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No exams yet</p>
            ) : (
              <div className="space-y-1.5">
                {exams.slice(0, 5).map(exam => (
                  <Link key={exam.id} href={`/admin/exams/${exam.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                    <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-600 text-xs font-bold">
                        {exam.subject.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-xs truncate group-hover:text-primary-700 transition-colors">
                        {exam.title}
                      </p>
                      <p className="text-gray-400 text-xs">{exam.classLevel} · {exam.questionCount}Q</p>
                    </div>
                    <span className={`badge flex-shrink-0 ${exam.isPublished ? 'badge-success' : 'badge-gray'}`}>
                      {exam.isPublished ? '●' : '○'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Class distribution */}
          {!loading && students.length > 0 && (
            <div className="card">
              <h3 className="font-display font-bold text-gray-900 mb-3">Students by Class</h3>
              <div className="space-y-2">
                {Object.entries(
                  students.reduce<Record<string, number>>((acc, s) => {
                    const k = s.classLevel ?? 'Unknown';
                    acc[k] = (acc[k] || 0) + 1;
                    return acc;
                  }, {})
                ).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cls, count]) => (
                  <div key={cls} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 w-20 flex-shrink-0 truncate">{cls}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-400 rounded-full"
                        style={{ width: `${(count / students.length) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-600 w-5 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
