import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes without conflicts */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format seconds into MM:SS */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Format minutes into human-readable */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Score to color class */
export function scoreColor(pct: number): string {
  if (pct >= 75) return 'text-success-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-danger-600';
}

/** Score to progress bar color */
export function scoreBgColor(pct: number): string {
  if (pct >= 75) return 'bg-success-500';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-danger-500';
}

/** Truncate text */
export function truncate(text: string, max = 60): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

/** Generate a random ID */
export function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

/** Check if an exam is currently live */
export function isExamLive(startTime: string, endTime: string): boolean {
  const now = Date.now();
  return now >= new Date(startTime).getTime() && now <= new Date(endTime).getTime();
}

/** Shuffle array (Fisher-Yates) */
export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
