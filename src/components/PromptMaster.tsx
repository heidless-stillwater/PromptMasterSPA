import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Send, RefreshCw, X, Sliders, CheckCircle2, Loader2, AlertCircle, Clock, Image, Zap } from 'lucide-react';
import { triggerGeneration, type GenerationProgress } from '../lib/services/prompt-tool';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';

interface Prompt {
  id: string;
  title: string;
  template?: string;
  prompts?: string[];
  thumbnailUrl?: string;
  description?: string;
}

interface StatusStep {
  id: string;
  label: string;
  status: 'waiting' | 'active' | 'done' | 'error';
}

interface CompletionSummary {
  creditsUsed?: number;
  remainingBalance?: number;
  imageUrl?: string;
  quality?: string;
  elapsed?: number;
}

const FALLBACK_PROMPTS: Prompt[] = [
  {
    id: 'sample-1',
    title: 'Cyberpunk Character Portrait',
    description: 'Neon-lit gritty cyberpunk character generation.',
    prompts: ['A {{character}} in a gritty {{setting}}, cinematic lighting, cyberpunk aesthetic, masterpiece, 8k'],
    thumbnailUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=cyber1'
  },
  {
    id: 'sample-2',
    title: 'Architectural Visualization',
    description: 'Photorealistic interior design and materials.',
    prompts: ['Modern {{room}} with {{material}} accents, natural sunlight streaming through windows, architectural photography'],
    thumbnailUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=arch1'
  }
];

const INITIAL_STEPS: StatusStep[] = [
  { id: 'auth',     label: 'Verifying credentials',     status: 'waiting' },
  { id: 'queue',    label: 'Queuing generation request', status: 'waiting' },
  { id: 'generate', label: 'Running AI generation',      status: 'waiting' },
  { id: 'upload',   label: 'Uploading to storage',       status: 'waiting' },
  { id: 'complete', label: 'Finalising result',          status: 'waiting' },
];

const PromptMaster: React.FC = () => {
  const { user } = useAuth();
  const { promptId } = useParams();
  const [prompts, setPrompts] = useState<Prompt[]>(FALLBACK_PROMPTS);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [resultantPrompt, setResultantPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState('nanobanana-2.0');

  // Progress tracking
  const [steps, setSteps] = useState<StatusStep[]>(INITIAL_STEPS);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [completion, setCompletion] = useState<CompletionSummary | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setStep = (id: string, status: StatusStep['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const resetProgress = () => {
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'waiting' })));
    setProgressMsg('');
    setProgressCurrent(0);
    setProgressTotal(1);
    setElapsed(0);
    setCompletion(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const snap = await getDocs(collection(db, 'resources'));
        const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prompt));
        setPrompts(fetched.length > 0 ? fetched : FALLBACK_PROMPTS);
      } catch (err) {
        setPrompts(FALLBACK_PROMPTS);
      }
    };
    fetchPrompts();
  }, []);

  useEffect(() => {
    if (promptId && prompts.length > 0) {
      const p = prompts.find(x => x.id === promptId);
      if (p) handleSelect(p);
    }
  }, [promptId, prompts]);

  const extractVariables = (template: string) => {
    const regex = /{{(.*?)}}/g;
    const matches = [...template.matchAll(regex)];
    const vars: Record<string, string> = {};
    matches.forEach(match => { vars[match[1]] = ''; });
    setVariables(vars);
  };

  const handleSelect = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    const template = prompt.prompts?.[0] || prompt.template || '';
    extractVariables(template);
  };

  useEffect(() => {
    if (!selectedPrompt) return;
    let result = selectedPrompt.prompts?.[0] || selectedPrompt.template || '';
    Object.entries(variables).forEach(([key, value]) => {
      const displayValue = value || `[${key}]`;
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), displayValue);
    });
    setResultantPrompt(result);
  }, [variables, selectedPrompt]);

  const handleSubmit = async () => {
    if (!user || !resultantPrompt) return;
    resetProgress();
    setGenerating(true);
    setError(null);
    setGeneratedImage(null);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    try {
      setStep('auth', 'active');
      const idToken = await user.getIdToken();
      setStep('auth', 'done');
      setStep('queue', 'active');

      await triggerGeneration(resultantPrompt, user.uid, idToken, (event: GenerationProgress) => {
        if (event.type === 'progress') {
          setStep('queue', 'done');
          setStep('generate', 'active');
          setProgressMsg(event.message || 'Generating...');
          setProgressCurrent(event.current || 0);
          setProgressTotal(event.total || 1);
        }
        if (event.type === 'image_ready') {
          setStep('generate', 'done');
          setStep('upload', 'active');
          const url = event.image?.imageUrl || null;
          setGeneratedImage(url);
          setTimeout(() => setStep('upload', 'done'), 600);
        }
        if (event.type === 'complete') {
          setStep('upload', 'done');
          setStep('complete', 'active');
          const finalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setCompletion({
            creditsUsed: event.creditsUsed,
            remainingBalance: event.remainingBalance,
            imageUrl: generatedImage || undefined,
            elapsed: finalElapsed,
          });
          if (timerRef.current) clearInterval(timerRef.current);
          setTimeout(() => { setStep('complete', 'done'); setGenerating(false); }, 500);
        }
        if (event.type === 'error') {
          steps.forEach(s => { if (s.status === 'active') setStep(s.id, 'error'); });
          setError(event.error || 'Unknown error');
          if (timerRef.current) clearInterval(timerRef.current);
          setGenerating(false);
        }
      });

      await addDoc(collection(db, 'generations'), {
        uid: user.uid,
        prompt: resultantPrompt,
        timestamp: serverTimestamp(),
        imageUrl: generatedImage,
        engine
      });
    } catch (err: any) {
      setError(err.message);
      if (timerRef.current) clearInterval(timerRef.current);
      setGenerating(false);
    }
  };

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const StepIcon = ({ status }: { status: StatusStep['status'] }) => {
    if (status === 'done')    return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    if (status === 'active')  return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    if (status === 'error')   return <AlertCircle className="w-4 h-4 text-red-400" />;
    return <div className="w-4 h-4 rounded-full border border-white/20" />;
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {!selectedPrompt ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {prompts.map((p, i) => (
            <div 
              key={p.id} 
              onClick={() => handleSelect(p)} 
              className="relative group cursor-pointer flex flex-col h-full animate-fade-in-up opacity-0"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-3xl blur opacity-0 group-hover:opacity-40 transition duration-700 group-hover:duration-300"></div>
              <div className="relative glass-panel p-6 bg-white/5 hover:bg-white/10 transition-all duration-500 transform group-hover:scale-[1.02] border-white/5 group-hover:border-primary/30 flex-1 flex flex-col justify-between">
                <div className="flex gap-6 items-start">
                  <div className="relative shrink-0">
                    <div className="absolute -inset-1 bg-white/20 blur opacity-0 group-hover:opacity-100 rounded-xl transition duration-500"></div>
                    <img src={p.thumbnailUrl} className="relative w-24 h-24 rounded-xl bg-black/40 object-cover shadow-2xl ring-1 ring-white/10" alt="" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{p.title}</h3>
                    <p className="text-sm text-gray-400 mt-2 leading-relaxed">{p.description}</p>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-end">
                  <span className="text-[10px] uppercase font-black tracking-widest text-primary/0 group-hover:text-primary/100 transition-colors flex items-center gap-2">Customize <RefreshCw className="w-3 h-3 group-hover:animate-spin" /></span>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fade-in-up opacity-0">
          <div className="space-y-6">
            <button onClick={() => { setSelectedPrompt(null); resetProgress(); }} className="text-sm font-bold text-gray-500 hover:text-white flex items-center gap-2 transition-colors px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl w-fit"><X className="w-4 h-4" /> BACK TO LIBRARY</button>
            <div className="relative group">
               <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/30 to-accent/30 rounded-3xl blur opacity-25"></div>
               <div className="relative glass-panel p-8 space-y-8 bg-[#181825]/90 border-white/10 shadow-2xl">
                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-white/5 pb-6">
                   <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">{selectedPrompt.title}</h2>
                   <div className="flex items-center gap-2 px-3 py-2 bg-black/40 rounded-xl border border-white/5 shadow-inner">
                     <Sliders className="w-3 h-3 text-primary" />
                     <select value={engine} onChange={(e) => setEngine(e.target.value)} className="bg-transparent text-[10px] tracking-widest font-black uppercase outline-none cursor-pointer text-gray-300">
                       <option value="nanobanana-2.0">Nanobanana 2.0</option>
                       <option value="nanobanana-pro">Nanobanana PRO</option>
                     </select>
                   </div>
                 </div>
                 <div className="space-y-6">
                   {Object.keys(variables).map((v, i) => (
                     <div key={v} className="space-y-2 animate-fade-in-up opacity-0" style={{ animationDelay: `${i * 100}ms` }}>
                       <label className="text-[10px] font-black tracking-widest text-primary uppercase ml-2">{v}</label>
                       <div className="relative group">
                         <div className="absolute -inset-px bg-gradient-to-r from-primary/50 to-accent/50 rounded-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-500"></div>
                         <input type="text" value={variables[v]} onChange={(e) => setVariables(prev => ({ ...prev, [v]: e.target.value }))} className="relative w-full bg-[#12121a] border border-white/10 rounded-xl px-5 py-4 outline-none text-white font-medium placeholder:text-gray-700 focus:bg-black/80 transition-all shadow-inner" placeholder={`Insert ${v} context...`} />
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="relative">
              <div className="absolute -inset-1 bg-brand-gradient rounded-3xl blur opacity-20"></div>
              <div className="relative glass-panel p-8 space-y-8 bg-[#1c1c2b]/90 border-white/10 shadow-2xl flex flex-col h-full">
                 <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                   <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                   <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Compiled Instructions</h3>
                 </div>
                 
                 <div className="flex-1 bg-black/20 rounded-2xl p-6 border border-white/5 shadow-inner">
                   <p className="text-xl leading-[1.8] text-gray-300 font-medium">
                     {resultantPrompt.split(/(\[.*?\])/).map((s, i) => s.startsWith('[') ? <span key={i} className="text-primary font-black bg-primary/10 px-2 py-1 rounded-lg border border-primary/20">{s}</span> : s)}
                   </p>
                 </div>

                 <div className="space-y-4">
                   <button onClick={handleSubmit} disabled={generating || !user || !resultantPrompt} className={`relative w-full overflow-hidden py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 ${generating || !user || !resultantPrompt ? 'opacity-50 cursor-not-allowed bg-white/5 text-gray-400' : 'bg-brand-gradient text-white hover:scale-[1.02] shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(217,70,239,0.5)]'}`}>
                     {generating && <div className="absolute inset-0 bg-white/20 animate-shimmer" style={{ backgroundSize: '200% auto', backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }}></div>}
                     <span className="relative z-10 flex items-center gap-3">
                       {generating ? <RefreshCw className="animate-spin w-5 h-5 text-white" /> : <Send className="w-5 h-5" />} 
                       {generating ? 'Processing Neuromap...' : (!user ? 'Authenticate to Generate' : 'Initialize Generation')}
                     </span>
                   </button>
                   
                   {error && <p className="text-red-400 text-xs font-bold tracking-wide bg-red-400/10 p-4 rounded-xl border border-red-400/20 text-center animate-fade-in-up opacity-0">{error}</p>}
                 </div>
              </div>
            </div>

            {/* Live Status Panel */}
            {(generating || completion) && (
              <div className="relative animate-fade-in-up opacity-0">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl blur opacity-30"></div>
                <div className="relative glass-panel p-6 bg-[#12121e]/95 border-white/10 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <Zap className="w-3 h-3 text-primary" /> Generation Status
                    </span>
                    <span className="text-[10px] font-mono text-primary flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatElapsed(elapsed)}
                    </span>
                  </div>

                  {/* Steps */}
                  <div className="space-y-2">
                    {steps.map(step => (
                      <div key={step.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 ${step.status === 'active' ? 'bg-primary/10 border border-primary/20' : step.status === 'done' ? 'opacity-60' : step.status === 'error' ? 'bg-red-500/10 border border-red-500/20' : 'opacity-30'}`}>
                        <StepIcon status={step.status} />
                        <span className={`text-xs font-bold tracking-wide ${step.status === 'active' ? 'text-white' : step.status === 'done' ? 'text-green-400' : step.status === 'error' ? 'text-red-400' : 'text-gray-600'}`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Live Progress Message */}
                  {progressMsg && generating && (
                    <div className="bg-black/30 rounded-xl px-4 py-3 border border-white/5">
                      <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                        <span>{progressMsg}</span>
                        {progressTotal > 1 && <span>{progressCurrent}/{progressTotal}</span>}
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-gradient rounded-full transition-all duration-500"
                          style={{ width: progressTotal > 1 ? `${(progressCurrent / progressTotal) * 100}%` : '100%', animation: progressTotal <= 1 ? 'shimmer 2s infinite' : 'none' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Completion Summary */}
                  {completion && !generating && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-2 animate-fade-in-up opacity-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-green-400 flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Generation Complete
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/20 rounded-lg p-2 text-center">
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest">Duration</p>
                          <p className="text-sm font-black text-white">{formatElapsed(completion.elapsed || 0)}</p>
                        </div>
                        {completion.creditsUsed !== undefined && (
                          <div className="bg-black/20 rounded-lg p-2 text-center">
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Credits Used</p>
                            <p className="text-sm font-black text-white">{completion.creditsUsed}</p>
                          </div>
                        )}
                        {completion.remainingBalance !== undefined && (
                          <div className="bg-black/20 rounded-lg p-2 text-center col-span-2">
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Remaining Balance</p>
                            <p className="text-sm font-black text-primary">{completion.remainingBalance} credits</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Output Image Section */}
          {generatedImage && (
            <div className="lg:col-span-2 relative mt-8 animate-fade-in-up opacity-0">
               <div className="absolute -inset-1 bg-brand-gradient rounded-3xl blur opacity-30"></div>
               <div className="relative glass-panel bg-black/60 p-2 rounded-2xl border-white/10">
                 <img src={generatedImage} className="w-full rounded-xl shadow-2xl object-cover ring-1 ring-white/10" alt="Generated Visual" />
                 <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                    <Image className="w-3.5 h-3.5 text-white" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-white">Save to Asset Library</span>
                 </div>
               </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default PromptMaster;
