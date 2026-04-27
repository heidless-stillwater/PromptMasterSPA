import React from 'react';
import { Icons } from '../Icons';
import { usePromptMaster } from './PromptMasterContext';
import { formatElapsed } from './types';
import { StepIcon } from './StepIcon';

export const NeuralStreamOverlay: React.FC = () => {
  const {
    generating, completion, setCompletion,
    status, progressMsg, elapsed,
    handleCancelGeneration, setActiveDetailTab,
  } = usePromptMaster();

  if (!generating && !completion) return null;

  return (
    <div className="relative animate-fade-in-up">
      <div className="absolute -inset-1 bg-primary/20 rounded-[2.5rem] blur-2xl opacity-40 pointer-events-none"></div>
      <div className="relative glass-card p-10 bg-background/95 border border-white/5 shadow-2xl rounded-[2.5rem] space-y-8">
        {generating ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
              <div className="flex items-center gap-4">
                <Icons.spinner className="w-5 h-5 text-primary animate-spin" />
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Neural Stream Protocol</h3>
              </div>
              <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] tabular-nums">{formatElapsed(elapsed)} Elapsed</span>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {status.map((step) => (
                <div key={step.id} className="flex flex-col gap-3">
                  <div className={`h-1.5 rounded-full transition-all duration-700 ${step.status === 'done' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : step.status === 'active' ? 'bg-primary animate-pulse' : 'bg-white/5'}`}></div>
                  <div className="flex items-center gap-2 px-1">
                    <StepIcon stepStatus={step.status} />
                    <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${step.status === 'done' ? 'text-emerald-400' : step.status === 'active' ? 'text-white' : 'text-white/10'}`}>{step.label}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end px-1">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-3">
                  <Icons.sparkles className="w-4 h-4 animate-pulse" />
                  {progressMsg || 'Calibrating Data Matrix...'}
                </p>
                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest tabular-nums">
                  {Math.round(((status.filter(s => s.status === 'done').length) / status.length) * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                <div
                  className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_20px_rgba(13,148,136,0.6)] rounded-full"
                  style={{ width: `${(status.filter(s => s.status === 'done').length / status.length) * 100}%` }}
                ></div>
              </div>

              <div className="pt-8 flex justify-center">
                <button
                  onClick={handleCancelGeneration}
                  className="px-8 py-3 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-[0.4em] border border-rose-500/20 transition-all shadow-xl active:scale-95 flex items-center gap-3"
                >
                  <Icons.close className="w-4 h-4" />
                  Abort Initialization
                </button>
              </div>
            </div>
          </div>
        ) : completion && (
          <div className="space-y-8 animate-in zoom-in-95 duration-700">
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse"></div>
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Manifest Render Complete</h3>
              </div>
              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest tabular-nums">{completion.elapsed}s Processed</span>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-primary/20 transition-all group/stat">
                <Icons.zap className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Architectural Cost</p>
                <p className="text-lg font-black text-white">{completion.creditsUsed} Credits</p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-primary/20 transition-all group/stat">
                <Icons.database className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Available Nodes</p>
                <p className="text-lg font-black text-white tabular-nums">{completion.remainingBalance}</p>
              </div>
            </div>

            <button
              onClick={() => { setCompletion(null); setActiveDetailTab('media'); }}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all active:scale-95 shadow-xl"
            >
              View Gallery Distribution
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
