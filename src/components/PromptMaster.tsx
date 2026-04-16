import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, addDoc, serverTimestamp, doc, setDoc, query, where, deleteDoc } from 'firebase/firestore';
import { db, resourcesDb, toolDb } from '../lib/firebase';
import { Icons } from './Icons';
import { triggerGeneration, type GenerationProgress } from '../lib/services/prompt-tool';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import PromptToolGallery from './PromptToolGallery';

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
  promptSetID?: string | null;
  authorName?: string;
}

interface Variation {
  id?: string;
  url: string;
  title?: string;
  prompt?: string;
  variables?: Record<string, { value: string; default: string }>;
  uid?: string;
  isOriginal?: boolean;
  template?: string;
}

const parseDate = (val: any): number => {
    if (!val) return Date.now();
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    return new Date(val).getTime() || Date.now();
};

const calculateComplexity = (template?: string, prompts?: string[]) => {
  const content = template || (prompts && prompts[0]) || '';
  const vars = content.match(/{{[^}]+}}/g);
  return vars ? Math.min(vars.length, 8) / 8 : 0.1;
};

const calculateFreshness = (updatedAt?: number) => {
  if (!updatedAt) return 0.5;
  const ageInDays = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);
  return Math.max(0.1, 1 - Math.min(ageInDays / 30, 0.9));
};

const calculateUsageRating = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return 0.3 + (Math.abs(hash % 70) / 100);
};

const VAR_REGEX = /{{(.*?)}}/g;

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
  if (stepStatus === 'done')    return <Icons.check className="w-4 h-4 text-emerald-400" />;
  if (stepStatus === 'active')  return <Icons.refresh className="w-4 h-4 text-indigo-400 animate-spin" />;
  if (stepStatus === 'error')   return <Icons.alert className="w-4 h-4 text-rose-400 animate-pulse" />;
  return <div className="w-4 h-4 rounded-full border border-white/5 bg-white/[0.02]" />;
};

interface PromptMasterProps {
  activeTab: 'blueprints' | 'exemplars' | 'gallery';
  setActiveTab: (tab: 'blueprints' | 'exemplars' | 'gallery') => void;
  setConfirmModal: (modal: any) => void;
}

const PromptMaster: React.FC<PromptMasterProps> = ({ 
    activeTab, 
    setActiveTab,
    setConfirmModal
}) => {
  const { user, profile } = useAuth();
  const { promptId } = useParams();
  
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [exemplars, setExemplars] = useState<Prompt[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [lastCommittedPrompt, setLastCommittedPrompt] = useState<string>('');
  const [viewingMetrics, setViewingMetrics] = useState<Prompt | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gallerySearchQuery, setGallerySearchQuery] = useState('');
  const [initialGalleryAssetId, setInitialGalleryAssetId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'az' | 'za' | 'newest' | 'oldest' | 'updated'>('updated');
  const [viewMode, setViewMode] = useState<'grid-2' | 'grid-3' | 'grid-4' | 'grid-5' | 'grid-6' | 'list'>('grid-4');
  const [variationsViewMode, setVariationsViewMode] = useState<'grid-3' | 'list'>('grid-3');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [rawTemplate, setRawTemplate] = useState('');
  const [variables, setVariables] = useState<Record<string, { value: string, default: string }>>({});
  const [resultantPrompt, setResultantPrompt] = useState('');
  const [isEditingBlueprint, setIsEditingBlueprint] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'architect' | 'media'>('architect');
  const [notification, setNotification] = useState<{ id: string; title: string } | null>(null);
  const [isNewImageSet, setIsNewImageSet] = useState(false);
  
  // Engine State
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Variation[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusStep[]>(INITIAL_STEPS);
  const [progressMsg, setProgressMsg] = useState('');
  const [engine, setEngine] = useState('nanobanana-2.0');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [completion, setCompletion] = useState<CompletionSummary | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPrompts = async () => {
    setLoadingLibrary(true);
    try {
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
                      authorName: data.authorName || user.displayName || 'Architect',
                      createdAt: parseDate(data.createdAt),
                      updatedAt: parseDate(data.updatedAt || data.createdAt)
                  } as Prompt;
              });
      }
      const filteredPersonal = personal;
      const filteredMaster = masterRes;

      setPrompts(filteredMaster.length > 0 ? [...filteredPersonal, ...filteredMaster] : [...filteredPersonal, ...FALLBACK_PROMPTS]);

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
                description: data.description || '',
                authorName: data.authorName || 'Ecosystem Architect',
                isExemplar: true,
                promptSetID: data.promptSetID || data.entryId || doc.id,
                createdAt: parseDate(data.createdAt || data.timestamp),
                updatedAt: parseDate(data.updatedAt || data.createdAt || data.timestamp)
            } as Prompt;
        });
        setExemplars(toolRes.length > 0 ? toolRes : FALLBACK_EXEMPLARS);
      } catch (toolErr) {
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
      const newVars: Record<string, { value: string, default: string }> = {};
      foundKeys.forEach(k => {
        if (k in prev) newVars[k] = prev[k];
      });
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

  const handleSetHero = (img: Variation) => {
      if (!selectedPrompt) return;
      
      const variationVars = img.variables || {};
      const hasMetadata = Object.keys(variationVars).length > 0;
      
      // 1. Prepare Architectural State (Fallback to literal prompt for legacy nodes)
      let finalTemplate = img.template || (hasMetadata ? (selectedPrompt.template || (selectedPrompt.prompts && selectedPrompt.prompts[0])) : img.prompt) || '';
      
      const nextVars: Record<string, { value: string, default: string }> = {};
      
      // 2. Perform Architectural Default Baking (if metadata exists)
      if (hasMetadata) {
          Object.entries(variationVars).forEach(([key, varData]) => {
              const valToBake = typeof varData === 'object' ? (varData.value || varData.default) : varData;
              
              if (valToBake && valToBake !== '<undefined>') {
                  const regex = new RegExp(`{{${key}(?::.*?)?}}`, 'g');
                  finalTemplate = finalTemplate.replace(regex, `{{${key}:${valToBake}}}`);
                  nextVars[key] = { value: valToBake, default: valToBake };
              } else if (typeof varData === 'object') {
                  nextVars[key] = varData as { value: string, default: string };
              }
          });
      }

      // 3. Sync visual identity and update local architectural state
      setSelectedPrompt({ 
          ...selectedPrompt, 
          thumbnailUrl: img.url,
          template: finalTemplate,
          prompts: [finalTemplate]
      });
      
      setRawTemplate(finalTemplate);
      // Determine if we need to completely overwrite variables (for legacy raw prompts) or merge
      setVariables(prev => hasMetadata ? ({ ...prev, ...nextVars }) : nextVars);
      setSaveStatus('idle');
      setActiveDetailTab('architect'); // Force UI switch so user sees the sync
  };

  const handleSelect = async (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setGeneratedImages([]);
    setVariables({});
    const template = prompt.prompts?.[0] || prompt.template || '';
    setRawTemplate(template);
    extractVariables(template);
    setIsEditingBlueprint(false);
    setActiveDetailTab('architect');
    setLastCommittedPrompt(template);

    const lineageID = prompt.promptSetID || prompt.id;
    if (lineageID && user) {
        try {
            const q = query(
                collection(toolDb, 'users', user.uid, 'images'),
                where('promptSetID', '==', lineageID)
            );
            const snaps = await getDocs(q);
            if (!snaps.empty) {
                const fetchedVariations = snaps.docs.map(doc => {
                    const data = doc.data();
                    const createdAt = data.createdAt?.toMillis() || data.timestamp || 0;
                    return {
                        id: doc.id,
                        url: data.imageUrl || data.url,
                        title: data.title || prompt.title,
                        prompt: data.prompt,
                        uid: data.userId || data.uid,
                        isOriginal: data.isOriginal || false,
                        variables: data.variables || {},
                        template: data.template || '',
                        createdAt
                    };
                }).filter(v => v.url)
                  .sort((a, b) => b.createdAt - a.createdAt);

                setGeneratedImages(fetchedVariations);
            } else {
                setGeneratedImages([]);
            }
        } catch (err) {
            console.error("Hydrating PromptTool variations failed:", err);
        }
    }
  };

  const commitSelection = (url: string | null, title: string | undefined, newPrompt: string, vars?: Record<string, { value: string, default: string }>) => {
      setVariables(vars || {});
      setRawTemplate(newPrompt);
      extractVariables(newPrompt);
      if (url && selectedPrompt) {
          setSelectedPrompt(prev => prev ? { ...prev, thumbnailUrl: url, title: title || prev.title } : null);
      }
      setLastCommittedPrompt(newPrompt);
      setActiveDetailTab('architect');
  };

  const handleAssetSelection = (url: string | null, title: string | undefined, newPrompt: string | undefined, vars?: Record<string, { value: string, default: string }>) => {
    if (!newPrompt) {
        setPreviewImageUrl(url);
        setPreviewTitle(title || '<no title>');
        return;
    }

    const updatedRaw = getCleanPrompt();
    const hasChanges = updatedRaw !== lastCommittedPrompt;

    if (hasChanges) {
        setConfirmModal({
            isOpen: true,
            title: 'Unsaved Architecture Changes',
            message: 'Your current prompt overrides have not been registered to the ecosystem. Resolving conflict...',
            isDanger: true,
            onConfirm: () => {},
            customButtons: [
                {
                    label: 'Sync & Load',
                    onClick: async () => {
                        await saveBlueprint(false);
                        commitSelection(url, title, newPrompt, vars);
                        setConfirmModal(null);
                    },
                    className: "col-span-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
                },
                {
                    label: 'Sync & Exit',
                    onClick: async () => {
                        await saveBlueprint(false);
                        setSelectedPrompt(null);
                        setConfirmModal(null);
                    },
                    className: "col-span-1 py-3 px-6 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all"
                },
                {
                    label: 'Discard & Load',
                    onClick: () => {
                        commitSelection(url, title, newPrompt, vars);
                        setConfirmModal(null);
                    },
                    className: "col-span-1 py-3 px-6 rounded-xl border border-rose-500/20 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-all"
                },
                {
                    label: 'Abort & Return',
                    onClick: () => setConfirmModal(null),
                    className: "col-span-1 py-3 px-6 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/10 hover:text-white/40 hover:bg-white/5 transition-all"
                }
            ]
        });
    } else {
        commitSelection(url, title, newPrompt, vars);
    }
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

  const saveBlueprint = async (asNew: boolean = true): Promise<string | null> => {
    if (!user || !selectedPrompt) return null;
    if (!selectedPrompt.title?.trim()) {
        const suggestion = suggestTitle(resultantPrompt);
        return new Promise((resolve) => {
          setConfirmModal({
            isOpen: true,
            title: 'Identity Missing',
            message: `This architecture is currently un-named. Our neural analyzer suggests "${suggestion}". Deploy with this identity?`,
            customButtons: [
                {
                    label: `Sync as ${suggestion}`,
                    onClick: () => {
                        const updated = { ...selectedPrompt, title: suggestion };
                        setSelectedPrompt(updated);
                        setConfirmModal(null);
                        setTimeout(async () => {
                            const clean = await doSave(asNew, updated);
                            resolve(clean);
                        }, 10);
                    },
                    className: "col-span-2 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
                },
                {
                    label: 'Abort Initialization',
                    onClick: () => { setConfirmModal(null); resolve(null); },
                    className: "col-span-2 mt-2 py-3 px-6 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/10 hover:text-white/40 hover:bg-white/5 transition-all"
                }
            ]
          });
        });
    }
    return await doSave(asNew, selectedPrompt);
  };

  const doSave = async (asNew: boolean, promptToSave: Prompt): Promise<string | null> => {
    if (!user || !promptToSave) return null;
    
    const updatedRawTemplate = getCleanPrompt();
    setRawTemplate(updatedRawTemplate);
    
    setSaving(true);
    setSaveStatus('saving');
    try {
        const isAdmin = profile?.role === 'admin' || profile?.role === 'su';
        const forceAsNew = asNew || (!selectedPrompt?.isPersonal && !isAdmin);
        const isActuallyNew = forceAsNew || !selectedPrompt?.id;

        const blueprintData = {
            title: isActuallyNew && !promptToSave.title.includes('(Custom)') 
                ? `${promptToSave.title} (Custom)` 
                : promptToSave.title,
            description: promptToSave.description || '',
            prompts: [updatedRawTemplate],
            thumbnailUrl: promptToSave.thumbnailUrl || '',
            promptSetID: promptToSave.promptSetID || promptToSave.id || null,
            uid: user.uid,
            updatedAt: serverTimestamp(),
        };

        if (isActuallyNew) {
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
            setLastCommittedPrompt(updatedRawTemplate);
        } else if (selectedPrompt?.isPersonal) {
            await setDoc(doc(db, 'blueprints', selectedPrompt.id), blueprintData, { merge: true });
            setSelectedPrompt(prev => prev ? { ...prev, ...blueprintData, updatedAt: Date.now() } : null);
            setLastCommittedPrompt(updatedRawTemplate);
        } else if (isAdmin) {
            await setDoc(doc(resourcesDb, 'resources', selectedPrompt.id), {
                ...blueprintData,
                updatedAt: serverTimestamp()
            }, { merge: true });
            setSelectedPrompt(prev => prev ? { ...prev, ...blueprintData, updatedAt: Date.now() } : null);
            setLastCommittedPrompt(updatedRawTemplate);
        }
        await fetchPrompts();
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
        return updatedRawTemplate;
    } catch (err: any) {
        setError("Failed to persist blueprint: " + err.message);
        setSaveStatus('error');
        return null;
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
        title: 'Confirm Purge',
        message: `This will permanently decommissioning "${promptToDelete.title}" from the ${isPersonal ? 'registry' : 'ecosystem'}. This action is irreversible.`,
        isDanger: true,
        customButtons: [
            {
                label: 'Confirm Decommission',
                onClick: async () => {
                    setSaving(true);
                    try {
                        if (isPersonal) {
                            await deleteDoc(doc(db, 'blueprints', promptToDelete.id));
                            try {
                                const imagesRef = collection(toolDb, 'users', user.uid, 'images');
                                const qById = query(imagesRef, where('promptSetID', '==', promptToDelete.id));
                                const snapById = await getDocs(qById);
                                const qByUrl = query(imagesRef, where('imageUrl', '==', promptToDelete.thumbnailUrl));
                                const snapByUrl = await getDocs(qByUrl);
                                const allDocs = [...snapById.docs, ...snapByUrl.docs];
                                const uniqueRefs = Array.from(new Set(allDocs.map(d => d.id))).map(id => allDocs.find(d => d.id === id)!.ref);
                                await Promise.all(uniqueRefs.map(ref => deleteDoc(ref)));
                            } catch (imgErr) {
                                console.error("Ecosystem Sync Failure: Failed to purge linked gallery nodes:", imgErr);
                            }
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
                },
                className: "col-span-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
            },
            {
                label: 'Cancel Operation',
                onClick: () => setConfirmModal(null),
                className: "col-span-1 py-3 px-6 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all"
            }
        ]
    });
  };



  const handleClone = async (p: Prompt, confirmedTitle?: string) => {
    if (!user) return;
    const template = p.prompts?.[0] || p.template || '';
    const baseTitle = confirmedTitle || p.title;
    if (!confirmedTitle) {
        const existing = prompts.filter(bp => bp.title.toLowerCase().startsWith(p.title.toLowerCase()));
        if (existing.length > 0) {
            const version = existing.length + 1;
            const suggestedTitle = `${p.title} (v${version})`;
            setConfirmModal({
                isOpen: true,
                title: 'Identity Collision',
                message: `An architecture with a similar identity exists. Protocol suggests: "${suggestedTitle}".`,
                customButtons: [
                    {
                        label: `Register as ${suggestedTitle}`,
                        onClick: () => { handleClone(p, suggestedTitle); setConfirmModal(null); },
                        className: "col-span-2 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
                    },
                    {
                        label: 'Force Duplicate',
                        onClick: () => { handleClone(p, p.title); setConfirmModal(null); },
                        className: "col-span-1 py-3 px-6 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all text-center"
                    },
                    {
                        label: 'Abort Operation',
                        onClick: () => setConfirmModal(null),
                        className: "col-span-1 py-3 px-6 rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white/40 hover:bg-white/5 transition-all text-center"
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
    const bakedTemplate = getCleanPrompt();
    setRawTemplate(bakedTemplate);
    if (selectedPrompt && !selectedPrompt.isExemplar) {
        doSave(false, { ...selectedPrompt, template: bakedTemplate });
    }
    const finalPrompt = bakedTemplate;
    let activePromptSetID = selectedPrompt?.promptSetID || selectedPrompt?.id;
    if (isNewImageSet) {
        activePromptSetID = crypto.randomUUID();
        setIsNewImageSet(false);
        if (selectedPrompt) {
            setSelectedPrompt({ ...selectedPrompt, promptSetID: activePromptSetID });
        }
    }
    setSaving(true);
    setError(null);
    startTimeRef.current = Date.now();
    abortControllerRef.current = new AbortController();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    try {
        setGenerating(true);
        setStatus(INITIAL_STEPS);
        const idToken = await user.getIdToken();
        const generationVariables = { ...variables };
        await triggerGeneration(
          finalPrompt, 
          user.uid, 
          idToken, 
          (event: GenerationProgress) => {
             if (event.type === 'progress') {
                const currentIdx = INITIAL_STEPS.findIndex(s => s.id === (event.message?.toLowerCase() || ''));
                if (currentIdx !== -1) {
                  setStatus(prev => prev.map((s, i) => ({
                    ...s,
                    status: i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'waiting'
                  })));
                }
                setProgressMsg(event.message || 'Processing Neural Request...');
             }
             if (event.type === 'image_ready') {
                  const imageUrl = event.image?.url || event.image?.imageUrl;
                  const imageTitle = (event as any).title || selectedPrompt?.title || 'Generated Variation';
                  const promptUsed = event.message || finalPrompt; 
                  if (imageUrl) {
                       setGeneratedImages(prev => [{ url: imageUrl, title: imageTitle, prompt: promptUsed, uid: user.uid, isOriginal: false }, ...prev]);
                  }
             }
             if (event.type === 'complete') {
                setStatus(prev => prev.map(s => ({ ...s, status: 'done' })));
                setProgressMsg('Evolution Complete');
                if (event.image?.url || event.image?.imageUrl) {
                  setCompletion({
                    imageUrl: event.image?.url || event.image?.imageUrl,
                    elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000)
                  });
                }
                setTimeout(() => { setGenerating(false); }, 500);
             }
             if (event.type === 'error') {
               if (event.error?.includes('abort')) {
                 setError(null);
               } else {
                 setError(event.error || 'Generation failed at the ecosystem core.');
               }
               setGenerating(false);
               if (timerRef.current) clearInterval(timerRef.current);
             }
          },
          selectedPrompt?.title || 'New Variation',
          activePromptSetID,
          generationVariables,
          getCleanPrompt(),
          abortControllerRef.current.signal
        );
    } catch (err: any) {
      setError(err.message);
      if (timerRef.current) clearInterval(timerRef.current);
      setGenerating(false);
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        setGenerating(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setProgressMsg('Operation Aborted');
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

  const handleViewVariation = async (image: any) => {
    const psid = image.promptSetID;
    if (!psid) {
       setError("This variation is not linked to a blueprint lineage.");
       return;
    }
    let p = prompts.find(x => x.promptSetID === psid || x.id === psid);
    let tab: 'blueprints' | 'exemplars' = 'blueprints';
    if (!p) {
      p = exemplars.find(x => x.promptSetID === psid || x.id === psid);
      tab = 'exemplars';
    }
    if (!p) {
       setError("Associated blueprint node not found in the registry.");
       return;
    }
    setActiveTab(tab);
    await handleSelect(p);
    handleAssetSelection(image.imageUrl, image.title, image.prompt);
  };

  const handleViewInGallery = (image: any) => {
    if (image?.promptSetID) {
      setGallerySearchQuery(image.promptSetID);
      setActiveTab('gallery');
    }
  };

  return (
    <div className="w-full space-y-12 pb-24">
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
         <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 pt-0">
               <div className="flex flex-col gap-1">
                  <h2 className="text-[10px] font-black text-indigo-400/40 uppercase tracking-[0.5em] leading-none mb-4">Registry Intelligence Explorer</h2>
                  <div className="flex gap-12">
                    <button 
                      onClick={() => setActiveTab('blueprints')}
                      className={`flex items-center gap-3 pb-4 -mb-[17px] text-[11px] font-black uppercase tracking-[0.4em] transition-all border-b-2 ${activeTab === 'blueprints' ? 'text-indigo-400 border-indigo-500' : 'text-white/20 border-transparent hover:text-white'}`}
                    >
                      <Icons.grid className="w-4 h-4" />
                      Blueprint Registry
                    </button>
                    <button 
                      onClick={() => setActiveTab('exemplars')}
                      className={`flex items-center gap-3 pb-4 -mb-[17px] text-[11px] font-black uppercase tracking-[0.4em] transition-all border-b-2 ${activeTab === 'exemplars' ? 'text-indigo-400 border-indigo-500' : 'text-white/20 border-transparent hover:text-white'}`}
                    >
                      <Icons.history className="w-4 h-4" />
                      Exemplars
                    </button>
                    <button 
                      onClick={() => { setGallerySearchQuery(''); setInitialGalleryAssetId(null); setActiveTab('gallery'); }}
                      className={`flex items-center gap-3 pb-4 -mb-[17px] text-[11px] font-black uppercase tracking-[0.4em] transition-all border-b-2 ${activeTab === 'gallery' ? 'text-indigo-400 border-indigo-500' : 'text-white/20 border-transparent hover:text-white'}`}
                    >
                      <Icons.image className="w-4 h-4" />
                      Personal Gallery
                    </button>
                  </div>
               </div>
            </div>

            {activeTab === 'gallery' ? (
              <div className="pt-6">
                <PromptToolGallery 
                  onViewVariation={handleViewVariation} 
                  initialSearch={gallerySearchQuery}
                  initialAssetId={initialGalleryAssetId}
                />
              </div>
            ) : (
              <div className="space-y-0">
                <div className="flex items-center justify-between py-4 border-b border-white/5 mb-6">
                  <div className="flex items-center gap-8 flex-1">
                      <div className="relative group/search flex-1 max-w-lg">
                          <Icons.search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within/search:text-indigo-400 transition-colors" />
                          <input
                              type="text"
                              placeholder="Search Neural Blueprints..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="bg-black/40 border border-white/5 rounded-2xl pl-16 pr-8 py-3 text-xs text-white placeholder:text-white/10 outline-none w-full focus:border-indigo-500/30 focus:bg-black/60 transition-all shadow-2xl font-medium tracking-wide"
                          />
                      </div>
                  </div>
                  <div className="flex items-center gap-6">
                      <button 
                          onClick={() => fetchPrompts()}
                          disabled={loadingLibrary}
                          className="group flex items-center gap-3 px-6 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Synchronize with Ecosystem Registry"
                      >
                          <Icons.refresh className={`w-3.5 h-3.5 ${loadingLibrary ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
                          Sync Registry
                      </button>

                      <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 shadow-2xl overflow-hidden self-stretch items-center">
                          <button 
                              onClick={() => setViewMode('grid-2')}
                              className={`p-3 rounded-xl transition-all ${viewMode === 'grid-2' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                              title="Detailed Grid (2)"
                          >
                              <Icons.rows className="w-4 h-4" />
                          </button>
                          <button 
                              onClick={() => setViewMode('grid-4')}
                              className={`p-3 rounded-xl transition-all ${viewMode === 'grid-4' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                              title="Standard Grid (4)"
                          >
                              <Icons.grid className="w-4 h-4" />
                          </button>
                          <button 
                              onClick={() => setViewMode('grid-6')}
                              className={`p-3 rounded-xl transition-all ${viewMode === 'grid-6' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                              title="Neural Density (6)"
                          >
                              <Icons.menu className="w-4 h-4 opacity-50" />
                          </button>
                          <button 
                              onClick={() => setViewMode('list')}
                              className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                              title="List View"
                          >
                              <Icons.list className="w-4 h-4" />
                          </button>
                      </div>

                      <div className="relative group">
                          <select
                              value={sortMode}
                              onChange={(e) => setSortMode(e.target.value as any)}
                              className="bg-black/40 text-[10px] font-black uppercase tracking-[0.3em] text-white/60 border border-white/5 rounded-2xl pl-8 pr-12 py-4 outline-none cursor-pointer hover:border-indigo-500/30 hover:text-white transition-all shadow-2xl appearance-none min-w-[220px]"
                          >
                              <option value="newest" className="bg-[#12121a] text-white">Latest Generations</option>
                              <option value="updated" className="bg-[#12121a] text-white">System Updated</option>
                              <option value="oldest" className="bg-[#12121a] text-white">Legacy Archives</option>
                              <option value="az" className="bg-[#12121a] text-white">Matrix Primary (A-Z)</option>
                              <option value="za" className="bg-[#12121a] text-white">Matrix Inverse (Z-A)</option>
                          </select>
                          <Icons.chevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-hover:text-white transition-colors pointer-events-none" />
                      </div>
                  </div>
                </div>

                <section className="relative min-h-[50vh]">
                  {loadingLibrary ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-6 animate-pulse">
                      <div className="w-24 h-24 rounded-[3rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-2xl relative">
                         <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full"></div>
                         <Icons.refresh className="w-10 h-10 text-indigo-400 animate-spin-slow relative" />
                      </div>
                    </div>
                  ) : filteredList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[4rem] bg-black/20 backdrop-blur-3xl animate-fade-in shadow-2xl">
                      <div className="w-24 h-24 rounded-[3rem] bg-white/5 flex items-center justify-center mb-8 border border-white/5">
                         <Icons.database className="w-10 h-10 text-white/10" />
                      </div>
                    </div>
                  ) : (
                    <div className={
                      viewMode === 'grid-2' ? 'grid grid-cols-1 md:grid-cols-2 gap-12' : 
                      viewMode === 'grid-3' ? 'grid grid-cols-1 md:grid-cols-3 gap-10' : 
                      viewMode === 'grid-4' ? 'grid grid-cols-2 md:grid-cols-4 gap-8' : 
                      viewMode === 'grid-5' ? 'grid grid-cols-2 md:grid-cols-5 gap-6' : 
                      viewMode === 'grid-6' ? 'grid grid-cols-3 md:grid-cols-6 gap-4' : 
                      'flex flex-col gap-8'
                    }>
                        {filteredList.map((p, i) => (
                          <div 
                            key={p.id} 
                            onClick={() => handleSelect(p)} 
                            className={`resource-card group hover-glow bg-[#12121a]/60 backdrop-blur-md shadow-2xl cursor-pointer animate-fade-in-up transition-all duration-700 hover:-translate-y-1 overflow-hidden 
                              ${viewMode === 'list' ? 'flex flex-row items-center p-5 rounded-3xl gap-8 border border-white/5' : 'flex flex-col h-full rounded-[2.5rem]'}`}
                            style={{ animationDelay: `${i * 100}ms` }}
                          >
                            {/* Thumbnail Section */}
                            <div className={`relative overflow-hidden shrink-0 bg-black/40 
                              ${viewMode === 'list' ? 'w-24 h-24 rounded-2xl shadow-xl' : 'aspect-square'}`}>
                              <img 
                                src={p.thumbnailUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${p.id}`} 
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                                alt={p.title || 'Inception Blueprint'} 
                              />
                              
                              {/* Badge Overlays (Grid only) */}
                              {viewMode !== 'list' && (viewMode !== 'grid-6') && (
                                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                                  <span className={`px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[8px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                    {p.isExemplar ? 'System Exemplar' : 'Neural Blueprint'}
                                  </span>
                                  <span className="px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[8px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                                    <Icons.zap size={10} />
                                    {Math.round(calculateComplexity(p.template, p.prompts) * 100)}% COMPLEXITY
                                  </span>
                                </div>
                              )}

                              {/* Action Overlays - Hover only */}
                              <div className={`absolute ${viewMode === 'list' ? 'inset-0 flex items-center justify-center' : 'bottom-4 right-4 translate-y-2 group-hover:translate-y-0'} z-10 opacity-0 group-hover:opacity-100 transition-all`}>
                                <div className={`p-3 bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-500/30 backdrop-blur-md rounded-xl shadow-xl transition-all active:scale-95`}>
                                  <Icons.play size={viewMode === 'list' ? 18 : 14} />
                                </div>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className={`${viewMode === 'list' ? 'flex-1 grid grid-cols-12 items-center gap-8' : (viewMode === 'grid-5' || viewMode === 'grid-6') ? 'p-4 space-y-2 flex-grow border-x border-white/5 flex flex-col' : 'p-8 space-y-4 flex-grow border-x border-white/5 flex flex-col'}`}>
                              <div className={`${viewMode === 'list' ? 'col-span-4' : 'flex justify-between items-start gap-4'}`}>
                                <h3 className={`${viewMode === 'list' ? 'text-lg' : (viewMode === 'grid-6') ? 'text-xs' : (viewMode === 'grid-5') ? 'text-sm' : 'text-xl'} font-black text-white group-hover:text-indigo-400 transition-colors line-clamp-1 leading-tight tracking-tight uppercase`}>
                                  {p.title || 'Inception Blueprint'}
                                </h3>
                                {(p.isExemplar && viewMode !== 'list' && viewMode !== 'grid-5' && viewMode !== 'grid-6') && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg shrink-0">
                                    <Icons.sparkles size={10} />
                                    <span className="text-[7px] font-black uppercase tracking-widest leading-none">Featured</span>
                                  </div>
                                )}
                              </div>

                              <div className={`${viewMode === 'list' ? 'col-span-4' : ''}`}>
                                  {(viewMode !== 'grid-6' && viewMode !== 'grid-5') && (
                                      <p className="text-[11px] font-medium text-white/30 line-clamp-2 leading-relaxed uppercase tracking-wider">
                                        {p.description || 'Architectural Vision Protocol established for high-fidelity generation and neural mapping.'}
                                      </p>
                                  )}
                              </div>

                              <div className={`${viewMode === 'list' ? 'col-span-3 flex flex-wrap gap-2 justify-center' : 'flex flex-wrap gap-2 pt-2'}`}>
                                 {p.template && [...p.template.matchAll(VAR_REGEX)].slice(0, viewMode === 'list' ? 2 : (viewMode === 'grid-6') ? 1 : 3).map((match, idx) => (
                                   <span key={idx} className={`px-3 py-1 bg-white/5 border border-white/10 rounded-lg font-black text-white/20 uppercase tracking-widest ${(viewMode === 'grid-6' || viewMode === 'grid-5') ? 'text-[6px]' : 'text-[8px]'}`}>
                                     #{match[1].split(':')[0].toLowerCase()}
                                   </span>
                                 ))}
                              </div>

                              <div className={`${viewMode === 'list' ? 'col-span-1 flex justify-end pr-4' : 'mt-auto pt-6 border-t border-white/5 flex items-center justify-between'}`}>
                                <div className="flex items-center gap-4">
                                  <div className={`rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black ${(viewMode === 'grid-6' || viewMode === 'grid-5') ? 'w-5 h-5 text-[6px]' : 'w-8 h-8 text-[10px]'}`}>
                                    {(p.authorName || 'S')[0].toUpperCase()}
                                  </div>
                                  {(viewMode !== 'grid-6' && viewMode !== 'grid-5') && (
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">Architect</span>
                                        <span className="text-[10px] font-black text-white uppercase tracking-tighter leading-none">{p.authorName || 'Stillwater'}</span>
                                      </div>
                                  )}
                                </div>
                                {viewMode !== 'list' && (viewMode !== 'grid-6' && viewMode !== 'grid-5') && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-indigo-400/40 uppercase tracking-tighter tabular-nums">
                                      {new Date(p.updatedAt || p.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </section>
              </div>
            )}
         </div>
        ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start animate-fade-in-up">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
                <button 
                      onClick={() => { setSelectedPrompt(null); setActiveTab('blueprints'); }} 
                      className="text-[9px] font-black text-white/20 hover:text-white flex items-center gap-2 transition-all px-5 py-2.5 bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl w-fit uppercase tracking-[0.3em] group"
                    >
                      <Icons.close className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" /> Back to Registry
                    </button>
                
                <div className="flex bg-black/40 p-1.5 rounded-[1.5rem] border border-white/5 shadow-2xl backdrop-blur-3xl overflow-hidden">
                   <button 
                     onClick={() => setActiveDetailTab('architect')}
                     className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeDetailTab === 'architect' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                   >
                      <Icons.plus className={`w-3.5 h-3.5 ${activeDetailTab === 'architect' ? 'rotate-45' : ''} transition-transform duration-500`} /> 
                      Architect
                   </button>
                   <button 
                     onClick={() => setActiveDetailTab('media')}
                     className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeDetailTab === 'media' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                   >
                      <Icons.feed className="w-3.5 h-3.5" /> 
                      Media Vault
                   </button>
                </div>
            </div>

                <div className="relative glass-card p-10 space-y-10 bg-[#12121a]/95 border-white/5 shadow-2xl backdrop-blur-3xl rounded-[3rem]">
                   <div className="flex flex-col gap-8 border-b border-white/5 pb-10">
                    <div className="flex flex-col gap-4">
                      <div className="relative group/title w-full">
                         <input 
                             type="text"
                             value={selectedPrompt?.title || ''}
                             onChange={(e) => selectedPrompt && setSelectedPrompt({...selectedPrompt, title: e.target.value})}
                             className="bg-transparent text-3xl font-black text-white outline-none w-full border-b border-white/5 focus:border-indigo-500/50 transition-all pr-24 pb-4 placeholder:text-white/5 tracking-tight"
                             placeholder="Blueprint Designation..."
                         />
                         <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-4">
                             <Icons.edit3 className="w-5 h-5 text-white/10 group-hover/title:text-indigo-400 transition-colors pointer-events-none" />
                         </div>
                      </div>
                      <div className="flex items-center gap-6">
                         <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl">
                            <Icons.database className="w-3.5 h-3.5 text-white/20" />
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Matrix DNA Verified</span>
                         </div>
                      </div>
                    </div>
                  </div>

                  {activeDetailTab === 'architect' ? (
                    <div className="space-y-10 animate-fade-in">
                       <div className="space-y-5">
                           <div className="flex justify-between items-center px-1">
                               <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Neural Blueprint Architecture</label>
                               <div className="flex gap-6">
                                   <button onClick={() => setIsEditingBlueprint(!isEditingBlueprint)} className="text-[10px] font-black text-indigo-400 hover:text-white transition-colors uppercase tracking-[0.3em] font-mono">{isEditingBlueprint ? '[ LOCK MATRIX ]' : '[ EDIT BLUEPRINT ]'}</button>
                               </div>
                           </div>
                          {isEditingBlueprint ? (
                              <textarea 
                                  value={rawTemplate}
                                  onChange={(e) => setRawTemplate(e.target.value)}
                                  className="w-full h-52 bg-black/60 border border-indigo-500/30 rounded-3xl p-8 text-base font-mono text-white transition-all resize-y shadow-2xl outline-none leading-relaxed focus:border-indigo-500"
                                  placeholder="Define your neural matrix here..."
                                  autoFocus
                              />
                          ) : (
                              <div 
                                  className="w-full min-h-[12rem] bg-black/40 border border-white/5 rounded-[2rem] p-8 text-base leading-relaxed text-white/60 font-mono shadow-inner overflow-y-auto cursor-pointer hover:border-indigo-500/20 transition-all group/blueprint"
                                  onClick={() => setIsEditingBlueprint(true)}
                              >
                                  {rawTemplate.split(/({{[^}]+}})/).map((part, i) => {
                                      if (part.startsWith('{{') && part.endsWith('}}')) {
                                          return (
                                              <span key={i} className="text-indigo-400 font-black bg-indigo-500/10 px-3 py-1 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-900/40 inline-block mx-1 my-1 text-sm">
                                                  {part}
                                              </span>
                                          );
                                      }
                                      return part;
                                  })}
                                  <div className="mt-8 pt-6 border-t border-white/5 opacity-0 group-hover/blueprint:opacity-100 transition-opacity">
                                     <span className="text-[10px] font-black text-indigo-400/40 uppercase tracking-[0.4em]">Click to adjust architectural node</span>
                                  </div>
                              </div>
                          )}
                       </div>

                       <div className="space-y-8">
                         <div className="flex items-center gap-4 mb-2">
                            <Icons.sliders className="w-4 h-4 text-indigo-400" />
                            <h4 className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Variable Matrix Parameters</h4>
                         </div>
                         {Object.keys(variables).map((v) => (
                           <div key={v} className="relative group/var space-y-3 bg-white/[0.02] p-6 rounded-2xl border border-white/5 hover:border-indigo-500/20 transition-all">
                              <div className="flex justify-between items-center px-1">
                                  <label className="text-[10px] font-black tracking-[0.3em] text-indigo-400/60 uppercase group-hover/var:text-indigo-400 transition-colors">{v}</label>
                              </div>
                              <div className="relative">
                                  <input 
                                      type="text"
                                      value={variables[v].value}
                                      onChange={(e) => setVariables({...variables, [v]: {...variables[v], value: e.target.value}})}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:border-indigo-500/40 transition-all outline-none placeholder:text-white/5 font-medium"
                                      placeholder={`Define ${v.toLowerCase()}...`}
                                  />
                                  <Icons.edit3 className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 pointer-events-none" />
                             </div>
                           </div>
                         ))}
                       </div>

                        <div className="grid grid-cols-2 gap-4 pt-6">
                           <button 
                             onClick={() => saveBlueprint(false)} 
                             disabled={saving}
                             className={`py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-95 border border-white/10 ${saving ? 'bg-white/5 text-white/20' : 'bg-white text-black hover:scale-[1.02]'}`}
                           >
                              {saving ? <Icons.refresh className="w-4 h-4 animate-spin" /> : <Icons.save className="w-4 h-4" />}
                              {saving ? 'Syncing...' : 'Commit Registry'}
                           </button>
                           <button 
                              onClick={() => saveBlueprint(true)}
                              className="py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4 shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:scale-[1.02] active:scale-95 border border-white/10"
                           >
                              <Icons.plus className="w-4 h-4" /> Clone Node
                           </button>
                        </div>

                        {generatedImages.length > 0 && (
                            <div className="pt-10 border-t border-white/5 space-y-6 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Variations</h4>
                                        <p className="text-[8px] font-black text-white/20 uppercase tracking-widest font-mono">Registry Index: {generatedImages.length} Variation{generatedImages.length !== 1 ? 's' : ''}</p>
                                    </div>
                                    <button 
                                        onClick={() => setActiveDetailTab('media')}
                                        className="text-[9px] font-black text-white/20 hover:text-white uppercase tracking-[0.2em] transition-all flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5 hover:border-white/10 shadow-xl"
                                    >
                                        View Full Vault <Icons.feed className="w-3 h-3 text-indigo-400" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    {generatedImages.slice(0, 7).map((img, idx) => (
                                        <div 
                                            key={idx}
                                            className={`group relative aspect-square rounded-2xl border transition-all duration-500 overflow-hidden cursor-pointer ${previewImageUrl === img.url ? 'border-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.4)] ring-2 ring-indigo-500/20' : 'border-white/5 hover:border-white/20 shadow-xl'}`}
                                            onClick={() => {
                                                setPreviewImageUrl(img.url || null);
                                                setPreviewTitle(img.title || '<no title>');
                                                setPreviewPrompt(img.prompt || null);
                                            }}
                                        >
                                            <img src={img.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                            
                                            {/* Selection Status Indicator */}
                                            {previewImageUrl === img.url && (
                                                <div className="absolute top-3 left-3 z-10 animate-fade-in">
                                                    <div className="bg-indigo-600 rounded-lg p-1.5 border border-indigo-400/50 shadow-lg">
                                                        <Icons.check className="w-3 h-3 text-white" />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4">
                                                <p className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter mb-1">Index #{idx + 1}</p>
                                                <p className="text-[9px] font-bold text-white uppercase tracking-tight truncate leading-none mb-3">{img.title || 'Genetic Variation'}</p>
                                                
                                                {/* Action Button: Set as Hero */}
                                                {selectedPrompt?.thumbnailUrl !== img.url && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSetHero(img);
                                                        }}
                                                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-[8px] font-black uppercase tracking-widest text-white rounded-lg border border-indigo-400/30 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-2xl"
                                                    >
                                                        Set as Hero
                                                    </button>
                                                )}
                                                {selectedPrompt?.thumbnailUrl === img.url && (
                                                    <div className="w-full py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2">
                                                        <Icons.star className="w-2.5 h-2.5 fill-current" /> Blueprint Hero
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {generatedImages.length > 7 ? (
                                        <button 
                                            onClick={() => setActiveDetailTab('media')}
                                            className="aspect-square rounded-2xl border border-dashed border-white/10 hover:border-indigo-500/40 flex flex-col items-center justify-center bg-white/[0.02] hover:bg-indigo-500/10 transition-all group"
                                        >
                                            <span className="text-2xl font-black text-white/10 group-hover:text-indigo-400 transition-colors">+{generatedImages.length - 7}</span>
                                            <span className="text-[8px] font-black text-white/5 uppercase tracking-widest mt-1 group-hover:text-indigo-400/60 transition-colors">Nodes</span>
                                        </button>
                                    ) : (
                                        <div className="aspect-square rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-2 opacity-40 grayscale">
                                            <Icons.camera className="w-4 h-4 text-white/20" />
                                            <span className="text-[7px] font-black text-white/10 uppercase tracking-widest">Awaiting Capture</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                  ) : (
                    <div className="space-y-10 animate-fade-in">
                       <div className="space-y-8">
                          <div className="flex items-center justify-between border-b border-white/5 pb-6">
                             <div className="flex flex-col gap-1">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Media Vault Distribution</h4>
                                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{generatedImages.length} Nodes Registered</p>
                             </div>
                             <div className="flex items-center gap-4">
                                <button
                                  onClick={() => setVariationsViewMode(variationsViewMode === 'list' ? 'grid-3' : 'list')}
                                  className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all shadow-xl"
                                >
                                   {variationsViewMode === 'list' ? <Icons.grid className="w-4 h-4" /> : <Icons.list className="w-4 h-4" />}
                                </button>
                             </div>
                          </div>

                          <div className={variationsViewMode.startsWith('grid') ? "grid grid-cols-3 gap-6" : "space-y-4"}>
                             {generatedImages.map((img, idx) => (
                                <div 
                                  key={idx} 
                                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer ${variationsViewMode.startsWith('grid') ? 'aspect-square' : 'flex items-center gap-6 p-4'} ${previewImageUrl === img.url ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 hover:border-white/20 bg-white/[0.02]'}`}
                                  onClick={() => {
                                      setPreviewImageUrl(img.url || null);
                                      setPreviewTitle(img.title || '<no title>');
                                      setPreviewPrompt(img.prompt || null);
                                  }}
                                >
                                   <div className={variationsViewMode.startsWith('grid') ? "w-full h-full" : "w-16 h-16 shrink-0"}>
                                      <img src={img.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                   </div>
                                   
                                   <div className={`flex flex-col gap-2 ${variationsViewMode.startsWith('grid') ? 'absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent' : 'flex-1 min-w-0'}`}>
                                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Index #{idx + 1}</p>
                                      <h5 className="text-[10px] font-bold text-white uppercase tracking-wider truncate">{img.title || 'Genetic Variation'}</h5>
                                      
                                      <div className="flex items-center gap-2 mt-2">
                                          {selectedPrompt?.thumbnailUrl === img.url ? (
                                              <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-lg">
                                                  <Icons.star className="w-2.5 h-2.5 fill-current" />
                                              </div>
                                          ) : (
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); handleSetHero(img); }}
                                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-[8px] font-black uppercase tracking-widest text-white rounded-lg border border-indigo-400/30 transition-all opacity-0 group-hover:opacity-100"
                                              >
                                                  Set as Hero
                                              </button>
                                          )}
                                      </div>
                                   </div>

                                   <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); window.open(img.url, '_blank'); }}
                                        className="p-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-indigo-600 transition-all shadow-2xl"
                                      >
                                         <Icons.zoomIn className="w-3.5 h-3.5" />
                                      </button>
                                   </div>
                                </div>
                             ))}
                             
                             <div className={`aspect-square rounded-2xl border-2 border-dashed border-white/5 hover:border-indigo-500/30 flex flex-col items-center justify-center gap-3 group transition-all cursor-pointer hover:bg-indigo-500/5 ${variationsViewMode === 'list' ? 'h-16 aspect-auto flex-row px-6' : ''}`}>
                                <Icons.uploadCloud className="w-6 h-6 text-white/10 group-hover:text-indigo-400 transition-all" />
                                <div className="text-center">
                                   <p className="text-[8px] font-black text-white/20 uppercase tracking-widest group-hover:text-white transition-all">Add Node</p>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
          </div>

          <div className="space-y-6 h-full flex flex-col">
            <div className="relative flex-1">
              <div className="absolute -inset-1 bg-indigo-500/20 rounded-[3rem] blur-2xl opacity-40 pointer-events-none"></div>
              <div className="relative glass-card p-10 space-y-10 bg-[#12121a]/95 border-white/5 shadow-2xl backdrop-blur-3xl rounded-[3rem] flex flex-col h-full">
                 
                 <div className="grid grid-cols-[1fr,auto] gap-6 pb-8 border-b border-white/5 relative z-20">
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => saveBlueprint(false)}
                            disabled={saveStatus !== 'idle'}
                            className={`flex items-center justify-center gap-3 px-6 py-4 rounded-xl border transition-all font-black uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95 ${
                                saveStatus === 'success' 
                                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                                : saveStatus === 'saving'
                                ? 'bg-indigo-600/20 border-indigo-500/20 text-indigo-400 animate-pulse'
                                : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 shadow-indigo-600/20'
                            }`}
                        >
                            <Icons.save className={`w-4 h-4 ${saveStatus === 'saving' ? 'animate-spin' : ''}`} />
                            {saveStatus === 'saving' ? 'Syncing...' : saveStatus === 'success' ? 'Saved' : 'Commit'}
                        </button>

                        <button 
                            onClick={() => saveBlueprint(true)}
                            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl border border-white/5 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 shadow-xl"
                        >
                            <Icons.plus className="w-4 h-4" />
                            Clone
                        </button>
                    </div>

                    {(selectedPrompt?.isPersonal || profile?.role === 'admin' || profile?.role === 'su') && (
                        <button 
                            onClick={() => handleDelete()}
                            className="flex items-center justify-center px-6 py-4 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all font-black uppercase tracking-[0.2em] text-[10px] active:scale-95"
                            title="Purge Protocol"
                        >
                            <Icons.delete className="w-4 h-4" />
                        </button>
                    )}
                 </div>

                 <div className="flex flex-wrap items-center gap-4 pb-8 border-b border-white/5">
                     <div className="relative group flex-1">
                        <Icons.zap className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-pulse pointer-events-none z-10" />
                        <select 
                            value={engine}
                            onChange={(e) => setEngine(e.target.value)}
                            className="w-full bg-black/40 text-[10px] font-black text-white uppercase tracking-[0.3em] border border-white/5 rounded-2xl pl-16 pr-12 py-4 outline-none cursor-pointer hover:border-indigo-500/30 transition-all shadow-2xl appearance-none relative z-0"
                        >
                            <option value="vision-0" className="bg-[#12121a] text-white">Visual Engine 1.0 (Standard)</option>
                            <option value="architect-1" className="bg-[#12121a] text-white">Architectural 2.0 (High Precision)</option>
                            <option value="cinematic-3" className="bg-[#12121a] text-white">Cinematic Ultra (Max Fidelity)</option>
                        </select>
                        <Icons.chevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-hover:text-white transition-colors pointer-events-none" />
                     </div>
                    <div className="flex items-center gap-3 px-5 py-3 bg-white/[0.02] rounded-2xl border border-white/5 shadow-inner shrink-0">
                       <Icons.sliders className="w-3.5 h-3.5 text-indigo-400/60" />
                       <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                           {Object.keys(variables).length} Controllers Active
                       </span>
                    </div>
                 </div>

                 <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                   <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                   <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Compiled Vision Instructions</h3>
                 </div>
                 
                 <div className="flex-1 bg-black/40 rounded-[2.5rem] p-8 border border-white/5 shadow-inner overflow-y-auto scrollbar-hide">
                    <p className="text-xl leading-[1.8] text-white/80 font-medium">
                      {resultantPrompt.split(/(__DEF__.*?__DEF__|__VAL__.*?__VAL__)/).map((s, i) => {
                          if (s.startsWith('__DEF__')) return <span key={i} className="text-white/30 italic px-2 py-0.5 bg-white/5 rounded-lg border border-white/5 mx-1 font-mono text-lg">{s.replace(/__DEF__/g, '')}</span>;
                          if (s.startsWith('__VAL__')) return <span key={i} className="text-indigo-400 font-black bg-indigo-500/10 px-3 py-1 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-500/10 mx-1">{s.replace(/__VAL__/g, '')}</span>;
                          return s;
                      })}
                    </p>
                  </div>
  
                  <div className="space-y-6 mt-auto pt-8">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between px-2">
                           <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${isNewImageSet ? 'bg-indigo-600 border-indigo-500' : 'bg-white/5 border-white/20 group-hover:border-indigo-500/50'}`}>
                                {isNewImageSet && <Icons.sparkles className="w-3 h-3 text-white" />}
                              </div>
                              <input type="checkbox" checked={isNewImageSet} onChange={e => setIsNewImageSet(e.target.checked)} className="hidden" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-white transition-colors">Start New Asset Cluster</span>
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
                                   className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 hover:text-white px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 rounded-xl transition-all shadow-xl"
                               >
                                   <Icons.save className="w-3 h-3" />
                                   Sync ID
                               </button>
                           )}
                        </div>
                        <button onClick={handleSubmit} disabled={generating || !user || !resultantPrompt} className={`relative w-full overflow-hidden py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] flex items-center justify-center gap-4 transition-all duration-500 ${generating || !user || !resultantPrompt ? 'opacity-50 cursor-not-allowed bg-white/5 text-white/10' : 'bg-indigo-600 text-white hover:scale-[1.02] active:scale-95 shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:bg-indigo-500 shadow-indigo-600/40'}`}>
                          <span className="relative z-10 flex items-center gap-4">
                            {generating ? <Icons.refresh className="animate-spin w-5 h-5" /> : <Icons.send className="w-5 h-5" />} 
                            {generating ? 'Processing Neuromap...' : 'Initialize Vision'}
                          </span>
                        </button>
                    </div>
                 </div>
              </div>
            </div>

            {(generating || completion) && (
              <div className="relative animate-fade-in-up">
                <div className="absolute -inset-1 bg-indigo-500/20 rounded-[2.5rem] blur-2xl opacity-40 pointer-events-none"></div>
                <div className="relative glass-card p-10 bg-[#12121a]/95 border border-white/5 shadow-2xl rounded-[2.5rem] space-y-8">
                  {generating ? (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between border-b border-white/5 pb-6">
                        <div className="flex items-center gap-4">
                          <Icons.spinner className="w-5 h-5 text-indigo-400 animate-spin" />
                          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Neural Stream Protocol</h3>
                        </div>
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] tabular-nums">{formatElapsed(elapsed)} Elapsed</span>
                      </div>

                      <div className="grid grid-cols-5 gap-4">
                        {status.map((step) => (
                          <div key={step.id} className="flex flex-col gap-3">
                             <div className={`h-1.5 rounded-full transition-all duration-700 ${step.status === 'done' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : step.status === 'active' ? 'bg-indigo-500 animate-pulse' : 'bg-white/5'}`}></div>
                             <div className="flex items-center gap-2 px-1">
                                <StepIcon stepStatus={step.status} />
                                <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${step.status === 'done' ? 'text-emerald-400' : step.status === 'active' ? 'text-white' : 'text-white/10'}`}>{step.label}</span>
                             </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-end px-1">
                           <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-3">
                              <Icons.sparkles className="w-4 h-4 animate-pulse" />
                              {progressMsg || 'Calibrating Data Matrix...'}
                           </p>
                           <span className="text-[10px] font-black text-white/20 uppercase tracking-widest tabular-nums">
                              {Math.round(((status.filter(s => s.status === 'done').length) / status.length) * 100)}%
                           </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                           <div 
                             className="h-full bg-indigo-600 transition-all duration-700 ease-out shadow-[0_0_20px_rgba(79,70,229,0.6)] rounded-full"
                             style={{ width: `${(status.filter(s => s.status === 'done').length / status.length) * 100}%` }}
                           ></div>
                        </div>

                        <div className="pt-8 flex justify-center">
                            <button 
                              onClick={handleCancelGeneration}
                              className="px-8 py-3 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-[0.4em] border border-rose-500/20 transition-all shadow-xl active:scale-95 flex items-center gap-3"
                            >
                                <Icons.close className="w-4 h-4" />
                                Abort Initialization
                            </button>
                        </div>
                       </div>
                     </div>
                  ) : completion && (
                    <div className="space-y-8 animate-in zoom-in-95 duration-700">
                       <div className="flex items-center justify-between border-b border-white/5 pb-6">
                          <div className="flex items-center gap-4">
                             <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse"></div>
                             <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Manifest Render Complete</h3>
                          </div>
                          <span className="text-[10px] font-black text-white/20 uppercase tracking-widest tabular-nums">{completion.elapsed}s Processed</span>
                       </div>

                       <div className="grid grid-cols-2 gap-6">
                           <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-indigo-500/20 transition-all group/stat">
                              <Icons.zap className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Architectural Cost</p>
                              <p className="text-lg font-black text-white">{completion.creditsUsed} Credits</p>
                           </div>
                           <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-indigo-500/20 transition-all group/stat">
                              <Icons.database className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Available Nodes</p>
                              <p className="text-lg font-black text-white tabular-nums">{completion.remainingBalance}</p>
                           </div>
                       </div>

                       <button 
                        onClick={() => {
                          setCompletion(null);
                          setActiveDetailTab('media');
                        }}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all active:scale-95 shadow-xl"
                       >
                          View Gallery Distribution
                       </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {(selectedPrompt?.thumbnailUrl || generatedImages[0]?.url) && (
                <div 
                    className="relative group cursor-zoom-in"
                    onClick={() => { 
                        setPreviewImageUrl(selectedPrompt?.thumbnailUrl || generatedImages[0]?.url); 
                        setPreviewTitle(selectedPrompt?.title || generatedImages[0]?.title || '<no title>'); 
                        setPreviewPrompt(selectedPrompt?.template || generatedImages[0]?.prompt || null);
                    }}
                >
                  <div className="absolute -inset-2 bg-indigo-500/20 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-60 transition-all duration-700 pointer-events-none"></div>
                  <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-black shadow-2xl">
                     <img src={selectedPrompt?.thumbnailUrl || generatedImages[0]?.url} className="w-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="Vision Preview" />
                     
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                         <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 transform scale-75 group-hover:scale-100 transition-all duration-500 shadow-2xl">
                             <Icons.zoomIn className="w-10 h-10 text-white" />
                         </div>
                         <span className="absolute bottom-8 text-[10px] font-black text-white uppercase tracking-[0.4em] opacity-0 group-hover:opacity-100 transition-all duration-700 delay-100">Expand Vision Preview</span>
                     </div>
                  </div>
                </div>
            )}
          </div>
        </section>
      )}

      {/* Image Preview Modal */}
      {previewImageUrl && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-12 backdrop-blur-3xl bg-black/90 animate-fade-in"
          onClick={() => { setPreviewImageUrl(null); setPreviewPrompt(null); }}
        >
           <button 
             onClick={() => { setPreviewImageUrl(null); setPreviewPrompt(null); }}
             className="absolute top-10 right-10 z-[120] p-5 bg-white/5 hover:bg-rose-600 text-white rounded-2xl border border-white/10 transition-all group shadow-2xl"
           >
              <Icons.close className="w-6 h-6 group-hover:scale-110 transition-transform" />
           </button>

           <div 
             className="relative max-w-7xl w-full max-h-[90vh] flex flex-col md:flex-row items-stretch rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(0,0,0,0.9)] border border-white/10 group/modal bg-[#12121a]"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="flex-1 relative flex items-center justify-center bg-black/60 overflow-hidden min-h-[40vh] md:min-h-0">
                  <div className="absolute -inset-20 bg-indigo-600 opacity-10 blur-[120px] animate-pulse pointer-events-none"></div>
                  <img 
                    src={previewImageUrl} 
                    className="relative w-full h-full object-contain z-10 p-4 md:p-12" 
                    alt="Vision Preview" 
                  />
                  
                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 px-10 py-4 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full flex items-center gap-6 opacity-0 group-hover/modal:opacity-100 transition-all duration-700 shadow-2xl">
                     <div className="flex items-center gap-3">
                        <Icons.sparkles className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-black text-white uppercase tracking-[0.2em] whitespace-nowrap">{previewTitle || 'High-Fidelity Neural Output'}</span>
                     </div>
                     <div className="h-4 w-[1px] bg-white/10"></div>
                     <button 
                      onClick={() => window.open(previewImageUrl, '_blank')}
                      className="text-[10px] font-black text-indigo-400 hover:text-white transition-colors uppercase tracking-[0.3em] active:scale-95"
                     >
                        Source Raw Link
                     </button>
                  </div>
              </div>

              {previewPrompt && [...previewPrompt.matchAll(VAR_REGEX)].length > 0 && (
                <div className="w-full md:w-96 bg-[#0f0f15] border-l border-white/5 p-10 flex flex-col gap-8 overflow-y-auto hidden md:flex z-20 scrollbar-hide">
                    <div>
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-3 flex items-center gap-3">
                            <Icons.sliders className="w-5 h-5" />
                            Active Variables
                        </h4>
                        <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest leading-relaxed">Structural parameter values legacy-embedded in this specific generation.</p>
                    </div>
                    <div className="space-y-6">
                        {[...previewPrompt.matchAll(VAR_REGEX)].map((match, idx) => {
                            const parts = match[ match.length > 1 ? 1 : 0].split(':');
                            const key = parts[0];
                            const val = parts.length > 1 ? parts[1] : '<undefined>';
                            return (
                                <div key={idx} className="bg-white/[0.02] border border-white/5 p-6 rounded-[1.5rem] flex flex-col gap-2 hover:border-indigo-500/30 transition-all shadow-inner group/var">
                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] group-hover/var:text-indigo-400 transition-colors">{key}</span>
                                    <span className="text-sm font-medium text-white break-words leading-relaxed">{val}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
              )}
           </div>
        </div>,
        document.body
      )}

        {/* Metrics Status Popup */}
        {viewingMetrics && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
             <div className="absolute inset-0 bg-black/85 backdrop-blur-xl animate-fade-in" onClick={() => setViewingMetrics(null)} />
             <div className="relative w-full max-w-lg glass-card p-12 space-y-10 bg-[#12121a]/95 border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-fade-in-up rounded-[3.5rem]">
                <button 
                  onClick={() => setViewingMetrics(null)}
                  className="absolute top-10 right-10 p-3 text-white/20 hover:text-white transition-colors bg-white/5 rounded-xl border border-white/10"
                >
                  <Icons.close className="w-6 h-6" />
                </button>
                
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em]">Architectural Analysis</p>
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-white leading-tight">{viewingMetrics.title}</h2>
                </div>

                <div className="grid grid-cols-1 gap-8">
                   <div className="p-8 bg-white/[0.03] rounded-[2.5rem] border border-white/5 space-y-6 shadow-inner">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <Icons.stack className="w-6 h-6 text-indigo-400" />
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Blueprint Complexity</span>
                        </div>
                        <span className="text-2xl font-black text-indigo-400">{Math.round(calculateComplexity(viewingMetrics.template, viewingMetrics.prompts) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
                        <div className="h-full bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)]" style={{ width: `${calculateComplexity(viewingMetrics.template, viewingMetrics.prompts) * 100}%` }} />
                      </div>
                      <p className="text-[10px] font-medium text-white/20 leading-relaxed uppercase tracking-[0.2em]">
                        Measures architectural placeholder density. Higher complexity requires precise neural overrides.
                      </p>
                   </div>

                   <div className="p-8 bg-white/[0.03] rounded-[2.5rem] border border-white/5 space-y-6 shadow-inner">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <Icons.refresh className="w-6 h-6 text-emerald-400" />
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Sync Freshness</span>
                        </div>
                        <span className="text-2xl font-black text-emerald-400">{Math.round(calculateFreshness(viewingMetrics.updatedAt) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
                        <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" style={{ width: `${calculateFreshness(viewingMetrics.updatedAt) * 100}%` }} />
                      </div>
                      <p className="text-[10px] font-medium text-white/20 leading-relaxed uppercase tracking-[0.2em]">
                        Data recency score. Last synchronized: {new Date(viewingMetrics.updatedAt || Date.now()).toLocaleDateString()}.
                      </p>
                   </div>

                   <div className="p-8 bg-white/[0.03] rounded-[2.5rem] border border-white/5 space-y-6 shadow-inner">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <Icons.zap className="w-6 h-6 text-indigo-400/40" />
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Ecosystem Usage</span>
                        </div>
                        <span className="text-2xl font-black text-white/60">{Math.round(calculateUsageRating(viewingMetrics.id) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
                        <div className="h-full bg-white/20 rounded-full" style={{ width: `${calculateUsageRating(viewingMetrics.id) * 100}%` }} />
                      </div>
                      <p className="text-[10px] font-medium text-white/20 leading-relaxed uppercase tracking-[0.2em]">
                        Frequency of implementation across the Stillwater cluster.
                      </p>
                   </div>
                </div>

                <button 
                  onClick={() => setViewingMetrics(null)}
                  className="w-full py-5 bg-white text-black text-[11px] font-black uppercase tracking-[0.5em] rounded-[1.5rem] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl"
                >
                  Close Analysis
                </button>
             </div>
          </div>
        )}

        {/* Clone Success Notification */}
        {notification && (
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
        )}
      </div>
  );
};

export default PromptMaster;
