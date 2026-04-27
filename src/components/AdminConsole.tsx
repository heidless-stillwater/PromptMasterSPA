import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Icons } from './Icons';
import { SovereignSentinel } from './SovereignSentinel';

const AdminConsole: React.FC = () => {
    const { profile, syncWithMaster, hasConflict, conflicts, loading, masterData, updateProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [isSyncing, setIsSyncing] = useState(false);
    const [isEditingAvatar, setIsEditingAvatar] = useState(false);
    const [newAvatarUrl, setNewAvatarUrl] = useState(profile?.photoURL || '');

    if (loading) return null;

    // Direct Access Guard - Master Authority Override
    const canAccess = (profile?.role === 'admin' || profile?.role === 'su') || 
                      (masterData?.role === 'admin' || masterData?.role === 'su');

    if (!canAccess) {
        return <Navigate to="/" replace />;
    }

    const handleMasterSync = async () => {
        setIsSyncing(true);
        try {
            await syncWithMaster();
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAvatarUpdate = async () => {
        if (!newAvatarUrl) return;
        setIsSyncing(true);
        try {
            await updateProfile({ photoURL: newAvatarUrl });
            setIsEditingAvatar(false);
            // Force a sync to align local state immediately
            await syncWithMaster();
        } catch (err) {
            console.error("Failed to update avatar", err);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-fade-in-up mb-20">
            {/* Master Conflict Flag - HIGH PRIORITY */}
            {hasConflict && (
                <div className="glass-card border-rose-500/50 p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Icons.alert className="w-24 h-24 text-rose-500" />
                    </div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="bg-rose-500 p-4 rounded-2xl shadow-xl shadow-rose-500/20 animate-pulse">
                            <Icons.refresh className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white tracking-tight uppercase">Master Data Conflict Detected</h3>
                            <p className="text-sm font-bold text-rose-400 mt-1 uppercase tracking-widest leading-tight">
                                {conflicts.join(' | ')}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleMasterSync}
                        disabled={isSyncing}
                        className="bg-white text-black px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-500 hover:text-white transition-all shadow-2xl relative z-10 flex items-center gap-3 disabled:opacity-50"
                    >
                        {isSyncing ? 'Synchronizing...' : 'Resolve & Align with PromptTool'}
                    </button>
                </div>
            )}

            {/* Cinematic Header / Action Bar */}
            <div className="flex flex-col md:flex-row justify-end items-center gap-6">

                <div className="flex items-center gap-2 p-1.5 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                    <button onClick={() => setActiveTab('overview')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-xl shadow-primary/20 border border-primary/40' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>Overview</button>
                    <button onClick={() => setActiveTab('profile')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-primary text-white shadow-xl shadow-primary/20 border border-primary/40' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>Master Identity</button>
                    <button onClick={() => setActiveTab('systems')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'systems' ? 'bg-primary text-white shadow-xl shadow-primary/20 border border-primary/40' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>Systems</button>
                </div>
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-8 animate-fade-in-up">
                    {/* Stats HUD Pattern */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Ecosystem Status', value: 'ALIGNED', change: 'Stable', icon: Icons.globe, color: 'text-emerald-400' },
                            { label: 'Prompt Power', value: '98.2%', change: '+2.1%', icon: Icons.zap, color: 'text-primary' },
                            { label: 'Identity Sync', value: hasConflict ? 'STALE' : 'SYNCED', change: 'Real-time', icon: Icons.users, color: hasConflict ? 'text-rose-400' : 'text-primary' },
                            { label: 'Revenue Nodes', value: '14 Active', change: 'Production', icon: Icons.trendingUp, color: 'text-amber-400' }
                        ].map((stat, idx) => (
                            <div key={idx} className="glass-card p-6 group overflow-hidden relative border-white/5 hover:border-primary/30 transition-all">
                                <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                                    <stat.icon size={96} />
                                </div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className={`p-2 bg-white/5 rounded-lg border border-white/10 ${stat.color}`}>
                                        <stat.icon size={16} />
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${stat.color}`}>{stat.change}</span>
                                </div>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1 relative z-10">{stat.label}</p>
                                <h3 className="text-2xl font-black text-white relative z-10">{stat.value}</h3>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Sovereign Sentinel HUD */}
                        <div className="xl:col-span-1 space-y-6">
                            <SovereignSentinel variant="hud" />
                            
                            {/* Quick Identity Card */}
                            <div className="glass-card p-6 bg-amber-500/[0.03] border-amber-500/20">
                                <h3 className="text-[10px] font-black text-amber-500/50 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Icons.users size={14} /> Identity Quick-Edit
                                </h3>
                                <div className="flex items-center gap-4 mb-4">
                                    <img src={profile?.photoURL || ''} className="w-12 h-12 rounded-xl object-cover border border-white/10" alt="" />
                                    <div>
                                        <p className="text-xs font-black text-white">{profile?.displayName}</p>
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{profile?.role}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setActiveTab('profile')}
                                    className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    Modify Master Identity
                                </button>
                            </div>
                        </div>

                        {/* Resource Management */}
                        <div className="xl:col-span-2 space-y-6">
                            <div className="glass-card p-6 bg-primary/[0.03]">
                                <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                    <Icons.database size={14} className="text-primary" /> Database Nodes
                                </h3>
                                <div className="space-y-3">
                                    {[
                                        { name: 'prompttool-db-0', role: 'MASTER', status: 'Healthy' },
                                        { name: 'promptmaster-spa-db-0', role: 'LOCAL', status: 'Healthy' },
                                        { name: 'promptresources-db-0', role: 'LOCAL', status: 'Offline' },
                                    ].map((dbNode, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                                            <div>
                                                <p className="text-[10px] font-black text-white uppercase tracking-tighter mb-1">{dbNode.name}</p>
                                                <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${dbNode.role === 'MASTER' ? 'text-primary' : 'text-white/20'}`}>{dbNode.role}</p>
                                            </div>
                                            <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${dbNode.status === 'Healthy' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>{dbNode.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button 
                                onClick={handleMasterSync}
                                disabled={isSyncing}
                                className="w-full bg-primary text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95 group disabled:opacity-50"
                            >
                                <Icons.refresh className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> 
                                {isSyncing ? 'Synchronizing Ecosystem...' : 'Lock & Align Ecosystem State'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="animate-fade-in-up">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Profile Configuration */}
                        <div className="glass-card p-8 bg-primary/[0.02]">
                            <div className="flex items-center justify-between mb-10 pb-4 border-b border-white/5">
                                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                                    <Icons.users className="w-5 h-5 text-primary" /> Identity Alignment
                                </h3>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${hasConflict ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'}`}>
                                    {hasConflict ? 'CONFLICT' : 'VALIDATED'}
                                </span>
                            </div>

                            <div className="space-y-8">
                                <div className="flex flex-col items-center gap-4">
                                     <div className="relative group">
                                          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-3xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
                                          <img src={profile?.photoURL || ''} className="relative w-28 h-28 rounded-3xl object-cover border border-white/10" alt="Avatar" />
                                          {!isEditingAvatar && (
                                              <button 
                                                  onClick={() => {
                                                      setIsEditingAvatar(true);
                                                      setNewAvatarUrl(profile?.photoURL || '');
                                                  }}
                                                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
                                              >
                                                  Change
                                              </button>
                                          )}
                                     </div>
                                     
                                     {isEditingAvatar ? (
                                         <div className="w-full max-w-sm space-y-3 mt-4">
                                             <input 
                                                 type="text" 
                                                 value={newAvatarUrl}
                                                 onChange={(e) => setNewAvatarUrl(e.target.value)}
                                                 placeholder="Paste Avatar URL here..."
                                                 className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition-all"
                                             />
                                             <div className="flex gap-2">
                                                 <button 
                                                     onClick={handleAvatarUpdate}
                                                     className="flex-1 bg-primary text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/80 transition-all"
                                                 >
                                                     Save URL
                                                 </button>
                                                 <button 
                                                     onClick={() => setIsEditingAvatar(false)}
                                                     className="px-4 bg-white/5 border border-white/10 text-white/40 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                                 >
                                                     Cancel
                                                 </button>
                                             </div>
                                         </div>
                                     ) : (
                                         <div className="text-center mt-4">
                                             <h4 className="text-2xl font-black text-white capitalize leading-none mb-2">{profile?.displayName}</h4>
                                             <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">{profile?.email}</p>
                                         </div>
                                     )}
                                </div>

                                <div className="grid grid-cols-1 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-1">Ecosystem Node ID</label>
                                        <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-center gap-4 group">
                                            <Icons.zap size={16} className="text-white/20 group-hover:text-primary transition-colors" />
                                            <code className="text-xs font-mono text-white/40 group-hover:text-white transition-colors">{profile?.uid}</code>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-1">Assigned Role</label>
                                            <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-center gap-4 group">
                                                <Icons.shield size={16} className="text-primary" />
                                                <span className="text-xs font-black text-white uppercase group-hover:text-primary transition-colors">{profile?.role}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-1">Subscription</label>
                                            <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-center gap-4 group">
                                                <Icons.billing size={16} className="text-amber-500" />
                                                <span className="text-xs font-black text-white uppercase group-hover:text-amber-500 transition-colors">
                                                    {typeof profile?.subscription === 'string' 
                                                        ? profile.subscription 
                                                        : (profile?.subscription as any)?.bundleId || 'PRO'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    className="w-full flex items-center justify-center gap-3 bg-white text-black py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-primary hover:text-white transition-all shadow-xl"
                                    onClick={() => handleMasterSync()}
                                >
                                    <Icons.refresh size={14} /> Force Identity Re-Sync
                                </button>
                            </div>
                        </div>

                        {/* Authority Matrix */}
                        <div className="space-y-8">
                            <div className="glass-card p-8 bg-amber-500/[0.02] border-amber-500/20 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                    <Icons.trophy size={120} />
                                </div>
                                
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                                            <Icons.trophy size={24} className="text-amber-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">Active Authority</p>
                                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                                                {profile?.suiteSubscription?.bundleId?.toUpperCase() || (profile?.subscription === 'pro' ? 'PRO ARCHITECT' : 'COMMUNITY NODE')}
                                            </h2>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            { title: 'Global Registry', desc: 'Manage master assets across all nodes.', active: true },
                                            { title: 'Blueprint Forge', desc: 'Full architectural metadata overrides.', active: true },
                                            { title: 'Studio Access', desc: 'Integrated workbench generative suite.', active: profile?.subscription === 'pro' || !!profile?.suiteSubscription },
                                            { title: 'Authority Hub', desc: 'Control user permissions and tiers.', active: profile?.role === 'su' }
                                        ].map((f, i) => (
                                            <div 
                                                key={i} 
                                                className={`p-4 rounded-2xl border transition-all ${f.active ? 'bg-white/5 border-white/10' : 'bg-transparent border-white/5 opacity-40'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-full ${f.active ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-white/20'}`}>
                                                        <Icons.check size={10} />
                                                    </div>
                                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] leading-none">{f.title}</p>
                                                </div>
                                                <p className="text-[9px] text-white/40 font-bold mt-2.5 leading-relaxed uppercase tracking-wider">
                                                    {f.desc}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="glass-card p-8 bg-primary/[0.02]">
                                <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-8 pb-4 border-b border-white/5 flex items-center gap-3">
                                    <Icons.database size={14} className="text-primary" /> Integrity Audit
                                </h3>
                                
                                <div className="space-y-4">
                                    {[
                                        { label: 'Role Authority', key: 'role', status: hasConflict && conflicts.some(c => c.includes('Role')) ? 'CRITICAL' : 'OK' },
                                        { label: 'Identity Mapping', key: 'displayName', status: hasConflict && conflicts.some(c => c.includes('DisplayName')) ? 'MISMATCH' : 'OK' },
                                        { label: 'Credit Ledger', key: 'credits', status: 'SYNCED' },
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl group hover:border-white/10 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'OK' || item.status === 'SYNCED' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                                                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] group-hover:text-white transition-colors">{item.label}</span>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${item.status === 'OK' || item.status === 'SYNCED' ? 'text-white/20' : 'text-rose-500'}`}>{item.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'systems' && (
                <div className="glass-card p-20 flex flex-col items-center justify-center text-center gap-8 border-white/5 bg-white/[0.01]">
                    <div className="p-8 bg-primary/5 rounded-full border border-primary/10">
                        <Icons.zap size={64} className="text-primary" />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Command Post Active</h3>
                        <p className="text-xs font-black text-white/20 uppercase tracking-[0.3em] max-w-sm mx-auto leading-relaxed">Global telemetry is synchronized. All system nodes are reporting healthy alignment with the Stillwater Master Registry.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                        <div className="p-4 bg-black/40 border border-white/5 rounded-2xl">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Uptime</p>
                            <p className="text-sm font-black text-emerald-500">99.98%</p>
                        </div>
                        <div className="p-4 bg-black/40 border border-white/5 rounded-2xl">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Latency</p>
                            <p className="text-sm font-black text-primary">14ms</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminConsole;
