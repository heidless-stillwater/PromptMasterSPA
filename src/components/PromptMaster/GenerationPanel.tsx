import React from 'react';
import { Icons } from '../Icons';
import { usePromptMaster } from './PromptMasterContext';
import { NeuralStreamOverlay } from './NeuralStreamOverlay';

export const GenerationPanel: React.FC = () => {
    const { 
        selectedPrompt,
        resultantPrompt,
        engine, setEngine,
        quality, setQuality,
        generating,
        handleSubmit,
        saveBlueprint,
        handleDelete,
        handleClone,
        isNewImageSet, setIsNewImageSet,
        saveStatus
    } = usePromptMaster();

    const controllers = (resultantPrompt.match(/__VAL__/g) || []).length / 2;

    return (
        <div className="space-y-12 h-full">
            {/* Header Actions */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em] flex items-center gap-3">
                        <Icons.settings className="w-5 h-5" />
                        Infrastructure
                    </h3>
                    <div className="flex gap-2">
                         <button 
                            onClick={() => saveBlueprint(false)}
                            title="Register to Registry"
                            className={`p-3 rounded-xl border transition-all ${saveStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/20'}`}
                        >
                            <Icons.save className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleClone(selectedPrompt!); }}
                            title="Clone Architecture"
                            className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-white hover:border-white/20 transition-all"
                        >
                            <Icons.copy className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            title="Decommission Node"
                            className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                        >
                            <Icons.trash className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="flex flex-col gap-4">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] px-1">Neural Engine Selection</p>
                        <div className="grid grid-cols-3 gap-3">
                            {['vision-0', 'architect-1', 'cinematic-3'].map(e => (
                                <button 
                                    key={e}
                                    onClick={() => setEngine(e)}
                                    className={`py-3 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${engine === e ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/20' : 'bg-white/[0.02] border-white/5 text-white/20 hover:text-white hover:bg-white/10'}`}
                                >
                                    {e.split('-')[0]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] px-1">Quality Tier Deployment</p>
                        <div className="grid grid-cols-3 gap-3">
                            {(['standard', 'high', 'ultra'] as const).map(q => (
                                <button 
                                    key={q}
                                    onClick={() => setQuality(q)}
                                    className={`py-3 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${quality === q ? 'bg-emerald-600 border-emerald-500 text-white shadow-xl shadow-emerald-600/20' : 'bg-white/[0.02] border-white/5 text-white/20 hover:text-white hover:bg-white/10'}`}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Instruction Preview */}
            <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em] flex items-center gap-3">
                        <Icons.zap className="w-5 h-5 text-yellow-400" />
                        Compiled Vision Instructions
                    </h3>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                             <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{controllers} Controllers Active</span>
                        </div>
                    </div>
                </div>
                
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 to-transparent rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    <div className="relative p-10 bg-black/40 border border-white/5 rounded-[2.5rem] min-h-[160px] flex flex-col justify-center overflow-hidden">
                        <p className="text-sm font-medium text-white/50 leading-relaxed font-mono italic">
                            {resultantPrompt.split(/(__DEF__.*?__DEF__|__VAL__.*?__VAL__)/).map((part, i) => {
                                if (part.startsWith('__DEF__')) {
                                    return <span key={i} className="text-white/20 decoration-white/10 underline underline-offset-4 decoration-dotted">{part.replace(/__DEF__/g, '')}</span>;
                                }
                                if (part.startsWith('__VAL__')) {
                                    return <span key={i} className="text-indigo-400 font-black not-italic bg-indigo-400/5 px-2 py-0.5 rounded-lg border border-indigo-500/20 shadow-lg">{part.replace(/__VAL__/g, '')}</span>;
                                }
                                return part;
                            })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Generate Action */}
            <div className="space-y-8">
                 <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                    <label className="flex items-center gap-4 cursor-pointer group">
                        <div 
                            onClick={() => setIsNewImageSet(!isNewImageSet)}
                            className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${isNewImageSet ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-600/30' : 'bg-white/5 border-white/10 group-hover:border-white/20'}`}
                        >
                            {isNewImageSet && <Icons.check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex flex-col">
                             <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Initialize New Asset Cluster</span>
                             <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Resets lineage ID for fresh versioning</span>
                        </div>
                    </label>
                </div>

                <div className="relative group">
                    {!generating ? (
                         <button 
                            onClick={handleSubmit}
                            className="w-full py-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] flex items-center justify-center gap-6 transition-all shadow-2xl shadow-indigo-600/40 relative overflow-hidden group/btn hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                            <Icons.sparkles className="w-8 h-8 text-indigo-300 group-hover/btn:rotate-12 transition-transform" />
                            <div className="flex flex-col items-start translate-x-4">
                                <span className="text-[12px] font-black uppercase tracking-[0.6em] mb-1">Generate Variation</span>
                                <span className="text-[9px] font-black text-indigo-300/40 uppercase tracking-[0.4em]">Neural Variation Output</span>
                            </div>
                        </button>
                    ) : (
                        <div className="w-full">
                            <NeuralStreamOverlay />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
