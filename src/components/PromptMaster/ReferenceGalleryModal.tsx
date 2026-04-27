import React from 'react';
import { createPortal } from 'react-dom';
import PromptToolGallery from '../PromptToolGallery';
import { Icons } from '../Icons';
import type { ReferenceImage } from './types';

import { usePromptMaster } from './PromptMasterContext';

interface ReferenceGalleryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (image: ReferenceImage) => void;
}

export const ReferenceGalleryModal: React.FC<ReferenceGalleryModalProps> = ({ isOpen, onClose, onSelect }) => {
    const { selectedPrompt } = usePromptMaster();
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 md:p-12 overflow-hidden">
            <div 
                className="absolute inset-0 bg-[#0a0a0f]/98 backdrop-blur-3xl"
                onClick={onClose}
            />
            
            <div className="relative w-full max-w-7xl h-full max-h-[90vh] bg-[#12121a] border border-white/5 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between shrink-0 bg-black/20">
                    <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Icons.image size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Source Architecture Reference</h3>
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mt-2">Select generated fragments to anchor as foundations</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-5 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all border border-white/10 group active:scale-90"
                    >
                        <Icons.close size={24} className="transition-transform group-hover:rotate-90" />
                    </button>
                </div>

                {/* Gallery Wrapper */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    <PromptToolGallery 
                        onViewVariation={(img) => {
                            onSelect({
                                url: img.imageUrl,
                                id: img.id,
                                title: img.title || 'Gallery Fragment',
                                source: 'gallery'
                            });
                            onClose();
                        }}
                        activeThumbnailUrl={selectedPrompt?.thumbnailUrl}
                    />
                </div>
                
                {/* Footer Advice */}
                <div className="px-10 py-6 bg-black/40 border-t border-white/5 shrink-0 flex justify-center">
                    <p className="text-[9px] font-black text-indigo-400/40 uppercase tracking-[0.4em]">Click 'Workbench' on any asset to select it as a reference</p>
                </div>
            </div>
        </div>,
        document.body
    );
};
