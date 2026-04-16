import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Icons } from './Icons';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google Auth failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-2xl transition-all duration-500 animate-fade-in" onClick={onClose} />
      
      <div className="relative glass-card p-10 w-full max-w-md bg-[#12121a]/90 border-indigo-500/20 shadow-2xl animate-fade-in-up">
        {/* Close Interaction */}
        <button 
            onClick={onClose} 
            className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-all active:scale-95 group"
        >
          <Icons.close className="w-5 h-5 group-hover:rotate-90 transition-transform" />
        </button>

        {/* Branding Protocol */}
        <div className="flex flex-col items-center text-center gap-6 mb-10">
          <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 shadow-2xl shadow-indigo-500/10 relative group">
             <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <Icons.sparkles className="w-10 h-10 text-indigo-400 relative" />
          </div>
          <div>
             <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{isLogin ? 'Ecosystem Login' : 'Initialise Identity'}</h3>
             <p className="text-[10px] font-black text-indigo-400/40 uppercase tracking-[0.4em] mt-3 leading-none">Registry Intelligence Protocol</p>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-4 animate-shake">
             <Icons.alert className="w-5 h-5 text-rose-500 shrink-0" />
             <p className="text-[11px] font-bold text-rose-200/80 leading-relaxed uppercase tracking-widest">{error}</p>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Architect Mail</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Icons.user className="w-4 h-4 text-white/10 group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl pl-12 pr-5 py-4 text-xs text-white outline-none focus:border-indigo-500/30 transition-all font-medium placeholder:text-white/5"
                placeholder="architect@stillwater.io"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Security Cipher</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Icons.zap className="w-4 h-4 text-white/10 group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl pl-12 pr-5 py-4 text-xs text-white outline-none focus:border-indigo-500/30 transition-all font-medium placeholder:text-white/5"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 text-[11px] font-black uppercase tracking-[0.4em] text-white transition-all flex justify-center items-center gap-3 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Icons.refresh className="w-4 h-4 animate-spin" /> : <Icons.arrowRight className="w-4 h-4" />}
            {isLogin ? 'Authenticate Node' : 'Establish Node'}
          </button>
        </form>

        <div className="flex items-center gap-5 my-10">
          <div className="h-px bg-white/5 flex-1"></div>
          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/10">External Handshake</span>
          <div className="h-px bg-white/5 flex-1"></div>
        </div>

        <button 
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full py-5 rounded-2xl bg-white text-black hover:bg-indigo-50 text-[11px] font-black uppercase tracking-[0.4em] transition-all flex justify-center items-center gap-3 active:scale-95 shadow-xl disabled:opacity-50"
        >
          <Icons.google size={18} />
          Google Identity
        </button>

        <p className="mt-10 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
          {isLogin ? "No active identity?" : "Existing node detected?"}
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="ml-3 text-indigo-400 hover:text-white transition-colors">
            {isLogin ? 'Register Now' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
