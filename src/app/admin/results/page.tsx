"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { getAllResults, getExams } from '@/lib/firestore';
import { SCHOOLS } from '@/config/schools';
import type { Result, Exam } from '@/types';
import { createColumnHelper, getCoreRowModel, getPaginationRowModel, useReactTable, flexRender } from '@tanstack/react-table';
import { format } from 'date-fns';

const columnHelper = createColumnHelper<Result>();

function ResultsTable({ data, pageSize, page, setPage }: { data: Result[]; pageSize: number; page: number; setPage: (n:number)=>void }) {
  const columns = useMemo(() => [
    columnHelper.accessor('studentName', { header: 'Student', cell: info => info.getValue() }),
    columnHelper.accessor('examTitle', { header: 'Exam', cell: info => info.getValue() }),
    columnHelper.accessor('percentage', { header: 'Score', cell: info => `${info.getValue()}%` }),
    columnHelper.accessor(row => `${row.correctAnswers}/${row.wrongAnswers}/${row.skippedAnswers}`, { id: 'details', header: 'Details', cell: info => info.getValue() }),
    columnHelper.accessor('timeSpent', { header: 'Time', cell: info => `${Math.floor(info.getValue()/60)}m ${info.getValue()%60}s` }),
    columnHelper.accessor('passed', { header: 'Status', cell: info => info.getValue() ? 'Pass' : 'Fail' }),
    columnHelper.accessor('submittedAt', { header: 'Date', cell: info => format(new Date(info.getValue()), 'MMM d, h:mm a') }),
  ], []);

  const table = useReactTable({
    data,
    columns,
    initialState: { pagination: { pageIndex: Math.max(0, page - 1), pageSize } },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageIndex = table.getState().pagination.pageIndex ?? 0;

  // sync table -> parent (safe inside effect)
  React.useEffect(() => {
    if (pageIndex + 1 !== page) setPage(pageIndex + 1);
  }, [pageIndex, page, setPage]);

  // sync parent -> table when external page changes
  React.useEffect(() => {
    if (table.getState().pagination.pageIndex !== Math.max(0, page - 1)) {
      table.setPageIndex(Math.max(0, page - 1));
    }
  }, [page, table]);

  return (
    <table className="w-full">
      <thead className="bg-gray-50 border-b border-gray-100">
        {table.getHeaderGroups().map(hg => (
          <tr key={hg.id}>
            {hg.headers.map(h => (
              <th key={h.id} className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody className="divide-y divide-gray-50">
        {table.getRowModel().rows.map(row => (
          <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
            {row.getVisibleCells().map(cell => (
              <td key={cell.id} className="px-4 py-3.5 text-sm text-gray-700">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ResultsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [schools] = useState(SCHOOLS);
  const [loading, setLoading] = useState(true);
  const [filterExam, setFilterExam] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const load = async () => {
      try {
        const e = await getExams();
        setExams(e);
        const r = await getAllResults();
        setResults(r);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const filteredAll = results.filter(r => {
    const matchSearch = r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.examTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchExam = !filterExam || r.examId === filterExam;
    const matchClass = !filterClass || r.classLevel === filterClass;
    return matchSearch && matchExam && matchClass;
  });
  const filtered = filterSchool ? filteredAll.filter(r => r.schoolId === filterSchool) : filteredAll;

  const totalAttempts = filtered.length;
  const passed = filtered.filter(r => r.passed).length;
  const avgScore = filtered.length ? Math.round(filtered.reduce((s, r) => s + r.percentage, 0) / filtered.length) : 0;
  const highestScore = filtered.length ? Math.max(...filtered.map(r => r.percentage)) : 0;

  const downloadCSV = () => {
    const rows = filtered.map(r => ({ Student: r.studentName, Exam: r.examTitle, Score: `${r.percentage}%`, Date: r.submittedAt }));
    const csv = [Object.keys(rows[0] || {}).join(','), ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `results_export.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="section-title">Results & Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">{results.length} total submissions</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Attempts', value: totalAttempts, icon: '✍️', color: 'text-blue-600 bg-blue-50' },
          { label: 'Passed', value: `${passed} (${totalAttempts ? Math.round(passed/totalAttempts*100) : 0}%)`, icon: '✅', color: 'text-green-600 bg-green-50' },
          { label: 'Average Score', value: `${avgScore}%`, icon: '📊', color: 'text-purple-600 bg-purple-50' },
          { label: 'Highest Score', value: `${highestScore}%`, icon: '🏆', color: 'text-amber-600 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
            <p className="text-2xl font-display font-bold text-gray-900">{loading ? '—' : s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by student or exam..." className="input pl-10 w-full" />
        </div>
        <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} className="input w-auto">
          <option value="">All Schools</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterExam} onChange={e => setFilterExam(e.target.value)} className="input w-auto">
          <option value="">All Exams</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-display font-bold text-gray-800 mb-2">No Results Found</h3>
          <p className="text-gray-500 text-sm">Results will appear here once students submit exams</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <ResultsTable data={filtered} pageSize={pageSize} page={page} setPage={setPage} />
          </div>

          <div className="flex items-center justify-between p-4 border-t">
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p-1))} className="btn-secondary">Prev</button>
              <button disabled={page >= Math.ceil(filtered.length / pageSize)} onClick={() => setPage(p => Math.min(Math.ceil(filtered.length / pageSize), p+1))} className="btn-secondary">Next</button>
              <span className="text-sm text-gray-500">Page {page} of {Math.max(1, Math.ceil(filtered.length / pageSize))}</span>
            </div>
            <div>
              <button className="btn-primary" onClick={downloadCSV}>Download CSV</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
