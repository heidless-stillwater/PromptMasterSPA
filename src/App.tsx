import { useState, useEffect } from 'react';
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Routes, Route, useSearchParams } from 'react-router-dom';
import PromptMaster from './components/PromptMaster';
import AdminConsole from './components/AdminConsole';
import { useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import EcosystemSwitcher from './components/EcosystemSwitcher';

function App() {
  const { loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [currentTheme, setCurrentTheme] = useState('midnight');
  const [activeTab, setActiveTab] = useState<'blueprints' | 'exemplars' | 'gallery'>('blueprints');

  const themes = {
    midnight: 'from-[#181825] to-[#1e1e2e]',
    cyberpunk: 'from-[#0f172a] to-[#1e1e2e]',
    neon: 'from-[#180018] to-[#1e1e2e]'
  };

  useEffect(() => {
     const urlTheme = searchParams.get('style');
     if (urlTheme && themes[urlTheme as keyof typeof themes]) {
        setCurrentTheme(urlTheme);
     }
  }, [searchParams]);
  const [confirmModal, setConfirmModal] = useState<{ 
    isOpen: boolean; 
    title: string; 
    message: string; 
    onConfirm?: () => void; 
    isDanger?: boolean;
    saving?: boolean;
    customButtons?: Array<{
        label: string;
        onClick: () => void;
        className?: string;
    }>;
  } | null>(null);

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#181825', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Sparkles className="text-indigo-500 w-12 h-12 animate-pulse" />
    </div>
  );

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themes[currentTheme as keyof typeof themes]} flex flex-col pt-24 pb-12 px-6 md:px-12 transition-all duration-1000 antialiased`}>
      <Header />
      <EcosystemSwitcher />

      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-12 text-white mt-8">
        {/* Dynamic Theme Sub-header */}
        <section className="animate-fade-in-up opacity-0" style={{ animationDelay: '200ms' }}>
           <div className="flex justify-between items-end">
              <div className="space-y-2">
                 <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Customize<br/><span className="brand-gradient-text uppercase">{activeTab === 'blueprints' ? 'Blueprint Registry' : activeTab === 'exemplars' ? 'PromptTool Exemplars' : 'My Gallery'}</span></h2>
              </div>
              <div className="text-right hidden md:block">
                 <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Active Engine</p>
                 <div className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl inline-flex items-center gap-3">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></span>
                    <span className="text-sm font-bold text-gray-300">nanobanana-v2.0</span>
                 </div>
              </div>
           </div>
        </section>

        {/* UI Framework with Dynamic Routes */}
        <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '500ms' }}>
           <Routes>
              <Route path="/" element={<PromptMaster activeTab={activeTab} setActiveTab={setActiveTab} setConfirmModal={setConfirmModal} />} />
              <Route path="/p/:promptId" element={<PromptMaster activeTab={activeTab} setActiveTab={setActiveTab} setConfirmModal={setConfirmModal} />} />
              <Route path="/admin" element={<AdminConsole />} />
           </Routes>
        </div>
      </main>

      <footer className="mt-20 w-full max-w-7xl mx-auto border-t border-white/5 py-8 flex flex-col md:flex-row justify-between items-center text-[10px] font-bold text-gray-600 uppercase tracking-widest gap-4">
        <div className="flex items-center gap-6">
           <span>Stillwater Studio</span>
           <span className="text-primary/50">AG-Protocol v1.2</span>
           <span>Heidless apps ecosystem</span>
        </div>
        <div className="flex items-center gap-6">
           <a href="#" className="hover:text-white transition-colors">Privacy</a>
           <a href="#" className="hover:text-white transition-colors">System Status</a>
           <a href="#" className="hover:text-white transition-colors underline decoration-primary/50 underline-offset-4">Report an error</a>
        </div>
      </footer>

      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-black/60 transition-all duration-300">
           <div className="relative glass-panel p-8 w-full max-w-md bg-[#181825]/95 border-primary/20 shadow-[0_0_50px_rgba(99,102,241,0.2)] text-white">
             <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${confirmModal.isDanger ? 'bg-red-500/10 border border-red-500/30' : 'bg-primary/10 border border-primary/30'}`}>
                   {confirmModal.isDanger ? <AlertCircle className="w-6 h-6 text-red-400"/> : <Sparkles className="w-6 h-6 text-primary"/>}
                </div>
                <div>
                    <h3 className="text-xl font-black text-white">{confirmModal.title}</h3>
                   <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Architecture Safety Guard</p>
                </div>
             </div>
             <p className="text-sm text-gray-400 leading-relaxed mb-8">{confirmModal.message}</p>
             <div className="grid grid-cols-2 gap-4">
                 {confirmModal.customButtons ? (
                     confirmModal.customButtons.map((btn, idx) => (
                         <button key={idx} onClick={btn.onClick} className={btn.className}>
                             {btn.label}
                         </button>
                     ))
                 ) : (
                     <>
                        <button onClick={() => setConfirmModal(null)} className="py-3 px-6 rounded-xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all outline-none">Cancel</button>
                         <button 
                            onClick={confirmModal.onConfirm} 
                            disabled={confirmModal.saving}
                            className={`py-3 px-6 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg flex items-center justify-center gap-2 outline-none ${confirmModal.isDanger ? 'bg-red-500/80 hover:bg-red-500 shadow-red-500/20' : 'bg-primary/80 hover:bg-primary shadow-primary/20'} ${confirmModal.saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                         >
                            {confirmModal.saving && <Loader2 className="w-3 h-3 animate-spin"/>}
                            {confirmModal.saving ? 'Processing...' : 'Confirm Action'}
                         </button>
                     </>
                 )}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;
