'use client';
import { useRouter } from 'next/navigation';

import React, { useMemo, useState } from 'react';

type Role = 'admin' | 'student';
type MenuItem = { key: string; label: string; icon: JSX.Element; hint?: string };
type SidebarProps = {
  role: Role;
  collapsed?: boolean;
  active?: string;
  onNavigate?: (key: string) => void;
  onCollapse?: (collapsed: boolean) => void;
  onLogout?: () => void;
  user?: { name?: string; subtitle?: string; avatarUrl?: string };
};

const LogoutIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function LogoutButton({ onLogout, collapsed }: { onLogout?: () => void; collapsed: boolean }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      if (onLogout) {
        await onLogout();
      }
      // Clear auth
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Navigate properly
      router.push('/auth/login');
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <button
      onClick={handleLogout}
      title="Sign Out"
      className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition w-full"
    >
      {LogoutIcon}
      {!collapsed && <span className="text-sm font-medium">Signout</span>}
    </button>
  );
}

const Icon = {
  Dashboard: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h8V3H3v10zM13 21h8V11h-8v10zM13 3v8h8V3h-8zM3 21h8v-6H3v6z" />
    </svg>
  ),
  Schools: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 17l10 5 10-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12l10 5 10-5" />
    </svg>
  ),
  Students: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
      <path d="M6 20v-2c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v2" />
    </svg>
  ),
  Exams: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 8v8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 12h8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Questions: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 18h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.09 9a3 3 0 115.82 1c0 2-3 2.5-3 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Results: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12A9 9 0 1112 3a9 9 0 019 9z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Analytics: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 14v4M12 10v8M17 6v12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Settings: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 15.5A3.5 3.5 0 1012 8.5a3.5 3.5 0 000 7z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82L4.21 5.1A2 2 0 016.89 2.27l.06.06a1.65 1.65 0 001.82.33h.09A1.65 1.65 0 0010 3.09V3a2 2 0 014 0v.09c.32.06.62.2.88.4.6.45 1.27.72 2 .72.41 0 .81-.07 1.19-.2l.12-.04a2 2 0 012.65 2.65l-.04.12c-.13.38-.2.78-.2 1.19 0 .73.27 1.4.72 2 .2.26.34.56.4.88H21a2 2 0 010 4h-.09c-.06.32-.2.62-.4.88-.45.6-.72 1.27-.72 2 0 .41.07.81.2 1.19l.04.12a2 2 0 01-2.65 2.65l-.12-.04a1.65 1.65 0 00-1.19-.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  MyExams: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 7V3M16 7V3M3 11h18" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="7" width="18" height="14" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Profile: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 20v-1a6 6 0 0112 0v1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ResultsSmall: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12A9 9 0 1112 3a9 9 0 019 9z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function PremiumSidebar({ role, collapsed: collapsedProp, active, onNavigate, onCollapse, onLogout, user }: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(collapsedProp ?? false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const collapsed = collapsedProp ?? internalCollapsed;
  const setCollapsed = (v: boolean) => {
    if (collapsedProp === undefined) setInternalCollapsed(v);
    onCollapse?.(v);
  };

  const menus = useMemo<Record<Role, MenuItem[]>>(() => ({
    admin: [
      { key: 'dashboard', label: 'Dashboard', icon: Icon.Dashboard },
      { key: 'schools', label: 'Schools', icon: Icon.Schools },
      { key: 'students', label: 'Students', icon: Icon.Students },
      { key: 'exams', label: 'Exams', icon: Icon.Exams },
      { key: 'questions', label: 'Questions', icon: Icon.Questions },
      { key: 'results', label: 'Results', icon: Icon.Results },
      { key: 'analytics', label: 'Analytics', icon: Icon.Analytics },
      { key: 'settings', label: 'Settings', icon: Icon.Settings },
    ],
    student: [
      { key: 'dashboard', label: 'Dashboard', icon: Icon.Dashboard },
      { key: 'my-exams', label: 'My Exams', icon: Icon.MyExams },
      { key: 'results', label: 'Results', icon: Icon.ResultsSmall },
      { key: 'profile', label: 'Profile', icon: Icon.Profile },
    ],
  }), []);

  const activeKey = active ?? menus[role][0]?.key;
  const handleNavigate = (key: string) => { onNavigate?.(key); setMobileOpen(false); };

  return (
    <>
      <div className="md:hidden flex items-center">
        <button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <aside className={`relative z-40 flex-shrink-0 bg-white border-r border-gray-100 shadow-sm transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-72'} hidden md:flex flex-col`} aria-label="Sidebar">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center rounded-md text-primary-600 bg-gradient-to-br from-primary-50 to-white p-2 ${collapsed ? 'w-8 h-8' : 'w-10 h-10'}`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>
            </div>
            {!collapsed && <div><div className="text-sm font-semibold text-gray-800">Exam Portal</div><div className="text-xs text-gray-400">Premium Admin</div></div>}
          </div>
          <button aria-label={collapsed ? 'Expand' : 'Collapse'} onClick={() => setCollapsed(!collapsed)} className="p-2 rounded-md hover:bg-gray-100 transition">
            <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {collapsed ? <path d="M8 15l7-7" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M16 8l-7 7" strokeLinecap="round" strokeLinejoin="round" />}
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {menus[role].map(item => {
              const isActive = item.key === activeKey;
              return (
                <li key={item.key}>
                  <button onClick={() => handleNavigate(item.key)} title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 ${isActive ? 'bg-primary-50 ring-1 ring-primary-200 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                    <span className={`w-1 h-6 rounded-r-md mr-2 transition-colors ${isActive ? 'bg-primary-500' : 'bg-transparent'}`} />
                    <span className={`flex-shrink-0 inline-flex items-center justify-center ${isActive ? 'text-primary-600' : 'text-gray-500'}`}>{item.icon}</span>
                    <span className={`flex-1 text-left text-sm font-medium transition-all ${collapsed ? 'opacity-0 translate-x-2 pointer-events-none' : 'opacity-100'}`}>{item.label}</span>
                    {!collapsed && isActive && <span className="text-xs text-primary-500 font-semibold ml-2">●</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3 py-3 border-t border-gray-100 space-y-2">
  {/* ✅ ONLY ADMIN CAN SEE THIS ENTIRE SECTION */}
  {role === 'admin' && (
    !collapsed ? (
      <>
        <div className="flex items-center gap-3">
          <img
            src={user?.avatarUrl || "/avatar-placeholder.png"}
            alt="avatar"
            className="w-9 h-9 rounded-full object-cover border border-gray-100"
          />
          <div>
            <div className="text-sm font-semibold text-gray-800">
              {user?.name ?? 'Admin'}
            </div>
            <div className="text-xs text-gray-400">
              {user?.subtitle ?? 'Superuser'}
            </div>
          </div>
        </div>

        <LogoutButton onLogout={onLogout} collapsed={collapsed} />
      </>
    ) : (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-md hover:bg-gray-100 transition"
          aria-label="Open"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <LogoutButton onLogout={onLogout} collapsed={collapsed} />
      </div>
    )
  )}
</div>
      </aside>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} aria-hidden={!mobileOpen}>
        <div className={`absolute inset-0 bg-black bg-opacity-30 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setMobileOpen(false)} />
        <div className={`absolute left-0 top-0 bottom-0 w-80 bg-white shadow-xl border-r border-gray-100 flex flex-col transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-primary-50 flex items-center justify-center text-primary-600">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>
              </div>
              <div><div className="text-sm font-semibold text-gray-800">Exam Portal</div><div className="text-xs text-gray-400">Premium</div></div>
            </div>
            <button onClick={() => setMobileOpen(false)} className="p-2 rounded-md hover:bg-gray-100 transition">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-2">
              {menus[role].map(item => {
                const isActive = item.key === activeKey;
                return (
                  <li key={item.key}>
                    <button onClick={() => handleNavigate(item.key)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 transition ${isActive ? 'bg-primary-50 ring-1 ring-primary-200 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                      <span className="flex-shrink-0 inline-flex items-center justify-center text-gray-600">{item.icon}</span>
                      <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="p-3 border-t border-gray-100">
            <LogoutButton onLogout={onLogout} collapsed={false} />
          </div>
        </div>
      </div>
    </>
  );
}