import React from 'react';
import { Icons } from './Icons';

interface RegistryVariationsProps {
  generatedImages: any[];
  isVariationsCollapsed: boolean;
  selectedVariations: Set<string>;
  variationsViewMode: string;
  originalSnapshot: any;
  selectedPrompt: any;
  profile: any;
  user: any;
  setIsVariationsCollapsed: (v: boolean) => void;
  handleDeleteSelectedVariations: (url?: string) => void;
  selectAllVariations: () => void;
  setVariationsViewMode: (v: any) => void;
  handleAssetSelection: (url: string | null, title: string | undefined, prompt: string | undefined, vars?: any) => void;
  setPreviewImageUrl: (url: string | null) => void;
  setPreviewTitle: (title: string) => void;
  setPreviewPrompt: (prompt: string | null) => void;
  handleClone: (p: any) => void;
  toggleSelectVariation: (url: string) => void;
  onViewInGallery?: (img: any) => void;
}

export function RegistryVariations({
  generatedImages,
  isVariationsCollapsed,
  selectedVariations,
  variationsViewMode,
  originalSnapshot,
  selectedPrompt,
  profile,
  user,
  setIsVariationsCollapsed,
  handleDeleteSelectedVariations,
  selectAllVariations,
  setVariationsViewMode,
  handleAssetSelection,
  setPreviewImageUrl,
  setPreviewTitle,
  setPreviewPrompt,
  handleClone,
  toggleSelectVariation,
  onViewInGallery
}: RegistryVariationsProps) {

  const renderCard = (img: any, isOriginal: boolean) => {
    const url = isOriginal ? (originalSnapshot?.url || (selectedPrompt?.id ? `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedPrompt.id}` : '')) : img.url;
    const title = isOriginal ? (originalSnapshot?.title || selectedPrompt?.title || '<no title>') : (img.title || '<no title>');
    const promptValue = isOriginal ? (originalSnapshot?.prompt || selectedPrompt?.template || selectedPrompt?.prompts?.[0]) : img.prompt;
    const isActive = (url === selectedPrompt?.thumbnailUrl) || (isOriginal && !selectedPrompt?.thumbnailUrl && !url);

    return (
      <div className={`flex group/card relative ${
        variationsViewMode.startsWith('grid') ? 'flex-col items-center gap-1.5 pb-2.5' : 
        'flex-col items-start gap-4 p-5'
      } ${isActive ? 'bg-indigo-500/5 ring-1 ring-indigo-500/30' : 'bg-white/5'} hover:bg-white/10 rounded-[2.5rem] border border-white/5 transition-all duration-500 transform hover:scale-[1.01]`}>
        
        {isActive && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-[60] bg-indigo-600 text-white text-[7px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full shadow-2xl border border-white/20 animate-pulse">
            Active Node
          </div>
        )}

        <div
           className={`group/thumb relative rounded-[2rem] overflow-hidden border transition-all cursor-zoom-in shadow-2xl bg-black/40 shrink-0 ${
             isActive ? 'border-indigo-500/40 shadow-indigo-500/10' : 'border-white/10 hover:border-white/20'
           } ${
             variationsViewMode === 'grid-8' ? 'w-full aspect-square rounded-xl' :
             variationsViewMode === 'grid-6' ? 'w-full aspect-square rounded-2xl' :
             variationsViewMode === 'grid-4' ? 'w-full aspect-[4/3]' :
             variationsViewMode.startsWith('grid') ? 'w-full aspect-square' : 
             variationsViewMode === 'extended' ? 'w-full h-48' :
             'w-full h-32'
           }`}
           onClick={() => handleAssetSelection(url, title, promptValue, !isOriginal ? img.variables : undefined)}
         >
          <img src={url} className="w-full h-full object-contain group-hover/thumb:scale-105 transition-transform duration-1000" alt="" />
          
          {!isOriginal && (
            <div 
              onClick={(e) => { e.stopPropagation(); toggleSelectVariation(url); }}
              className={`absolute top-4 left-4 w-6 h-6 rounded-lg border z-40 flex items-center justify-center transition-all cursor-pointer ${selectedVariations.has(url) ? 'bg-indigo-600 border-indigo-500 shadow-xl' : 'border-white/10 bg-black/80 opacity-0 group-hover/thumb:opacity-100 backdrop-blur-md hover:border-white/40'}`}
            >
               {selectedVariations.has(url) && <Icons.check className="w-3.5 h-3.5 text-white" />}
            </div>
          )}

          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] pointer-events-none group-hover/thumb:pointer-events-auto z-30">
            <button
              className={`py-3 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl text-[9px] font-black text-white uppercase tracking-[0.3em] transition-all shadow-2xl hover:scale-105 active:scale-95 ${variationsViewMode.startsWith('grid') ? 'w-36' : 'w-12 h-10 text-[8px] px-2'}`}
              onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(url); setPreviewTitle(title); setPreviewPrompt(promptValue || null); }}
            >
              {variationsViewMode.startsWith('grid') ? 'Immerse Vision' : <Icons.eye className="w-3.5 h-3.5 mx-auto" />}
            </button>
            <button
              className={`py-3 bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-500/20 rounded-2xl text-[9px] font-black text-white uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 ${variationsViewMode.startsWith('grid') ? 'w-36' : 'w-12 h-10 text-[8px] px-2'}`}
              onClick={(e) => { e.stopPropagation(); handleAssetSelection(url, title, promptValue, !isOriginal ? img.variables : undefined); }}
            >
              <Icons.check className="w-3.5 h-3.5" />{variationsViewMode.startsWith('grid') ? ' Standardize' : ''}
            </button>
          </div>

          <div className="absolute top-5 right-5 z-50 flex flex-col gap-2 opacity-0 group-hover/thumb:opacity-100 transition-all translate-x-3 group-hover/thumb:translate-x-0 pointer-events-none group-hover/thumb:pointer-events-auto">
             <button 
               onClick={(e) => { 
                 e.stopPropagation(); 
                 handleClone({ 
                   ...selectedPrompt, 
                   thumbnailUrl: url,
                   title: title,
                   template: promptValue
                 }); 
               }}
               className="w-10 h-10 flex items-center justify-center bg-black/80 hover:bg-indigo-600/40 text-white/40 hover:text-indigo-400 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all backdrop-blur-xl shadow-2xl"
               title="Clone Blueprint"
             >
               <Icons.copy className="w-4 h-4" />
             </button>
             {onViewInGallery && url && (
               <button 
                  onClick={(e) => { e.stopPropagation(); onViewInGallery({ ...img, imageUrl: url, title: title, prompt: promptValue }); }}
                  className="w-10 h-10 flex items-center justify-center bg-black/80 hover:bg-indigo-600/40 text-white/40 hover:text-indigo-400 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all backdrop-blur-xl shadow-2xl"
                  title="View Registry"
               >
                 <Icons.external className="w-4 h-4" />
               </button>
             )}
             {!isOriginal && (profile?.role === 'admin' || profile?.role === 'su' || (user && img.uid === user.uid)) && (
               <button 
                 onClick={(e) => { e.stopPropagation(); handleDeleteSelectedVariations(url); }}
                 className="w-10 h-10 flex items-center justify-center bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl border border-rose-500/20 transition-all backdrop-blur-xl shadow-2xl"
                 title="Decommission Node"
               >
                 <Icons.delete className="w-4 h-4" />
               </button>
             )}
          </div>
        </div>

        <div className={`flex-1 w-full min-w-0 flex flex-col ${variationsViewMode.startsWith('grid') ? 'items-center text-center' : 'items-start text-left'} gap-2 px-2`}>
          {!variationsViewMode.startsWith('grid') && (
             <p className={`font-black text-white/90 truncate w-full tracking-tight ${variationsViewMode === 'extended' ? 'text-sm' : 'text-[12px]'}`}>
                {title}
             </p>
          )}
          {variationsViewMode === 'extended' && !isOriginal && img.prompt && (
              <p className="text-white/20 text-[10px] uppercase font-black tracking-widest w-full mt-1 leading-relaxed opacity-60 whitespace-normal line-clamp-3">
                {img.prompt}
              </p>
          )}
          <div className="flex items-center gap-2">
            <span className={`font-black text-white/40 uppercase bg-white/5 px-4 py-2 rounded-xl border border-white/5 shadow-2xl inline-block ${variationsViewMode.startsWith('grid') ? 'text-[8px] tracking-[0.2em] px-3 py-1' : 'text-[10px] tracking-[0.4em]'}`}>
               {isOriginal ? 'Genesis Node' : (img.isOriginal ? 'Inception Vision' : `Variation ${((generatedImages.length - (generatedImages.indexOf(img))) * 0.1).toFixed(1)}`)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 mt-10">
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setIsVariationsCollapsed(!isVariationsCollapsed)}
            className="flex items-center gap-4 group outline-none"
          >
            <div className={`p-2 rounded-xl bg-white/5 border border-white/10 text-indigo-400 transition-all duration-500 group-hover:bg-indigo-500/10 ${isVariationsCollapsed ? '-rotate-90' : ''}`}>
                <Icons.chevronDown className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
                <h4 className="text-[12px] font-black text-white uppercase tracking-[0.4em] m-0 p-0 leading-none">
                  Asset Variation Matrix
                </h4>
                <p className="text-[9px] font-black text-indigo-400/30 uppercase tracking-[0.3em] mt-2 leading-none">Linked Neural Blueprints</p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
              {selectedVariations.size > 0 && (
                <button 
                  onClick={() => handleDeleteSelectedVariations()}
                  className="text-[9px] font-black text-rose-400 hover:text-white hover:bg-rose-600 uppercase tracking-[0.3em] flex items-center gap-3 transition-all px-4 py-2.5 bg-rose-500/10 rounded-2xl border border-rose-500/20 shadow-2xl"
                >
                   <Icons.delete className="w-4 h-4" /> Purge Matrix ({selectedVariations.size})
                </button>
              )}
              <button 
                onClick={selectAllVariations}
                className={`px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] transition-all border shadow-2xl ${selectedVariations.size === generatedImages.length && generatedImages.length > 0 ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/20' : 'text-white/40 hover:text-white hover:bg-white/5 border-white/10'}`}
              >
                {selectedVariations.size === generatedImages.length && generatedImages.length > 0 ? 'De-Select All' : 'Select Collective'}
              </button>
          </div>

          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-3xl shrink-0">
            <div className="px-3 py-1.5 flex items-center gap-3 border-r border-white/5 mr-1 select-none">
                <Icons.grid className="w-4 h-4 text-indigo-400" />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Density</span>
            </div>
            {['grid-2', 'grid-3', 'grid-4', 'grid-6', 'grid-8'].map(mode => (
               <button 
                 key={mode}
                 onClick={() => setVariationsViewMode(mode)} 
                 className={`px-3.5 py-1.5 rounded-xl text-[9px] font-black transition-all duration-500 uppercase ${variationsViewMode === mode ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
               >
                 {mode.split('-')[1]}C
               </button>
            ))}
            <div className="w-px h-6 bg-white/5 mx-2" />
            <button 
              onClick={() => setVariationsViewMode('list')} 
              className={`p-2 rounded-xl transition-all duration-500 ${variationsViewMode === 'list' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
            >
              <Icons.list className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setVariationsViewMode('extended')} 
              className={`p-2 rounded-xl transition-all duration-500 ${variationsViewMode === 'extended' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
            >
              <Icons.feed className="w-4 h-4" />
            </button>
          </div>
          <div className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl">
             <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">{generatedImages.length + 1} Managed Objects</span>
          </div>
        </div>
      </div>

      {!isVariationsCollapsed && (
        <div className={`pt-8 animate-fade-in ${
          variationsViewMode === 'grid-2' ? 'grid grid-cols-2 gap-10' : 
          variationsViewMode === 'grid-3' ? 'grid grid-cols-3 gap-8' : 
          variationsViewMode === 'grid-4' ? 'grid grid-cols-4 gap-6' : 
          variationsViewMode === 'grid-6' ? 'grid grid-cols-6 gap-4' : 
          variationsViewMode === 'grid-8' ? 'grid grid-cols-8 gap-3' : 
          'flex flex-col gap-6'
        }`}>
          {renderCard(null, true)}
          {generatedImages.map((img, idx) => (
            <div key={idx} className="animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
              {renderCard(img, false)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
