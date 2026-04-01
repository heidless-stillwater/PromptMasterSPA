import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Users, Activity, Zap, TrendingUp, Settings, ChevronRight, BarChart3, Lock, Database, AlertTriangle, RefreshCcw, UserCheck, Mail, Fingerprint, Globe } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const AdminConsole: React.FC = () => {
    const { profile, syncWithMaster, hasConflict, conflicts, loading, masterData } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [isSyncing, setIsSyncing] = useState(false);

    if (loading) return null;

    // Direct Access Guard - Master Authority Override
    // Allow access if EITHER local or master role is elevated
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

    return (
        <div className="flex flex-col gap-8 animate-fade-in mb-20">
            {/* Master Conflict Flag - HIGH PRIORITY */}
            {hasConflict && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertTriangle className="w-24 h-24 text-red-500" />
                    </div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="bg-red-500 p-4 rounded-2xl shadow-xl shadow-red-500/20 animate-pulse">
                            <RefreshCcw className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white tracking-tight uppercase">Master Data Conflict Detected</h3>
                            <p className="text-sm font-bold text-red-400 mt-1 uppercase tracking-widest leading-tight">
                                {conflicts.join(' | ')}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleMasterSync}
                        disabled={isSyncing}
                        className="bg-white text-black px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all shadow-2xl relative z-10 flex items-center gap-3 disabled:opacity-50"
                    >
                        {isSyncing ? 'Synchronizing...' : 'Resolve & Align with PromptTool'}
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/20 text-primary rounded-lg border border-primary/20">
                            <Shield className="w-5 h-5" />
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase font-outline-2">Admin <span className="text-primary tracking-normal">Console</span></h2>
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Protocol Version 2.0 // Stillwater Unified Admin</p>
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-xl shadow-primary/30' : 'text-gray-500 hover:text-white'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-primary text-white shadow-xl shadow-primary/30' : 'text-gray-500 hover:text-white'}`}>Master Identity</button>
                    <button onClick={() => setActiveTab('systems')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'systems' ? 'bg-primary text-white shadow-xl shadow-primary/30' : 'text-gray-500 hover:text-white'}`}>System Health</button>
                </div>
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-8 animate-fade-in-up">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Ecosystem Status', value: 'ALIGNED', change: 'Stable', icon: Globe, color: 'text-green-400' },
                            { label: 'Prompt Power', value: '98.2%', change: '+2.1%', icon: Zap, color: 'text-primary' },
                            { label: 'Identity Sync', value: hasConflict ? 'STALE' : 'SYNCED', change: 'Real-time', icon: UserCheck, color: hasConflict ? 'text-red-400' : 'text-blue-400' },
                            { label: 'Revenue Nodes', value: '14 Active', change: 'Production', icon: TrendingUp, color: 'text-amber-400' }
                        ].map((stat, idx) => (
                            <div key={idx} className="glass-panel p-6 border-white/5 hover:border-primary/20 transition-all group overflow-hidden relative">
                                <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                                    <stat.icon className="w-24 h-24" />
                                </div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 bg-black rounded-lg border border-white/10 ${stat.color}`}>
                                        <stat.icon className="w-4 h-4" />
                                    </div>
                                    <span className={`text-[9px] font-black uppercase ${stat.color}`}>{stat.change}</span>
                                </div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
                                <h3 className="text-2xl font-black text-white">{stat.value}</h3>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Traffic Performance */}
                        <div className="xl:col-span-2 glass-panel p-8 border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent"></div>
                            <div className="flex items-center justify-between mb-10 pb-4 border-b border-white/5">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                                    <BarChart3 className="w-5 h-5 text-primary" /> Multi-App Analytics
                                </h3>
                                <div className="flex gap-2">
                                     <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-lg shadow-primary"></span>
                                     <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Live Engine</span>
                                </div>
                            </div>
                            
                            <div className="aspect-[21/9] bg-white/[0.01] border border-dashed border-white/10 rounded-3xl flex items-center justify-center group cursor-pointer hover:bg-white/[0.02] transition-all">
                                <Activity className="w-16 h-16 text-primary/10 group-hover:text-primary/20 transition-all group-hover:scale-110 duration-700" />
                                <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">No Active Telemetry</p>
                                    <button className="text-[9px] font-black text-primary uppercase underline underline-offset-4 opacity-0 group-hover:opacity-100 transition-opacity">Launch Debugger</button>
                                </div>
                            </div>
                        </div>

                        {/* Resource Management */}
                        <div className="space-y-6">
                            <div className="glass-panel p-6 border-white/5 bg-primary/5">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Database Nodes</h3>
                                <div className="space-y-3">
                                    {[
                                        { name: 'prompttool-db-0', role: 'MASTER', status: 'Healthy' },
                                        { name: 'promptmaster-spa-db-0', role: 'LOCAL', status: 'Healthy' },
                                        { name: 'promptresources-db-0', role: 'LOCAL', status: 'Offline' },
                                    ].map((dbNode, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-black border border-white/5 rounded-xl">
                                            <div>
                                                <p className="text-[10px] font-black text-white uppercase tracking-tighter mb-0.5">{dbNode.name}</p>
                                                <p className={`text-[8px] font-bold uppercase tracking-widest ${dbNode.role === 'MASTER' ? 'text-primary' : 'text-gray-500'}`}>{dbNode.role}</p>
                                            </div>
                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${dbNode.status === 'Healthy' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{dbNode.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button className="w-full bg-white text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all shadow-2xl group">
                                <Lock className="w-3.5 h-3.5" /> Lock Ecosystem State
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="animate-fade-in-up">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Profile Configuration */}
                        <div className="glass-panel p-8 border-white/5 bg-brand-gradient/5">
                            <div className="flex items-center justify-between mb-10 pb-4 border-b border-white/5">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                                    <Users className="w-5 h-5 text-primary" /> Profile Alignment
                                </h3>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${hasConflict ? 'bg-red-500 text-white' : 'bg-green-500/10 text-green-500'}`}>
                                    {hasConflict ? 'CONFLICT' : 'VALIDATED'}
                                </span>
                            </div>

                            <div className="space-y-8">
                                <div className="flex flex-col items-center gap-4">
                                     <div className="relative group">
                                          <div className="absolute -inset-1 bg-brand-gradient rounded-3xl blur opacity-30"></div>
                                          <img src={profile?.photoURL || ''} className="relative w-24 h-24 rounded-3xl object-cover ring-2 ring-white/10" alt="Avatar" />
                                          <button className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 bg-black border border-white/10 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl hover:bg-primary transition-colors">Change</button>
                                     </div>
                                     <div className="text-center">
                                         <h4 className="text-xl font-black text-white capitalize">{profile?.displayName}</h4>
                                         <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">{profile?.email}</p>
                                     </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Ecosystem Unique ID</label>
                                        <div className="bg-black/60 border border-white/5 p-4 rounded-2xl flex items-center gap-3 group">
                                            <Fingerprint className="w-4 h-4 text-gray-600" />
                                            <code className="text-xs font-mono text-gray-400 group-hover:text-primary transition-colors">{profile?.uid}</code>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Assigned Role</label>
                                            <div className="bg-black/60 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                                                <Shield className="w-4 h-4 text-primary" />
                                                <span className="text-xs font-black text-white uppercase">{profile?.role}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Subscription</label>
                                            <div className="bg-black/60 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                                                <Zap className="w-4 h-4 text-amber-500" />
                                                <span className="text-xs font-black text-white uppercase">{profile?.subscription || 'free'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    className="w-full flex items-center justify-center gap-3 bg-white text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-primary hover:text-white transition-all shadow-2xl"
                                    onClick={() => alert("Identity update locked. Use Master Sync to align.")}
                                >
                                    Update Local Metadata
                                </button>
                            </div>
                        </div>

                        {/* Master Record Comparison */}
                        <div className="space-y-6">
                            <div className="glass-panel p-8 border-white/5">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-8 pb-4 border-b border-white/5 flex items-center gap-3">
                                    <Database className="w-5 h-5 text-primary" /> Master Record Status
                                </h3>
                                
                                <div className="space-y-6">
                                    {[
                                        { label: 'Role Authority', key: 'role', status: hasConflict && conflicts.some(c => c.includes('Role')) ? 'CRITICAL' : 'OK' },
                                        { label: 'Identity Mapping', key: 'displayName', status: hasConflict && conflicts.some(c => c.includes('DisplayName')) ? 'MISMATCH' : 'OK' },
                                        { label: 'Credit Ledger', key: 'credits', status: 'SYNCED' },
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-2 h-2 rounded-full ${item.status === 'OK' || item.status === 'SYNCED' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}></div>
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{item.label}</span>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase ${item.status === 'OK' || item.status === 'SYNCED' ? 'text-gray-500' : 'text-red-500'}`}>{item.status}</span>
                                        </div>
                                    ))}

                                    <div className="pt-6">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                                            Stillwater Studio Protocol dictates that the <span className="text-white">PromptTool</span> record is the final authority. If a local override occurs in SPA, it must be flagged for manual resolution or automated rollback.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full flex items-center justify-center gap-3 border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                                <Mail className="w-3.5 h-3.5" /> Email Audit Trail
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'systems' && (
                <div className="glass-panel p-12 border-dashed border-white/10 flex flex-col items-center justify-center text-center gap-6 opacity-60 grayscale animate-fade-in">
                    <Database className="w-16 h-16 text-primary animate-bounce-slow" />
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Advanced Systems Offline</h3>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Connect to live production nodes to view ecosystem telemetry</p>
                    </div>
                    <button className="bg-white/5 border border-white/10 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-white transition-all">Retry Handshake</button>
                </div>
            )}
        </div>
    );
};

export default AdminConsole;
