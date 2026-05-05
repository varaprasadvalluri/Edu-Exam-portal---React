"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import PremiumSidebar from '@/components/PremiumSidebar';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, logOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'student')) router.replace('/auth/login');
  }, [profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== 'student') return null;

  const handleLogout = async () => {
    await logOut();
    toast.success('Logged out');
    router.push('/auth/login');
  };

  if (pathname.startsWith('/student/exam/')) return <>{children}</>;

  const studentNavMap: { [k: string]: string } = {
    'my-exams': '/student',
    results: '/student/results',
    profile: '/student/profile',
    dashboard: '/student',
  };

  const sidebarUser = { name: profile.displayName, subtitle: profile.classLevel };

  let activeKey = 'my-exams';
  if (pathname.startsWith('/student/results')) activeKey = 'results';
  else if (pathname.startsWith('/student/profile')) activeKey = 'profile';

  return (
    <div className="min-h-screen bg-[#f5f7ff] flex">
      <PremiumSidebar
        role="student"
        user={sidebarUser}
        active={activeKey}
        onNavigate={(key) => router.push(studentNavMap[key] ?? '/student')}
      />

      <div className="flex-1">
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shadow-glow">
                  <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                  </svg>
                </div>
                <div>
                  <p className="font-display font-bold text-gray-900 text-base leading-none">EduExam</p>
                  <p className="text-gray-400 text-xs">Student Portal</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-gray-800 leading-none">{profile.displayName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{profile.classLevel}</p>
                </div>
                <div className="relative group">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center cursor-pointer shadow-sm">
                    <span className="text-white text-sm font-bold">{profile.displayName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-card border border-gray-100 py-1 hidden group-hover:block z-50">
                    <div className="px-4 py-2.5 border-b border-gray-50">
                      <p className="text-sm font-semibold text-gray-800">{profile.displayName}</p>
                      <p className="text-xs text-gray-400">{profile.email}</p>
                    </div>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors font-medium flex items-center gap-2 mt-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}