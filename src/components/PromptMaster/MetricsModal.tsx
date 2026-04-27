import React from 'react';
import { Icons } from '../Icons';
import { usePromptMaster } from './PromptMasterContext';
import { calculateComplexity, calculateFreshness, calculateUsageRating } from './types';

export const MetricsModal: React.FC = () => {
  const { viewingMetrics, setViewingMetrics } = usePromptMaster();
  if (!viewingMetrics) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl animate-fade-in" onClick={() => setViewingMetrics(null)} />
      <div className="relative w-full max-w-lg glass-card p-12 space-y-10 bg-[#12121a]/95 border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-fade-in-up rounded-[3.5rem]">
        <button
          onClick={() => setViewingMetrics(null)}
          className="absolute top-10 right-10 p-3 text-white/20 hover:text-white transition-colors bg-white/5 rounded-xl border border-white/10"
        >
          <Icons.close className="w-6 h-6" />
        </button>

        <div className="space-y-4">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em]">Architectural Analysis</p>
          <h2 className="text-4xl font-black uppercase tracking-tighter text-white leading-tight">{viewingMetrics.title}</h2>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="p-8 bg-white/[0.03] rounded-[2.5rem] border border-white/5 space-y-6 shadow-inner">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Icons.stack className="w-6 h-6 text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Blueprint Complexity</span>
              </div>
              <span className="text-2xl font-black text-indigo-400">{Math.round(calculateComplexity(viewingMetrics.template, viewingMetrics.prompts) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
              <div className="h-full bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)]" style={{ width: `${calculateComplexity(viewingMetrics.template, viewingMetrics.prompts) * 100}%` }} />
            </div>
            <p className="text-[10px] font-medium text-white/20 leading-relaxed uppercase tracking-[0.2em]">
              Measures architectural placeholder density. Higher complexity requires precise neural overrides.
            </p>
          </div>

          <div className="p-8 bg-white/[0.03] rounded-[2.5rem] border border-white/5 space-y-6 shadow-inner">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Icons.refresh className="w-6 h-6 text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Sync Freshness</span>
              </div>
              <span className="text-2xl font-black text-emerald-400">{Math.round(calculateFreshness(viewingMetrics.updatedAt) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
              <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" style={{ width: `${calculateFreshness(viewingMetrics.updatedAt) * 100}%` }} />
            </div>
            <p className="text-[10px] font-medium text-white/20 leading-relaxed uppercase tracking-[0.2em]">
              Data recency score. Last synchronized: {new Date(viewingMetrics.updatedAt || Date.now()).toLocaleDateString()}.
            </p>
          </div>

          <div className="p-8 bg-white/[0.03] rounded-[2.5rem] border border-white/5 space-y-6 shadow-inner">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Icons.zap className="w-6 h-6 text-indigo-400/40" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Ecosystem Usage</span>
              </div>
              <span className="text-2xl font-black text-white/60">{Math.round(calculateUsageRating(viewingMetrics.id) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
              <div className="h-full bg-white/20 rounded-full" style={{ width: `${calculateUsageRating(viewingMetrics.id) * 100}%` }} />
            </div>
            <p className="text-[10px] font-medium text-white/20 leading-relaxed uppercase tracking-[0.2em]">
              Frequency of implementation across the Stillwater cluster.
            </p>
          </div>
        </div>

        <button
          onClick={() => setViewingMetrics(null)}
          className="w-full py-5 bg-white text-black text-[11px] font-black uppercase tracking-[0.5em] rounded-[1.5rem] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl"
        >
          Close Analysis
        </button>
      </div>
    </div>
  );
};
