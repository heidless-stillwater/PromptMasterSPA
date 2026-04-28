import React from 'react';
import { PromptMasterProvider, usePromptMaster } from './PromptMasterContext';
import { RegistryExplorer } from './RegistryExplorer';
import { BlueprintEditor } from './BlueprintEditor';
import { GenerationPanel } from './GenerationPanel';
import { VisionPreviewModal } from './VisionPreviewModal';
import { MetricsModal } from './MetricsModal';
import { Notification } from './Notification';
import { Icons } from '../Icons';

const PromptMasterLayout: React.FC = () => {
    const { 
        selectedPrompt, 
        error, setError
    } = usePromptMaster();

    return (
        <div className="w-full space-y-12 pb-24">
            {/* Global Error Handle */}
            {error && (
                <div className="fixed top-28 right-10 z-[1000] animate-fade-in-right px-8 py-5 bg-rose-600/90 backdrop-blur-3xl border border-white/20 rounded-[2rem] shadow-2xl flex items-center gap-6 max-w-md">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                        <Icons.alert className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mb-2 leading-none">Neural Desync Detected</p>
                        <p className="text-sm font-bold text-white leading-relaxed">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="p-3 text-white/30 hover:text-white transition-colors hover:bg-white/5 rounded-xl">
                        <Icons.close className="w-5 h-5" />
                    </button>
                </div>
            )}

            {!selectedPrompt ? (
                <RegistryExplorer />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start w-full max-w-full overflow-hidden">
                    {/* Main Workspace: Template, Variables, Variations */}
                    <div className="lg:col-span-8 space-y-12 min-w-0 w-full overflow-hidden">
                        <BlueprintEditor />
                    </div>

                    {/* Infrastructure Sidebar: Engine, Quality, Generation */}
                    <div className="lg:col-span-4 sticky top-32 w-full">
                        <GenerationPanel />
                    </div>
                </div>
            )}

            {/* Global Modals & Notifications */}
            <VisionPreviewModal />
            <MetricsModal />
            <Notification />
        </div>
    );
};

export const PromptMasterOrchestrator: React.FC<any> = (props) => {
    return (
      <PromptMasterProvider {...props}>
        <PromptMasterLayout />
      </PromptMasterProvider>
    );
};

export default PromptMasterOrchestrator;
