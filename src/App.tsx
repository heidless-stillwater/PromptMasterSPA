import { useState, useEffect } from 'react';
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Routes, Route, useSearchParams } from 'react-router-dom';
import PromptMaster from './components/PromptMaster';
import AdminConsole from './components/AdminConsole';
import { useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import EcosystemSwitcher from './components/EcosystemSwitcher';

function App() {
  const { user, profile, loading, login, logout, masterData } = useAuth();
  const [searchParams] = useSearchParams();
  const [currentTheme, setCurrentTheme] = useState('midnight');
  const [activeTab, setActiveTab] = useState<'blueprints' | 'exemplars' | 'gallery'>('blueprints');

  const themes: Record<string, string> = {
    midnight: 'from-[#181825] to-[#1e1e2e]',
    cyberpunk: 'from-[#0f172a] to-[#1e1e2e]',
    neon: 'from-[#180018] to-[#1e1e2e]'
  };

  useEffect(() => {
     const urlTheme = searchParams.get('style');
     if (urlTheme && themes[urlTheme]) {
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

  // --- Subscription & Entitlements Gate ---
  const isJustSubscribed = searchParams.get('subscribed') === 'true';
  const MASTER_ARCHITECT_EMAIL = 'heidlessemail18@gmail.com';
  
  // Hardened Dual-Authority Admin Check + Architect Email Override
  const isAdmin = profile?.role === 'admin' || profile?.role === 'su' || 
                  masterData?.role === 'admin' || masterData?.role === 'su' ||
                  user?.email === MASTER_ARCHITECT_EMAIL;
  
  const activeSuites: string[] = (
    profile?.suiteSubscription?.activeSuites ||
    profile?.subscriptionMetadata?.activeSuites ||
    (profile?.subscription as any)?.activeSuites ||
    []
  );
  
  // High-fidelity gate with Admin Override
  const hasRegistryAccess = 
    isAdmin ||
    isJustSubscribed ||
    activeSuites.includes('registry') ||
    activeSuites.includes('promptmaster') ||
    profile?.subscription === 'pro' ||
    (typeof profile?.subscription === 'object' && profile?.subscription !== null && (profile.subscription as any).status === 'active');

  // New: Entitlement Verification Buffer
  // If we have a user, but masterData hasn't arrived yet, wait a moment before showing "Access Restricted"
  const isVerifying = profile && !isAdmin && !masterData && !isJustSubscribed && activeSuites.length === 0;

  if (isVerifying) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#181825', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <Loader2 className="text-primary w-8 h-8 animate-spin" />
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Verifying Ecosystem Entitlements...</p>
    </div>
  );

  const currentThemeClasses = themes[currentTheme] || themes.midnight;

  if (!profile && !loading) {
     return (
        <div className={`min-h-screen bg-gradient-to-br ${currentThemeClasses} flex items-center justify-center px-6`}>
            <div className="max-w-xl w-full glass-panel p-12 rounded-[3.5rem] border-primary/30 bg-[#181825]/95 text-center space-y-8 backdrop-blur-3xl shadow-[0_0_50px_rgba(99,102,241,0.2)]">
                <div className="space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center text-primary mx-auto">
                        <Sparkles className="w-10 h-10" />
                    </div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter text-white">Registry <br /><span className="brand-gradient-text">Authentication</span></h2>
                    <p className="text-gray-400 font-medium text-sm leading-relaxed">Sign in to sync your Pro Suite entitlements and access the global blueprint registry.</p>
                    <button
                        onClick={login}
                        className="h-16 w-full rounded-2xl bg-primary text-white font-black uppercase tracking-widest hover:bg-primary/80 transition-all shadow-xl shadow-primary/20"
                    >
                        Sign In with Google
                    </button>
                </div>
            </div>
        </div>
     );
  }

  if (!hasRegistryAccess) {
    return (
        <div className={`min-h-screen bg-gradient-to-br ${currentThemeClasses} flex items-center justify-center px-6`}>
            <div className="max-w-xl w-full glass-panel p-12 rounded-[3.5rem] border-primary/30 bg-[#181825]/95 text-center space-y-8 backdrop-blur-3xl shadow-[0_0_50px_rgba(99,102,241,0.2)] relative overflow-hidden">
                <div className="absolute -top-12 -left-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl opacity-50" />
                
                <div className="relative z-10 space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center text-primary mx-auto shadow-lg shadow-primary/20">
                        <Sparkles className="w-10 h-10" />
                    </div>
                    
                    <div className="space-y-3">
                        <h2 className="text-4xl font-black uppercase tracking-tighter text-white">Registry Access <br /><span className="brand-gradient-text">Restricted</span></h2>
                        <p className="text-gray-400 font-medium text-sm leading-relaxed">
                            The PromptMaster Registry is an advanced blueprint management system for Pro Suite members. 
                        </p>
                    </div>

                        <div className="pt-4 flex flex-col gap-4">
                            <button
                                onClick={() => window.location.href = `http://localhost:3002/pricing?returnUrl=${encodeURIComponent(window.location.origin)}`}
                                className="h-16 w-full rounded-2xl bg-primary/80 text-white font-black uppercase tracking-widest hover:bg-primary transition-all shadow-xl shadow-primary/20"
                            >
                                Upgrade to Pro Suite
                            </button>
                            <button
                                onClick={logout}
                                className="h-10 w-full rounded-xl border border-white/5 bg-white/5 text-gray-400 font-bold uppercase tracking-widest text-[9px] hover:bg-white/10 hover:text-white transition-all"
                            >
                                Switch Account / Refresh Identity
                            </button>
                            <div className="space-y-4">
                                <button 
                                    onClick={() => window.location.href = '/'}
                                    className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors block mx-auto"
                                >
                                    Return to Stillwater
                                </button>
                                <div className="pt-6 border-t border-white/5">
                                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Authenticated Identity</p>
                                        <p className="text-xs text-primary font-mono break-all">{user?.email || 'No email detected'}</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                                                {isAdmin ? 'Architect Permissions Active' : 'Standard Member Access Only'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentThemeClasses} flex flex-col pt-24 pb-12 px-6 md:px-12 transition-all duration-1000 antialiased`}>
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
        <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 backdrop-blur-xl bg-black/60 transition-all duration-300">
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
