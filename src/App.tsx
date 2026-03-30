import { useState, useEffect } from 'react';
import { Sparkles, LayoutPanelLeft, Settings, Database, Activity, X } from 'lucide-react';
import PromptMaster from './components/PromptMaster';
import { useAuth } from './contexts/AuthContext';
import { Routes, Route, useSearchParams } from 'react-router-dom';

function App() {
  const { user, profile, loading, login, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [currentTheme, setCurrentTheme] = useState('midnight');

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

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#181825', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Sparkles className="text-indigo-500 w-12 h-12 animate-pulse" />
    </div>
  );

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themes[currentTheme as keyof typeof themes]} flex flex-col p-6 md:px-12 md:py-8 transition-all duration-1000 antialiased`}>
      {/* Navigation */}
      <header className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-16 gap-6">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-brand-gradient rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-3 bg-black/40 border border-white/5 rounded-2xl shadow-2xl backdrop-blur-xl">
              <Sparkles className="text-primary w-7 h-7" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none text-white">
              Prompt<span className="brand-gradient-text uppercase">Master</span> <span className="text-[10px] text-primary/50 font-bold border border-primary/20 px-1.5 rounded ml-2">v0.1</span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 mt-1">Nanobanana Unified Engine</p>
          </div>
        </div>

        <nav className="flex items-center gap-2 p-1 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md">
           <button className="p-2 px-5 bg-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-inner"><LayoutPanelLeft className="w-4 h-4" /> Discovery</button>
           <button className="p-2 px-5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all"><Database className="w-4 h-4" /> Library</button>
           <button className="p-2 px-5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all"><Activity className="w-4 h-4" /> Usage</button>
           <div className="w-[1px] h-4 bg-white/10 mx-2"></div>
           <button className="p-2 px-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"><Settings className="w-4 h-4" /></button>
        </nav>

        <div className="flex items-center gap-4">
          {(profile || user) ? (
            <div className="flex items-center gap-3 glass-panel p-2 pl-4 border-white/5 shadow-2xl group relative bg-white/5">
               <div className="text-right">
                  <p className="text-xs font-bold text-white">{profile?.displayName || user?.displayName}</p>
                  <p className="text-[10px] font-bold text-primary uppercase">{profile?.role || 'member'}</p>
               </div>
               <img src={profile?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} referrerPolicy="no-referrer" className="w-10 h-10 rounded-xl bg-white/10 ring-2 ring-white/5" alt="Profile" />
               <button onClick={() => logout()} className="absolute top-0 right-0 p-1 bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2 -translate-y-1/2 shadow-lg">
                  <X className="w-3 h-3 text-white" />
               </button>
            </div>
          ) : (
            <button 
              onClick={() => login()}
              className="px-8 py-3 bg-brand-gradient text-white text-sm font-black rounded-2xl shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:scale-105"
            >
              SIGN IN
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-12 text-white">
        {/* Dynamic Theme Sub-header */}
        <section className="animate-fade-in-up opacity-0" style={{ animationDelay: '200ms' }}>
           <div className="flex justify-between items-end">
              <div className="space-y-2">
                 <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Customize &<br/><span className="brand-gradient-text uppercase">Generate</span></h2>
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
              <Route path="/" element={<PromptMaster />} />
              <Route path="/p/:promptId" element={<PromptMaster />} />
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
    </div>
  );
}

export default App;
