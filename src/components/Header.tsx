import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthModal from './AuthModal';
import { Icons } from './Icons';
import { SovereignSentinel } from './SovereignSentinel';

interface HeaderProps {
  setActiveTab?: (tab: 'blueprints' | 'exemplars' | 'gallery') => void;
}

const Header: React.FC<HeaderProps> = ({ setActiveTab }) => {
  const { user, profile, logout, hasConflict, masterData } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPath = location.pathname === '/admin';

  // Use environment-aware URL for ecosystem navigation
  const RESOURCES_URL = import.meta.env.VITE_PROMPTRESOURCES_URL || 'http://localhost:3002';
  const THIS_APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
  const pricingUrl = `${RESOURCES_URL}/pricing?returnUrl=${encodeURIComponent(THIS_APP_URL)}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] px-6 h-[72px] flex items-center border-b border-white/5 backdrop-blur-xl bg-background/80">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-12 group">
          <div 
            className="flex items-center gap-4 cursor-pointer" 
            onClick={() => {
              navigate('/');
              setActiveTab?.('blueprints');
            }}
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative bg-background rounded-lg p-2 border border-white/10 group-hover:border-primary/50 transition-colors shadow-2xl">
                <Icons.sparkles className="w-6 h-6 text-primary group-hover:animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter text-white group-hover:text-primary transition-colors uppercase leading-none">Prompt Master</h1>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mt-1.5 leading-none">Registry Intelligence</p>
            </div>
          </div>

          {/* Navigation Architecture */}
          <nav className="hidden lg:flex items-center gap-8 border-l border-white/5 pl-12">
            <button 
              onClick={() => {
                navigate('/');
                setActiveTab?.('blueprints');
              }}
              className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.3em] transition-all hover:text-white group/nav ${location.pathname === '/' ? 'text-primary' : 'text-white/20'}`}
            >
              <Icons.grid size={14} className={`${location.pathname === '/' ? 'text-primary' : 'text-white/10 group-hover/nav:text-primary'} transition-colors`} />
              Dashboard
            </button>
            <button 
              onClick={() => window.open(`${RESOURCES_URL}/resources`, '_blank')}
              className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-all group/nav"
            >
              <Icons.sparkles size={14} className="text-white/10 group-hover/nav:text-primary transition-colors" />
              Resources
            </button>
          </nav>
        </div>

        {/* Navigation Actions & User */}
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


              {/* Admin Quick Access */}
              {(profile?.role === 'admin' || profile?.role === 'su' || masterData?.role === 'admin' || masterData?.role === 'su') && (
                <button
                  onClick={() => navigate(isAdminPath ? '/' : '/admin')}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 hover:border-primary/40 hover:bg-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary transition-all"
                >
                  {isAdminPath ? (
                    <>
                      <Icons.grid size={14} /> View Registry
                    </>
                  ) : (
                    <>
                      <Icons.shield size={14} /> Admin Console
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
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
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
                      <span className="text-xs font-black text-primary">
                        {(profile?.displayName || user.displayName || 'A')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-0" onClick={() => setShowMenu(false)}></div>
                    <div className="absolute right-0 mt-4 w-72 bg-background/95 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-2xl z-[1000] animate-fade-in-up">
                      <div className="flex items-center gap-4 pb-6 border-b border-white/5">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl text-primary font-black">
                          {(profile?.displayName || user.displayName || '👤')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-black text-white leading-none capitalize truncate w-32">{profile?.displayName || user.displayName || 'Creator'}</div>
                          <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest mt-1.5">
                            {typeof profile?.subscription === 'string' ? profile.subscription : 'PRO'} NODE AUTHORITY
                          </div>
                        </div>
                      </div>

                      <div className="py-6 space-y-2">
                          <button onClick={() => window.open(`${RESOURCES_URL}/dashboard/settings`, '_blank')} className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                              <Icons.settings size={14} /> Account Settings
                          </button>
                          <button onClick={() => window.open(`${RESOURCES_URL}/resources`, '_blank')} className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary/80 hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
                              <Icons.grid size={14} /> Resource Hub
                          </button>
                      </div>

                      <div className="pt-2">
                          <button 
                              onClick={logout}
                              className="w-full mb-3 bg-primary py-3 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-primary/80 shadow-lg shadow-primary/20 transition-all active:scale-95"
                          >
                              <Icons.logout size={14} /> Terminate Session
                          </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="bg-primary px-6 py-2.5 rounded-full text-[10px] font-black text-white uppercase tracking-[0.2em] hover:bg-primary/80 hover:scale-105 transition-all shadow-[0_10px_20px_rgba(13,148,136,0.3)] active:scale-95">
              Secure Login
            </button>
          )}

          {/* Sovereign Sentinel Status (Universal) */}
          <SovereignSentinel variant="badge" />
        </div>
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </header>
  );
};

export default Header;
