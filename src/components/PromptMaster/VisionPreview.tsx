import React from 'react';
import { Icons } from '../Icons';
import { usePromptMaster } from './PromptMasterContext';

export const VisionPreview: React.FC = () => {
  const { selectedPrompt, generatedImages, setPreviewImageUrl, setPreviewTitle, setPreviewPrompt } = usePromptMaster();

  const previewUrl = selectedPrompt?.thumbnailUrl || generatedImages[0]?.url;
  if (!previewUrl) return null;

  return (
    <div
      className="relative group cursor-zoom-in"
      onClick={() => {
        setPreviewImageUrl(selectedPrompt?.thumbnailUrl || generatedImages[0]?.url);
        setPreviewTitle(selectedPrompt?.title || generatedImages[0]?.title || '<no title>');
        setPreviewPrompt(selectedPrompt?.template || generatedImages[0]?.prompt || null);
      }}
    >
      <div className="absolute -inset-2 bg-indigo-500/20 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-60 transition-all duration-700 pointer-events-none"></div>
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-black shadow-2xl">
        <img src={previewUrl} className="w-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="Vision Preview" />

        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 transform scale-75 group-hover:scale-100 transition-all duration-500 shadow-2xl">
            <Icons.zoomIn className="w-10 h-10 text-white" />
          </div>
          <span className="absolute bottom-8 text-[10px] font-black text-white uppercase tracking-[0.4em] opacity-0 group-hover:opacity-100 transition-all duration-700 delay-100">Expand Vision Preview</span>
        </div>
      </div>
    </div>
  );
};
