'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getPublishedExams, getStudentAttemptForExam } from '@/lib/firestore';
import type { Exam, ExamAttempt } from '@/types';
import Link from 'next/link';
import { format, isPast, isFuture, formatDistanceToNow } from 'date-fns';

type ExamWithAttempt = Exam & { attempt: ExamAttempt | null; status: 'upcoming' | 'available' | 'ended' | 'completed' };

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<ExamWithAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const pageSize = 6;
  const [availablePage, setAvailablePage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [endedPage, setEndedPage] = useState(1);

  useEffect(() => {
    if (!profile?.classLevel) return;

    const load = async () => {
      try {
        const published = await getPublishedExams(profile.classLevel!, profile.schoolId);
        const withAttempts = await Promise.all(
          published.map(async (exam) => {
            const attempt = await getStudentAttemptForExam(profile.uid, exam.id);
            let status: ExamWithAttempt['status'] = 'available';
            if (attempt?.status === 'submitted' || attempt?.status === 'evaluated') {
              status = 'completed';
            } else if (isFuture(new Date(exam.startTime))) {
              status = 'upcoming';
            } else if (isPast(new Date(exam.endTime))) {
              status = 'ended';
            }
            return { ...exam, attempt, status };
          })
        );
        setExams(withAttempts);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile]);

  const available = exams.filter(e => e.status === 'available');
  const upcoming = exams.filter(e => e.status === 'upcoming');
  const completed = exams.filter(e => e.status === 'completed');
  const ended = exams.filter(e => e.status === 'ended');

  const paged = (list: ExamWithAttempt[], page: number) => list.slice((page - 1) * pageSize, page * pageSize);

  const ExamCard = ({ exam }: { exam: ExamWithAttempt }) => {
    const canAttempt = exam.status === 'available';
    const isCompleted = exam.status === 'completed';
    const isUpcoming = exam.status === 'upcoming';

    return (
      <div className={`card hover:shadow-soft transition-all duration-200 relative overflow-hidden ${
        canAttempt ? 'border-primary-100 hover:border-primary-200' : ''
      }`}>
        {canAttempt && (
          <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-primary-500 to-primary-300 rounded-r-2xl" />
        )}

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-display font-bold flex-shrink-0 ${
              canAttempt ? 'bg-primary-600 text-white shadow-glow' :
              isCompleted ? 'bg-success-500 text-white' :
              isUpcoming ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {exam.subject.substring(0, 3).toUpperCase()}
            </div>
            <div>
              <h3 className="font-display font-bold text-gray-900 text-base leading-tight">{exam.title}</h3>
              <p className="text-gray-500 text-xs mt-0.5">{exam.subject}</p>
            </div>
          </div>
          <span className={`badge flex-shrink-0 ${
            canAttempt ? 'bg-primary-100 text-primary-700' :
            isCompleted ? 'badge-success' :
            isUpcoming ? 'bg-amber-100 text-amber-700' :
            'badge-gray'
          }`}>
            {canAttempt ? '● Available' :
             isCompleted ? '✓ Done' :
             isUpcoming ? '⏰ Upcoming' : 'Ended'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { icon: '⏱', label: `${exam.duration} min` },
            { icon: '📝', label: `${exam.questionCount} Qs` },
            { icon: '🏆', label: `${exam.totalMarks} marks` },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-base mb-0.5">{stat.icon}</p>
              <p className="text-xs font-semibold text-gray-600">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {isUpcoming && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Starts {formatDistanceToNow(new Date(exam.startTime), { addSuffix: true })}
              </span>
            )}
            {canAttempt && (
              <span className="text-danger-500 font-medium flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ends {formatDistanceToNow(new Date(exam.endTime), { addSuffix: true })}
              </span>
            )}
            {(isCompleted || exam.status === 'ended') && (
              <span>Ended {format(new Date(exam.endTime), 'MMM d, yyyy')}</span>
            )}
          </div>

          {canAttempt && (
            <Link href={`/student/exam/${exam.id}`}
              className="btn-primary text-sm px-4 py-2">
              Start Exam →
            </Link>
          )}
          {isCompleted && (
            <Link href="/student/results"
              className="btn-secondary text-sm px-4 py-2">
              View Result
            </Link>
          )}
        </div>

        {isCompleted && exam.attempt?.percentage !== undefined && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500">Your Score</span>
              <span className={`font-bold ${
                exam.attempt.passed ? 'text-success-600' : 'text-danger-600'
              }`}>{exam.attempt.percentage}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${exam.attempt.passed ? 'bg-success-500' : 'bg-danger-500'}`}
                style={{ width: `${exam.attempt.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-in">
      {/* Welcome Banner */}
      <div className="mb-8 p-6 bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl text-white shadow-glow-lg relative overflow-hidden">
        <div className="absolute right-4 top-4 text-6xl opacity-10">📚</div>
        <p className="text-primary-200 text-sm mb-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
        <h1 className="text-2xl font-display font-bold mb-1">
          Hello, {profile?.displayName?.split(' ')[0]}! 👋
        </h1>
        <p className="text-primary-100 text-sm">
          {profile?.classLevel} · {available.length} exam{available.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Available', value: available.length, color: 'text-primary-600 bg-primary-50' },
          { label: 'Completed', value: completed.length, color: 'text-success-600 bg-success-50' },
          { label: 'Upcoming', value: upcoming.length, color: 'text-amber-600 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-2xl font-display font-bold ${s.color.split(' ')[0]}`}>{s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-52 w-full rounded-2xl" />)}
        </div>
      ) : exams.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-display font-bold text-gray-800 mb-2">No Exams Yet</h3>
          <p className="text-gray-500 text-sm">
            No exams assigned to {profile?.classLevel} right now. Check back later!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {available.length > 0 && (
            <section>
              <h2 className="text-base font-display font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-500 rounded-full" />
                Available Now
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {paged(available, availablePage).map(exam => <ExamCard key={exam.id} exam={exam} />)}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button disabled={availablePage <= 1} onClick={() => setAvailablePage(p => Math.max(1, p-1))} className="btn-secondary">Prev</button>
                <button disabled={availablePage >= Math.ceil(available.length / pageSize)} onClick={() => setAvailablePage(p => Math.min(Math.ceil(available.length / pageSize), p+1))} className="btn-secondary">Next</button>
                <span className="text-sm text-gray-500">{available.length} exams</span>
              </div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-base font-display font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full" />
                Upcoming
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {paged(upcoming, upcomingPage).map(exam => <ExamCard key={exam.id} exam={exam} />)}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button disabled={upcomingPage <= 1} onClick={() => setUpcomingPage(p => Math.max(1, p-1))} className="btn-secondary">Prev</button>
                <button disabled={upcomingPage >= Math.ceil(upcoming.length / pageSize)} onClick={() => setUpcomingPage(p => Math.min(Math.ceil(upcoming.length / pageSize), p+1))} className="btn-secondary">Next</button>
                <span className="text-sm text-gray-500">{upcoming.length} exams</span>
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <h2 className="text-base font-display font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-success-500 rounded-full" />
                Completed
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {paged(completed, completedPage).map(exam => <ExamCard key={exam.id} exam={exam} />)}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button disabled={completedPage <= 1} onClick={() => setCompletedPage(p => Math.max(1, p-1))} className="btn-secondary">Prev</button>
                <button disabled={completedPage >= Math.ceil(completed.length / pageSize)} onClick={() => setCompletedPage(p => Math.min(Math.ceil(completed.length / pageSize), p+1))} className="btn-secondary">Next</button>
                <span className="text-sm text-gray-500">{completed.length} exams</span>
              </div>
            </section>
          )}
          {ended.length > 0 && (
            <section>
              <h2 className="text-base font-display font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full" />
                Ended
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {paged(ended, endedPage).map(exam => <ExamCard key={exam.id} exam={exam} />)}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button disabled={endedPage <= 1} onClick={() => setEndedPage(p => Math.max(1, p-1))} className="btn-secondary">Prev</button>
                <button disabled={endedPage >= Math.ceil(ended.length / pageSize)} onClick={() => setEndedPage(p => Math.min(Math.ceil(ended.length / pageSize), p+1))} className="btn-secondary">Next</button>
                <span className="text-sm text-gray-500">{ended.length} exams</span>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
