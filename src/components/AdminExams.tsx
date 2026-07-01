import React, { useEffect, useState, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs, setDoc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { Exam } from '../types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, Trash2, Clock, FileText, ClipboardList, Eye, EyeOff, BookOpen, Brain, Code, Globe, Calculator, FlaskConical, Search, ShieldCheck, CheckCircle2, Zap, Send } from 'lucide-react';
import { toast } from 'sonner';

import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { motion, AnimatePresence } from 'motion/react';

import { Textarea } from './ui/textarea';
import { AdminDispatchCenter } from './AdminDispatchCenter';

const SUBJECT_ICONS: Record<string, any> = {
  'Mathematics': <Calculator className="h-4 w-4" />,
  'Physics': <FlaskConical className="h-4 w-4" />,
  'Computer Science': <Code className="h-4 w-4" />,
  'English': <BookOpen className="h-4 w-4" />,
  'General Knowledge': <Globe className="h-4 w-4" />,
  'Psychology': <Brain className="h-4 w-4" />,
  'Other': <FileText className="h-4 w-4" />
};

const SUBJECTS = Object.keys(SUBJECT_ICONS);

export const AdminExams: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDispatchExam, setSelectedDispatchExam] = useState<any | null>(null);
  const [step, setStep] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [schoolLinks, setSchoolLinks] = useState<Record<string, string>>({});

  // Real-time link mappings for schools
  useEffect(() => {
    if (profile?.role !== 'school' || !profile?.schoolId) return;
    
    const q = query(
      collection(db, 'secure_exam_links'),
      where('schoolId', '==', profile.schoolId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const linksMap: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        linksMap[data.examId] = data.id; // examId -> secure token id value
      });
      setSchoolLinks(linksMap);
    }, (error) => {
      console.error("Failed to sync secure exam links for school:", error);
    });
    
    return () => unsubscribe();
  }, [profile]);
  
  const [newExam, setNewExam] = useState({
    title: '',
    description: '',
    subject: 'Computer Science',
    difficulty: 'Medium' as const,
    duration: 30,
    totalMarks: 100,
    startTime: '',
    endTime: '',
    assignedSchoolIds: [] as string[]
  });

  const filteredExams = useMemo(() => {
    return exams.filter(e => 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.subject.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [exams, searchQuery]);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const snap = await getDocs(collection(db, 'schools'));
        setSchools(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Failed to load schools for exam allocator:", err);
      }
    };
    if (profile) {
      fetchSchools();
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    
    setLoading(true);
    const examsRef = collection(db, 'exams');
    const q = query(
      examsRef, 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedExams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      
      // In-memory filter avoiding composite query index errors on Firestore.
      // Admins see all; Schools see their drafts or any published exams.
      const permittedExams = profile.role === 'admin'
        ? fetchedExams
        : fetchedExams.filter(e => {
            const isCreator = e.creatorId === profile.uid;
            const isPublished = e.status === 'published';
            const isAssigned = !e.assignedSchoolIds || e.assignedSchoolIds.length === 0 || e.assignedSchoolIds.includes(profile.schoolId);
            return isCreator || (isPublished && isAssigned);
          });

      setExams(permittedExams);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'exams');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleCreateExam = async () => {
    if (!profile) return;
    if (!newExam.title) {
        toast.error("Validation failed: Please provide an exam academic title");
        return;
    }
    if (!newExam.description) {
        toast.error("Validation failed: Please provide a description for the student guidelines");
        return;
    }
    if (!newExam.duration || newExam.duration <= 0) {
        toast.error("Validation failed: Duration must be a positive integer (at least 1 minute)");
        return;
    }
    if (!newExam.totalMarks || newExam.totalMarks <= 0) {
        toast.error("Validation failed: Total marks must be a positive number greater than 0");
        return;
    }
    if (newExam.startTime && newExam.endTime) {
        const start = new Date(newExam.startTime).getTime();
        const end = new Date(newExam.endTime).getTime();
        if (end <= start) {
            toast.error("Validation failed: The ending date/time bounds must be set after the starter start date/time");
            return;
        }
    }
    
    try {
      const examsRef = collection(db, 'exams');
      await addDoc(examsRef, {
        ...newExam,
        creatorId: profile.uid,
        createdAt: new Date().toISOString(),
        startTime: newExam.startTime || null,
        endTime: newExam.endTime || null,
        status: 'draft',
        assignedSchoolIds: newExam.assignedSchoolIds || []
      });

      toast.success("Exam created successfully");
      setIsCreateOpen(false);
      setNewExam({
        title: '',
        description: '',
        subject: 'Computer Science',
        difficulty: 'Medium',
        duration: 30,
        totalMarks: 100,
        startTime: '',
        endTime: '',
        assignedSchoolIds: []
      });
    } catch (error) {
      toast.error("Failed to create exam");
      console.error(error);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm("Are you sure you want to delete this exam?")) return;
    try {
      await deleteDoc(doc(db, 'exams', id));
      toast.success("Exam deleted");
    } catch (error) {
      toast.error("Failed to delete exam");
    }
  };

  const handleToggleStatus = async (exam: Exam) => {
    const nextStatus = exam.status === 'published' ? 'draft' : 'published';
    try {
      const examRef = doc(db, 'exams', exam.id);
      await updateDoc(examRef, { status: nextStatus });
      toast.success(`Exam status updated to ${nextStatus}`);

      if (nextStatus === 'published') {
        let schoolsToProvision = exam.assignedSchoolIds && exam.assignedSchoolIds.length > 0
          ? exam.assignedSchoolIds
          : [];

        if (schoolsToProvision.length === 0) {
          const schoolsSnap = await getDocs(collection(db, 'schools'));
          schoolsToProvision = schoolsSnap.docs.map(d => d.id);
        }

        const expiresAt = exam.endTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        for (const sId of schoolsToProvision) {
          const tokenDocId = `gen_${sId}_${exam.id}`;
          const tokenRef = doc(db, 'secure_exam_links', tokenDocId);
          // Generate a cryptographically strong unique secure token segment
          const uuidToken = `tkn_${crypto.randomUUID().replace(/-/g, "")}`;

          await setDoc(tokenRef, {
            id: uuidToken,
            examId: exam.id,
            schoolId: sId,
            isActive: true,
            expiresAt: expiresAt,
            createdAt: new Date().toISOString()
          }, { merge: true });
        }

        toast.success(`Generated cryptographically locked dynamic links for ${schoolsToProvision.length} schools.`);
      }
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  const canManage = profile?.role === 'admin';
  const canViewResults = profile?.permissions?.includes('view_results') || profile?.role === 'school';

  if (loading) return <div>Loading exams...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Examination Registry</h2>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mt-1">Operational Control</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <Input 
              placeholder="Filter by subject or title..." 
              className="pl-10 bg-white border-slate-200 h-10 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {canManage && (
            <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if(!open) setStep(1); }}>
              <DialogTrigger 
                render={
                  <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all font-bold text-[11px] uppercase tracking-widest h-12 px-6 rounded-xl">
                    <Plus className="h-4 w-4 mr-2" /> CREATE ASSESSMENT
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden rounded-[40px] border-0 shadow-2xl">
                <div className="flex flex-col md:flex-row h-full min-h-[500px]">
                  {/* Sidebar Stepper */}
                  <div className="md:w-64 bg-slate-900 p-8 text-white flex flex-col justify-between">
                     <div>
                        <div className="flex items-center gap-2 mb-10">
                           <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                              <FileText size={16} />
                           </div>
                           <span className="font-black text-xs uppercase tracking-widest">Portal Wizard</span>
                        </div>
                        <div className="space-y-8">
                           {[
                              { id: 1, label: 'Definitions', desc: 'Core Metadata' },
                              { id: 2, label: 'Parameters', desc: 'Marks & Duration' },
                              { id: 3, label: 'Access Control', desc: 'Access Windows' },
                              { id: 4, label: 'Finalize', desc: 'Initialize Portal' }
                           ].map((s) => (
                              <div key={s.id} className="flex items-center gap-4 group cursor-default">
                                 <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all ${step >= s.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-700 text-slate-500'}`}>
                                    {step > s.id ? <CheckCircle2 size={14} /> : s.id}
                                 </div>
                                 <div className="hidden md:block">
                                    <p className={`text-[10px] font-black uppercase tracking-widest leading-none ${step === s.id ? 'text-white' : 'text-slate-500'}`}>{s.label}</p>
                                    <p className="text-[9px] font-bold text-slate-600 mt-1">{s.desc}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                     <div className="hidden md:block bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Pro-Tip</p>
                        <p className="text-[10px] text-slate-300 leading-relaxed font-medium">Use AI to import questions directly once the portal is initialized.</p>
                     </div>
                  </div>

                  {/* Content Area */}
                  <div className="flex-grow p-10 bg-white min-h-[500px] flex flex-col">
                     <div className="flex-grow">
                        <AnimatePresence mode="wait">
                           {step === 1 && (
                             <motion.div 
                               key="step1"
                               initial={{ opacity: 0, x: 20 }}
                               animate={{ opacity: 1, x: 0 }}
                               exit={{ opacity: 0, x: -20 }}
                               className="space-y-8"
                             >
                               <div>
                                 <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Assessment Definitions</h3>
                                 <p className="text-sm font-medium text-slate-400">Establish the identity of this assessment portal.</p>
                               </div>
                               <div className="space-y-6">
                                 <div className="grid gap-3">
                                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Exam Title</Label>
                                   <Input value={newExam.title} onChange={e => setNewExam({...newExam, title: e.target.value})} placeholder="e.g. JEE Advanced Mock - Wave Optics" className="h-14 rounded-2xl bg-slate-50 border-0 focus-visible:ring-indigo-600" />
                                 </div>
                                 <div className="grid gap-3">
                                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Subject Category</Label>
                                   <Select value={newExam.subject} onValueChange={(val) => setNewExam({...newExam, subject: val})}>
                                     <SelectTrigger className="h-14 rounded-2xl bg-white border-2 border-slate-300 text-slate-900 font-bold px-4 justify-between focus:border-indigo-650 focus:ring-4 focus:ring-indigo-500/10 hover:border-indigo-500 transition-all">
                                       <SelectValue placeholder="Select Subject" />
                                     </SelectTrigger>
                                     <SelectContent className="bg-white border-2 border-slate-300 shadow-2xl rounded-2xl p-1.5 z-50">
                                       {SUBJECTS.map(s => (
                                         <SelectItem key={s} value={s} className="font-bold text-xs text-slate-800 hover:bg-slate-50 cursor-pointer py-1.5 px-3 rounded-lg">{s}</SelectItem>
                                       ))}
                                     </SelectContent>
                                   </Select>
                                 </div>
                                 <div className="grid gap-3">
                                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Manual Instructions</Label>
                                   <Textarea value={newExam.description} onChange={e => setNewExam({...newExam, description: e.target.value})} className="rounded-2xl bg-slate-50 border-0 min-h-[120px] resize-none" placeholder="Provide syllabus coverage and instructions..." />
                                 </div>
                               </div>
                             </motion.div>
                           )}

                           {step === 2 && (
                             <motion.div 
                               key="step2"
                               initial={{ opacity: 0, x: 20 }}
                               animate={{ opacity: 1, x: 0 }}
                               exit={{ opacity: 0, x: -20 }}
                               className="space-y-8"
                             >
                               <div>
                                 <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Quantifiable Rules</h3>
                                 <p className="text-sm font-medium text-slate-400">Set the operational metrics for this session.</p>
                               </div>
                               <div className="grid grid-cols-2 gap-6">
                                 <div className="grid gap-3">
                                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Marks</Label>
                                   <Input type="number" value={newExam.totalMarks} onChange={e => setNewExam({...newExam, totalMarks: parseInt(e.target.value) || 0})} className="h-14 rounded-2xl bg-slate-50 border-0" />
                                 </div>
                                 <div className="grid gap-3">
                                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Time Limit (Min)</Label>
                                   <Input type="number" value={newExam.duration} onChange={e => setNewExam({...newExam, duration: parseInt(e.target.value) || 0})} className="h-14 rounded-2xl bg-slate-50 border-0" />
                                 </div>
                               </div>
                               <div className="grid gap-3">
                                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Difficulty Heuristic</Label>
                                 <div className="flex gap-3">
                                    {['Easy', 'Medium', 'Hard'].map((d: any) => (
                                       <button 
                                          key={d} 
                                          type="button"
                                          onClick={() => setNewExam({...newExam, difficulty: d})}
                                          className={`flex-1 h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest border-2 transition-all ${newExam.difficulty === d ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-lg shadow-indigo-100' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                       >
                                          {d}
                                       </button>
                                    ))}
                                 </div>
                               </div>
                             </motion.div>
                           )}

                           {step === 3 && (
                             <motion.div 
                               key="step3"
                               initial={{ opacity: 0, x: 20 }}
                               animate={{ opacity: 1, x: 0 }}
                               exit={{ opacity: 0, x: -20 }}
                               className="space-y-8"
                             >
                               <div>
                                 <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Access Protocol</h3>
                                 <p className="text-sm font-medium text-slate-400">Define the valid temporal window for student access.</p>
                               </div>
                               <div className="space-y-6">
                                 <div className="grid gap-3">
                                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Release Window (Start)</Label>
                                   <Input type="datetime-local" value={newExam.startTime} onChange={e => setNewExam({...newExam, startTime: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-0" />
                                 </div>
                                 <div className="grid gap-3">
                                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lock Window (End)</Label>
                                   <Input type="datetime-local" value={newExam.endTime} onChange={e => setNewExam({...newExam, endTime: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-0" />
                                  </div>

                                  {/* Institution Allocation Targeter */}
                                  <div className="pt-4 border-t border-slate-100 space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Institution Allocation Targets</Label>
                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        variant={newExam.assignedSchoolIds.length === 0 ? "default" : "outline"}
                                        onClick={() => setNewExam({ ...newExam, assignedSchoolIds: [] })}
                                        className={`text-[10.5px] font-black uppercase tracking-wider rounded-xl py-2 px-3 h-9 ${newExam.assignedSchoolIds.length === 0 ? 'bg-indigo-650 text-white hover:bg-slate-950' : 'bg-transparent text-slate-800 border'}`}
                                      >
                                        Global (All Schools)
                                      </Button>
                                      <Button
                                        type="button"
                                        variant={newExam.assignedSchoolIds.length > 0 ? "default" : "outline"}
                                        onClick={() => {
                                          if (schools.length > 0) {
                                            setNewExam({ ...newExam, assignedSchoolIds: [schools[0].id] });
                                          } else {
                                            toast.error("No other institutions registered yet to form a cluster.");
                                          }
                                        }}
                                        className={`text-[10.5px] font-black uppercase tracking-wider rounded-xl py-2 px-3 h-9 ${newExam.assignedSchoolIds.length > 0 ? 'bg-indigo-650 text-white hover:bg-slate-950' : 'bg-transparent text-slate-800 border'}`}
                                      >
                                        Specific Schools Cluster
                                      </Button>
                                    </div>

                                    {newExam.assignedSchoolIds.length > 0 && schools.length > 0 && (
                                      <div className="p-4 bg-slate-50 rounded-[20px] max-h-[150px] overflow-y-auto space-y-2 border border-slate-200/50">
                                        {schools.map((school) => {
                                          const checked = newExam.assignedSchoolIds.includes(school.id);
                                          return (
                                            <label key={school.id} className="flex items-center gap-3 cursor-pointer p-1.5 hover:bg-slate-100/50 rounded-lg">
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                  const current = [...newExam.assignedSchoolIds];
                                                  if (checked) {
                                                    const filtered = current.filter(id => id !== school.id);
                                                    setNewExam({ ...newExam, assignedSchoolIds: filtered });
                                                  } else {
                                                    setNewExam({ ...newExam, assignedSchoolIds: [...current, school.id] });
                                                  }
                                                }}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                              />
                                              <span className="text-xs font-bold text-slate-705">{school.name}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                 </div>
                                 <div className="bg-emerald-50 p-5 rounded-[24px] border border-emerald-100 flex items-center gap-5">
                                    <div className="h-10 w-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0">
                                       <ShieldCheck size={20} />
                                    </div>
                                    <p className="text-[11px] font-bold text-emerald-700 leading-relaxed uppercase tracking-tight">Automated access control will prevent students from starting or viewing content after the lock window expires.</p>
                                 </div>
                               </div>
                             </motion.div>
                           )}

                           {step === 4 && (
                             <motion.div 
                               key="step4"
                               initial={{ opacity: 0, x: 20 }}
                               animate={{ opacity: 1, x: 0 }}
                               exit={{ opacity: 0, x: -20 }}
                               className="space-y-8 text-center py-6"
                             >
                               <div className="h-24 w-24 bg-indigo-600 rounded-[32px] flex items-center justify-center text-white mx-auto shadow-2xl shadow-indigo-200">
                                  <Zap size={48} className="fill-white" />
                               </div>
                               <div>
                                 <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Initialize Portal?</h3>
                                 <p className="text-sm font-medium text-slate-400 mt-2">Final validation required before deployment to the registry.</p>
                               </div>
                               <div className="bg-slate-50 p-8 rounded-[32px] text-left border border-slate-100">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Summary Verification</p>
                                  <div className="space-y-4">
                                     <div className="flex justify-between text-xs font-black uppercase tracking-tight">
                                        <span className="text-slate-500">Subject</span>
                                        <span className="text-slate-900">{newExam.subject}</span>
                                     </div>
                                     <div className="flex justify-between text-xs font-black uppercase tracking-tight">
                                        <span className="text-slate-500">Difficulty</span>
                                        <span className="text-indigo-600 font-black">{newExam.difficulty}</span>
                                     </div>
                                     <div className="flex justify-between text-xs font-black uppercase tracking-tight">
                                        <span className="text-slate-500">Total Run-Time</span>
                                        <span className="text-slate-900">{newExam.duration} Minutes</span>
                                     </div>
                                  </div>
                               </div>
                             </motion.div>
                           )}
                        </AnimatePresence>
                     </div>

                     <div className="mt-8 flex gap-4">
                        {step > 1 && (
                           <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 h-14 rounded-2xl border-slate-100 font-black text-[11px] uppercase tracking-widest text-slate-500">Previous</Button>
                        )}
                        {step < 4 ? (
                           <Button onClick={() => setStep(step + 1)} className="flex-[2] bg-indigo-600 text-white h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Continue Phase</Button>
                        ) : (
                           <Button onClick={handleCreateExam} className="flex-[2] bg-slate-900 text-white h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all">Initialize Assessment</Button>
                        )}
                     </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Overview Removed to favor Overview Dashboard */}

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.slice((page - 1) * pageSize, page * pageSize).map(exam => (
            <Card key={exam.id} className="relative overflow-hidden group border-slate-200 hover:border-indigo-300 transition-all shadow-sm hover:shadow-xl bg-white rounded-2xl">
              <div className={`h-1 w-full absolute top-0 left-0 transition-all ${exam.status === 'published' ? 'bg-green-500' : 'bg-slate-300'}`} />
              
              <CardHeader className="pb-4 pt-6">
                <div className="flex items-center gap-2 mb-2">
                   <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                      {SUBJECT_ICONS[exam.subject] || <FileText className="h-4 w-4" />}
                   </div>
                   <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{exam.subject}</span>
                </div>
                
                <div className="flex items-start justify-between">
                  <CardTitle className="line-clamp-1 font-display font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{exam.title}</CardTitle>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={`h-8 w-8 transition-all rounded-full ${exam.status === 'published' ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`} 
                        onClick={() => handleToggleStatus(exam)}
                        title={exam.status === 'published' ? 'Unpublish' : 'Publish'}
                      >
                        {exam.status === 'published' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteExam(exam.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription className="whitespace-pre-wrap text-slate-500 text-sm leading-relaxed mt-1 line-clamp-3">{exam.description || 'Comprehensive assessment criteria and instructions for students.'}</CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                 <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-full border border-slate-100">
                      <Clock className="h-3.5 w-3.5 text-indigo-500" />
                      {exam.duration}m
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-full border border-slate-100">
                      <FileText className="h-3.5 w-3.5 text-indigo-500" />
                      {exam.totalMarks} Pts
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-tighter px-2.5 py-1.5 rounded-full border ${
                      exam.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      exam.difficulty === 'Medium' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {exam.difficulty}
                    </div>
                 </div>

                 {profile?.role === 'school' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-650 flex items-center gap-1">
                          <ShieldCheck className="h-4 w-4 text-indigo-500" /> Secure Portal Link
                        </span>
                        {schoolLinks[exam.id] ? (
                          <div className="bg-emerald-50 text-emerald-700 border border-emerald-250 text-[8px] font-bold uppercase py-0.5 px-2 rounded-full">
                            Sealed & Active
                          </div>
                        ) : (
                          <div className="bg-amber-50 text-amber-700 border border-amber-250 text-[8px] font-bold uppercase py-0.5 px-2 rounded-full animate-pulse">
                            Pending Seal
                          </div>
                        )}
                      </div>
                      
                      {schoolLinks[exam.id] ? (
                        <div className="flex gap-2 items-center">
                          <Input 
                            readOnly 
                            value={`${window.location.origin}/portal/school/${profile.schoolId}/exam/${exam.id}/${schoolLinks[exam.id]}`}
                            className="bg-slate-50 border-slate-200 h-9 text-[10px] font-mono text-slate-500 select-all rounded-lg flex-1 cursor-default"
                          />
                          <Button 
                            className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shrink-0"
                            onClick={() => {
                              const secureUrl = `${window.location.origin}/portal/school/${profile.schoolId}/exam/${exam.id}/${schoolLinks[exam.id]}`;
                              navigator.clipboard.writeText(secureUrl);
                              toast.success("Secure link copied toClipboard!");
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      ) : (
                        <div className="p-2 w-full rounded-lg bg-amber-50 border border-amber-100 text-[10px] font-semibold text-amber-700 leading-normal">
                          Waiting for secure token signature. Contact admin to re-publish if this persists.
                        </div>
                      )}
                    </div>
                 )}
              </CardContent>
              <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex gap-2 p-4">
                 {canManage && (
                   <Button className="flex-1 h-10 text-[10px] font-black uppercase tracking-wider rounded-lg border-slate-200 bg-white" variant="outline" onClick={() => navigate(`/admin/exam/${exam.id}`)}>
                     <Plus className="h-3 w-3 mr-1 text-indigo-550" /> Build
                   </Button>
                 )}
                 {canManage && (
                   <Button className="flex-1 h-10 text-[10px] font-black uppercase tracking-wider rounded-lg border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 text-indigo-705" variant="outline" onClick={() => setSelectedDispatchExam(exam)}>
                     <Send className="h-3 w-3 mr-1 text-indigo-600 animate-pulse" /> Dispatch
                   </Button>
                 )}
                 {canViewResults && (
                   <Button className="flex-1 h-10 text-[10px] font-black uppercase tracking-wider rounded-lg border-slate-200 bg-white" variant="outline" onClick={() => navigate(`/admin/results/${exam.id}`)}>
                     <ClipboardList className="h-3 w-3 mr-1 text-slate-500" /> Reports
                   </Button>
                 )}
              </CardFooter>
            </Card>
          ))}
          
          {exams.length === 0 && (
            <div className="col-span-full py-32 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white shadow-inner">
               <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                 <ShieldCheck className="h-8 w-8 text-slate-300" />
               </div>
               <h3 className="text-xl font-bold text-slate-900">Admin Control Center</h3>
               <p className="text-slate-500 mb-8 max-w-sm mx-auto">Welcome to the System Administration portal. Start by creating an examination or managing institutional branches.</p>
               <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg px-8" onClick={() => setIsCreateOpen(true)}>Create First Exam</Button>
                  {profile?.role === 'admin' && (
                    <Button variant="outline" className="border-slate-200 bg-white shadow-sm px-8" onClick={() => navigate('/admin/schools')}>Manage Institutions</Button>
                  )}
               </div>
            </div>
          )}
        </div>

        {/* Global Pagination Controls for Exam Registry */}
        {filteredExams.length > 0 && (
          <div className="p-6 border border-slate-200 rounded-[24px] flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Items per page:</span>
              <select 
                value={pageSize} 
                onChange={e => {
                  setPageSize(parseInt(e.target.value));
                  setPage(1);
                }}
                className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                {[3, 6, 12, 24].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span className="text-xs font-medium text-slate-400 ml-4">
                Showing {Math.min(filteredExams.length, (page - 1) * pageSize + 1)} - {Math.min(filteredExams.length, page * pageSize)} of {filteredExams.length} Exams
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 px-3 rounded-lg border-slate-200 font-bold text-xs"
              >
                Previous
              </Button>
              {Array.from({ length: Math.ceil(filteredExams.length / pageSize) }).map((_, idx) => (
                <Button
                  key={idx}
                  variant={page === idx + 1 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(idx + 1)}
                  className={`h-9 w-9 p-0 rounded-lg text-xs font-bold ${page === idx + 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600'}`}
                >
                  {idx + 1}
                </Button>
              ))}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(Math.ceil(filteredExams.length / pageSize), p + 1))}
                disabled={page === Math.ceil(filteredExams.length / pageSize) || filteredExams.length === 0}
                className="h-9 px-3 rounded-lg border-slate-200 font-bold text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {selectedDispatchExam && (
        <AdminDispatchCenter
          exam={selectedDispatchExam}
          isOpen={!!selectedDispatchExam}
          onClose={() => setSelectedDispatchExam(null)}
        />
      )}
    </div>
  );
};
