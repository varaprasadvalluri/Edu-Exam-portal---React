'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { CLASS_LEVELS, type ClassLevel } from '@/types';
import { SCHOOLS } from '@/config/schools';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    displayName: '', email: '', password: '', confirmPassword: '',
    classLevel: '' as ClassLevel | '', rollNumber: '', schoolId: '',
  });

  const [schools] = useState(SCHOOLS);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName || !form.email || !form.password || !form.classLevel) {
      return toast.error('Fill required fields');
    }
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Password min 6 chars');

    setLoading(true);
    try {
      await signUp({
        email: form.email, password: form.password, displayName: form.displayName,
        role: 'student', classLevel: form.classLevel as ClassLevel, rollNumber: form.rollNumber,
        schoolId: form.schoolId || undefined,
      });
      toast.success('Account created!');
      router.push('/student');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') toast.error('Email already used');
      else toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-black/10" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <span className="text-white font-display font-bold text-xl">EduExam</span>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-display font-bold text-white mb-1">Create Account</h2>
          <p className="text-purple-200 text-sm mb-6">Register as a student</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input name="displayName" value={form.displayName} onChange={handleChange}
              placeholder="Full Name *" className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-white/40" />

            <input name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="Email *" className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-white/40" />

            <div className="grid grid-cols-2 gap-3">
              <select name="classLevel" value={form.classLevel} onChange={handleChange}
                className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/40">
                <option value="" className="bg-purple-900">Class *</option>
                {CLASS_LEVELS.map(c => <option key={c} value={c} className="bg-purple-900">{c}</option>)}
              </select>

              <select name="schoolId" value={form.schoolId} onChange={handleChange}
                className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/40">
                <option value="">Select School</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <input name="password" type="password" value={form.password} onChange={handleChange}
              placeholder="Password (min 6) *" className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-white/40" />

            <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange}
              placeholder="Confirm Password *" className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-white/40" />

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-white text-purple-700 font-bold text-sm rounded-xl hover:bg-purple-50 transition-all mt-2 shadow-xl disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-purple-200 text-sm mt-5">
            Have account?{' '}
            <Link href="/auth/login" className="text-white font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
