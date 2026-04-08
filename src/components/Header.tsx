import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Zap, Shield, LogOut, LayoutGrid, Sparkles, CreditCard, ShoppingCart, AlertTriangle } from 'lucide-react';
import AuthModal from './AuthModal';

const Header: React.FC = () => {
  const { user, profile, logout, topUpCredits, hasConflict, masterData, conflicts } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isDev = import.meta.env.DEV;
  const navigate = useNavigate();

  // Use environment-aware URL for ecosystem navigation
  const TOOL_URL = import.meta.env.VITE_PROMPTTOOL_URL || 'https://prompttool-v0.web.app';
  const RESOURCES_URL = import.meta.env.VITE_PROMPTRESOURCES_URL || 'http://localhost:3002';
  const THIS_APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
  const pricingUrl = `${RESOURCES_URL}/pricing?returnUrl=${encodeURIComponent(THIS_APP_URL)}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 h-[72px] flex items-center">
      <div className="absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5 shadow-2xl"></div>
      
      <div className="max-w-7xl mx-auto relative flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => window.location.href = '/'}>
          <div className="relative">
            <div className="absolute -inset-1 bg-brand-gradient rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative bg-black rounded-lg p-2 border border-white/10 group-hover:border-primary/50 transition-colors">
              <Sparkles className="w-6 h-6 text-primary group-hover:animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white group-hover:text-primary transition-colors">PROMPT MASTER</h1>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Stillwater Studio</p>
          </div>
        </div>

        {/* Navigation & User */}
        <div className="flex items-center gap-6">
          {user ? (
            <>
              {/* Conflict Indicator (High Priority) */}
              {hasConflict && (
                <button 
                  onClick={() => navigate('/admin')}
                  className="p-3 bg-red-500/20 text-red-500 rounded-full border border-red-500/30 animate-pulse relative group"
                  title="CRITICAL: Ecosystem Sync Conflict"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                </button>
              )}

              {/* Dev Only Top-Up (Simulation Mechanism) */}
              {isDev && (
                <button 
                  onClick={() => topUpCredits(500)}
                  className="hidden xl:flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl hover:bg-green-500/20 hover:border-green-500/40 transition-all text-[9px] font-black text-green-400 uppercase tracking-widest"
                  title="Developer: Local Top-up Simulation"
                >
                  <Sparkles className="w-3 h-3" /> +500 Credits
                </button>
              )}

              {/* Admin Quick Access - DUAL AUTHORITY CHECK */}
              {(profile?.role === 'admin' || profile?.role === 'su' || masterData?.role === 'admin' || masterData?.role === 'su') && (
                <button 
                  onClick={() => navigate('/admin')}
                  className={`hidden md:flex items-center gap-2 px-4 py-2 border rounded-2xl transition-all group ${hasConflict && conflicts.some(c => c.includes('Role')) ? 'border-red-500/50 bg-red-500/10' : 'border-primary/20 bg-primary/5 hover:border-primary/50 hover:bg-primary/10'}`}
                  title={hasConflict ? "Sync Conflict Detected: Click to resolve" : "Administrative Console"}
                >
                  <Shield className={`w-3.5 h-3.5 ${hasConflict && conflicts.some(c => c.includes('Role')) ? 'text-red-400 animate-pulse' : 'text-primary'}`} />
                  <span className="text-[10px] font-black text-white px-1 uppercase tracking-widest">Admin</span>
                </button>
              )}

              {/* Credit Indicator - Funnel to PromptTool */}
              <div 
                className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl hover:border-primary/30 hover:bg-white/10 transition-all cursor-pointer group"
                onClick={() => window.location.href = pricingUrl}
                title="Top-up credits at PromptTool"
              >
                <div className="bg-primary/20 p-1.5 rounded-lg group-hover:scale-110 transition-transform">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</span>
                    <span className="text-xs font-black text-white">{profile?.credits ?? '...'}</span>
                  </div>
                  {profile?.subscription === 'free' && (
                    <span className="text-[9px] font-bold text-primary animate-pulse">Get Pro</span>
                  )}
                </div>
                <CreditCard className="w-3.5 h-3.5 text-gray-500 group-hover:text-white transition-colors" />
              </div>

              {/* User Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-3 p-1.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all backdrop-blur-md group"
                >
                  <div className="w-8 h-8 rounded-full border border-white/20 overflow-hidden bg-white/5 flex items-center justify-center">
                    {(profile?.photoURL || user.photoURL) ? (
                      <img 
                        src={profile?.photoURL || user.photoURL || ''} 
                        className="w-full h-full object-cover" 
                        alt="Profile" 
                      />
                    ) : (
                      <span className="text-[10px] font-black text-primary">
                        {(profile?.displayName || user.displayName || 'A')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="pr-2 hidden sm:block text-left">
                    <p className="text-[10px] font-black text-white leading-none capitalize group-hover:text-primary transition-colors">{profile?.displayName || user.displayName || 'Creator'}</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                      {typeof profile?.subscription === 'string' ? profile.subscription : 'PRO'} NODE
                    </p>
                  </div>
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-0" onClick={() => setShowMenu(false)}></div>
                    <div className="absolute right-0 mt-4 w-64 glass-panel bg-[#12121e]/95 border-white/10 p-4 shadow-2xl animate-fade-in-up">
                      <div className="space-y-4">
                        <div className="pb-4 border-b border-white/5 md:hidden">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">My Balance</p>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-black text-white">{profile?.credits ?? 0} Credits</span>
                                <button 
                                    onClick={() => window.location.href = pricingUrl}
                                    className="bg-primary/20 text-primary text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest"
                                >
                                    Top Up
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                          {(profile?.role === 'admin' || profile?.role === 'su') && (
                            <button onClick={() => { navigate('/admin'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-gray-400 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all">
                              <Shield className="w-4 h-4" /> Admin Console
                            </button>
                          )}
                          <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                            <LayoutGrid className="w-4 h-4" /> Asset Library
                          </button>
                          <button onClick={() => window.open(TOOL_URL, '_blank')} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
                            <Zap className="w-4 h-4" /> Go to PromptTool
                          </button>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                           {profile?.subscription === 'free' && (
                             <button 
                                onClick={() => window.location.href = pricingUrl}
                                className="w-full mb-3 bg-brand-gradient py-3 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                             >
                                <ShoppingCart className="w-3.5 h-3.5" /> Unlock PRO Access
                             </button>
                           )}
                           <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-400/5 rounded-xl transition-all">
                             <LogOut className="w-4 h-4" /> Sign Out
                           </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="bg-brand-gradient px-6 py-2.5 rounded-full text-xs font-black text-white uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              Authenticate
            </button>
          )}
        </div>
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </header>
  );
};

export default Header;
