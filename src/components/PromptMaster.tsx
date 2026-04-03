import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, setDoc, query, where, orderBy, deleteDoc } from 'firebase/firestore';
import { db, resourcesDb, toolDb } from '../lib/firebase';
import { 
  X, 
  Send, 
  Sparkles, 
  RefreshCw, 
  Zap,
  Sliders,
  Edit3,
  Save,
  Plus,
  Database,
  LayoutGrid,
  History,
  Search,
  List,
  Maximize2,
  ZoomIn,
  UploadCloud,
  Layers,
  GalleryVertical,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Grid,
  Check,
  Trash2,
  Copy
} from 'lucide-react';
import { triggerGeneration, type GenerationProgress } from '../lib/services/prompt-tool';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';

interface Prompt {
  id: string;
  title: string;
  template?: string;
  prompts?: string[];
  thumbnailUrl?: string;
  description?: string;
  isPersonal?: boolean;
  isExemplar?: boolean;
  createdAt?: number;
  updatedAt?: number;
  promptSetID?: string;
}

const parseDate = (val: any): number => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    return new Date(val).getTime() || 0;
};


interface StatusStep {
  id: string;
  label: string;
  status: 'waiting' | 'active' | 'done' | 'error';
}

const INITIAL_STEPS: StatusStep[] = [
    { id: 'auth', label: 'Auth', status: 'waiting' },
    { id: 'queue', label: 'Queue', status: 'waiting' },
    { id: 'generate', label: 'Generate', status: 'waiting' },
    { id: 'upload', label: 'Upload', status: 'waiting' },
    { id: 'complete', label: 'Complete', status: 'waiting' }
];

interface CompletionSummary {
  creditsUsed?: number;
  remainingBalance?: number;
  imageUrl?: string;
  title?: string;
  quality?: string;
  elapsed?: number;
}

const FALLBACK_PROMPTS: Prompt[] = [
  {
    id: 'sample-1',
    title: 'Cyberpunk Character Portrait',
    description: 'Neon-lit gritty cyberpunk character generation.',
    prompts: ['A {{character}} in a gritty {{setting}}, cinematic lighting, cyberpunk aesthetic, masterpiece, 8k'],
    thumbnailUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=cyber1'
  },
  {
    id: 'sample-2',
    title: 'Architectural Visualization',
    description: 'Photorealistic interior design and materials.',
    prompts: ['Modern {{room:living room}} with {{material:concrete}} accents, natural sunlight streaming through windows, architectural photography'],
    thumbnailUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=arch1'
  }
];

const FALLBACK_EXEMPLARS: Prompt[] = [
  {
    id: 'exemplar-1',
    title: 'Surrealist Void Architecture',
    template: 'A floating {{structure}} in an endless {{void}}, surrealist style, hyper-detailed, 8k',
    thumbnailUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=sur1',
    description: 'System Exemplar',
    isExemplar: true
  },
  {
    id: 'exemplar-2',
    title: 'Hyper-Realistic Foliage',
    template: 'Macro shot of {{plant}} with {{weather}} droplets, hyper-realistic, studio lighting',
    thumbnailUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=fol1',
    description: 'System Exemplar',
    isExemplar: true
  }
];

const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const StepIcon = ({ stepStatus }: { stepStatus: StatusStep['status'] }) => {
  if (stepStatus === 'done')    return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (stepStatus === 'active')  return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
  if (stepStatus === 'error')   return <AlertCircle className="w-4 h-4 text-red-400" />;
  return <div className="w-4 h-4 rounded-full border border-white/20" />;
};

interface PromptMasterProps {
  activeTab: 'blueprints' | 'exemplars';
  setActiveTab: (tab: 'blueprints' | 'exemplars') => void;
  confirmModal: any;
  setConfirmModal: (modal: any) => void;
}

const PromptMaster: React.FC<PromptMasterProps> = ({ 
    activeTab, 
    setActiveTab,
    confirmModal,
    setConfirmModal
}) => {
  const { user, profile } = useAuth();
  const { promptId } = useParams();
  
  // Library State
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [exemplars, setExemplars] = useState<Prompt[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'az' | 'za' | 'newest' | 'oldest' | 'updated'>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'extended'>('grid');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [rawTemplate, setRawTemplate] = useState('');
  const [variables, setVariables] = useState<Record<string, { value: string, default: string }>>({});
  const [resultantPrompt, setResultantPrompt] = useState('');
  const [isEditingBlueprint, setIsEditingBlueprint] = useState(false);
  
  // Engine State
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [generatedImages, setGeneratedImages] = useState<Array<{ url: string, title?: string, prompt?: string, variables?: Record<string, { value: string, default: string }> }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusStep[]>(INITIAL_STEPS);
  const [progressMsg, setProgressMsg] = useState('');
  const [engine, setEngine] = useState('nanobanana-2.0');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'architect' | 'media'>('architect');
  const [isNewImageSet, setIsNewImageSet] = useState<boolean>(false);
  const [originalThumbnail, setOriginalThumbnail] = useState<string | null>(null);
  const [variationsViewMode, setVariationsViewMode] = useState<'grid' | 'list'>('grid');
  const [isVariationsCollapsed, setIsVariationsCollapsed] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Progress tracking
  const [elapsed, setElapsed] = useState(0);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(1);
  const [completion, setCompletion] = useState<CompletionSummary | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrompts = async () => {
    setLoadingLibrary(true);
    try {
      // 1. Fetch Blueprints
      const masterSnap = await getDocs(collection(resourcesDb, 'resources'));
      const masterRes = masterSnap.docs.map(doc => {
          const d = doc.data();
          return { 
              id: doc.id, 
              ...d,
              createdAt: parseDate(d.createdAt),
              updatedAt: parseDate(d.updatedAt || d.createdAt)
          } as Prompt;
      });
      
      let personal: Prompt[] = [];
      if (user) {
          const personalSnap = await getDocs(collection(db, 'blueprints'));
          personal = personalSnap.docs
              .filter(d => d.data().uid === user.uid)
              .map(d => {
                  const data = d.data();
                  return { 
                      id: d.id, 
                      ...data, 
                      isPersonal: true,
                      createdAt: parseDate(data.createdAt),
                      updatedAt: parseDate(data.updatedAt || data.createdAt)
                  } as Prompt;
              });
      }
      setPrompts(masterRes.length > 0 ? [...personal, ...masterRes] : [...personal, ...FALLBACK_PROMPTS]);

      // 2. Fetch Exemplars (PromptTool leagueEntries)
      try {
        const toolSnap = await getDocs(collection(toolDb, 'leagueEntries'));
        const toolRes = toolSnap.docs.map(doc => {
            const data = doc.data();
            const legacyTitle = data.prompt?.slice(0, 50).trim() + (data.prompt?.length > 50 ? '...' : '');
            return {
                id: doc.id,
                title: data.title || legacyTitle || 'Untitled Exemplar',
                template: data.prompt,
                prompts: [data.prompt],
                thumbnailUrl: data.imageUrl,
                description: `By ${data.authorName || 'Ecosystem Architect'}`,
                isExemplar: true,
                promptSetID: data.promptSetID || data.entryId || doc.id,
                createdAt: parseDate(data.createdAt || data.timestamp),
                updatedAt: parseDate(data.updatedAt || data.createdAt || data.timestamp)
            } as Prompt;
        });
        setExemplars(toolRes.length > 0 ? toolRes : FALLBACK_EXEMPLARS);
      } catch (toolErr) {
        console.error("Exemplar Node Hydration Failed:", toolErr);
        setExemplars(FALLBACK_EXEMPLARS);
      }

    } catch (err) {
      setPrompts(FALLBACK_PROMPTS);
    } finally {
      setLoadingLibrary(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, [user]);

  useEffect(() => {
    if (promptId && prompts.length > 0) {
      const p = prompts.find(x => x.id === promptId);
      if (p) handleSelect(p);
    }
  }, [promptId, prompts]);

  const extractVariables = (template: string) => {
    const regex = /{{(.*?)}}/g;
    const matches = [...template.matchAll(regex)];
    
    const foundTags = matches.map(m => {
        const parts = m[1].split(':');
        const key = parts[0];
        const def = parts.length > 1 ? parts[1] : '<undefined>';
        return { key, default: def };
    });

    const foundKeys = foundTags.map(t => t.key);

    setVariables(prev => {
      // Start from live prev state (avoids stale closure)
      const newVars: Record<string, { value: string, default: string }> = {};
      // Carry over existing values for keys still present in template
      foundKeys.forEach(k => {
        if (k in prev) newVars[k] = prev[k];
      });
      // Add or update from template tags
      foundTags.forEach(tag => {
        if (!(tag.key in newVars)) {
          newVars[tag.key] = { value: tag.default, default: tag.default };
        } else {
          newVars[tag.key].default = tag.default;
          if (tag.default === '<undefined>' && (!newVars[tag.key].value || newVars[tag.key].value === '')) {
            newVars[tag.key].value = '<undefined>';
          }
        }
      });
      return newVars;
    });
  };

  useEffect(() => {
    if (!rawTemplate) return;
    extractVariables(rawTemplate);
  }, [rawTemplate]);

  useEffect(() => {
    if (!selectedPrompt) return;
    let result = rawTemplate || '';
    Object.entries(variables).forEach(([key, data]) => {
      const isActuallyDefault = !data.value || data.value === data.default || data.default === '<undefined>';
      const displayValue = data.value || data.default || `[${key}]`;
      
      const wrapped = isActuallyDefault ? `__DEF__${displayValue}__DEF__` : `__VAL__${displayValue}__VAL__`;
      result = result.replace(new RegExp(`{{${key}(?::.*?)?}}`, 'g'), wrapped);
    });
    setResultantPrompt(result);
  }, [variables, selectedPrompt, rawTemplate]);

  const getCleanPrompt = () => {
    let result = rawTemplate || '';
    Object.entries(variables).forEach(([key, data]) => {
      const currentValue = data.value || data.default || '';
      if (currentValue && currentValue !== '<undefined>') {
          result = result.replace(new RegExp(`{{${key}(?::.*?)?}}`, 'g'), `{{${key}:${currentValue}}}`);
      } else {
          result = result.replace(new RegExp(`{{${key}(?::.*?)?}}`, 'g'), `{{${key}}}`);
      }
    });
    return result;
  };

  const handleSelect = async (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setOriginalThumbnail(prompt.thumbnailUrl || null);
    setGeneratedImages([]); // Clear variations on new blueprint selection
    setVariables({}); // Purge old variable inputs to hydrate from new blueprint
    const template = prompt.prompts?.[0] || prompt.template || '';
    setRawTemplate(template);
    extractVariables(template); // Force immediate extraction for UI hydration
    setIsEditingBlueprint(false);
    setActiveDetailTab('architect');

    // Cross-Ecosystem Variation Hydration
    const lineageID = prompt.promptSetID || prompt.id;
    if (lineageID) {
        try {
            const q = query(
                collection(toolDb, 'generations'),
                where('promptSetID', '==', lineageID),
                orderBy('createdAt', 'desc')
            );
            const snaps = await getDocs(q);
            if (!snaps.empty) {
                const fetchedVariations = snaps.docs.map(doc => {
                    const data = doc.data();
                    return {
                        url: data.imageUrl,
                        title: data.title || prompt.title, // fallback to blueprint title
                        prompt: data.prompt
                    };
                }).filter(v => v.url); // filter out failures securely

                // Set hydration array
                setGeneratedImages(fetchedVariations);
            }
        } catch (err) {
            console.error("Hydrating PromptTool variations failed:", err);
        }
    }
  };

  const commitSelection = (url: string | null, title: string | undefined, newPrompt: string, vars?: Record<string, { value: string, default: string }>) => {
      setVariables(vars || {}); // Force inputs to reflect loaded defaults
      setRawTemplate(newPrompt);
      if (url && selectedPrompt) {
          setSelectedPrompt(prev => prev ? { ...prev, thumbnailUrl: url, title: title || prev.title } : null);
      }
      setActiveDetailTab('architect');
  };

  const handleAssetSelection = (url: string | null, title: string | undefined, newPrompt: string | undefined, vars?: Record<string, { value: string, default: string }>) => {
    if (!newPrompt) {
        setPreviewImageUrl(url);
        setPreviewTitle(title || '<no title>');
        return;
    }

    const currentBlueprintOriginal = selectedPrompt?.prompts?.[0] || selectedPrompt?.template || '';
    const updatedRaw = getCleanPrompt();
    const hasChanges = updatedRaw !== currentBlueprintOriginal && rawTemplate !== currentBlueprintOriginal;

    if (hasChanges) {
        setConfirmModal({
            isOpen: true,
            title: 'Unsaved Architecture Changes',
            message: 'Your current prompt overrides have not been registered to the ecosystem. Resolving conflict...',
            isDanger: true,
            onConfirm: () => {}, // unused due to custom buttons
            customButtons: [
                {
                    label: 'Save & Continue',
                    onClick: () => {
                        saveBlueprint(false);
                        commitSelection(url, title, newPrompt, vars);
                        setConfirmModal(null);
                    },
                    className: "col-span-1 py-3 px-6 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg bg-primary/80 hover:bg-primary shadow-primary/20"
                },
                {
                    label: 'Save & Exit',
                    onClick: () => {
                        saveBlueprint(false);
                        setSelectedPrompt(null);
                        setConfirmModal(null);
                    },
                    className: "col-span-1 py-3 px-6 rounded-xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all"
                },
                {
                    label: 'Discard & Load Variation',
                    onClick: () => {
                        commitSelection(url, title, newPrompt, vars);
                        setConfirmModal(null);
                    },
                    className: "col-span-2 mt-2 py-3 px-6 rounded-xl border border-red-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 hover:bg-red-500/10 transition-all"
                }
            ]
        });
    } else {
        commitSelection(url, title, newPrompt, vars);
    }
  };

  const clearInput = (key: string) => {
    setVariables(prev => ({ ...prev, [key]: { ...prev[key], value: '' } }));
  };

  const useDefault = (key: string) => {
    setVariables(prev => ({ ...prev, [key]: { ...prev[key], value: prev[key].default } }));
  };

  const revertBlueprint = () => {
    if (!selectedPrompt) return;
    const originalTemplate = selectedPrompt.prompts?.[0] || selectedPrompt.template || '';
    
    setConfirmModal({
        isOpen: true,
        title: 'Revert Architecture',
        message: 'Discard all unsaved structural changes and snap back to the last saved blueprint?',
        isDanger: true,
        onConfirm: () => {
            setRawTemplate(originalTemplate);
            setConfirmModal(null);
        }
    });
  };

  const confirmRevert = () => revertBlueprint();

  const setAsDefault = (key: string) => {
    const val = variables[key].value;
    if (!val) return;
    
    setConfirmModal({
        isOpen: true,
        title: 'Set Architectural Default',
        message: `Configure "{{${key}:${val}}}" as the permanent default for this blueprint?`,
        onConfirm: () => {
            const newTemplate = rawTemplate.replace(
                new RegExp(`{{${key}(?::.*?)?}}`, 'g'), 
                `{{${key}:${val}}}`
            );
            setRawTemplate(newTemplate);
            setConfirmModal(null);
        }
    });
  };

  const resetProgress = () => {
    setStatus(INITIAL_STEPS.map(s => ({ ...s, status: 'waiting' })));
    setProgressMsg('');
    setProgressCurrent(0);
    setProgressTotal(1);
    setElapsed(0);
    setCompletion(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const setStep = (id: string, status: StatusStep['status']) => {
    setStatus(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const suggestTitle = (text: string) => {
    const regex = /(__DEF__.*?__DEF__|__VAL__.*?__VAL__)/g;
    const parts = text.split(regex);
    let fragments: string[] = [];
    parts.forEach(part => {
        if (part.startsWith('__DEF__') || part.startsWith('__VAL__')) {
            const content = part.replace(/__DEF__|__VAL__/g, '');
            const key = Object.keys(variables).find(k => 
                variables[k].default === content || variables[k].value === content
            ) || '';
            fragments.push(key.replace(/[\[\]]/g, ''));
        } else {
            fragments.push(part);
        }
    });
    let clean = fragments.join(' ').toLowerCase();
    const noise = ['8k', 'cinematic', 'lighting', 'masterpiece', 'atmospheric', 'photorealistic', 'realistic', 'hi-res', 'high resolution', 'hyper-detailed', 'intricate', 'studio', 'render', 'unreal engine', 'trending', 'artstation', 'vibrant', 'aesthetic', 'gritty'];
    noise.forEach(n => {
        const regex = new RegExp(`[,\\s]*${n}[,\\s]*`, 'gi');
        clean = clean.replace(regex, ' ');
    });
    clean = clean.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();
    const words = clean.split(/\s+/).filter(w => w.length > 2 && !w.includes('{'));
    const title = words.slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return title || (selectedPrompt?.title ? `${selectedPrompt.title} (Custom)` : 'New Architecture');
  };

  const saveBlueprint = async (asNew: boolean = true) => {
    if (!user || !selectedPrompt) return;
    if (!selectedPrompt.title?.trim()) {
        const suggestion = suggestTitle(resultantPrompt);
        setConfirmModal({
            isOpen: true,
            title: 'Title Recommendation',
            message: `Your blueprint needs a name. Recommended: "${suggestion}". Would you like to use this?`,
            onConfirm: () => {
                const updated = { ...selectedPrompt, title: suggestion };
                setSelectedPrompt(updated);
                setConfirmModal(null);
                setTimeout(() => doSave(asNew, updated), 10);
            }
        });
        return;
    }
    doSave(asNew, selectedPrompt);
  };

  const doSave = async (asNew: boolean, promptToSave: Prompt) => {
    if (!user || !promptToSave) return;
    
    // Explicitly commit current variable values as new defaults in the raw template UI
    const updatedRawTemplate = getCleanPrompt();
    setRawTemplate(updatedRawTemplate);
    
    setSaving(true);
    setSaveStatus('saving');
    try {
        const blueprintData = {
            title: asNew && !promptToSave.title.includes('(Custom)') 
                ? `${promptToSave.title} (Custom)` 
                : promptToSave.title,
            description: promptToSave.description || '',
            prompts: [updatedRawTemplate],
            thumbnailUrl: promptToSave.thumbnailUrl || '',
            uid: user.uid,
            updatedAt: serverTimestamp(),
        };

        if (asNew || !selectedPrompt?.id) {
            const docRef = await addDoc(collection(db, 'blueprints'), {
                ...blueprintData,
                createdAt: serverTimestamp(),
            });
            setSelectedPrompt({ 
                id: docRef.id, 
                ...blueprintData, 
                isPersonal: true,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        } else if (selectedPrompt?.isPersonal) {
            await setDoc(doc(db, 'blueprints', selectedPrompt.id), blueprintData, { merge: true });
            setSelectedPrompt(prev => prev ? { ...prev, ...blueprintData, updatedAt: Date.now() } : null);
        } else if (profile?.role === 'admin' || profile?.role === 'su') {
            await setDoc(doc(resourcesDb, 'resources', selectedPrompt.id), {
                ...blueprintData,
                updatedAt: serverTimestamp()
            }, { merge: true });
            setSelectedPrompt(prev => prev ? { ...prev, ...blueprintData, updatedAt: Date.now() } : null);
        }
        await fetchPrompts();
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
        setError("Failed to persist blueprint: " + err.message);
        setSaveStatus('error');
    } finally {
        setSaving(false);
    }
  };

  const handleDelete = async (targetPrompt?: Prompt) => {
    const promptToDelete = targetPrompt || selectedPrompt;
    if (!user || !promptToDelete) return;
    
    const isPersonal = promptToDelete.isPersonal;
    const isAdmin = profile?.role === 'admin' || profile?.role === 'su';
    
    if (!isPersonal && !isAdmin) {
        setError("You do not have administrative clearance to decommission ecosystem resources.");
        return;
    }

    setConfirmModal({
        isOpen: true,
        title: 'Confirm Decommissioning',
        message: `This will permanently purge "${promptToDelete.title}" from the ${isPersonal ? 'personal registry' : 'ecosystem node'}. This action is irreversible.`,
        isDanger: true,
        onConfirm: async () => {
            setSaving(true);
            try {
                if (isPersonal) {
                    await deleteDoc(doc(db, 'blueprints', promptToDelete.id));
                } else {
                    await deleteDoc(doc(resourcesDb, 'resources', promptToDelete.id));
                }
                setConfirmModal(null);
                if (selectedPrompt?.id === promptToDelete.id) {
                    setSelectedPrompt(null);
                }
                await fetchPrompts();
            } catch (err: any) {
                setError("Decommissioning failed: " + err.message);
            } finally {
                setSaving(false);
            }
        }
    });
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const selectAll = () => {
    if (selectedItems.size === filteredList.length) {
        setSelectedItems(new Set());
    } else {
        setSelectedItems(new Set(filteredList.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!user || selectedItems.size === 0) return;
    
    // Only allow deleting personal records in bulk
    const itemsToDelete = prompts.filter(p => selectedItems.has(p.id) && p.isPersonal);
    
    if (itemsToDelete.length === 0) {
        setError("Bulk decommissioning is reserved for personal archival nodes.");
        return;
    }

    setConfirmModal({
        isOpen: true,
        title: 'Bulk Decommissioning',
        message: `You are about to permanently purge ${itemsToDelete.length} architectures from your personal registry. This action cannot be undone.`,
        isDanger: true,
        onConfirm: async () => {
            setSaving(true);
            setError(null);
            try {
                for (const item of itemsToDelete) {
                    await deleteDoc(doc(db, 'blueprints', item.id));
                }
                setSelectedItems(new Set());
                await fetchPrompts();
                setConfirmModal(null);
            } catch (err: any) {
                setError("Bulk deletion failed: " + err.message);
            } finally {
                setSaving(false);
            }
        }
    });
  };

  const handleClone = async (p: Prompt, confirmedTitle?: string) => {
    if (!user) return;

    const template = p.prompts?.[0] || p.template || '';
    const baseTitle = confirmedTitle || p.title;
    
    // Check for collision if we haven't confirmed a title yet
    if (!confirmedTitle) {
        const existing = prompts.filter(bp => bp.title.toLowerCase().startsWith(p.title.toLowerCase()));
        if (existing.length > 0) {
            const version = existing.length + 1;
            const suggestedTitle = `${p.title} (v${version})`;
            
            setConfirmModal({
                isOpen: true,
                title: 'Architecture Collision',
                message: `An architecture with a similar identity exists. Suggested version: "${suggestedTitle}". You can also force a duplicate or define a custom workspace ID.`,
                customButtons: [
                    {
                        label: `Use ${suggestedTitle}`,
                        onClick: () => { handleClone(p, suggestedTitle); setConfirmModal(null); },
                        className: "col-span-2 py-3 px-6 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg bg-primary/80 hover:bg-primary shadow-primary/20 order-1"
                    },
                    {
                        label: 'Force Duplicate',
                        onClick: () => { handleClone(p, p.title); setConfirmModal(null); },
                        className: "col-span-1 py-2 px-6 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-600 hover:bg-white/5 transition-all text-center order-2"
                    },
                    {
                        label: 'Custom Architecture ID',
                        onClick: () => {
                            const custom = window.prompt("Enter custom architecture ID:", suggestedTitle);
                            if (custom) { handleClone(p, custom); setConfirmModal(null); }
                        },
                        className: "col-span-1 py-2 px-6 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-600 hover:bg-white/5 transition-all text-center order-3"
                    },
                    {
                        label: 'Abort Operation',
                        onClick: () => setConfirmModal(null),
                        className: "col-span-2 mt-2 py-3 px-6 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all text-center order-4"
                    }
                ]
            });
            return;
        }
    }

    setSaving(true);
    setSaveStatus('saving');
    try {
        const blueprintData = {
            title: baseTitle,
            description: p.description || '',
            prompts: [template],
            thumbnailUrl: p.thumbnailUrl || '',
            uid: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, 'blueprints'), blueprintData);
        await fetchPrompts();
        setSaveStatus('success');
        
        // Notify user about save location by switching view
        setActiveTab('blueprints');

        setTimeout(() => setSaveStatus('idle'), 2000);
        
        handleSelect({
            id: docRef.id,
            ...blueprintData,
            isPersonal: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        } as Prompt);

    } catch (err: any) {
        setError("Cloning failed: " + err.message);
        setSaveStatus('error');
    } finally {
        setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !resultantPrompt) return;
    const finalPrompt = getCleanPrompt();
    
    // Explicitly commit current variable values as new defaults in the raw template UI
    setRawTemplate(finalPrompt);

    // Derive active lineage ID
    let activePromptSetID = selectedPrompt?.promptSetID || selectedPrompt?.id;
    if (isNewImageSet) {
        activePromptSetID = crypto.randomUUID();
        setIsNewImageSet(false); // consume intent
        if (selectedPrompt) {
            setSelectedPrompt({ ...selectedPrompt, promptSetID: activePromptSetID });
        }
    }
    
    resetProgress();
    setGenerating(true);
    setError(null);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    try {
      setStep('auth', 'active');
      const idToken = await user.getIdToken();
      setStep('auth', 'done');
      setStep('queue', 'active');

       await triggerGeneration(finalPrompt, user.uid, idToken, (event: GenerationProgress) => {
        if (event.type === 'progress') {
          setStep('queue', 'done');
          setStep('generate', 'active');
          setProgressMsg(event.message || 'Generating...');
          setProgressCurrent(event.current || 0);
          setProgressTotal(event.total || 1);
        }
        if (event.type === 'image_ready') {
          setStep('generate', 'done');
          setStep('upload', 'active');
          const imageUrl = event.image?.imageUrl || null;
          const imageTitle = event.image?.title || '<no title>';
          const promptUsed = event.image?.prompt || finalPrompt;
          if (imageUrl) {
               setGeneratedImages(prev => [{ url: imageUrl, title: imageTitle, prompt: promptUsed }, ...prev]);
          }
          setTimeout(() => setStep('upload', 'done'), 600);
        }
        if (event.type === 'complete') {
          setStep('upload', 'done');
          setStep('complete', 'active');
          const finalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setCompletion({
            creditsUsed: event.creditsUsed,
            remainingBalance: event.remainingBalance,
            imageUrl: event.image?.imageUrl || undefined,
            title: event.image?.title || undefined,
            elapsed: finalElapsed,
          });
          if (timerRef.current) clearInterval(timerRef.current);
          setTimeout(() => { setStep('complete', 'done'); setGenerating(false); }, 500);
        }
        if (event.type === 'error') {
          setError(event.error || 'Unknown error');
          if (timerRef.current) clearInterval(timerRef.current);
          setGenerating(false);
        }
      }, selectedPrompt?.title, activePromptSetID);
    } catch (err: any) {
      setError(err.message);
      if (timerRef.current) clearInterval(timerRef.current);
      setGenerating(false);
    }
  };

  const filteredList = (activeTab === 'blueprints' ? prompts : exemplars)
    .filter(p => {
        if (!searchQuery) return true;
        const sq = searchQuery.toLowerCase();
        const t = p?.title?.toLowerCase() || '';
        const d = p?.description?.toLowerCase() || '';
        return t.includes(sq) || d.includes(sq);
    })
    .sort((a, b) => {
        if (sortMode === 'az') return (a?.title || '').localeCompare(b?.title || '');
        if (sortMode === 'za') return (b?.title || '').localeCompare(a?.title || '');
        if (sortMode === 'newest') return (b?.createdAt || 0) - (a?.createdAt || 0);
        if (sortMode === 'oldest') return (a?.createdAt || 0) - (b?.createdAt || 0);
        if (sortMode === 'updated') return (b?.updatedAt || b?.createdAt || 0) - (a?.updatedAt || a?.createdAt || 0);
        return 0;
    });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">

       {error && (
         <div className="fixed top-24 right-8 z-[60] animate-fade-in-right px-6 py-4 bg-red-500/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex items-center gap-4 max-w-md">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
               <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
               <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Ecosystem Error</p>
               <p className="text-sm font-bold text-white leading-tight">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-2 text-white/40 hover:text-white transition-colors">
               <X className="w-5 h-5" />
            </button>
         </div>
       )}

       {!selectedPrompt ? (
        <div className="space-y-8">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex gap-8">
              <button 
                onClick={() => setActiveTab('blueprints')}
                className={`flex items-center gap-2 pb-4 -mb-[17px] text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'blueprints' ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                Blueprint Library
              </button>
              <button 
                onClick={() => setActiveTab('exemplars')}
                className={`flex items-center gap-2 pb-4 -mb-[17px] text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'exemplars' ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-white'}`}
              >
                <History className="w-4 h-4" />
                PromptTool Exemplars
              </button>
            </div>
            <div className="flex items-center gap-3 px-3 py-1 bg-white/5 rounded-lg border border-white/10">
               <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                 Live Ecosystem Node: {activeTab === 'blueprints' ? 'Master Registry' : 'PromptTool Global'}
               </span>
            </div>
          </div>

          {/* Explorer Navigation */}
          <div className="flex items-center justify-between py-2 border-b border-white/5 pb-6">
            <div className="flex items-center gap-4 flex-1">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search registry..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-sm text-white placeholder:text-gray-500 outline-none w-full md:w-64"
                />
            </div>
            <div className="flex items-center gap-3">
                <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as any)}
                >
                    <option value="newest">Newest First</option>
                    <option value="updated">Recently Updated</option>
                    <option value="oldest">Oldest First</option>
                    <option value="az">A-Z</option>
                    <option value="za">Z-A</option>
                </select>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                    {selectedItems.size > 0 && (
                        <div className="flex items-center gap-4 px-4 border-r border-white/10 mr-2">
                           <span className="text-[10px] font-black text-primary uppercase tracking-widest">{selectedItems.size} Selected</span>
                           <button 
                             onClick={handleBulkDelete}
                             disabled={saving}
                             className={`text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${saving ? 'text-gray-500 cursor-not-allowed' : 'text-red-400 hover:text-red-500'}`}
                           >
                             {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                             {saving ? 'Purging...' : 'Purge'}
                           </button>
                        </div>
                    )}
                    <button 
                        onClick={selectAll}
                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all ${selectedItems.size === filteredList.length && filteredList.length > 0 ? 'bg-primary text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        {selectedItems.size === filteredList.length && filteredList.length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 transition-colors rounded-lg ${viewMode === 'grid' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 transition-colors rounded-lg ${viewMode === 'list' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
                    >
                        <List className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={() => setViewMode('extended')}
                        className={`p-1.5 transition-colors rounded-lg ${viewMode === 'extended' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
                    >
                        <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
          </div>

          <section className="relative min-h-[400px]">
            {loadingLibrary ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4 animate-pulse">
                <RefreshCw className="w-12 h-12 text-primary/40 animate-spin-slow" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Initializing Ecosystem Node</span>
                  <span className="text-[9px] font-bold text-gray-700 italic mt-1">Hydrating architectural registry...</span>
                </div>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-white/[0.02]">
                <Database className="w-12 h-12 text-gray-700 mb-6 opacity-40" />
                <div className="text-center">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Registry Entry Null</h3>
                  <p className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">No architectures indexed in this node</p>
                </div>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-8" : "flex flex-col gap-6"}>
                {filteredList.map((p, i) => (
                  <div 
                    key={p.id} 
                    onClick={() => handleSelect(p)} 
                    className={`relative group cursor-pointer flex flex-col h-full animate-fade-in-up opacity-0 ${viewMode === 'list' ? '' : 'h-full'}`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    {/* Outer Glow Bloom */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/40 to-accent/40 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-60 transition-all duration-700 pointer-events-none"></div>
                    
                    <div className="relative glass-panel p-8 bg-white/5 hover:bg-[#12121a]/80 backdrop-blur-2xl transition-all duration-500 transform group-hover:scale-[1.03] group-hover:-translate-y-2 border-white/5 group-hover:border-primary/40 flex-1 flex flex-col justify-between shadow-2xl group-hover:shadow-primary/20">
                      
                      {/* Selection Checkbox */}
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSelectItem(p.id); }}
                        className={`absolute top-6 left-6 w-6 h-6 rounded-lg border-2 z-30 flex items-center justify-center transition-all cursor-pointer ${selectedItems.has(p.id) ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'border-white/10 bg-black/20 opacity-0 group-hover:opacity-100'}`}
                      >
                         {selectedItems.has(p.id) && <Check className="w-4 h-4 text-white" />}
                      </div>
                      {p.isPersonal && (
                        <div className="absolute -top-3 -right-3 px-4 py-1.5 bg-brand-gradient text-[9px] font-black uppercase tracking-[0.2em] rounded-full z-10 shadow-[0_0_20px_rgba(99,102,241,0.4)] ring-1 ring-white/20">
                          Personal Record
                        </div>
                      )}
                      {p.isExemplar && (
                        <div className="absolute -top-3 -right-3 px-4 py-1.5 bg-primary/20 backdrop-blur-md text-[9px] font-black uppercase tracking-[0.2em] rounded-full z-10 shadow-lg border border-primary/40 text-primary">
                          Exemplar Alpha
                        </div>
                      )}

                      {/* Contextual Actions */}
                      <div className="absolute bottom-20 right-6 flex flex-col gap-3 z-20">
                          {p.isExemplar && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClone(p);
                                }}
                                className="p-3 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl border border-primary/20 transition-all opacity-0 group-hover:opacity-100 shadow-xl"
                                title="Clone to My Library"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                          )}
                          {(p.isPersonal || profile?.role === 'admin' || profile?.role === 'su') && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(p);
                                }}
                                className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all opacity-0 group-hover:opacity-100 shadow-xl"
                                title="Purge Record"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                      </div>
                      
                      <div className={`flex items-start ${viewMode === 'extended' ? 'flex-col gap-6' : 'gap-8'}`}>
                        <div className={`relative shrink-0 overflow-hidden border border-white/10 group-hover:border-primary/50 transition-colors shadow-2xl ${viewMode === 'extended' ? 'w-full h-48 rounded-[2rem]' : 'w-28 h-28 rounded-[2rem]'}`}>
                          <img 
                            src={p.thumbnailUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${p.id}`} 
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" 
                            alt="" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                        <div className="flex-1 min-w-0 w-full">
                           <div className="mb-2">
                              <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">Neural Identity</p>
                              <h3 className={`font-black uppercase truncate transition-colors leading-tight ${!p.title ? "text-gray-500 italic text-sm" : "text-white group-hover:text-primary text-sm"}`}>
                                {p.title || '<no title>'}
                              </h3>
                           </div>
                          <p className={`text-xs text-gray-400 mt-2 font-medium ${viewMode === 'extended' ? 'leading-relaxed' : 'leading-relaxed line-clamp-2'}`}>{p.description}</p>
                          
                          {viewMode === 'extended' && p.template && (
                             <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/5 relative group-hover:border-primary/20 transition-all">
                                <p className="text-xs text-gray-500 font-mono italic leading-relaxed break-words">{p.template}</p>
                             </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
                        <div className="flex items-center gap-3">
                           <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                              <Database className="w-3 h-3 text-gray-500" />
                           </div>
                           <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{p.isExemplar ? 'Global Resource' : 'Architectural DNA'}</span>
                        </div>
                        <span className="text-[10px] uppercase font-black tracking-[0.3em] text-primary translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500 flex items-center gap-3">
                          Initialize <RefreshCw className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fade-in-up opacity-0">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <button 
                onClick={() => {
                  setSelectedPrompt(null);
                  setActiveTab('blueprints');
                }} 
                className="text-sm font-bold text-gray-500 hover:text-white flex items-center gap-2 transition-colors px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl w-fit"
               >
                <X className="w-4 h-4" /> BACK TO LIBRARY
               </button>
               
               <div className="flex bg-white/5 p-1 rounded-[1.2rem] border border-white/10 shadow-inner backdrop-blur-xl">
                  <button 
                    onClick={() => setActiveDetailTab('architect')}
                    className={`flex items-center gap-2.5 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-500 ${activeDetailTab === 'architect' ? 'bg-primary text-white shadow-[0_10px_20px_-10px_rgba(99,102,241,0.6)] border border-primary/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                  >
                     <Plus className={`w-3.5 h-3.5 ${activeDetailTab === 'architect' ? 'rotate-45' : ''} transition-transform duration-500`} /> 
                     Architect
                  </button>
                  <button 
                    onClick={() => setActiveDetailTab('media')}
                    className={`flex items-center gap-2.5 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-500 ${activeDetailTab === 'media' ? 'bg-primary text-white shadow-[0_10px_20px_-10px_rgba(99,102,241,0.6)] border border-primary/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                  >
                     <GalleryVertical className="w-3.5 h-3.5" /> 
                     Media
                  </button>
               </div>
            </div>

            <div className="relative group">
               <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/30 to-accent/30 rounded-3xl blur opacity-25"></div>
               <div className="relative glass-panel p-8 space-y-8 bg-[#181825]/90 border-white/10 shadow-2xl">
                 <div className="flex flex-col gap-6 border-b border-white/5 pb-6">
                   <div className="flex flex-col gap-2">
                     <div className="relative group/title w-full">
                        <input 
                            type="text"
                            value={selectedPrompt.title}
                            onChange={(e) => setSelectedPrompt({...selectedPrompt, title: e.target.value})}
                            className="bg-transparent text-2xl font-black text-white/90 outline-none w-full border-b border-white/5 focus:border-primary/50 transition-all pr-24 pb-1"
                            placeholder="Blueprint Title..."
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-3">
                            {(selectedPrompt.isPersonal || profile?.role === 'admin' || profile?.role === 'su') && (
                                <button 
                                    onClick={() => handleDelete()}
                                    className="p-2 text-white/10 hover:text-red-500 transition-colors"
                                    title="Decommission Blueprint"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                            <Edit3 className="w-5 h-5 text-white/20 group-hover/title:text-primary transition-colors pointer-events-none" />
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <button 
                            onClick={() => {
                                const suggestion = suggestTitle(resultantPrompt);
                                setConfirmModal({
                                    isOpen: true,
                                    title: 'Architectural Recommendation',
                                    message: `Would you like to rename this blueprint to "${suggestion}"?`,
                                    onConfirm: () => {
                                        setSelectedPrompt({ ...selectedPrompt, title: suggestion });
                                        setConfirmModal(null);
                                    }
                                });
                            }}
                            className="flex items-center gap-2 text-[10px] font-black text-primary hover:text-white transition-colors uppercase tracking-widest px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20"
                        >
                            <Sparkles className="w-3 h-3" />
                            Suggest Architectural Name
                        </button>
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Blueprint DNA</span>
                     </div>
                   </div>
                 </div>

                 {activeDetailTab === 'architect' ? (
                   <div className="space-y-8 animate-fade-in">
                      <div className="space-y-3">
                          <div className="flex justify-between items-center px-1">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Blueprint Mode (Raw Template)</label>
                              <div className="flex gap-4">
                                  <button onClick={() => setIsEditingBlueprint(!isEditingBlueprint)} className="text-[9px] font-black text-primary hover:text-white transition-colors uppercase tracking-widest">[ {isEditingBlueprint ? 'Lock Changes' : 'Edit Blueprint'} ]</button>
                                  <button onClick={confirmRevert} className="text-[9px] font-black text-primary/50 hover:text-primary transition-colors uppercase tracking-widest">[ Revert Blueprint ]</button>
                              </div>
                          </div>
                         {isEditingBlueprint ? (
                             <textarea 
                                 value={rawTemplate}
                                 onChange={(e) => setRawTemplate(e.target.value)}
                                 className="w-full h-40 bg-black/40 border border-primary/50 rounded-xl p-5 text-[15px] font-mono text-white transition-all resize-y shadow-inner outline-none leading-relaxed"
                                 placeholder="Define your prompt architecture here..."
                                 autoFocus
                             />
                         ) : (
                             <div 
                                 className="w-full min-h-[10rem] bg-black/40 border border-white/5 rounded-2xl p-6 text-[15px] leading-relaxed text-gray-400 font-mono shadow-inner overflow-y-auto cursor-pointer group-hover:border-primary/20 transition-all"
                                 onClick={() => setIsEditingBlueprint(true)}
                             >
                                 {rawTemplate.split(/({{[^}]+}})/).map((part, i) => {
                                     if (part.startsWith('{{') && part.endsWith('}}')) {
                                         return (
                                             <span key={i} className="text-primary font-black bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20 shadow-lg shadow-primary/10 inline-block mx-0.5 my-0.5 text-[13px]">
                                                 {part}
                                             </span>
                                         );
                                     }
                                     return part;
                                 })}
                             </div>
                         )}
                      </div>

                      <div className="space-y-6">
                        {Object.keys(variables).map((v) => (
                          <div key={v} className="space-y-2">
                             <div className="flex justify-between items-center px-1">
                                 <label className="text-[10px] font-black tracking-widest text-primary uppercase ml-1">{v}</label>
                                 <div className="flex gap-4">
                                     {variables[v].value && variables[v].value !== variables[v].default && (
                                         <button onClick={() => setAsDefault(v)} className="text-[9px] font-black text-primary hover:text-white transition-colors uppercase tracking-widest">[ Set as Default ]</button>
                                     )}
                                     {variables[v].value && variables[v].default && (
                                         <button onClick={() => useDefault(v)} className="text-[9px] font-black text-white/20 hover:text-primary transition-colors uppercase tracking-widest">[ Use Default ]</button>
                                     )}
                                     {variables[v].value && (
                                         <button onClick={() => clearInput(v)} className="text-[9px] font-black text-white/20 hover:text-red-400 transition-colors uppercase tracking-widest">[ Clear ]</button>
                                     )}
                                 </div>
                             </div>
                             <input 
                                 type="text" 
                                 value={variables[v].value} 
                                 onChange={(e) => setVariables(prev => ({ ...prev, [v]: { ...prev[v], value: e.target.value } }))} 
                                 className="w-full bg-[#12121a] border border-white/10 rounded-xl px-5 py-4 outline-none text-white font-medium placeholder:text-white/40 focus:bg-black/80 transition-all shadow-inner" 
                                 placeholder={variables[v].default ? `Override: ${variables[v].default}...` : `Insert ${v} context...`} 
                             />
                          </div>
                        ))}
                      </div>

                      {/* Sibling Variations Registry */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setIsVariationsCollapsed(!isVariationsCollapsed)}
                              className="flex items-center gap-2 hover:opacity-70 transition-opacity outline-none"
                            >
                              <ChevronDown className={`w-4 h-4 text-primary transition-transform duration-300 ${isVariationsCollapsed ? '-rotate-90' : ''}`} />
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 m-0 p-0">
                                <Layers className="w-3.5 h-3.5 text-primary" /> Registry Variations
                              </h4>
                            </button>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                              <button onClick={() => setVariationsViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${variationsViewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                <Grid className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setVariationsViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${variationsViewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                <List className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[9px] font-bold text-gray-700 uppercase">{generatedImages.length + 1} Assets Linked</span>
                          </div>
                        </div>

                        {!isVariationsCollapsed && (
                          <div className={`pt-4 ${variationsViewMode === 'grid' ? 'grid grid-cols-2 lg:grid-cols-3 gap-6' : 'flex flex-col gap-4'}`}>
                            {/* Original Node */}
                            <div className={`flex ${variationsViewMode === 'grid' ? 'flex-col items-center space-y-3' : 'flex-row items-center gap-6 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors'}`}>
                              <div
                                className={`group/thumb relative rounded-[2rem] overflow-hidden border border-white/10 hover:border-primary/50 transition-all cursor-zoom-in shadow-xl bg-black/40 shrink-0 ${variationsViewMode === 'grid' ? 'w-full aspect-square' : 'w-24 h-24'}`}
                                onClick={() => handleAssetSelection(originalThumbnail || selectedPrompt.thumbnailUrl || null, selectedPrompt.title, selectedPrompt.template || selectedPrompt.prompts?.[0])}
                              >
                                <img src={originalThumbnail || selectedPrompt.thumbnailUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedPrompt.id}`} className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-700" alt="" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[1px] pointer-events-none group-hover/thumb:pointer-events-auto z-30">
                                  <button
                                    className={`py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-[2px] border border-white/20 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] transition-all duration-500 shadow-xl hover:scale-105 active:scale-95 ${variationsViewMode === 'grid' ? 'w-32' : 'w-12 h-8 text-[8px] px-2'}`}
                                    onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(originalThumbnail || selectedPrompt.thumbnailUrl || null); setPreviewTitle(selectedPrompt.title || '<no title>'); setPreviewPrompt(selectedPrompt.template || selectedPrompt.prompts?.[0] || null); }}
                                  >
                                    {variationsViewMode === 'grid' ? 'View Vision' : <Maximize2 className="w-3 h-3 mx-auto" />}
                                  </button>
                                  <button
                                    className={`py-2.5 bg-primary/80 hover:bg-primary border border-primary/20 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] transition-all duration-500 shadow-xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 ${variationsViewMode === 'grid' ? 'w-32' : 'w-12 h-8 text-[8px] px-2'}`}
                                    onClick={(e) => { e.stopPropagation(); handleAssetSelection(originalThumbnail || selectedPrompt.thumbnailUrl || null, selectedPrompt.title, selectedPrompt.template || selectedPrompt.prompts?.[0]); }}
                                  >
                                    <Check className="w-3 h-3" />{variationsViewMode === 'grid' ? ' Select' : ''}
                                  </button>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent z-20 pointer-events-none">
                                  <span className={`text-white/40 font-bold uppercase truncate text-center tracking-widest block ${variationsViewMode === 'grid' ? 'text-[8px]' : 'hidden'}`}>{selectedPrompt.title || '<no title>'}</span>
                                </div>
                              </div>
                              <div className={variationsViewMode === 'list' ? 'flex-1 min-w-0 flex flex-col items-start' : ''}>
                                {variationsViewMode === 'list' && <p className="text-[12px] font-black text-white truncate max-w-sm mb-2">{selectedPrompt.title || '<no title>'}</p>}
                                <span className="text-[14px] font-black text-primary uppercase tracking-[0.3em] bg-primary/5 px-4 py-1.5 rounded-full border border-primary/20 shadow-lg shadow-primary/5 italic inline-block">Original</span>
                              </div>
                            </div>

                            {/* Historical Lineage */}
                            {generatedImages.map((img, idx) => (
                              <div key={idx} className={`flex ${variationsViewMode === 'grid' ? 'flex-col items-center space-y-3' : 'flex-row items-center gap-6 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors'}`}>
                                <div
                                  className={`group/thumb relative rounded-[2rem] overflow-hidden border-2 border-primary/40 hover:border-primary transition-all cursor-zoom-in shadow-[0_0_30px_rgba(99,102,241,0.2)] shrink-0 ${variationsViewMode === 'grid' ? 'w-full aspect-square' : 'w-24 h-24'}`}
                                  onClick={() => handleAssetSelection(img.url, img.title, img.prompt, img.variables)}
                                >
                                  <img src={img.url} className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-700" alt="" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[1px] pointer-events-none group-hover/thumb:pointer-events-auto z-30">
                                    <button
                                      className={`py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-[2px] border border-white/20 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] transition-all duration-500 shadow-xl hover:scale-105 active:scale-95 ${variationsViewMode === 'grid' ? 'w-32' : 'w-12 h-8 text-[8px] px-2'}`}
                                      onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(img.url); setPreviewTitle(img.title || '<no title>'); setPreviewPrompt(img.prompt || null); }}
                                    >
                                      {variationsViewMode === 'grid' ? 'View Vision' : <Maximize2 className="w-3 h-3 mx-auto" />}
                                    </button>
                                    <button
                                      className={`py-2.5 bg-primary/80 hover:bg-primary border border-primary/20 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] transition-all duration-500 shadow-xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 ${variationsViewMode === 'grid' ? 'w-32' : 'w-12 h-8 text-[8px] px-2'}`}
                                      onClick={(e) => { e.stopPropagation(); handleAssetSelection(img.url, img.title, img.prompt, img.variables); }}
                                    >
                                      <Check className="w-3 h-3" />{variationsViewMode === 'grid' ? ' Select' : ''}
                                    </button>
                                  </div>
                                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent z-20 pointer-events-none">
                                    <span className={`text-white/40 font-bold uppercase truncate text-center tracking-widest block ${variationsViewMode === 'grid' ? 'text-[8px]' : 'hidden'}`}>{img.title || '<no title>'}</span>
                                  </div>
                                </div>
                                <div className={variationsViewMode === 'list' ? 'flex-1 min-w-0 flex flex-col items-start' : ''}>
                                  {variationsViewMode === 'list' && (
                                    <div className="mb-2">
                                      <p className="text-[12px] font-black text-white truncate max-w-sm">{img.title || '<no title>'}</p>
                                      {img.prompt && <p className="text-[9px] text-gray-500 truncate max-w-sm mt-1">{img.prompt}</p>}
                                    </div>
                                  )}
                                  <span className="text-[14px] font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-4 py-1.5 rounded-full border border-primary/30 shadow-lg shadow-primary/10 inline-block">
                                    v: {((generatedImages.length - idx) * 0.1).toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                       </div>

                       {/* Ecosystem Asset Sync */}
                       <div className="bg-black/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden group mt-8">
                         <div className="absolute -inset-10 bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
                           <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                               <Database className="w-6 h-6 text-gray-700" />
                             </div>
                             <div>
                               <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Ecosystem Asset Sync</h4>
                               <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                                 Unified storage node synchronization is active. All media assets linked to this blueprint are cached at the ecosystem edge.
                               </p>
                             </div>
                           </div>
                           {selectedPrompt.isExemplar && (
                             <button 
                               onClick={() => window.open(`http://localhost:3001/community?entryId=${selectedPrompt.id}`, '_blank')}
                               className="px-5 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-primary transition-all flex items-center gap-2 shrink-0 group/link"
                             >
                               <Sparkles className="w-3 h-3 group-hover/link:rotate-12 transition-transform" />
                               View in Hub
                             </button>
                           )}
                         </div>
                       </div>
                    </div>
                  ) : (
                   <div className="space-y-8 animate-fade-in">
                      {/* Blueprint Asset Node */}
                      <div className="space-y-8">
                         <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                               <Layers className="w-5 h-5 text-primary" /> Multi-Layer Asset Node
                            </h3>
                            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                               <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/20"></div>
                               <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Ecosystem Linked</span>
                            </div>
                         </div>

                         <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            {/* Current Blueprint Image */}
                             <div className="group relative aspect-square rounded-[2rem] overflow-hidden border border-white/10 hover:border-primary/50 transition-all cursor-zoom-in shadow-xl" onClick={() => handleAssetSelection(selectedPrompt.thumbnailUrl || null, selectedPrompt.title, selectedPrompt.template || selectedPrompt.prompts?.[0])}>
                                <img src={selectedPrompt.thumbnailUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedPrompt.id}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2 z-20">
                                   <div className="flex items-center justify-between pointer-events-auto">
                                      <span className="text-[8px] font-black text-primary uppercase tracking-widest shrink-0">Current Thumbnail</span>
                                      <button 
                                        className="text-[8px] font-black text-white/60 hover:text-white uppercase tracking-widest transition-colors z-30"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewImageUrl(selectedPrompt.thumbnailUrl || null);
                                            setPreviewTitle(selectedPrompt.title || '<no title>');
                                            setPreviewPrompt(selectedPrompt.template || selectedPrompt.prompts?.[0] || null);
                                        }}
                                      >
                                          [ Expand Image ]
                                      </button>
                                   </div>
                                   <span className="text-[7px] text-gray-400 font-bold uppercase truncate pointer-events-none">{selectedPrompt.title || '<no title>'}</span>
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm pointer-events-none z-10">
                                   <Edit3 className="w-6 h-6 text-white" />
                                </div>
                             </div>

                            {/* Generated Variations */}
                             {generatedImages.map((img, idx) => (
                               <div key={idx} className="group relative aspect-square rounded-[2rem] overflow-hidden border-2 border-primary/40 hover:border-primary transition-all cursor-zoom-in shadow-[0_0_30px_rgba(99,102,241,0.2)]" onClick={() => handleAssetSelection(img.url, img.title, img.prompt)}>
                                  <img src={img.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2 z-20">
                                      <div className="flex items-center justify-between pointer-events-auto">
                                          <span className="text-[8px] font-black text-primary uppercase shrink-0">VARIATION {generatedImages.length - idx}</span>
                                          <button 
                                            className="text-[8px] font-black text-white/60 hover:text-white uppercase tracking-widest transition-colors z-30"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewImageUrl(img.url);
                                                setPreviewTitle(img.title || '<no title>');
                                                setPreviewPrompt(img.prompt || null);
                                            }}
                                          >
                                              [ Expand Image ]
                                          </button>
                                      </div>
                                      <span className="text-[7px] text-gray-400 font-bold uppercase truncate pointer-events-none">{img.title || '<no title>'}</span>
                                  </div>
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm pointer-events-none z-10">
                                     <Edit3 className="w-6 h-6 text-white" />
                                  </div>
                               </div>
                             ))}

                            {/* Upload New Asset */}
                            <div className="aspect-square rounded-[2rem] border-4 border-dashed border-white/10 hover:border-primary/40 flex flex-col items-center justify-center gap-4 group cursor-pointer transition-all hover:bg-primary/5">
                               <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 group-hover:border-primary/40 transition-all">
                                  <UploadCloud className="w-6 h-6 text-gray-600 group-hover:text-primary transition-colors" />
                               </div>
                               <div className="text-center px-4">
                                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-white transition-colors">Infuse Media</p>
                                  <p className="text-[8px] font-bold text-gray-700 uppercase mt-1">External Asset Upload</p>
                               </div>
                            </div>
                         </div>

                      </div>
                   </div>
                 )}
               </div>
            </div>
          </div>

          <div className="space-y-6 h-full flex flex-col">
            <div className="relative flex-1">
              <div className="absolute -inset-1 bg-brand-gradient rounded-3xl blur opacity-20"></div>
              <div className="relative glass-panel p-8 space-y-8 bg-[#1c1c2b]/90 border-white/10 shadow-2xl flex flex-col h-full">
                 
                 {/* Blueprint Control Unit — Action Logic Nodes */}
                 <div className="grid grid-cols-[1fr,auto] gap-4 pb-6 border-b border-white/10 relative z-20">
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => saveBlueprint(false)}
                            disabled={saveStatus !== 'idle'}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all font-black uppercase tracking-widest text-[9px] shadow-lg ${
                                saveStatus === 'success' 
                                ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                                : saveStatus === 'saving'
                                ? 'bg-primary/20 border-primary/20 text-primary animate-pulse'
                                : 'bg-primary/80 border-primary/30 text-white hover:bg-primary hover:scale-[1.02]'
                            }`}
                        >
                            <Save className={`w-3.5 h-3.5 ${saveStatus === 'saving' ? 'animate-spin' : ''}`} />
                            {saveStatus === 'saving' ? 'Persisting...' : saveStatus === 'success' ? 'Saved' : 'Save'}
                        </button>

                        <button 
                            onClick={() => saveBlueprint(true)}
                            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[9px] hover:scale-[1.02]"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Save New
                        </button>
                    </div>

                    {(selectedPrompt?.isPersonal || profile?.role === 'admin' || profile?.role === 'su') && (
                        <button 
                            onClick={() => handleDelete()}
                            className="flex items-center justify-center px-4 py-3 rounded-xl border border-red-500/10 bg-red-500/5 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all font-black uppercase tracking-widest text-[9px] hover:scale-[1.02]"
                            title="Decommission Architecture"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                 </div>

                 {/* Engine Selector — Diagnostic Cockpit */}
                 <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10 shadow-xl backdrop-blur-md flex-1">
                       <Zap className="w-4 h-4 text-primary animate-pulse shrink-0" />
                       <select 
                           value={engine}
                           onChange={(e) => setEngine(e.target.value)}
                           className="bg-transparent text-[10px] font-black text-white uppercase tracking-widest outline-none flex-1 cursor-pointer"
                       >
                           <option value="vision-0">Visual Engine 1.0 (Standard)</option>
                           <option value="architect-1">Architectural 2.0 (High Precision)</option>
                           <option value="cinematic-3">Cinematic Ultra (Max Fidelity)</option>
                       </select>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-black/40 rounded-xl border border-white/5 shadow-inner shrink-0">
                       <Sliders className="w-3 h-3 text-primary/60" />
                       <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                           {Object.keys(variables).length} Controls Active
                       </span>
                    </div>
                 </div>

                 <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                   <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                   <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Compiled Instructions</h3>
                 </div>
                 
                 <div className="flex-1 bg-black/20 rounded-2xl p-6 border border-white/5 shadow-inner overflow-hidden">
                    <p className="text-xl leading-[1.8] text-gray-300 font-medium">
                      {resultantPrompt.split(/(__DEF__.*?__DEF__|__VAL__.*?__VAL__)/).map((s, i) => {
                          if (s.startsWith('__DEF__')) return <span key={i} className="text-gray-400 italic px-1.5 py-0.5 bg-white/5 rounded-md border border-white/5 text-lg">{s.replace(/__DEF__/g, '')}</span>;
                          if (s.startsWith('__VAL__')) return <span key={i} className="text-primary font-black bg-primary/10 px-2 py-1 rounded-lg border border-primary/20 shadow-lg shadow-primary/10">{s.replace(/__VAL__/g, '')}</span>;
                          return s;
                      })}
                    </p>
                  </div>
 
                  <div className="space-y-6 mt-auto">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                           <label className="flex items-center gap-2 cursor-pointer w-fit group">
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isNewImageSet ? 'bg-primary border-primary' : 'bg-white/5 border-white/20 group-hover:border-primary/50'}`}>
                                {isNewImageSet && <Sparkles className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <input type="checkbox" checked={isNewImageSet} onChange={e => setIsNewImageSet(e.target.checked)} className="hidden" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">Start New Image Set <span className="text-white/20 lowercase tracking-normal font-medium">(breaks variation lineage)</span></span>
                           </label>
                           {isNewImageSet && (
                               <button
                                   onClick={() => {
                                       const newSetID = crypto.randomUUID();
                                       if (selectedPrompt) {
                                           setSelectedPrompt({ ...selectedPrompt, promptSetID: newSetID });
                                       }
                                       setIsNewImageSet(false);
                                       saveBlueprint(false);
                                   }}
                                   disabled={saveStatus !== 'idle'}
                                   className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-primary hover:text-white px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-all"
                               >
                                   <Save className="w-3 h-3" />
                                   Save New Set
                               </button>
                           )}
                        </div>
                        <button onClick={handleSubmit} disabled={generating || !user || !resultantPrompt} className={`relative w-full overflow-hidden py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 ${generating || !user || !resultantPrompt ? 'opacity-50 cursor-not-allowed bg-white/5 text-gray-400' : 'bg-brand-gradient text-white hover:scale-[1.02] shadow-[0_0_30px_rgba(99,102,241,0.3)]'}`}>
                          <span className="relative z-10 flex items-center gap-3">
                            {generating ? <RefreshCw className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />} 
                            {generating ? 'Processing Neuromap...' : 'Initialize Generation'}
                          </span>
                        </button>
                    </div>

                 </div>
              </div>
            </div>

            {(generating || completion) && (
              <div className="relative animate-fade-in-up">
                <div className="absolute -inset-1 bg-brand-gradient rounded-3xl blur opacity-20"></div>
                <div className="relative glass-panel p-8 bg-[#1c1c2b]/95 border border-white/10 shadow-2xl space-y-6">
                  {generating ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live Neural Stream</h3>
                        </div>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest tabular-nums">{formatElapsed(elapsed)} Elapsed</span>
                      </div>

                      <div className="grid grid-cols-5 gap-3">
                        {status.map((step) => (
                          <div key={step.id} className="flex flex-col gap-2">
                             <div className={`h-1.5 rounded-full transition-all duration-500 ${step.status === 'done' ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : step.status === 'active' ? 'bg-primary' : 'bg-white/5'}`}></div>
                             <div className="flex items-center gap-1.5 px-1">
                                <StepIcon stepStatus={step.status} />
                                <span className={`text-[8px] font-black uppercase tracking-widest ${step.status === 'done' ? 'text-green-400' : step.status === 'active' ? 'text-white' : 'text-gray-600'}`}>{step.label}</span>
                             </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                           <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                              <Sparkles className="w-3 h-3" />
                              {progressMsg || 'Processing...'}
                           </p>
                           <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest tabular-nums">{Math.round((progressCurrent / progressTotal) * 100)}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                           <div 
                            className="h-full bg-brand-gradient transition-all duration-500 ease-out shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                            style={{ width: `${(progressCurrent / progressTotal) * 100}%` }}
                           ></div>
                        </div>
                       </div>

                     </div>
                  ) : completion && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-500">
                       <div className="flex items-center justify-between border-b border-white/5 pb-4">
                          <div className="flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                             <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Generation Successful</h3>
                          </div>
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest tabular-nums">Manifest Rendered in {completion.elapsed}s</span>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2">
                             <Zap className="w-4 h-4 text-primary" />
                             <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Architectural Cost</p>
                             <p className="text-sm font-black text-white">{completion.creditsUsed} Credits</p>
                          </div>
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2">
                             <Database className="w-4 h-4 text-primary" />
                             <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Remaining Nodes</p>
                             <p className="text-sm font-black text-white tabular-nums">{completion.remainingBalance}</p>
                          </div>
                       </div>

                       <button 
                        onClick={() => {
                          setCompletion(null);
                          setActiveDetailTab('media');
                        }}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                       >
                          View Gallery Distribution
                       </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {generatedImages.length > 0 && (
                <div 
                    className="relative group cursor-zoom-in"
                    onClick={() => { 
                        setPreviewImageUrl(generatedImages[0].url); 
                        setPreviewTitle(generatedImages[0].title || '<no title>'); 
                        setPreviewPrompt(generatedImages[0].prompt || null);
                    }}
                >
                  <div className="absolute -inset-1 bg-brand-gradient rounded-3xl blur opacity-30 group-hover:opacity-50 transition-all duration-500"></div>
                  <img src={generatedImages[0].url} className="relative w-full rounded-2xl shadow-2xl border border-white/10 group-hover:scale-[1.01] transition-transform duration-500" alt="Result" />
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 transform scale-75 group-hover:scale-100 transition-transform duration-500">
                          <ZoomIn className="w-8 h-8 text-white" />
                      </div>
                      <span className="absolute bottom-6 text-[10px] font-black text-white uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity">Expand Vision Preview</span>
                  </div>
                </div>
            )}
          </div>
        </section>
      )}
      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-12 backdrop-blur-3xl bg-black/80 animate-fade-in"
          onClick={() => { setPreviewImageUrl(null); setPreviewPrompt(null); }}
        >
           <button 
             onClick={() => { setPreviewImageUrl(null); setPreviewPrompt(null); }}
             className="absolute top-8 right-8 z-[120] p-4 bg-white/5 hover:bg-red-500 text-white rounded-2xl border border-white/10 transition-all group"
           >
              <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
           </button>

           <div 
             className="relative max-w-7xl w-full max-h-[90vh] flex flex-col md:flex-row items-stretch rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 group/modal bg-[#181825]"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="flex-1 relative flex items-center justify-center bg-black/50 overflow-hidden">
                  <div className="absolute -inset-10 bg-brand-gradient opacity-20 blur-3xl animate-pulse pointer-events-none"></div>
                  <img 
                    src={previewImageUrl} 
                    className="relative w-full h-full object-contain z-10 p-4 md:p-8" 
                    alt="Vision Preview" 
                  />
                  
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 px-8 py-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-4 opacity-0 group-hover/modal:opacity-100 transition-opacity duration-500">
                     <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-xs font-black text-white uppercase tracking-widest whitespace-nowrap">{previewTitle || 'High-Fidelity Neural Output'}</span>
                     </div>
                     <div className="h-4 w-px bg-white/10"></div>
                     <button 
                      onClick={() => window.open(previewImageUrl, '_blank')}
                      className="text-[10px] font-black text-primary hover:text-white transition-colors uppercase tracking-widest"
                     >
                        Source Raw Link
                     </button>
                  </div>
              </div>

              {previewPrompt && [...previewPrompt.matchAll(/{{(.*?)}}/g)].length > 0 && (
                <div className="w-full md:w-96 bg-[#1a1b26] border-l border-white/10 p-8 flex flex-col gap-6 overflow-y-auto hidden md:flex z-20">
                    <div>
                        <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                            <Sliders className="w-4 h-4" />
                            Active Variables
                        </h4>
                        <p className="text-xs text-gray-500 max-w-[200px]">Metadata parameter values structurally embedded in this generation.</p>
                    </div>
                    <div className="space-y-4">
                        {[...previewPrompt.matchAll(/{{(.*?)}}/g)].map((match, idx) => {
                            const parts = match[1].split(':');
                            const key = parts[0];
                            const val = parts.length > 1 ? parts[1] : '<undefined>';
                            return (
                                <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col gap-1 hover:border-primary/30 transition-colors">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{key}</span>
                                    <span className="text-sm font-medium text-white break-words">{val}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default PromptMaster;
