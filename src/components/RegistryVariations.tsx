import { ChevronDown, Layers, Trash2, LayoutGrid, List, Maximize2, Check, Copy, ExternalLink } from 'lucide-react';

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
      <div className={`flex ${
        variationsViewMode.startsWith('grid') ? 'flex-col items-center gap-1.5 pb-2.5' : 
        'flex-col items-start gap-4 p-5'
      } ${isActive ? 'bg-primary/10 ring-2 ring-primary/40' : 'bg-white/5'} hover:bg-white/10 rounded-[2.5rem] border border-white/5 transition-all duration-300 transform hover:scale-[1.01] relative group`}>
        
        {isActive && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-[60] bg-primary text-white text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-white/20">
            Active Node
          </div>
        )}

        <div
           className={`group/thumb relative rounded-[2rem] overflow-hidden border transition-all cursor-zoom-in shadow-xl bg-black/40 shrink-0 ${
             isActive ? 'border-primary shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'border-white/10 hover:border-primary/50'
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
          <img src={url} className="w-full h-full object-contain group-hover/thumb:scale-110 transition-transform duration-700" alt="" />
          
          {!isOriginal && (
            <div 
              onClick={(e) => { e.stopPropagation(); toggleSelectVariation(url); }}
              className={`absolute top-4 left-4 w-6 h-6 rounded-lg border-2 z-40 flex items-center justify-center transition-all cursor-pointer ${selectedVariations.has(url) ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'border-white/20 bg-black/40 opacity-0 group-hover/thumb:opacity-100 backdrop-blur-sm'}`}
            >
               {selectedVariations.has(url) && <Check className="w-4 h-4 text-white" />}
            </div>
          )}

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[1px] pointer-events-none group-hover/thumb:pointer-events-auto z-30">
            <button
              className={`py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-[2px] border border-white/20 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] transition-all duration-500 shadow-xl hover:scale-105 active:scale-95 ${variationsViewMode.startsWith('grid') ? 'w-32' : 'w-12 h-8 text-[8px] px-2'}`}
              onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(url); setPreviewTitle(title); setPreviewPrompt(promptValue || null); }}
            >
              {variationsViewMode.startsWith('grid') ? 'View Vision' : <Maximize2 className="w-3 h-3 mx-auto" />}
            </button>
            <button
              className={`py-2.5 bg-primary/80 hover:bg-primary border border-primary/20 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] transition-all duration-500 shadow-xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 ${variationsViewMode.startsWith('grid') ? 'w-32' : 'w-12 h-8 text-[8px] px-2'}`}
              onClick={(e) => { e.stopPropagation(); handleAssetSelection(url, title, promptValue, !isOriginal ? img.variables : undefined); }}
            >
              <Check className="w-3 h-3" />{variationsViewMode.startsWith('grid') ? ' Select' : ''}
            </button>
          </div>

          <div className="absolute top-4 right-4 z-50 flex items-center gap-2 opacity-0 group-hover/thumb:opacity-100 transition-all translate-x-2 group-hover/thumb:translate-x-0 pointer-events-none group-hover/thumb:pointer-events-auto">
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
               className="w-8 h-8 flex items-center justify-center bg-black/60 hover:bg-primary/20 text-white/40 hover:text-primary rounded-lg border border-white/10 hover:border-primary/30 transition-all backdrop-blur-md"
               title="Clone as New Blueprint"
             >
               <Copy className="w-3.5 h-3.5" />
             </button>
             {onViewInGallery && url && (
               <button 
                  onClick={(e) => { e.stopPropagation(); onViewInGallery({ ...img, imageUrl: url, title: title, prompt: promptValue }); }}
                  className="w-8 h-8 flex items-center justify-center bg-black/60 hover:bg-primary/20 text-white/40 hover:text-primary rounded-lg border border-white/10 hover:border-primary/30 transition-all backdrop-blur-md"
                  title="Find in Gallery"
               >
                 <ExternalLink className="w-3.5 h-3.5" />
               </button>
             )}
             {!isOriginal && (profile?.role === 'admin' || profile?.role === 'su' || (user && img.uid === user.uid)) && (
               <button 
                 onClick={(e) => { e.stopPropagation(); handleDeleteSelectedVariations(url); }}
                 className="w-8 h-8 flex items-center justify-center bg-black/95 hover:bg-red-500/20 text-white/90 hover:text-red-500 rounded-lg border border-white/10 hover:border-red-500/50 transition-all backdrop-blur-md shadow-xl"
                 title="Decommission Variation"
               >
                 <Trash2 className="w-3.5 h-3.5" />
               </button>
             )}
          </div>
        </div>

        <div className={`flex-1 w-full min-w-0 flex flex-col ${variationsViewMode.startsWith('grid') ? 'items-center text-center' : 'items-start text-left'} gap-2`}>
          {!variationsViewMode.startsWith('grid') && (
             <p className={`font-black text-white truncate w-full ${variationsViewMode === 'extended' ? 'text-sm' : 'text-[12px]'}`}>
                {title}
             </p>
          )}
          {variationsViewMode === 'extended' && !isOriginal && img.prompt && (
              <p className="text-gray-500 text-xs w-full mt-1 leading-relaxed opacity-60 whitespace-normal">
                {img.prompt}
              </p>
          )}
          <span className={`font-black text-primary uppercase bg-primary/10 px-4 py-1.5 rounded-full border border-primary/30 shadow-lg shadow-primary/10 inline-block ${variationsViewMode.startsWith('grid') ? 'text-[8px] tracking-tighter px-2 py-0.5' : 'text-[14px] tracking-[0.4em]'}`}>
             {isOriginal ? 'Original' : (img.isOriginal ? '[ Inception Vision ]' : `v: ${((generatedImages.length - (generatedImages.indexOf(img))) * 0.1).toFixed(1)}`)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsVariationsCollapsed(!isVariationsCollapsed)}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity outline-none"
          >
            <ChevronDown className={`w-4 h-4 text-primary transition-transform duration-300 ${isVariationsCollapsed ? '-rotate-90' : ''}`} />
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 m-0 p-0">
              <Layers className="w-3.5 h-3.5 text-primary" /> Registry Variations
            </h4>
          </button>
        </div>
        <div className="flex items-center gap-4">
          {selectedVariations.size > 0 && (
            <button 
              onClick={() => handleDeleteSelectedVariations()}
              className="text-[10px] font-black text-red-400 hover:text-red-500 uppercase tracking-widest flex items-center gap-2 transition-all px-3 py-1 bg-red-500/10 rounded-lg border border-red-500/20"
            >
               <Trash2 className="w-3.5 h-3.5" /> Purge ({selectedVariations.size})
            </button>
          )}
          <button 
            onClick={selectAllVariations}
            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all border ${selectedVariations.size === generatedImages.length && generatedImages.length > 0 ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white hover:bg-white/5 border-white/5'}`}
          >
            {selectedVariations.size === generatedImages.length && generatedImages.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shadow-inner backdrop-blur-xl shrink-0">
            <div className="px-2 py-1.5 flex items-center gap-2 border-r border-white/10 mr-1 select-none opacity-60">
                <LayoutGrid className="w-3 h-3 text-white" />
                <span className="text-[8px] font-black text-white uppercase tracking-tighter">Density</span>
            </div>
            {['grid-2', 'grid-3', 'grid-4', 'grid-6', 'grid-8'].map(mode => (
               <button 
                 key={mode}
                 onClick={() => setVariationsViewMode(mode)} 
                 className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black transition-all duration-300 ${variationsViewMode === mode ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
               >
                 {mode.split('-')[1]}C
               </button>
            ))}
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            <button 
              onClick={() => setVariationsViewMode('list')} 
              className={`p-1.5 rounded-lg transition-all duration-300 ${variationsViewMode === 'list' ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setVariationsViewMode('extended')} 
              className={`p-1.5 rounded-lg transition-all duration-300 ${variationsViewMode === 'extended' ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[9px] font-bold text-gray-700 uppercase tracking-widest">{generatedImages.length + 1} Assets Linked</span>
        </div>
      </div>

      {!isVariationsCollapsed && (
        <div className={`pt-4 ${
          variationsViewMode === 'grid-2' ? 'grid grid-cols-2 gap-6' : 
          variationsViewMode === 'grid-3' ? 'grid grid-cols-3 gap-6' : 
          variationsViewMode === 'grid-4' ? 'grid grid-cols-4 gap-4' : 
          variationsViewMode === 'grid-6' ? 'grid grid-cols-6 gap-3' : 
          variationsViewMode === 'grid-8' ? 'grid grid-cols-8 gap-2' : 
          'flex flex-col gap-4'
        }`}>
          {renderCard(null, true)}
          {generatedImages.map((img, idx) => (
            <div key={idx}>
              {renderCard(img, false)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
