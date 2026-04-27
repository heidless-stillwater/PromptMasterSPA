import React from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../Icons';
import { usePromptMaster } from './PromptMasterContext';
import { VAR_REGEX, type Prompt } from './types';

export const VisionPreviewModal: React.FC = () => {
  const { 
    previewImageUrl, setPreviewImageUrl, 
    previewTitle, 
    previewPrompt, setPreviewPrompt,
    handleClone, selectedPrompt
  } = usePromptMaster();

  if (!previewImageUrl) return null;

  const handleModalClone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!previewImageUrl) return;

    handleClone({
      ...(selectedPrompt || {}),
      id: selectedPrompt?.id || `clone-${Date.now()}`,
      thumbnailUrl: previewImageUrl,
      title: previewTitle || selectedPrompt?.title || 'Cloned Architecture',
      template: selectedPrompt?.template || previewPrompt || ''
    } as Prompt, undefined, previewPrompt || undefined);
    
    setPreviewImageUrl(null);
    setPreviewPrompt(null);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-12 backdrop-blur-3xl bg-black/90 animate-fade-in"
      onClick={() => { setPreviewImageUrl(null); setPreviewPrompt(null); }}
    >
      <button
        onClick={() => { setPreviewImageUrl(null); setPreviewPrompt(null); }}
        className="absolute top-10 right-10 z-[120] p-5 bg-white/5 hover:bg-rose-600 text-white rounded-2xl border border-white/10 transition-all group shadow-2xl"
      >
        <Icons.close className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      <div
        className="relative max-w-7xl w-full max-h-[90vh] flex flex-col md:flex-row items-stretch rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(0,0,0,0.9)] border border-white/10 group/modal bg-[#12121a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 relative flex items-center justify-center bg-black/60 overflow-hidden min-h-[40vh] md:min-h-0">
          <div className="absolute -inset-20 bg-indigo-600 opacity-10 blur-[120px] animate-pulse pointer-events-none"></div>
          <img
            src={previewImageUrl}
            className="relative w-full h-full object-contain z-10 p-4 md:p-12 transition-all duration-1000 group-hover/modal:scale-[1.01]"
            alt="Vision Preview"
          />

          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 px-10 py-4 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full flex items-center gap-6 opacity-0 group-hover/modal:opacity-100 translate-y-4 group-hover/modal:translate-y-0 transition-all duration-700 shadow-2xl">
            <div className="flex items-center gap-3">
              <Icons.sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-black text-white uppercase tracking-[0.2em] whitespace-nowrap">{previewTitle || 'High-Fidelity Neural Output'}</span>
            </div>
            
            <div className="h-4 w-[1px] bg-white/10"></div>
            
            <div className="flex items-center gap-6">
                <button
                  onClick={handleModalClone}
                  className="text-[10px] font-black text-white hover:text-indigo-400 transition-colors uppercase tracking-[0.3em] flex items-center gap-2 active:scale-95"
                >
                   <Icons.copy className="w-3.5 h-3.5 text-indigo-400" />
                   Clone Architecture
                </button>

                <button
                  onClick={() => window.open(previewImageUrl, '_blank')}
                  className="text-[10px] font-black text-white/40 hover:text-white transition-colors uppercase tracking-[0.3em] active:scale-95"
                >
                  Source Raw Link
                </button>
            </div>
          </div>
        </div>

        {previewPrompt && [...previewPrompt.matchAll(VAR_REGEX)].length > 0 && (
          <div className="w-full md:w-96 bg-[#0f0f15] border-l border-white/5 p-10 flex flex-col gap-8 overflow-y-auto hidden md:flex z-20 scrollbar-hide">
            <div>
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-3 flex items-center gap-3">
                <Icons.sliders className="w-5 h-5" />
                Active Variables
              </h4>
              <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest leading-relaxed">Structural parameter values legacy-embedded in this specific generation.</p>
            </div>
            <div className="space-y-6">
              {[...previewPrompt.matchAll(VAR_REGEX)].map((match, idx) => {
                const parts = match[match.length > 1 ? 1 : 0].split(':');
                const key = parts[0];
                const val = parts.length > 1 ? parts[1] : '<undefined>';
                return (
                  <div key={idx} className="bg-white/[0.02] border border-white/5 p-6 rounded-[1.5rem] flex flex-col gap-2 hover:border-indigo-500/30 transition-all shadow-inner group/var">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] group-hover/var:text-indigo-400 transition-colors">{key}</span>
                    <span className="text-sm font-medium text-white break-words leading-relaxed">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
