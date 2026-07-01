import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { BookOpen, CheckCircle2, Circle, AlertCircle, PlayCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface Topic {
  name: string;
  status: 'completed' | 'in-progress' | 'pending';
  coverage: number;
  testsConducted: number;
}

interface SubjectSyllabus {
  subject: string;
  topics: Topic[];
}

const MOCK_SYLLABUS: SubjectSyllabus[] = [
  {
    subject: 'Mathematics',
    topics: [
      { name: 'Calculus', status: 'completed', coverage: 100, testsConducted: 4 },
      { name: 'Probability', status: 'in-progress', coverage: 65, testsConducted: 2 },
      { name: 'Matrices', status: 'completed', coverage: 100, testsConducted: 3 },
      { name: 'Vectors', status: 'pending', coverage: 0, testsConducted: 0 }
    ]
  },
  {
    subject: 'Physics',
    topics: [
      { name: 'Optics', status: 'completed', coverage: 100, testsConducted: 5 },
      { name: 'Thermodynamics', status: 'in-progress', coverage: 40, testsConducted: 1 },
      { name: 'Electromagnetism', status: 'pending', coverage: 0, testsConducted: 0 }
    ]
  }
];

export const SyllabusTracker: React.FC = () => {
  return (
    <div className="space-y-8 pb-20">
      <header>
        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-black text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider mb-2">Curriculum Oversight</Badge>
        <h2 className="text-4xl font-display font-black text-slate-900 tracking-tight">Syllabus Velocity</h2>
        <p className="text-slate-500 font-medium mt-1">Real-time mapping of curriculum coverage against assessment milestones.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {MOCK_SYLLABUS.map((subj, idx) => (
          <motion.div
            key={subj.subject}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="shadow-2xl shadow-slate-200/50 border-0 rounded-[40px] overflow-hidden bg-white">
              <CardHeader className="p-10 border-b border-slate-50">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                         <BookOpen size={24} />
                      </div>
                      <div>
                         <CardTitle className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{subj.subject}</CardTitle>
                         <CardDescription className="font-bold text-slate-400">Total Progress: {Math.round(subj.topics.reduce((acc, t) => acc + t.coverage, 0) / subj.topics.length)}%</CardDescription>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black text-[10px] uppercase">On Track</Badge>
                   </div>
                </div>
              </CardHeader>
              <CardContent className="p-10">
                <div className="space-y-8">
                  {subj.topics.map((topic) => (
                    <div key={topic.name} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {topic.status === 'completed' ? (
                            <CheckCircle2 className="text-emerald-500" size={18} />
                          ) : topic.status === 'in-progress' ? (
                            <PlayCircle className="text-amber-500 animate-pulse" size={18} />
                          ) : (
                            <Circle className="text-slate-200" size={18} />
                          )}
                          <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{topic.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Tests</p>
                              <p className="text-xs font-black text-slate-900 mt-1">{topic.testsConducted}</p>
                           </div>
                           <div className="text-right min-w-[40px]">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Coverage</p>
                              <p className="text-xs font-black text-indigo-600 mt-1">{topic.coverage}%</p>
                           </div>
                        </div>
                      </div>
                      <div className="relative">
                         <Progress value={topic.coverage} className="h-2 bg-slate-100 transition-all rounded-full overflow-hidden" />
                         {topic.coverage < 100 && topic.status === 'in-progress' && (
                            <div className="absolute -top-1 right-0 translate-x-1/2 h-3 w-3 rounded-full bg-white border-2 border-indigo-600" />
                         )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-10 p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <AlertCircle className="text-slate-400" size={20} />
                      <p className="text-[11px] font-bold text-slate-600 leading-tight uppercase tracking-tight">Syllabus gap detected in <span className="text-indigo-600">Vector Algebra</span>. No assessments recorded for 14 days.</p>
                   </div>
                   <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline shrink-0">Schedule Test</button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
