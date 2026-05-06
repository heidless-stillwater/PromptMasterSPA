import React from 'react';
import { Icons } from '../Icons';
import { usePromptMaster } from './PromptMasterContext';
import { RegistryVariations } from '../RegistryVariations';
import { VisionPreview } from './VisionPreview';
import { TemplateHighlighter } from './TemplateHighlighter';
import { ReferenceGalleryModal } from './ReferenceGalleryModal';

export const BlueprintEditor: React.FC = () => {
    const { 
        selectedPrompt, setSelectedPrompt,
        rawTemplate, setRawTemplate,
        variables, setVariables,
        isEditingBlueprint, setIsEditingBlueprint,
        activeDetailTab, setActiveDetailTab,
        generatedImages,
        variationsViewMode, setVariationsViewMode,
        handleAssetSelection,
        setPreviewImageUrl, setPreviewTitle, setPreviewPrompt,
        handleClone, handleViewInGallery,
        profile, user,
        saveBlueprint,
        originalSnapshot,
        referenceImages,
        uploadReferenceImage,
        addReferenceImage,
        removeReferenceImage,
        selectedVariations,
        toggleSelectVariation,
        selectAllVariations,
        handleDeleteSelectedVariations
    } = usePromptMaster();

    const [isGalleryModalOpen, setIsGalleryModalOpen] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Sync default tab based on asset type
    React.useEffect(() => {
        if (selectedPrompt?.isExemplar) {
            setActiveDetailTab('media');
        } else {
            setActiveDetailTab('architect');
        }
    }, [selectedPrompt?.id, selectedPrompt?.isExemplar, setActiveDetailTab]);
    const [isReferencesCollapsed, setIsReferencesCollapsed] = React.useState(referenceImages.length === 0);

    // Sync collapse state when a new blueprint is loaded or images are cleared
    React.useEffect(() => {
        if (referenceImages.length === 0) {
            setIsReferencesCollapsed(true);
        } else {
            setIsReferencesCollapsed(false);
        }
    }, [referenceImages.length, selectedPrompt?.id]);

    if (!selectedPrompt) return null;

    return (
        <div className="space-y-12 animate-fade-in-up">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 border-b border-white/5 pb-12 items-start">
                <div className="xl:col-span-8 space-y-6 min-w-0">
                    <button 
                        onClick={() => setSelectedPrompt(null)}
                        className="group flex items-center gap-3 text-[10px] font-black text-white/20 hover:text-indigo-400 uppercase tracking-[0.5em] transition-all"
                    >
                        <Icons.arrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-2" />
                        De-select Prompt
                    </button>
                    
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white leading-[0.9] break-words">
                                {selectedPrompt.title}
                            </h2>
                            {selectedPrompt.isExemplar && (
                                <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-black uppercase tracking-widest rounded-full shrink-0">
                                    Registry Template
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] font-medium text-white/30 uppercase tracking-[0.3em] leading-relaxed max-w-2xl break-words">
                            {selectedPrompt.description || 'No architectural documentation provided for this node.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-8 pt-4 overflow-x-auto no-scrollbar">
                        <button 
                            onClick={() => setActiveDetailTab('architect')}
                            className={`flex items-center gap-3 pb-4 -mb-[1px] text-[11px] font-black uppercase tracking-[0.4em] transition-all border-b-2 shrink-0 ${activeDetailTab === 'architect' ? 'text-indigo-400 border-indigo-500' : 'text-white/20 border-transparent hover:text-white'}`}
                        >
                            <Icons.edit className="w-4 h-4" />
                            Prompt Blueprint
                        </button>
                        <button 
                            onClick={() => setActiveDetailTab('media')}
                            className={`flex items-center gap-3 pb-4 -mb-[1px] text-[11px] font-black uppercase tracking-[0.4em] transition-all border-b-2 shrink-0 ${activeDetailTab === 'media' ? 'text-indigo-400 border-indigo-500' : 'text-white/20 border-transparent hover:text-white'}`}
                        >
                            <Icons.image className="w-4 h-4" />
                            Media Vault
                        </button>
                    </div>
                </div>

                <div className="xl:col-span-4 w-full max-w-md xl:max-w-none ml-auto">
                    <VisionPreview />
                </div>
            </div>

            {activeDetailTab === 'architect' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                    {/* Left Side: Template Editor */}
                    <div className="lg:col-span-12 space-y-12">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em] flex items-center gap-3">
                                    <Icons.terminal className="w-5 h-5" />
                                    Structural Template
                                </h3>
                                <div className="flex gap-4">
                                    {!isEditingBlueprint ? (
                                        <button 
                                            onClick={() => setIsEditingBlueprint(true)}
                                            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/10"
                                        >
                                            Modify Logic
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => {
                                                setIsEditingBlueprint(false);
                                                saveBlueprint(false);
                                            }}
                                            className="px-6 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-indigo-600/20"
                                        >
                                            Register Overrides
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isEditingBlueprint ? (
                                <div className="relative group">
                                    <div className="absolute inset-0 w-full h-48 p-10 text-sm font-mono leading-relaxed whitespace-pre-wrap pointer-events-none overflow-hidden">
                                        <TemplateHighlighter 
                                            text={rawTemplate} 
                                            className="opacity-100" 
                                        />
                                    </div>
                                    <textarea 
                                        value={rawTemplate}
                                        onChange={(e) => setRawTemplate(e.target.value)}
                                        className="w-full h-48 bg-black/40 border border-indigo-500/20 rounded-[2.5rem] p-10 text-sm font-medium text-transparent caret-white placeholder:text-white/10 outline-none focus:border-indigo-500/50 transition-all font-mono leading-relaxed shadow-inner block relative z-10 resize-none"
                                        placeholder="Define neural architecture patterns using {{placeholder}} syntax..."
                                    />
                                    <div className="absolute inset-0 pointer-events-none rounded-[2.5rem] bg-indigo-500/[0.02] border border-indigo-500/10 group-focus-within:border-indigo-500/30 transition-all" />
                                </div>
                            ) : (
                                <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] relative group overflow-hidden">
                                    <TemplateHighlighter 
                                        text={rawTemplate} 
                                        className="text-white/60 text-sm font-mono leading-relaxed"
                                    />
                                    <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem] pointer-events-none" />
                                </div>
                            )}
                        </div>
                        
                        {/* Reference Materials Matrix */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <button 
                                    onClick={() => setIsReferencesCollapsed(!isReferencesCollapsed)}
                                    className="flex items-center gap-4 group outline-none"
                                >
                                    <div className={`p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 transition-all duration-500 group-hover:bg-indigo-500/20 ${isReferencesCollapsed ? '-rotate-90' : ''}`}>
                                        <Icons.chevronDown size={14} />
                                    </div>
                                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em] flex items-center gap-3">
                                        <Icons.image className="w-5 h-5" />
                                        Attached Reference Materials
                                    </h3>
                                </button>
                                <div className="flex gap-4">
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        ref={fileInputRef}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) uploadReferenceImage(file);
                                        }}
                                        accept="image/*"
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/10 flex items-center gap-2"
                                    >
                                        <Icons.upload className="w-3 h-3" />
                                        Upload Material
                                    </button>
                                    <button 
                                        onClick={() => setIsGalleryModalOpen(true)}
                                        className="px-6 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-indigo-500/20 flex items-center gap-2"
                                    >
                                        <Icons.stack className="w-3 h-3" />
                                        Source Gallery
                                    </button>
                                </div>
                            </div>
                            
                            {!isReferencesCollapsed && (
                                <div className="animate-fade-in-up">
                                    {referenceImages.length === 0 ? (
                                        <div className="p-10 border border-dashed border-white/5 rounded-[2.5rem] bg-white/[0.01] flex flex-col items-center justify-center gap-4 text-center group/empty">
                                            <Icons.activity className="w-8 h-8 text-white/5 group/empty-hover:text-indigo-500/20 transition-colors" />
                                            <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.3em]">No reference foundations anchored to this blueprint</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                            {referenceImages.map((ref, idx) => (
                                                <div key={idx} className="relative group/ref rounded-2xl overflow-hidden aspect-square border border-white/10 bg-black shadow-xl">
                                                    <img src={ref.url} className="w-full h-full object-cover opacity-60 group-hover/ref:opacity-100 transition-all duration-500 group-hover/ref:scale-110" alt={ref.title} />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/ref:opacity-100 transition-opacity" />
                                                    
                                                    <button 
                                                        onClick={() => removeReferenceImage(ref.url)}
                                                        className="absolute top-2 right-2 p-2 bg-rose-600 text-white rounded-lg opacity-0 group-hover/ref:opacity-100 transition-all hover:bg-rose-500 shadow-xl"
                                                    >
                                                        <Icons.close className="w-3 h-3" />
                                                    </button>
                                                    
                                                    <div className="absolute bottom-3 left-3 right-3 pointer-events-none opacity-0 group-hover/ref:opacity-100 transition-opacity">
                                                        <p className="text-[8px] font-black text-white uppercase truncate tracking-widest">{ref.title || 'Untitled Reference'}</p>
                                                        <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">{ref.source} source</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Variable Matrix */}
                        {Object.keys(variables).length > 0 && (
                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em] flex items-center gap-3">
                                    <Icons.sliders className="w-5 h-5" />
                                    Environmental Overrides
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {Object.entries(variables).map(([key, data]) => (
                                        <div key={key} className="bg-white/[0.02] border border-white/5 p-6 rounded-[1.5rem] flex flex-col gap-3 group/var hover:border-indigo-500/20 transition-all">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] group-hover/var:text-indigo-400 transition-colors">{key}</span>
                                                <Icons.target className="w-3 h-3 text-white/5 group-hover/var:text-indigo-400/40" />
                                            </div>
                                            <input 
                                                type="text" 
                                                value={data.value === data.default && data.default !== '<undefined>' ? '' : (data.value === '<undefined>' ? '' : data.value)}
                                                onChange={(e) => setVariables(prev => ({
                                                    ...prev,
                                                    [key]: { ...prev[key], value: e.target.value || prev[key].default }
                                                }))}
                                                placeholder={data.default === '<undefined>' ? 'Specify variable...' : data.default}
                                                className="bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder:text-white/10 outline-none focus:border-indigo-500/30 transition-all uppercase tracking-widest w-full"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Inline Registry Variations */}
                        <RegistryVariations 
                            generatedImages={generatedImages}
                            isVariationsCollapsed={false}
                            selectedVariations={selectedVariations} 
                            variationsViewMode={variationsViewMode}
                            originalSnapshot={originalSnapshot}
                            selectedPrompt={selectedPrompt}
                            profile={profile}
                            user={user}
                            setIsVariationsCollapsed={() => {}}
                            handleDeleteSelectedVariations={handleDeleteSelectedVariations}
                            selectAllVariations={selectAllVariations}
                            setVariationsViewMode={setVariationsViewMode}
                            handleAssetSelection={handleAssetSelection}
                            setPreviewImageUrl={setPreviewImageUrl}
                            setPreviewTitle={setPreviewTitle}
                            setPreviewPrompt={setPreviewPrompt}
                            handleClone={handleClone}
                            toggleSelectVariation={toggleSelectVariation}
                            onViewInGallery={handleViewInGallery}
                        />
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in-up">
                    <RegistryVariations 
                        generatedImages={generatedImages}
                        isVariationsCollapsed={false}
                        selectedVariations={selectedVariations}
                        variationsViewMode={variationsViewMode}
                        originalSnapshot={originalSnapshot}
                        selectedPrompt={selectedPrompt}
                        profile={profile}
                        user={user}
                        setIsVariationsCollapsed={() => {}}
                        handleDeleteSelectedVariations={handleDeleteSelectedVariations}
                        selectAllVariations={selectAllVariations}
                        setVariationsViewMode={setVariationsViewMode}
                        handleAssetSelection={handleAssetSelection}
                        setPreviewImageUrl={setPreviewImageUrl}
                        setPreviewTitle={setPreviewTitle}
                        setPreviewPrompt={setPreviewPrompt}
                        handleClone={handleClone}
                        toggleSelectVariation={toggleSelectVariation}
                        onViewInGallery={handleViewInGallery}
                    />
                </div>
            )}
            
            <ReferenceGalleryModal 
                isOpen={isGalleryModalOpen}
                onClose={() => setIsGalleryModalOpen(false)}
                onSelect={(img) => addReferenceImage(img)}
            />
        </div>
    );
};
