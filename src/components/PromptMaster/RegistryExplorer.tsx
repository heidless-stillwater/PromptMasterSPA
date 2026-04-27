import React from 'react';
import { Icons } from '../Icons';
import { usePromptMaster } from './PromptMasterContext';
import PromptToolGallery from '../PromptToolGallery';

export const RegistryExplorer: React.FC = () => {
    const { 
        activeTab,
        filteredList, loadingLibrary, handleSelect, handleDelete, setViewingMetrics,
        searchQuery, setSearchQuery, 
        sortMode, setSortMode, 
        viewMode, setViewMode,
        gallerySearchQuery,
        initialGalleryAssetId,
        handleViewVariation,
        selectedPrompt
    } = usePromptMaster();

    if (activeTab === 'gallery') {
        return (
            <div className="space-y-4 animate-fade-in-up">
                <div className="pt-4">
                    <PromptToolGallery 
                        onViewVariation={handleViewVariation}
                        initialSearch={gallerySearchQuery}
                        initialAssetId={initialGalleryAssetId}
                        activeThumbnailUrl={selectedPrompt?.thumbnailUrl}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* ── CONTROL BELT (Aligned with Resources) ── */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-background-secondary/30 backdrop-blur-xl border border-white/5 rounded-[2rem] mb-6 shadow-2xl relative overflow-hidden">
                <div className="flex flex-wrap items-center gap-4 flex-1 min-w-[300px] relative z-10">
                    {/* Search Architecture */}
                    <div className="relative flex-1 max-w-md group">
                        <Icons.search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchQuery ? 'text-primary' : 'text-white/20'}`} />
                        <input 
                            type="text" 
                            placeholder={`Search ${activeTab === 'blueprints' ? 'architectures' : 'exemplars'}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-11 pl-12 pr-10 bg-black/40 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-primary/50 transition-all font-medium placeholder:text-white/30"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/80">
                                <Icons.close size={14} />
                            </button>
                        )}
                    </div>
                    
                    <div className="h-8 w-px bg-white/5 hidden md:block"></div>

                    {/* Density Selector Architecture */}
                    <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
                        {(['grid-2', 'grid-3', 'grid-4', 'grid-5', 'grid-6'] as any[]).map(m => (
                            <button 
                                key={m}
                                onClick={() => setViewMode(m)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === m ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white'}`}
                            >
                                {m.split('-')[1]}C
                            </button>
                        ))}
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white'}`}
                            title="List View"
                        >
                            <Icons.list className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    {/* Sort Protocol */}
                    <div className="relative group/sort hidden lg:block">
                        <select 
                            value={sortMode}
                            onChange={(e) => setSortMode(e.target.value as any)}
                            className="h-11 bg-background border border-white/5 rounded-xl px-4 pr-10 text-[10px] font-black uppercase text-white/70 outline-none hover:bg-white/5 hover:border-primary/30 transition-all cursor-pointer min-w-[180px] appearance-none tracking-widest"
                        >
                            <option value="updated">Recent Activity</option>
                            <option value="newest">Discovery Date</option>
                            <option value="oldest">Historical Sort</option>
                            <option value="az">Identity (A-Z)</option>
                            <option value="za">Identity (Z-A)</option>
                        </select>
                        <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 pointer-events-none group-hover/sort:text-primary transition-colors" />
                    </div>

                    <div className="h-8 w-px bg-white/5 hidden md:block"></div>

                    <div className="px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl hidden lg:block">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{filteredList.length} Objects Found</span>
                    </div>
                </div>
            </div>

            {loadingLibrary ? (
                <div className="flex flex-col items-center justify-center py-40 gap-6">
                    <Icons.refresh className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 animate-pulse">Synchronizing Registry Intelligence</span>
                </div>
            ) : filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 gap-6 border border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
                    <Icons.search className="w-12 h-12 text-white/5" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/10">No matching architectures found in domain</span>
                </div>
            ) : (
                <div className={viewMode === 'list' ? 'flex flex-col gap-4' : `grid gap-6 ${
                    viewMode === 'grid-2' ? 'grid-cols-2' : 
                    viewMode === 'grid-3' ? 'grid-cols-3' : 
                    viewMode === 'grid-4' ? 'grid-cols-4' : 
                    viewMode === 'grid-5' ? 'grid-cols-5' : 
                    'grid-cols-6'
                }`}>
                    {filteredList.map((p, idx) => (
                    <div 
                        key={p.id}
                        onClick={() => handleSelect(p)}
                        className={`group relative flex flex-col bg-white/[0.02] border border-white/5 rounded-[2rem] overflow-hidden transition-all duration-700 hover:border-primary/30 hover:shadow-[0_0_50px_rgba(13,148,136,0.1)] cursor-pointer animate-fade-in-up`}
                        style={{ animationDelay: `${idx * 40}ms` }}
                    >
                        <div className="aspect-square relative overflow-hidden bg-black/40">
                            <img 
                                src={p.thumbnailUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${p.id}`} 
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-60 group-hover:opacity-100" 
                                alt="" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-20 transition-opacity" />
                            
                            <div className="absolute top-4 right-4 flex gap-2 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setViewingMetrics(p); }}
                                    className="p-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-all shadow-2xl"
                                >
                                    <Icons.activity className="w-4 h-4" />
                                </button>
                                {p.isPersonal && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                                        className="p-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-rose-600 text-white/60 hover:text-white transition-all shadow-2xl"
                                    >
                                        <Icons.trash className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between transition-all duration-700">
                                <div className="space-y-1">
                                    <p className="text-[14px] font-black text-white uppercase tracking-tighter leading-none">{p.title}</p>
                                    <p className="text-[8px] font-black text-primary/60 uppercase tracking-[0.2em]">{p.authorName || 'Architect'}</p>
                                </div>
                                <div className="p-3 bg-white/10 backdrop-blur-xl rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Icons.arrowRight className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                    ))}
                </div>
            )}
        </div>
    );
};
