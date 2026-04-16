import { Icons } from './Icons';

const EcosystemSwitcher: React.FC = () => {
  const isDev = import.meta.env.DEV;

  if (!isDev) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[60] group">
      <button className="bg-indigo-500/10 backdrop-blur-xl border border-indigo-500/20 p-4 rounded-2xl shadow-2xl hover:scale-110 hover:bg-indigo-500 hover:text-white transition-all text-indigo-400 group active:scale-95">
         <Icons.stack className="w-5 h-5" />
      </button>
    </div>
  );
};

export default EcosystemSwitcher;
