import { useState } from 'react';
import { Routes, Route, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import PromptMaster from './components/PromptMaster';
import AdminConsole from './components/AdminConsole';
import { useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import EcosystemSwitcher from './components/EcosystemSwitcher';
import { Icons } from './components/Icons';

function App() {
  const { user, profile, loading, login, logout, masterData } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'blueprints' | 'exemplars' | 'gallery'>('blueprints');
  const [tabVersion, setTabVersion] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPath = location.pathname === '/admin';

  // Use environment-aware URL for ecosystem navigation
  const RESOURCES_URL = import.meta.env.VITE_PROMPTRESOURCES_URL || 'http://localhost:3002';
  const THIS_APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173';

  const handleTabClick = (tab: 'blueprints' | 'exemplars' | 'gallery') => {
    setActiveTab(tab);
    setTabVersion(prev => prev + 1);
    navigate('/');
  };

  const [confirmModal, setConfirmModal] = useState<{ 
    isOpen: boolean; 
    title: string; 
    message: string; 
    onConfirm?: () => void; 
    isDanger?: boolean; 
    saving?: boolean;
    costSummary?: {
        engine: string;
        quality: string;
        cost: number;
        balance: number;
        remaining: number;
    };
    preview?: {
        thumbnailUrl?: string;
        template?: string;
        visionInstructions?: string;
    };
    customButtons?: Array<{
        label: string;
        onClick: () => void;
        className?: string;
    }>;
  } | null>(null);

  if (loading) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Icons.sparkles className="text-primary w-12 h-12 animate-pulse" />
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Initialising Core Registry</div>
      </div>
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
  const isVerifying = profile && !isAdmin && !masterData && !isJustSubscribed && activeSuites.length === 0;

  if (isVerifying) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <Icons.spinner className="text-primary w-10 h-10 animate-spin" />
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">Ecosystem Check</div>
          <div className="text-xs font-bold text-primary/80">Verifying Entitlements...</div>
        </div>
      </div>
    </div>
  );

  if (!profile && !loading) {
     return (
        <div className="min-h-screen bg-background text-white selection:bg-primary/30 font-inter relative overflow-hidden flex items-center justify-center p-6">
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-50" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px]" />
            </div>

            <div className="max-w-xl w-full relative z-10 glass-card p-12 overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 transition-all duration-1000 group-hover:bg-primary/20" />
                
                <div className="flex flex-col items-center text-center space-y-8">
                    <div className="p-5 bg-primary/10 border border-primary/20 rounded-3xl shadow-2xl shadow-primary/20">
                        <Icons.sparkles className="w-10 h-10 text-primary/80" />
                    </div>
                    
                    <div className="space-y-3">
                        <div className="premium-label">Registry Node 01</div>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white leading-tight">
                            Identity <br /><span className="text-primary/80">Verification</span>
                        </h2>
                        <p className="text-white/40 font-medium text-sm leading-relaxed max-w-sm mx-auto">
                            Sign in to synchronise your Pro Suite entitlements and access the global prompt registry.
                        </p>
                    </div>

                    <button
                        onClick={login}
                        className="h-16 w-full rounded-2xl bg-primary border border-primary text-white font-black uppercase tracking-widest hover:bg-primary/80 transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-3"
                    >
                        <Icons.google size={20} /> Authorise Session
                    </button>
                </div>
            </div>
        </div>
     );
  }

  if (!hasRegistryAccess) {
    return (
        <div className="min-h-screen bg-background text-white selection:bg-primary/30 font-inter relative overflow-hidden flex items-center justify-center p-6">
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-transparent to-primary/10 opacity-50" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-rose-500/5 rounded-full blur-[150px]" />
            </div>

            <div className="max-w-xl w-full relative z-10 glass-card p-12 overflow-hidden border-rose-500/20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                
                <div className="flex flex-col items-center text-center space-y-8">
                    <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-3xl shadow-2xl shadow-rose-500/20">
                        <Icons.alert className="w-10 h-10 text-rose-400" />
                    </div>
                    
                    <div className="space-y-3">
                        <div className="premium-label text-rose-500/40">Access Protocol Violation</div>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white leading-tight">
                            Registry <br /><span className="text-rose-400">Restricted</span>
                        </h2>
                        <p className="text-white/40 font-medium text-sm leading-relaxed max-w-sm mx-auto">
                            The PromptMaster Registry is an advanced prompt management system reserved for Pro Suite members.
                        </p>
                    </div>

                    <div className="w-full flex flex-col gap-4">
                        <button
                            onClick={() => window.location.href = `${RESOURCES_URL}/pricing?returnUrl=${encodeURIComponent(window.location.origin)}`}
                            className="h-16 w-full rounded-2xl bg-primary border border-primary text-white font-black uppercase tracking-widest hover:bg-primary/80 transition-all shadow-xl shadow-primary/20 active:scale-95"
                        >
                            Upgrade to Pro Suite
                        </button>
                        
                        <div className="p-4 bg-black/40 border border-white/5 rounded-2xl text-left">
                            <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Authenticated Node</div>
                            <div className="text-xs text-primary/80 font-mono truncate mb-3">{user?.email}</div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Standard Member Access Only</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                onClick={logout}
                                className="h-11 rounded-xl border border-white/5 bg-white/5 text-white/40 font-black uppercase tracking-widest text-[9px] hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <Icons.refresh size={12} /> Switch Account
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="h-11 rounded-xl border border-white/5 bg-white/5 text-white/40 font-black uppercase tracking-widest text-[9px] hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <Icons.arrowLeft size={12} /> Exit Portal
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white selection:bg-primary/30 font-inter">
      <Header setActiveTab={handleTabClick} />
      <EcosystemSwitcher />

      {/* ── CINEMATIC HERO COVER ── */}
      <div className="relative w-full h-auto overflow-hidden flex flex-col px-6">
          {/* Background Layer (Blurred Telemetry) */}
          <div className="absolute inset-0 z-0">
              <div className="w-full h-full bg-background">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-50" />
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-48 -mt-48" />
              </div>
          </div>

          <div className="max-w-7xl mx-auto relative z-10 flex flex-col gap-12 pt-24 pb-8 w-full">
              <div className="flex flex-col gap-2 animate-fade-in">
                  <div className="text-[11px] font-black text-primary uppercase tracking-[0.5em] mb-2">Stillwater Protocol / Registry</div>
                  <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white leading-none">
                      {isAdminPath ? 'Admin Settings' : 
                       activeTab === 'blueprints' ? 'Prompt Registry' : 
                       activeTab === 'exemplars' ? 'Exemplars' : 
                       'Asset Gallery'}
                  </h1>
              </div>

              {/* Global Tab Switcher */}
              <div className="flex gap-12 border-b border-white/5 pb-4">
                  <button 
                      onClick={() => handleTabClick('blueprints')}
                      className={`flex items-center gap-3 pb-4 -mb-[17px] text-[11px] font-black uppercase tracking-[0.4em] transition-all border-b-2 ${activeTab === 'blueprints' ? 'text-primary border-primary' : 'text-white/20 border-transparent hover:text-white'}`}
                  >
                      <Icons.grid className="w-4 h-4" />
                      Prompt Registry
                  </button>
                  <button 
                      onClick={() => handleTabClick('exemplars')}
                      className={`flex items-center gap-3 pb-4 -mb-[17px] text-[11px] font-black uppercase tracking-[0.4em] transition-all border-b-2 ${activeTab === 'exemplars' ? 'text-primary border-primary' : 'text-white/20 border-transparent hover:text-white'}`}
                  >
                      <Icons.history className="w-4 h-4" />
                      Exemplars
                  </button>
                  <button 
                      onClick={() => handleTabClick('gallery')}
                      className={`flex items-center gap-3 pb-4 -mb-[17px] text-[11px] font-black uppercase tracking-[0.4em] transition-all border-b-2 ${activeTab === 'gallery' ? 'text-primary border-primary' : 'text-white/20 border-transparent hover:text-white'}`}
                  >
                      <Icons.image className="w-4 h-4" />
                      Asset Gallery
                  </button>
              </div>
          </div>
      </div>

      <main className="w-full px-6 pb-20 relative z-30">
        <div className="max-w-7xl mx-auto animate-fade-in-up">
           <Routes>
              <Route path="/" element={<PromptMaster activeTab={activeTab} setActiveTab={setActiveTab} tabVersion={tabVersion} setConfirmModal={setConfirmModal} />} />
              <Route path="/p/:promptId" element={<PromptMaster activeTab={activeTab} setActiveTab={setActiveTab} tabVersion={tabVersion} setConfirmModal={setConfirmModal} />} />
              <Route path="/admin" element={<AdminConsole />} />
           </Routes>
        </div>
      </main>

      <footer className="mt-20 w-full max-w-7xl mx-auto border-t border-white/5 pt-12 pb-20 px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
              <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                          <Icons.sparkles size={16} className="text-indigo-400" />
                      </div>
                      <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Stillwater Studio</span>
                          <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest leading-none">AG-Protocol v1.2</span>
                      </div>
                  </div>
                  <p className="text-[10px] font-medium text-white/20 max-w-xs leading-relaxed uppercase tracking-wider">
                      Orchestrating high-fidelity architectural frameworks across the global creator registry.
                  </p>
              </div>

              <div className="flex flex-wrap gap-12">
                  <div className="flex flex-col gap-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Ecosystem</span>
                      <nav className="flex flex-col gap-2">
                          {['Privacy', 'System Status', 'Architecture', 'Security'].map(link => (
                              <a key={link} href="#" className="text-[10px] font-bold text-white/20 hover:text-indigo-400 uppercase tracking-widest transition-colors">
                                  {link}
                              </a>
                          ))}
                      </nav>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Authority</span>
                      <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Global Sync Active</span>
                          </div>
                          <div className="text-[9px] font-mono text-white/10 break-all max-w-[120px]">
                              NODE_US_EAST_PROMPTMASTER
                          </div>
                      </div>
                  </div>
              </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-[9px] font-black text-white/10 uppercase tracking-[0.3em]">
                  © 2026 Stillwater • Heidless Apps Ecosystem
              </div>
              <div className="flex items-center gap-4">
                  <a href="#" className="p-2 bg-white/5 rounded-lg text-white/20 hover:text-white hover:bg-white/10 transition-all">
                      <Icons.twitter size={14} />
                  </a>
                  <a href="#" className="p-2 bg-white/5 rounded-lg text-white/20 hover:text-white hover:bg-white/10 transition-all">
                      <Icons.globe size={14} />
                  </a>
              </div>
          </div>
      </footer>

      {confirmModal?.isOpen && (
        <div 
          className="fixed inset-0 top-0 left-0 w-screen h-screen z-[10000] flex items-center justify-center p-4 backdrop-blur-xl bg-black/60 transition-all duration-300"
          onClick={() => setConfirmModal(null)}
        >
           <div 
             className="relative glass-panel p-8 w-full max-w-md bg-[#181825]/95 border-primary/20 shadow-[0_0_50px_rgba(99,102,241,0.2)] text-white"
             onClick={(e) => e.stopPropagation()}
           >
             <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${confirmModal.isDanger ? 'bg-red-500/10 border border-red-500/30' : 'bg-primary/10 border border-primary/30'}`}>
                   {confirmModal.isDanger ? <Icons.alert className="w-6 h-6 text-red-400"/> : <Icons.sparkles className="w-6 h-6 text-primary"/>}
                </div>
                <div>
                   <h3 className="text-xl font-black text-white">{confirmModal.title}</h3>
                   <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Prompt Safety Guard</p>
                </div>
             </div>
             <p className="text-sm text-gray-400 leading-relaxed mb-6">{confirmModal.message}</p>

             {(confirmModal as any).costSummary && (
                <div className="mb-8 p-6 bg-black/40 border border-white/5 rounded-3xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Engine Cluster</p>
                            <p className="text-xs font-bold text-primary uppercase">{(confirmModal as any).costSummary.engine}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Quality Tier</p>
                            <p className="text-xs font-bold text-emerald-400 uppercase">{(confirmModal as any).costSummary.quality}</p>
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Computational Cost</p>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-white">{(confirmModal as any).costSummary.cost}</span>
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Credits</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center opacity-60">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Current Balance</p>
                            <p className="text-xs font-bold text-white">{(confirmModal as any).costSummary.balance} CR</p>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Projected Tally</p>
                            <p className="text-xs font-black text-primary">{(confirmModal as any).costSummary.remaining} CR</p>
                        </div>
                    </div>
                </div>
             )}

             {confirmModal.preview && (confirmModal.preview.template || confirmModal.preview.visionInstructions) && (
                <div className="mb-8 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="space-y-1.5">
                        <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">
                            {confirmModal.preview.template ? 'Structural Template' : 'Compiled Vision Instructions'}
                        </p>
                        <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-[1.5rem] font-mono text-[10px] text-white/60 leading-relaxed overflow-y-auto whitespace-pre-wrap break-words h-32 custom-scrollbar">
                            {confirmModal.preview.template || confirmModal.preview.visionInstructions}
                        </div>
                        <p className="text-[8px] font-bold text-indigo-400/30 uppercase tracking-widest text-right mt-2">
                            {confirmModal.preview.template ? 'Architectural Foundation' : 'Verified Architectural Output'}
                        </p>
                    </div>
                </div>
              )}
             <div className="grid grid-cols-2 gap-4">
                 {confirmModal.customButtons ? (
                     confirmModal.customButtons.map((btn: any, idx: number) => (
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
                            {confirmModal.saving && <Icons.spinner className="w-3 h-3 animate-spin"/>}
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
