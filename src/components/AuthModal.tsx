import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { X, Mail, Lock, Sparkles, Loader2, AlertCircle } from 'lucide-react';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-black/60 transition-all duration-300">
      <div className="relative glass-panel p-8 w-full max-w-md bg-[#181825]/95 border-primary/20 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/30">
             <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
             <h3 className="text-xl font-black text-white">{isLogin ? 'Ecosystem Login' : 'Initialize Identity'}</h3>
             <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Prompt Master Hub</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
             <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
             <p className="text-xs text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 pl-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-11 py-3 text-sm text-white outline-none focus:border-primary/50 transition-colors"
                placeholder="architect@stillwater.io"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 pl-1">Security Key</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-11 py-3 text-sm text-white outline-none focus:border-primary/50 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-4 rounded-xl bg-primary/80 hover:bg-primary shadow-[0_0_20px_rgba(99,102,241,0.3)] text-xs font-black uppercase tracking-widest text-white transition-all flex justify-center items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLogin ? 'Authenticate' : 'Establish Identity'}
          </button>
        </form>

        <div className="flex items-center gap-4 mb-6">
          <div className="h-px bg-white/10 flex-1"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">OR</span>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        <button 
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full py-3 mb-6 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-black uppercase tracking-widest transition-all flex justify-center items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
             <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
             <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
             <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
             <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
             <path fill="none" d="M1 1h22v22H1z" />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-xs text-gray-500 font-medium">
          {isLogin ? "Don't have an identity?" : "Already an architect?"}
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="ml-2 text-primary font-bold hover:underline">
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>

      </div>
    </div>
  );
};

export default AuthModal;
