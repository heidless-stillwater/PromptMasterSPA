import React from 'react';
import { Icons } from './Icons';
import { useSovereignStatus } from '../hooks/useSovereignStatus';

interface Props {
  variant?: 'badge' | 'hud';
}

export const SovereignSentinel: React.FC<Props> = ({ variant = 'badge' }) => {
  const sovereign = useSovereignStatus();

  const getStatusColor = () => {
    switch (sovereign.overallStatus) {
      case 'green': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'amber': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'red': return 'text-rose-400 border-rose-500/50 bg-rose-500/10';
      default: return 'text-white/40 border-white/10 bg-white/5';
    }
  };

  const getStatusLabel = () => {
    if (sovereign.error) return 'Registry Offline';
    switch (sovereign.overallStatus) {
      case 'green': return 'Sovereign Nominal';
      case 'amber': return 'Integrity Drift';
      case 'red': return 'Sovereign Lock';
      default: return 'Registry Syncing...';
    }
  };

  if (variant === 'badge') {
    return (
      <button
        onClick={() => window.location.href = 'http://localhost:3003/monitoring'}
        className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 group relative overflow-hidden ${getStatusColor()}`}
        title={`Status: ${getStatusLabel()} ${sovereign.failingPolicies.length ? `(${sovereign.failingPolicies.join(', ')})` : ''}`}
      >
        {sovereign.overallStatus === 'red' && (
          <div className="absolute inset-0 bg-rose-500/10 animate-pulse"></div>
        )}
        <Icons.shield size={16} className={`relative z-10 ${sovereign.overallStatus === 'red' ? 'animate-pulse' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-widest relative z-10">{getStatusLabel()}</span>
        {sovereign.failingPolicies.length > 0 && (
            <div className={`w-1.5 h-1.5 rounded-full relative z-10 ${sovereign.overallStatus === 'red' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-amber-500'}`} />
        )}
      </button>
    );
  }

  return (
    <div className={`glass-card p-6 border transition-all group relative overflow-hidden ${getStatusColor()}`}>
       <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
           <Icons.shield size={96} />
       </div>
       
       <div className="flex justify-between items-start mb-6 relative z-10">
          <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${getStatusColor()}`}>
                  <Icons.shield size={24} className={sovereign.overallStatus === 'red' ? 'animate-pulse' : ''} />
              </div>
              <div>
                  <h3 className="text-lg font-black text-white tracking-tight uppercase leading-none mb-1">Sovereign Sentinel</h3>
                  <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${sovereign.overallStatus === 'green' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                      <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{getStatusLabel()}</span>
                  </div>
              </div>
          </div>
          <button 
            onClick={() => window.location.href = 'http://localhost:3003'}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            Open Hub
          </button>
       </div>

       <div className="space-y-3 relative z-10">
          {sovereign.overallStatus === 'green' ? (
              <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex items-center gap-3">
                  <Icons.check size={14} className="text-emerald-500" />
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">All regulatory gates are clinical and verified.</p>
              </div>
          ) : (
              sovereign.failingPolicies.map((p, i) => (
                  <div key={i} className="p-4 bg-black/40 rounded-xl border border-rose-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <Icons.alert size={14} className="text-rose-500" />
                          <span className="text-[10px] text-white uppercase font-black tracking-tight">{p}</span>
                      </div>
                      <span className="text-[8px] font-black text-rose-500/60 uppercase tracking-widest">Breach_Detected</span>
                  </div>
              ))
          )}
          
          <div className="pt-2 flex items-center justify-between">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Protocol: Sentinel_v4.2</span>
              <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Last Sync: {sovereign.lastAudit?.toLocaleTimeString() || 'Pending'}</span>
          </div>
       </div>
    </div>
  );
};
