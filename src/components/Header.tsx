import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthModal from './AuthModal';
import { Icons } from './Icons';
import { useSovereignStatus } from '../hooks/useSovereignStatus';

const Header: React.FC = () => {
  const { user, profile, logout, hasConflict, masterData } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPath = location.pathname === '/admin';
  const sovereign = useSovereignStatus();

  // Use environment-aware URL for ecosystem navigation
  const RESOURCES_URL = import.meta.env.VITE_PROMPTRESOURCES_URL || 'http://localhost:3002';
  const THIS_APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
  const pricingUrl = `${RESOURCES_URL}/pricing?returnUrl=${encodeURIComponent(THIS_APP_URL)}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] px-6 h-[72px] flex items-center border-b border-white/5 backdrop-blur-xl bg-[#0a0a0f]/80">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => window.location.href = '/'}>
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative bg-[#0a0a0f] rounded-lg p-2 border border-white/10 group-hover:border-indigo-500/50 transition-colors shadow-2xl">
              <Icons.sparkles className="w-6 h-6 text-indigo-400 group-hover:animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black tracking-tighter text-white group-hover:text-indigo-400 transition-colors uppercase leading-none">Prompt Master</h1>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mt-1.5 leading-none">Registry Intelligence</p>
          </div>
        </div>

        {/* Navigation & User */}
        <div className="flex items-center gap-5">
          {user ? (
            <>
              {/* Conflict Indicator */}
              {hasConflict && (
                <button
                  onClick={() => navigate('/admin')}
                  className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 hover:bg-rose-500/20 transition-all relative animate-pulse"
                  title="CRITICAL: Ecosystem Sync Conflict"
                >
                  <Icons.alert size={18} />
                </button>
              )}

              {/* Sovereign Sentinel Status */}
              {sovereign.isGated && (
                <button
                  onClick={() => window.location.href = 'http://localhost:3003/monitoring'}
                  className="px-4 spy-2 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center gap-2 group relative overflow-hidden"
                  title={`SOVEREIGN_LOCK: ${sovereign.failingPolicies.join(', ')}`}
                >
                  <div className="absolute inset-0 bg-rose-500/10 animate-pulse"></div>
                  <Icons.shield size={16} className="relative z-10" />
                  <span className="text-[9px] font-black uppercase tracking-widest relative z-10">Sovereign Lock</span>
                </button>
              )}

              {/* Admin Quick Access */}
              {(profile?.role === 'admin' || profile?.role === 'su' || masterData?.role === 'admin' || masterData?.role === 'su') && (
                <button
                  onClick={() => navigate(isAdminPath ? '/' : '/admin')}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400 transition-all"
                >
                  {isAdminPath ? (
                    <>
                      <Icons.grid size={14} /> Dashboard
                    </>
                  ) : (
                    <>
                      <Icons.shield size={14} /> Admin
                    </>
                  )}
                </button>
              )}

              {/* Credit Status HUD */}
              <div
                className="hidden lg:flex items-center gap-3 pl-4 pr-1 spy-2 bg-white/[0.03] border border-white/10 rounded-2xl hover:bg-white/[0.05] transition-all cursor-pointer group"
                onClick={() => window.location.href = pricingUrl}
              >
                <div className="flex flex-col items-end">
                  <div className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">Entitlements</div>
                  <div className="text-xs font-black text-white leading-none">{profile?.credits ?? '...'} <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">CR</span></div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                  <Icons.zap size={14} />
                </div>
              </div>

              {/* User Identity Portal */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-3 p-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all group"
                >
                  <div className="w-9 h-9 rounded-full border border-white/20 overflow-hidden bg-white/5 flex items-center justify-center">
                    {(profile?.photoURL || user.photoURL) ? (
                      <img
                        src={profile?.photoURL || user.photoURL || ''}
                        className="w-full h-full object-cover"
                        alt="Profile"
                      />
                    ) : (
                      <span className="text-xs font-black text-indigo-400">
                        {(profile?.displayName || user.displayName || 'A')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-0" onClick={() => setShowMenu(false)}></div>
                    <div className="absolute right-0 mt-4 w-72 glass-panel bg-[#12121e]/98 border-white/10 p-5 shadow-2xl animate-fade-in-up">
                      <div className="flex items-center gap-4 pb-4 border-b border-white/5 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl text-indigo-400 font-black">
                          {(profile?.displayName || user.displayName || '👤')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-black text-white leading-none capitalize">{profile?.displayName || user.displayName || 'Creator'}</div>
                          <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest mt-1.5">
                            {typeof profile?.subscription === 'string' ? profile.subscription : 'PRO'} NODE AUTHORITY
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {(profile?.role === 'admin' || profile?.role === 'su') && (
                          <button onClick={() => { navigate('/admin'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-400/80 hover:text-rose-400 hover:bg-rose-400/5 rounded-xl transition-all">
                            <Icons.shield size={14} /> Administrative Console
                          </button>
                        )}
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                          <Icons.grid size={14} /> My Asset Library
                        </button>
                        <button onClick={() => window.open(RESOURCES_URL, '_blank')} className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-indigo-400/80 hover:text-indigo-400 hover:bg-indigo-400/5 rounded-xl transition-all">
                          <Icons.sparkles size={14} /> Master library
                        </button>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/5">
                        {profile?.subscription === 'free' && (
                          <button
                            onClick={() => window.location.href = pricingUrl}
                            className="w-full mb-3 bg-indigo-600 py-3 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                          >
                            <Icons.billing size={14} /> Unlock PRO Access
                          </button>
                        )}
                        <button onClick={logout} className="w-full flex items-center justify-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-all">
                          <Icons.logout size={14} /> Sign Out Platform
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="bg-indigo-600 px-6 py-2.5 rounded-full text-[10px] font-black text-white uppercase tracking-[0.2em] hover:bg-indigo-500 hover:scale-105 transition-all shadow-[0_10px_20px_rgba(79,70,229,0.3)] active:scale-95">
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
