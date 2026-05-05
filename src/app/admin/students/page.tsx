'use client';
import { useEffect, useState } from 'react';
import { getAllStudents, deleteUser, updateUserProfile, createUserProfile } from '@/lib/firestore';
import { SCHOOLS } from '@/config/schools';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { AppUser, ClassLevel } from '@/types';
import { CLASS_LEVELS } from '@/types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function StudentsPage() {
  const [students, setStudents] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: '', email: '', password: '',
    classLevel: '' as ClassLevel | '', rollNumber: '', schoolId: '',
  });

  const loadStudents = async () => {
    try {
      const data = await getAllStudents();
      setStudents(data);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStudents(); }, []);

  const filtered = students.filter(s => {
    const matchSearch =
      s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.rollNumber ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchClass = !filterClass || s.classLevel === filterClass;
    return matchSearch && matchClass;
  });

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName || !form.email || !form.password || !form.classLevel) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(user, { displayName: form.displayName });
      await createUserProfile(user.uid, {
        uid: user.uid,
        email: form.email,
        displayName: form.displayName,
        role: 'student',
        classLevel: form.classLevel as ClassLevel,
        schoolId: form.schoolId || undefined,
        rollNumber: form.rollNumber || undefined,
        isActive: true,
      });
      toast.success('Student added!');
      setShowAddModal(false);
      setForm({ displayName: '', email: '', password: '', classLevel: '', rollNumber: '' });
      await loadStudents();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') toast.error('Email already registered');
      else toast.error('Failed to add student');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (student: AppUser) => {
    try {
      await updateUserProfile(student.uid, { isActive: !student.isActive });
      setStudents(prev => prev.map(s =>
        s.uid === student.uid ? { ...s, isActive: !s.isActive } : s
      ));
      toast.success(student.isActive ? 'Student deactivated' : 'Student activated');
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (student: AppUser) => {
    if (!confirm(`Remove "${student.displayName}" from the system?`)) return;
    setDeletingId(student.uid);
    try {
      await deleteUser(student.uid);
      setStudents(prev => prev.filter(s => s.uid !== student.uid));
      toast.success('Student removed');
    } catch { toast.error('Failed to remove student'); }
    finally { setDeletingId(null); }
  };

  const classCounts = students.reduce<Record<string, number>>((acc, s) => {
    const key = s.classLevel ?? 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="section-title">Students</h1>
          <p className="text-gray-500 text-sm mt-1">{students.length} enrolled students</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Student
        </button>
      </div>

      {/* Quick stats by class */}
      {!loading && students.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setFilterClass('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              !filterClass ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
            }`}
          >
            All ({students.length})
          </button>
          {Object.entries(classCounts).map(([cls, count]) => (
            <button
              key={cls}
              onClick={() => setFilterClass(cls === filterClass ? '' : cls)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                filterClass === cls ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
              }`}
            >
              {cls} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, or roll number..."
          className="input pl-10 max-w-md"
        />
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">👨‍🎓</div>
          <h3 className="text-lg font-display font-bold text-gray-800 mb-2">
            {searchQuery || filterClass ? 'No matching students' : 'No students yet'}
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            {searchQuery || filterClass ? 'Try different search terms' : 'Add your first student to get started'}
          </p>
          {!searchQuery && !filterClass && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary inline-flex">Add First Student</button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Student', 'Class', 'Roll No.', 'Email', 'Joined', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(student => (
                  <tr key={student.uid} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          student.isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {student.displayName.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-semibold text-gray-800 text-sm">{student.displayName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="badge badge-primary text-xs">{student.classLevel ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-600 font-mono">{student.rollNumber || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-500">{student.email}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-400">
                        {format(new Date(student.createdAt), 'MMM d, yyyy')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`badge ${student.isActive ? 'badge-success' : 'badge-gray'}`}>
                        {student.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleToggleActive(student)}
                          className={`p-1.5 rounded-lg transition-colors text-xs font-semibold ${
                            student.isActive
                              ? 'text-amber-500 hover:bg-amber-50'
                              : 'text-success-600 hover:bg-success-50'
                          }`}
                          title={student.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {student.isActive ? '🔒' : '🔓'}
                        </button>
                        <button
                          onClick={() => handleDelete(student)}
                          disabled={deletingId === student.uid}
                          className="p-1.5 hover:bg-danger-50 rounded-lg text-danger-400 transition-colors"
                        >
                          {deletingId === student.uid ? (
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-gray-900 text-lg">Add New Student</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                  placeholder="Student full name" className="input" />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="student@school.com" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Class *</label>
                  <select value={form.classLevel} onChange={e => setForm(p => ({ ...p, classLevel: e.target.value as ClassLevel }))}
                    className="input">
                    <option value="">Select</option>
                    {CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Roll No.</label>
                  <input value={form.rollNumber} onChange={e => setForm(p => ({ ...p, rollNumber: e.target.value }))}
                    placeholder="2024-001" className="input" />
                </div>
              </div>
              <div>
                <label className="label">School</label>
                <select value={form.schoolId} onChange={e => setForm(p => ({ ...p, schoolId: e.target.value }))} className="input">
                  <option value="">Select School</option>
                  {SCHOOLS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Password *</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Min 6 characters" className="input" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Adding...' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
