'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Fill all fields');
    setLoading(true);
    try {
      const profile = await signIn(email, password);
      toast.success(`Welcome, ${profile.displayName}!`);
      router.push(profile.role === 'admin' ? '/admin' : '/student');
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      if (msg.includes('invalid-credential')) toast.error('Wrong email or password');
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 relative overflow-hidden animate-gradient">
      <div className="absolute inset-0 bg-black/10" />
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(120,119,198,0.3), transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,105,180,0.3), transparent 50%)',
      }} />
      
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-16 relative z-10">
        <div className="max-w-lg text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-2xl shadow-purple-500/30">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl">EduExam Portal</h2>
              <p className="text-purple-200 text-sm">Smart Exam System</p>
            </div>
          </div>
          
          <h1 className="text-5xl font-display font-bold leading-tight mb-6">
            Transform Your
            <span className="block bg-gradient-to-r from-yellow-200 to-pink-200 bg-clip-text text-transparent">
              Exam Experience
            </span>
          </h1>
          
          <p className="text-purple-100 text-lg mb-8 leading-relaxed">
            Secure, real-time online exams with anti-cheat protection, instant results, and comprehensive analytics.
          </p>
          
          {[
            { icon: '⚡', text: 'Real-time monitoring with auto-save' },
            { icon: '🛡️', text: 'Advanced anti-cheat detection' },
            { icon: '📊', text: 'Instant results & analytics' },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-xl">
                {f.icon}
              </div>
              <p className="text-purple-100">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                </svg>
              </div>
              <span className="text-white font-display font-bold text-xl">EduExam</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.25)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition-all duration-300">
            <h2 className="text-2xl font-display font-bold text-white mb-6">Sign In</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/40 text-sm shadow-inner"
                  disabled={loading}
                />
              </div>

              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/40 text-sm shadow-inner"
                  disabled={loading}
                />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-white to-purple-100 text-purple-700 font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl hover:shadow-2xl disabled:opacity-50">
                {loading ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>

            <p className="text-center text-purple-200 text-sm mt-6">
              New student?{' '}
              <Link href="/auth/register" className="text-white font-bold hover:underline">
                Register here
              </Link>
            </p>
          </div>

          <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur">
            <p className="text-purple-200 text-xs font-semibold mb-2">📝 Getting Started</p>
            <p className="text-purple-100 text-xs leading-relaxed">
              Register as student, then admin can upgrade your role in Firebase Console → Firestore → users collection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
