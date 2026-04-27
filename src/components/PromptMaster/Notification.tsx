import React from 'react';
import { Icons } from '../Icons';
import { usePromptMaster } from './PromptMasterContext';

export const Notification: React.FC = () => {
  const { notification, setNotification, handleViewInGallery } = usePromptMaster();
  if (!notification) return null;

  return (
    <div className="fixed bottom-12 right-12 z-[200] max-w-sm animate-in slide-in-from-right-12 duration-700">
      <div className="relative glass-card p-6 bg-[#12121a]/95 border border-indigo-500/30 shadow-[0_40px_100px_rgba(0,0,0,0.5)] rounded-3xl flex flex-col gap-4 backdrop-blur-3xl overflow-hidden">
        <div className="absolute -inset-10 bg-indigo-600/10 blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Icons.check className="w-6 h-6 text-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[11px] font-black text-white uppercase tracking-[0.2em] leading-none">Architecture Registered</h4>
            <p className="text-[10px] text-white/30 mt-2 uppercase font-bold truncate max-w-[200px] tracking-widest">{notification.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 relative z-10">
          <button
            onClick={() => { handleViewInGallery({ promptSetID: notification.id }); setNotification(null); }}
            className="flex-1 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-indigo-500 hover:scale-[1.02] transition-all shadow-xl"
          >
            View Gallery
          </button>
          <button
            onClick={() => setNotification(null)}
            className="px-5 py-3 bg-white/5 text-white/20 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all hover:bg-white/10"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
