import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
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
    <div className={`min-h-screen bg-gradient-to-br ${themes[currentTheme as keyof typeof themes]} flex flex-col pt-24 pb-12 px-6 md:px-12 transition-all duration-1000 antialiased`}>
      <Header />
      <EcosystemSwitcher />

      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-12 text-white mt-8">
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
    </div>
  );
}

export default App;
