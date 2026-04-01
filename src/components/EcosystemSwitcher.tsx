import React from 'react';
import { Terminal } from 'lucide-react';

const EcosystemSwitcher: React.FC = () => {
  const isDev = import.meta.env.DEV;

  if (!isDev) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[60] group flex flex-col items-start gap-4">
      {/* Floating Trigger - Emulator Menu Deactivated */}
      <button className="bg-primary/20 backdrop-blur-xl border border-primary/30 p-3.5 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all text-primary">
         <Terminal className="w-6 h-6" />
      </button>
    </div>
  );
};

export default EcosystemSwitcher;
