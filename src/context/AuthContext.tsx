'use client';
// ============================================================
// AUTHENTICATION CONTEXT
// ============================================================
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, createUserProfile, updateUserProfile } from '@/lib/firestore';
import type { AppUser, UserRole, ClassLevel } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signUp: (data: SignUpData) => Promise<void>;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface SignUpData {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  classLevel?: ClassLevel;
  rollNumber?: string;
  schoolId?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userProfile = await getUserProfile(firebaseUser.uid);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string): Promise<AppUser> => {
    const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
    const userProfile = await getUserProfile(firebaseUser.uid);
    if (!userProfile) throw new Error('User profile not found. Please contact admin.');
    if (!userProfile.isActive) throw new Error('Your account has been deactivated. Contact admin.');
    setProfile(userProfile);
    return userProfile;
  };

  const signUp = async (data: SignUpData) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );
    await updateProfile(firebaseUser, { displayName: data.displayName });
    await createUserProfile(firebaseUser.uid, {
      uid: firebaseUser.uid,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      classLevel: data.classLevel,
      schoolId: data.schoolId,
      rollNumber: data.rollNumber,
      isActive: true,
    });
  };

  const logOut = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const refreshProfile = async () => {
    if (user) {
      const userProfile = await getUserProfile(user.uid);
      setProfile(userProfile);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, logOut, resetPassword, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
