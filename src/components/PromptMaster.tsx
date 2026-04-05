import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, addDoc, serverTimestamp, doc, setDoc, query, where, deleteDoc } from 'firebase/firestore';
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
  Check,
  Trash2,
  Copy
} from 'lucide-react';
import { triggerGeneration, type GenerationProgress } from '../lib/services/prompt-tool';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { RegistryVariations } from './RegistryVariations';
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
  id?: string;         // Firestore document ID for direct deletion
  url: string;
  title?: string;
  prompt?: string;
  variables?: Record<string, { value: string; default: string }>;
  uid?: string;
  isOriginal?: boolean;
}

const parseDate = (val: any): number => {
    if (!val) return Date.now(); // Default to now if missing
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
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
  return Math.max(0.1, 1 - Math.min(ageInDays / 30, 0.9)); // Degrade over 30 days
};

const calculateUsageRating = (id: string) => {
  // Mocking usage rating based on ID hash for persistent "popularity" feel
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return 0.3 + (Math.abs(hash % 70) / 100); // 30% to 100% range
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
  activeTab: 'blueprints' | 'exemplars' | 'gallery';
  setActiveTab: (tab: 'blueprints' | 'exemplars' | 'gallery') => void;
  setConfirmModal: (modal: any) => void;
}

const PromptMaster: React.FC<PromptMasterProps> = ({ 
    activeTab, 
    setActiveTab,
    setConfirmModal
}) => {
  const { user, profile, topUpCredits } = useAuth();
  const { promptId } = useParams();
  
  // Library State
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [exemplars, setExemplars] = useState<Prompt[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [lastCommittedPrompt, setLastCommittedPrompt] = useState<string>('');
  const [viewingMetrics, setViewingMetrics] = useState<Prompt | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gallerySearchQuery, setGallerySearchQuery] = useState('');
  const [initialGalleryAssetId, setInitialGalleryAssetId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'az' | 'za' | 'newest' | 'oldest' | 'updated'>('updated');
  const [viewMode, setViewMode] = useState<'grid-2' | 'grid-3' | 'grid-4' | 'list' | 'extended'>('grid-4');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [rawTemplate, setRawTemplate] = useState('');
  const [variables, setVariables] = useState<Record<string, { value: string, default: string }>>({});
  const [resultantPrompt, setResultantPrompt] = useState('');
  const [isEditingBlueprint, setIsEditingBlueprint] = useState(false);
  
  // Engine State
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedVariationsCount, setLoadedVariationsCount] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<Variation[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusStep[]>(INITIAL_STEPS);
  const [progressMsg, setProgressMsg] = useState('');
  const [engine, setEngine] = useState('nanobanana-2.0');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'architect' | 'media'>('architect');
  const [notification, setNotification] = useState<{ id: string; title: string } | null>(null);
  const [isNewImageSet, setIsNewImageSet] = useState<boolean>(false);
  const [originalSnapshot, setOriginalSnapshot] = useState<{ url: string | null, title: string, prompt: string } | null>(null);
  const [variationsViewMode, setVariationsViewMode] = useState<'list' | 'grid-2' | 'grid-3' | 'grid-4' | 'grid-6' | 'grid-8' | 'extended'>(() => {
    try {
        const saved = window.localStorage.getItem('promptmaster_variationsViewMode');
        return (saved as any) || 'grid-3';
    } catch (e) {
        return 'grid-3';
    }
  });

  useEffect(() => {
    try {
        window.localStorage.setItem('promptmaster_variationsViewMode', variationsViewMode);
    } catch (e) {}
  }, [variationsViewMode]);
  const [isVariationsCollapsed, setIsVariationsCollapsed] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedVariations, setSelectedVariations] = useState<Set<string>>(new Set());

  const VAR_REGEX = /{{(.*?)}}/g;

  // Progress tracking
  const [elapsed, setElapsed] = useState(0);
  const [completion, setCompletion] = useState<CompletionSummary | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
                      authorName: data.authorName || user.displayName || 'Architect',
                      createdAt: parseDate(data.createdAt),
                      updatedAt: parseDate(data.updatedAt || data.createdAt)
                  } as Prompt;
              });
      }
      // 1b. Cleanup "blueprint exemplar" artifacts
      const filteredPersonal = personal.filter(p => !p?.title?.toLowerCase().startsWith('blueprint exemplar'));
      const filteredMaster = masterRes.filter(p => !p?.title?.toLowerCase().startsWith('blueprint exemplar'));
      
      // Auto-delete leaked system-named blueprints from personal collection
      if (user) {
        personal.forEach(async (p) => {
          if (p.title?.toLowerCase().startsWith('blueprint exemplar')) {
             try {
                await deleteDoc(doc(db, 'blueprints', p.id));
                console.log(`Neural Cleanup: Purged artifact node ${p.id} (${p.title})`);
             } catch (e) {
                console.error(`Cleanup Fault: Failed to purge node ${p.id}`, e);
             }
          }
        });
      }

      setPrompts(filteredMaster.length > 0 ? [...filteredPersonal, ...filteredMaster] : [...filteredPersonal, ...FALLBACK_PROMPTS]);

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
    setGeneratedImages([]); // Clear variations on new blueprint selection
    setVariables({}); // Purge old variable inputs to hydrate from new blueprint
    const template = prompt.prompts?.[0] || prompt.template || '';
    setRawTemplate(template);
    extractVariables(template); // Force immediate extraction for UI hydration
    setIsEditingBlueprint(false);
    setActiveDetailTab('architect');
    setLastCommittedPrompt(template);
    setOriginalSnapshot({
        url: prompt.thumbnailUrl || null,
        title: prompt.title,
        prompt: template
    });

    // Cross-Ecosystem Variation Hydration
    const lineageID = prompt.promptSetID || prompt.id;
    if (lineageID && user) {
        try {
            const q = query(
                collection(toolDb, 'users', user.uid, 'images'),
                where('promptSetID', '==', lineageID)
            );
            const snaps = await getDocs(q);
            if (!snaps.empty) {
                // Perform sort in client memory to bypass index requirements
                const fetchedVariations = snaps.docs.map(doc => {
                    const data = doc.data();
                    const createdAt = data.createdAt?.toMillis() || data.timestamp || 0; // handle various schemas
                    return {
                        id: doc.id,                          // Store Firestore doc ID for direct deletion
                        url: data.imageUrl || data.url,      // Handle PromptTool schema nuances
                        title: data.title || prompt.title,   // fallback to blueprint title
                        prompt: data.prompt,
                        uid: data.userId || data.uid,
                        isOriginal: data.isOriginal || false,
                        createdAt
                    };
                }).filter(v => v.url)
                  .sort((a, b) => b.createdAt - a.createdAt); // map and sort descending

                // Set hydration array
                setGeneratedImages(fetchedVariations);
                setLoadedVariationsCount(fetchedVariations.length);
            } else {
                setGeneratedImages([]);
                setLoadedVariationsCount(0);
            }
        } catch (err) {
            console.error("Hydrating PromptTool variations failed:", err);
        }
    }
  };

  const commitSelection = (url: string | null, title: string | undefined, newPrompt: string, vars?: Record<string, { value: string, default: string }>) => {
      setVariables(vars || {}); // Force inputs to reflect loaded defaults
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
            onConfirm: () => {}, // unused due to custom buttons
            customButtons: [
                {
                    label: 'Save & Continue',
                    onClick: async () => {
                        await saveBlueprint(false);
                        commitSelection(url, title, newPrompt, vars);
                        setConfirmModal(null);
                    },
                    className: "col-span-1 py-3 px-6 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg bg-primary/80 hover:bg-primary shadow-primary/20"
                },
                {
                    label: 'Save & Exit',
                    onClick: async () => {
                        await saveBlueprint(false);
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
            title: 'Title Recommendation',
            message: `Your blueprint needs a name. Recommended: "${suggestion}". Would you like to use this?`,
            onConfirm: () => {
                const updated = { ...selectedPrompt, title: suggestion };
                setSelectedPrompt(updated);
                setConfirmModal(null);
                setTimeout(async () => {
                    const clean = await doSave(asNew, updated);
                    resolve(clean);
                }, 10);
            }
          });
        });
    }
    return await doSave(asNew, selectedPrompt);
  };

  const doSave = async (asNew: boolean, promptToSave: Prompt): Promise<string | null> => {
    if (!user || !promptToSave) return null;
    
    // Explicitly commit current variable values as new defaults in the raw template UI
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
        title: 'Confirm Decommissioning',
        message: `This will permanently purge "${promptToDelete.title}" from the ${isPersonal ? 'personal registry' : 'ecosystem node'}. This action is irreversible.`,
        isDanger: true,
        onConfirm: async () => {
            setSaving(true);
            try {
                if (isPersonal) {
                    await deleteDoc(doc(db, 'blueprints', promptToDelete.id));
                    // Synchronize Ecosystem: Purge all linked generation artifacts from 'My Gallery'
                    try {
                        const imagesRef = collection(toolDb, 'users', user.uid, 'images');
                        
                        // Strategy 1: Fast ID targeting
                        const qById = query(imagesRef, where('promptSetID', '==', promptToDelete.id));
                        const snapById = await getDocs(qById);
                        
                        // Strategy 2: URL matching (Legacy fallback for orphaned nodes)
                        const qByUrl = query(imagesRef, where('imageUrl', '==', promptToDelete.thumbnailUrl));
                        const snapByUrl = await getDocs(qByUrl);
                        
                        const allDocs = [...snapById.docs, ...snapByUrl.docs];
                        const uniqueRefs = Array.from(new Set(allDocs.map(d => d.id))).map(id => allDocs.find(d => d.id === id)!.ref);
                        
                        await Promise.all(uniqueRefs.map(ref => deleteDoc(ref)));
                        console.log(`Neural Purge: ${uniqueRefs.length} linked gallery nodes decommissioned.`);
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

  const toggleSelectVariation = (url: string) => {
    setSelectedVariations(prev => {
        const next = new Set(prev);
        if (next.has(url)) next.delete(url);
        else next.add(url);
        return next;
    });
  };

  const selectAllVariations = () => {
    if (selectedVariations.size === generatedImages.length) {
        setSelectedVariations(new Set());
    } else {
        setSelectedVariations(new Set(generatedImages.map(img => img.url)));
    }
  };

  const handleDeleteSelectedVariations = async (targetUrl?: string) => {
    const targets = targetUrl ? new Set([targetUrl]) : selectedVariations;
    if (!selectedPrompt || targets.size === 0) return;
    
    setConfirmModal({
        isOpen: true,
        isDanger: true,
        title: 'Purge Protocol',
        message: `Permanently decommission ${targets.size === 1 ? 'this architectural variation' : `${targets.size} architectural variations`} from the ecosystem history? Resulting node desync is irreversible.`,
        onConfirm: async () => {
             setSaving(true);
             try {
                if (!user) throw new Error('Authentication required');

                // Build a map of url -> Variation so we can look up doc IDs
                const variationsByUrl = new Map(generatedImages.map(img => [img.url, img]));

                const deletePromises: Promise<void>[] = [];
                for (const targetUrl of targets) {
                    const variation = variationsByUrl.get(targetUrl);
                    if (!variation) continue;

                    if (variation.id) {
                        // Fast path: we have the Firestore document ID
                        const docRef = doc(toolDb, 'users', user.uid, 'images', variation.id);
                        deletePromises.push(deleteDoc(docRef));
                    } else {
                        // Fallback: query by imageUrl in the correct subcollection
                        const lineageID = selectedPrompt!.promptSetID || selectedPrompt!.id;
                        const q = query(
                            collection(toolDb, 'users', user.uid, 'images'),
                            where('promptSetID', '==', lineageID),
                            where('imageUrl', '==', targetUrl)
                        );
                        const snap = await getDocs(q);
                        snap.docs.forEach(d => deletePromises.push(deleteDoc(d.ref)));
                    }
                }

                if (deletePromises.length === 0) {
                    throw new Error('No matching variation nodes found in ecosystem. The record may have already been purged.');
                }

                await Promise.all(deletePromises);

                // Update local state
                setGeneratedImages(prev => prev.filter(img => !targets.has(img.url)));
                if (!targetUrl) setSelectedVariations(new Set());
                else setSelectedVariations(prev => {
                    const next = new Set(prev);
                    next.delete(targetUrl);
                    return next;
                });

                setConfirmModal(null);
             } catch (err) {
                console.error('Purge Failed:', err);
                setError(`Lineage purge failed: ${(err as Error).message}`);
             } finally {
                setSaving(false);
             }
        }
    });
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
                    // Synchronize Ecosystem: Purge all linked generation artifacts for this node
                    try {
                        const q = query(collection(toolDb, 'users', user.uid, 'images'), where('promptSetID', '==', item.id));
                        const snap = await getDocs(q);
                        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
                    } catch (e) {}
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

  const alignEcosystem = async () => {
    if (!user || loadingLibrary || saving) return;
    setSaving(true);
    try {
        // Collect all valid IDs from the local and master neural clusters
        const validIds = new Set([
            ...prompts.map(p => p.id),
            ...exemplars.map(p => p.id),
            ...exemplars.map(p => p.promptSetID).filter(Boolean) as string[]
        ]);

        // Scan Gallery for orphaned records
        const imagesSnap = await getDocs(collection(toolDb, 'users', user.uid, 'images'));
        const orphans = imagesSnap.docs.filter(doc => {
            const data = doc.data();
            const setID = data.promptSetID;
            if (!setID) return false; // Loose nodes stay preserved for safety
            return !validIds.has(setID);
        });

        if (orphans.length === 0) {
            setError("Ecosystem Aligned: No orphaned neural nodes detected in the gallery vault.");
        } else {
            await Promise.all(orphans.map(d => deleteDoc(d.ref)));
            setError(`Alignment Success: Purged ${orphans.length} orphaned nodes from your gallery.`);
        }
    } catch (err: any) {
        setError("Alignment Failed: " + err.message);
    } finally {
        setSaving(false);
    }
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
    
    // Lineage Anchor Protocol: Ensure current variable values are committed as new defaults
    const bakedTemplate = getCleanPrompt();
    setRawTemplate(bakedTemplate);
    
    // Silent Save: Persist the architectural baseline to Firestore immediately
    // This ensuring the 'raw' prompt used for this generation is stored as the new blueprint state
    if (selectedPrompt && !selectedPrompt.isExemplar) {
        doSave(false, { ...selectedPrompt, template: bakedTemplate });
    }

    const finalPrompt = bakedTemplate;
    
    let activePromptSetID = selectedPrompt?.promptSetID || selectedPrompt?.id;
    if (isNewImageSet) {
        activePromptSetID = crypto.randomUUID();
        setIsNewImageSet(false); // consume intent
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
                  const imageUrl = event.image?.url || event.image?.imageUrl; // Handle both legacy and unified property names
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
                 setError(null); // Silent cancel
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

    // 1. Find the blueprint/exemplar
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

    // 2. Switch tab and select
    setActiveTab(tab);
    await handleSelect(p);

    // 3. Force variation selection
    handleAssetSelection(image.imageUrl, image.title, image.prompt);
  };

  const handleViewInGallery = (image: any) => {
    if (image?.promptSetID) {
      setGallerySearchQuery(image.promptSetID);
    }
    setInitialGalleryAssetId(image?.id || image?.url || image?.imageUrl || null);
    setActiveTab('gallery');
  };

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
         <div className="space-y-6 animate-fade-in-up">
           <div className="flex items-center justify-between border-b border-white/5 pb-6 pt-2">
             <div className="flex gap-10">
               <button 
                 onClick={() => setActiveTab('blueprints')}
                 className={`flex items-center gap-2.5 pb-6 -mb-[25px] text-[10px] font-black uppercase tracking-[0.25em] transition-all border-b-4 ${activeTab === 'blueprints' ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-white'}`}
               >
                 <LayoutGrid className="w-4 h-4" />
                 Blueprint Library
               </button>
               <button 
                 onClick={() => setActiveTab('exemplars')}
                 className={`flex items-center gap-2.5 pb-6 -mb-[25px] text-[10px] font-black uppercase tracking-[0.25em] transition-all border-b-4 ${activeTab === 'exemplars' ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-white'}`}
               >
                 <History className="w-4 h-4" />
                 Ecosystem Exemplars
               </button>
               <button 
                 onClick={() => { setGallerySearchQuery(''); setInitialGalleryAssetId(null); setActiveTab('gallery'); }}
                 className={`flex items-center gap-2.5 pb-6 -mb-[25px] text-[10px] font-black uppercase tracking-[0.25em] transition-all border-b-4 ${activeTab === 'gallery' ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-white'}`}
               >
                 <GalleryVertical className="w-4 h-4" />
                 My Gallery
               </button>
             </div>
             <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.02] rounded-xl border border-white/5 backdrop-blur-xl">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]"></div>
                <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.15em] whitespace-nowrap">
                  Node: <span className="text-gray-400">{activeTab === 'blueprints' ? 'Master Registry' : activeTab === 'exemplars' ? 'Global Cluster' : 'PromptTool Gallery'}</span>
                </span>
             </div>
           </div>

           {/* ── Gallery Tab View ──────────────────────────────── */}
           {activeTab === 'gallery' && (
             <div className="pt-4">
               <PromptToolGallery 
                 onViewVariation={handleViewVariation} 
                 initialSearch={gallerySearchQuery}
                 initialAssetId={initialGalleryAssetId}
               />
             </div>
           )}

          {activeTab !== 'gallery' && (
            <div className="space-y-0">
              <div className="flex items-center justify-between py-6 border-b border-white/5 pb-10">
            <div className="flex items-center gap-6 flex-1">
                <div className="relative group/search flex-1 max-w-md">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within/search:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search Neural Registry..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-white/[0.03] border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-sm text-white placeholder:text-gray-600 outline-none w-full focus:border-primary/50 focus:bg-white/[0.07] transition-all shadow-inner"
                    />
                </div>
            </div>
            <div className="flex items-center gap-4">
                <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as any)}
                    className="bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border border-white/10 rounded-2xl px-6 py-4 outline-none cursor-pointer hover:border-primary/50 transition-all shadow-inner appearance-none min-w-[180px]"
                >
                    <option value="newest">Recently Generated</option>
                    <option value="updated">Network Updated</option>
                    <option value="oldest">Legacy Oldest</option>
                    <option value="az">Index A-Z</option>
                    <option value="za">Index Z-A</option>
                </select>
                <div className="flex items-center bg-white/[0.02] border border-white/10 rounded-2xl p-1.5 gap-1.5 shadow-2xl backdrop-blur-3xl">
                    <button
                      onClick={alignEcosystem}
                      disabled={saving || loadingLibrary}
                      className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.22em] text-accent hover:bg-accent/10 transition-all flex items-center gap-3 border-r border-white/10 mr-1 group/resync ${saving ? 'animate-pulse' : ''}`}
                      title="Purge Orphaned Gallery Nodes (Desync Alignment)"
                    >
                      <Zap className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : 'group-hover/resync:rotate-12 transition-transform'}`} />
                      {saving ? 'Aligning...' : 'Resync Now'}
                    </button>
                    {activeTab === 'exemplars' && (
                        <button
                          onClick={() => fetchPrompts()}
                          disabled={loadingLibrary}
                          className="px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.22em] text-primary hover:bg-primary/10 transition-all flex items-center gap-3 border-r border-white/10 mr-1 group/sync"
                          title="Retrieve Latest from PromptTool"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingLibrary ? 'animate-spin' : 'group-hover/sync:rotate-180 transition-transform duration-700'}`} />
                          {loadingLibrary ? 'Syncing...' : 'Sync Latest'}
                        </button>
                    )}
                    {selectedItems.size > 0 && (
                        <div className="flex items-center gap-6 px-5 border-r border-white/10 mr-1 animate-fade-in-right">
                           <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{selectedItems.size} Selected</span>
                           <button 
                             onClick={handleBulkDelete}
                             disabled={saving}
                             className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 px-3 py-1.5 rounded-lg ${saving ? 'bg-gray-500/10 text-gray-500 cursor-not-allowed' : 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'}`}
                           >
                             {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                             {saving ? 'Purging...' : 'Purge'}
                           </button>
                        </div>
                    )}
                    <button 
                        onClick={selectAll}
                        className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.22em] transition-all ${selectedItems.size === filteredList.length && filteredList.length > 0 ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                    >
                        {selectedItems.size === filteredList.length && filteredList.length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                    <div className="w-px h-5 bg-white/10 mx-1"></div>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setViewMode('grid-2')} 
                            className={`px-3 py-2.5 rounded-xl text-[9px] font-black transition-all duration-500 ${viewMode === 'grid-2' ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'text-gray-600 hover:text-white hover:bg-white/10'}`}
                            title="Detail Grid"
                        >
                            2C
                        </button>
                        <button 
                            onClick={() => setViewMode('grid-3')} 
                            className={`px-3 py-2.5 rounded-xl text-[9px] font-black transition-all duration-500 ${viewMode === 'grid-3' ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'text-gray-600 hover:text-white hover:bg-white/10'}`}
                            title="Balanced Grid"
                        >
                            3C
                        </button>
                        <button 
                            onClick={() => setViewMode('grid-4')} 
                            className={`px-3 py-2.5 rounded-xl text-[9px] font-black transition-all duration-500 ${viewMode === 'grid-4' ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'text-gray-600 hover:text-white hover:bg-white/10'}`}
                            title="Density Grid"
                        >
                            4C
                        </button>
                        <div className="w-[1px] h-5 bg-white/10 mx-1 self-center" />
                        <button 
                            onClick={() => setViewMode('list')} 
                            className={`p-2.5 rounded-xl transition-all duration-500 ${viewMode === 'list' ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'text-gray-600 hover:text-white hover:bg-white/10'}`}
                            title="List Registry"
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setViewMode('extended')} 
                            className={`p-2.5 rounded-xl transition-all duration-500 ${viewMode === 'extended' ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'text-gray-600 hover:text-white hover:bg-white/10'}`}
                            title="Architectural Expansion"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    </div>
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
              <div className={
                viewMode === 'grid-2' ? "grid grid-cols-1 md:grid-cols-2 gap-10" : 
                viewMode === 'grid-3' ? "grid grid-cols-1 md:grid-cols-3 gap-8" : 
                viewMode === 'grid-4' ? "grid grid-cols-2 md:grid-cols-4 gap-6" : 
                "flex flex-col gap-6"
              }>
                {filteredList.map((p, i) => (
                  <div 
                    key={p.id} 
                    onClick={() => handleSelect(p)} 
                    className={`relative group cursor-pointer flex flex-col h-full animate-fade-in-up opacity-0 ${viewMode.startsWith('grid') ? 'h-full' : ''}`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    {/* Outer Glow Bloom */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-accent/30 rounded-[3rem] blur-2xl opacity-0 group-hover:opacity-40 transition-all duration-700 pointer-events-none"></div>
                    
                    <div className="relative glass-panel p-8 bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-3xl transition-all duration-700 border-white/10 group-hover:border-primary/50 flex-1 flex flex-col justify-between shadow-2xl group-hover:shadow-primary/20 overflow-hidden">
                      
                      {/* Selection Checkbox */}
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSelectItem(p.id); }}
                        className={`absolute top-6 left-6 w-7 h-7 rounded-xl border-2 z-30 flex items-center justify-center transition-all cursor-pointer ${selectedItems.has(p.id) ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'border-white/10 bg-black/20 opacity-0 group-hover:opacity-100 hover:border-white/30'}`}
                      >
                         {selectedItems.has(p.id) && <Check className="w-4 h-4 text-white" />}
                      </div>

                      {/* Header Badge */}
                      <div className="absolute top-6 right-6 z-30 flex items-center gap-2 pointer-events-none">
                        {p.isPersonal && (
                          <div className="px-3 py-1 bg-white/5 backdrop-blur-md text-[8px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg border border-white/10 text-white/60">
                            Local Node
                          </div>
                        )}
                        {p.isExemplar && (
                          <div className="px-3 py-1 bg-primary/20 backdrop-blur-md text-[8px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg border border-primary/40 text-primary animate-pulse">
                            Alpha Exemplar
                          </div>
                        )}
                      </div>

                      {/* Primary Action (Full Reveal Backdrop) */}
                      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700 z-40 flex flex-col items-center justify-center pointer-events-none"></div>
                      
                      <div className="flex flex-col gap-8 transition-opacity duration-300 relative z-50">
                        <div className={`relative shrink-0 overflow-hidden border border-white/5 rounded-3xl bg-black/20 group-hover:border-primary/20 transition-colors shadow-inner flex items-center justify-center p-8 ${viewMode.startsWith('grid') ? 'w-full aspect-square' : 'w-64 h-64'}`}>
                          <img 
                            src={p.thumbnailUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${p.id}`} 
                            className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-1000 grayscale-[40%] group-hover:grayscale-0 filter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" 
                            alt="" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                        <div className="flex-1 min-w-0 w-full space-y-3 relative z-50 pointer-events-none">
                           <div>
                              <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-1 relative z-50">
                                By {p.authorName || (p.isPersonal ? profile?.displayName : 'Ecosystem Architect') || 'Architect'}
                              </p>
                              <h3 className={`font-black uppercase truncate transition-colors leading-tight tracking-tight ${!p.title ? "text-gray-500 italic text-xl" : "text-white group-hover:text-primary text-xl"}`}>
                                {p.title || '<no title>'}
                              </h3>
                              
                              {/* Interaction Nodes below Identity stack */}
                              <div className="flex flex-col items-center gap-3 mt-8 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0 pointer-events-auto">
                                 {p.isExemplar && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleClone(p); }}
                                      className="w-full py-4 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                                    >
                                       <Copy className="w-4 h-4" /> Clone to Library
                                    </button>
                                 )}
                                 
                                 <div className="flex items-center gap-2 w-full">
                                    <div 
                                      onClick={(e) => { e.stopPropagation(); handleSelect(p); }}
                                      className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/10 hover:border-white/20 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] transition-all text-center cursor-pointer active:scale-95"
                                    >
                                       Open Architecture
                                    </div>

                                    {(p.isPersonal || profile?.role === 'admin' || profile?.role === 'su') && (
                                       <button 
                                         onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                                         className="w-14 h-14 flex items-center justify-center bg-black/95 hover:bg-red-500/20 text-white/90 hover:text-red-500 border-2 border-white/40 hover:border-red-500 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,0,0,0.1)] backdrop-blur-2xl rounded-2xl"
                                         title="Purge Protocol"
                                       >
                                          <Trash2 className="w-5 h-5" />
                                       </button>
                                    )}
                                 </div>
                              </div>
                           </div>
                          <div className="group-hover:opacity-0 transition-opacity duration-300 pointer-events-none">
                            <p className={`text-[11px] text-gray-500 font-medium leading-relaxed ${viewMode === 'extended' ? '' : 'line-clamp-2'}`}>{p.description || 'No detailed architecture specification provided.'}</p>
                            
                            {viewMode === 'extended' && p.template && (
                               <div className="mt-6 p-5 bg-black/60 rounded-2xl border border-white/5 relative group-hover:border-primary/20 transition-all overflow-hidden">
                                  <div className="absolute top-0 right-0 px-3 py-1 bg-white/5 text-[7px] font-black uppercase tracking-widest text-white/30 border-l border-b border-white/5 rounded-bl-lg">Blueprint ID</div>
                                  <p className="text-[10px] text-gray-400 font-mono italic leading-relaxed break-words">{p.template}</p>
                               </div>
                            )}
                          </div>
                        </div>
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
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fade-in-up opacity-0">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <button 
                     onClick={async (e) => {
                       e.stopPropagation();
                       const cleaned = getCleanPrompt();
                       const hasTemplateChanges = cleaned !== lastCommittedPrompt;
                       const hasNewGenerations = generatedImages.length > loadedVariationsCount; 
                       
                       if (hasTemplateChanges || hasNewGenerations) {
                         setConfirmModal({
                           isOpen: true,
                           title: 'Unsaved Architectural State',
                           message: hasTemplateChanges 
                             ? 'Your vision overrides haven\'t been registered. Do you want to back out and discard these neural adjustments?'
                             : 'You generated new siblings that haven\'t been committed to the Registry. Back out and discard these nodes?',
                           isDanger: true,
                           customButtons: [
                               {
                                   label: 'Cancel',
                                   onClick: () => {
                                       setConfirmModal(null);
                                   },
                                   className: "col-span-1 py-3 px-6 rounded-xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all"
                               },
                               {
                                   label: 'Discard & Exit',
                                   onClick: () => {
                                       setSelectedPrompt(null);
                                       setActiveTab('blueprints');
                                       setConfirmModal(null);
                                   },
                                   className: "col-span-1 py-3 px-6 rounded-xl border border-red-500/30 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all"
                               },
                               {
                                   label: 'Save & Exit',
                                   onClick: async () => {
                                       await saveBlueprint(false);
                                       setSelectedPrompt(null);
                                       setActiveTab('blueprints');
                                       setConfirmModal(null);
                                   },
                                   className: "col-span-2 py-4 px-6 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg bg-primary/80 hover:bg-primary shadow-primary/20"
                               }
                           ]
                         });
                       } else {
                         setSelectedPrompt(null);
                         setActiveTab('blueprints');
                       }
                     }} 
                     className="text-[9px] font-black text-gray-500 hover:text-white flex items-center gap-2 transition-all px-4 py-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl w-fit uppercase tracking-widest group"
                   >
                     <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" /> Back
                   </button>
               
               <div className="flex bg-white/[0.02] p-1 rounded-2xl border border-white/5 shadow-xl backdrop-blur-2xl overflow-hidden">
                  <button 
                    onClick={() => setActiveDetailTab('architect')}
                    className={`flex items-center gap-2.5 px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeDetailTab === 'architect' ? 'bg-primary text-white shadow-lg shadow-primary/20 border border-white/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                  >
                     <Plus className={`w-3.5 h-3.5 ${activeDetailTab === 'architect' ? 'rotate-45' : ''} transition-transform duration-500`} /> 
                     Architect
                  </button>
                  <button 
                    onClick={() => setActiveDetailTab('media')}
                    className={`flex items-center gap-2.5 px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeDetailTab === 'media' ? 'bg-primary text-white shadow-lg shadow-primary/20 border border-white/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                  >
                     <GalleryVertical className="w-3.5 h-3.5" /> 
                     Media Vault
                  </button>
                  {selectedPrompt?.promptSetID && (
                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                  )}
                  {selectedPrompt?.promptSetID && (
                    <button
                       onClick={() => handleViewInGallery({ promptSetID: selectedPrompt?.promptSetID, url: previewImageUrl })}
                       className="flex items-center gap-2 px-6 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white hover:bg-white/5 transition-all rounded-xl"
                       title="Search in Gallery"
                    >
                      <GalleryVertical className="w-3.5 h-3.5" />
                      Gallery
                    </button>
                  )}
               </div>
            </div>

            <div className="relative group">
               <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 to-accent/20 rounded-[2rem] blur-xl opacity-30 group-hover:opacity-50 transition-all duration-700 pointer-events-none"></div>
               <div className="relative glass-panel p-6 space-y-6 bg-background-secondary/95 border-white/5 shadow-2xl backdrop-blur-3xl">
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
                             <div className="flex flex-col gap-2 px-1">
                                 <label className="text-[10px] font-black tracking-widest text-primary uppercase ml-1 opacity-60">{v}</label>
                                 <div className="flex items-center gap-4">
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
                      <RegistryVariations
                        generatedImages={generatedImages}
                        isVariationsCollapsed={isVariationsCollapsed}
                        selectedVariations={selectedVariations}
                        variationsViewMode={variationsViewMode}
                        originalSnapshot={originalSnapshot}
                        selectedPrompt={selectedPrompt}
                        profile={profile}
                        user={user}
                        setIsVariationsCollapsed={setIsVariationsCollapsed}
                        handleDeleteSelectedVariations={handleDeleteSelectedVariations}
                        selectAllVariations={selectAllVariations}
                        setVariationsViewMode={setVariationsViewMode}
                        handleAssetSelection={handleAssetSelection}
                        setPreviewImageUrl={setPreviewImageUrl}
                        setPreviewTitle={setPreviewTitle}
                        setPreviewPrompt={setPreviewPrompt}
                        handleClone={handleClone as any}
                        toggleSelectVariation={toggleSelectVariation}
                        onViewInGallery={handleViewInGallery}
                      />

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
                                <img src={selectedPrompt.thumbnailUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedPrompt.id}`} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700" alt="" />
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
                                  <img src={img.url} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700" alt="" />
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
                    <div className="flex items-center gap-3 px-4 py-2 bg-[#12121a] rounded-xl border border-white/10 shadow-xl backdrop-blur-md flex-1">
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
                           {profile?.role === 'su' && (
                               <button
                                   onClick={() => topUpCredits(500)}
                                   className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-accent hover:text-white px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg transition-all"
                               >
                                   <Zap className="w-3 h-3" />
                                   Architectural Sync (+500)
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
                           <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest tabular-nums">
                              {Math.round(((status.filter(s => s.status === 'done').length) / status.length) * 100)}%
                           </span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                           <div 
                            className="h-full bg-brand-gradient transition-all duration-500 ease-out shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                            style={{ width: `${(status.filter(s => s.status === 'done').length / status.length) * 100}%` }}
                           ></div>
                        </div>

                        <div className="pt-6 flex justify-center">
                            <button 
                              onClick={handleCancelGeneration}
                              className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border border-red-500/20 transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center gap-3"
                            >
                                <X className="w-3.5 h-3.5" />
                                Cancel Command
                            </button>
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
            
            {(selectedPrompt?.thumbnailUrl || generatedImages[0]?.url) && (
                <div 
                    className="relative group cursor-zoom-in"
                    onClick={() => { 
                        setPreviewImageUrl(selectedPrompt?.thumbnailUrl || generatedImages[0]?.url); 
                        setPreviewTitle(selectedPrompt?.title || generatedImages[0]?.title || '<no title>'); 
                        setPreviewPrompt(selectedPrompt?.template || generatedImages[0]?.prompt || null);
                    }}
                >
                  <div className="absolute -inset-1 bg-brand-gradient rounded-3xl blur opacity-30 group-hover:opacity-50 transition-all duration-500"></div>
                  <img src={selectedPrompt?.thumbnailUrl || generatedImages[0]?.url} className="relative w-full rounded-2xl shadow-2xl border border-white/10 group-hover:scale-[1.01] transition-transform duration-500" alt="Vision Preview" />
                  
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
      {previewImageUrl && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-12 backdrop-blur-3xl bg-black/80 animate-fade-in"
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

              {previewPrompt && [...previewPrompt.matchAll(VAR_REGEX)].length > 0 && (
                <div className="w-full md:w-96 bg-[#1a1b26] border-l border-white/10 p-8 flex flex-col gap-6 overflow-y-auto hidden md:flex z-20">
                    <div>
                        <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                            <Sliders className="w-4 h-4" />
                            Active Variables
                        </h4>
                        <p className="text-xs text-gray-500 max-w-[200px]">Metadata parameter values structurally embedded in this generation.</p>
                    </div>
                    <div className="space-y-4">
                        {[...previewPrompt.matchAll(VAR_REGEX)].map((match, idx) => {
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
        </div>,
        document.body
      )}
        {/* Metrics Status Popup */}
        {viewingMetrics && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
             <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setViewingMetrics(null)} />
             <div className="relative w-full max-w-lg glass-panel p-10 space-y-8 bg-background-secondary/95 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-fade-in-up">
                <button 
                  onClick={() => setViewingMetrics(null)}
                  className="absolute top-6 right-6 p-2 text-white/20 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Architectural Analysis</p>
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-white">{viewingMetrics.title}</h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                   {/* Complexity */}
                   <div className="p-6 bg-white/[0.03] rounded-[2rem] border border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Layers className="w-5 h-5 text-primary" />
                          <span className="text-xs font-black uppercase tracking-widest text-white/50">Prompt Complexity</span>
                        </div>
                        <span className="text-xl font-black text-primary">{Math.round(calculateComplexity(viewingMetrics.template, viewingMetrics.prompts) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${calculateComplexity(viewingMetrics.template, viewingMetrics.prompts) * 100}%` }} />
                      </div>
                      <p className="text-[10px] font-medium text-gray-500 leading-relaxed uppercase tracking-wider">
                        Measures variable density and structural placeholders within the blueprint. High complexity indicates a more versatile template requiring precise overrides.
                      </p>
                   </div>

                   {/* Freshness */}
                   <div className="p-6 bg-white/[0.03] rounded-[2rem] border border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <RefreshCw className="w-5 h-5 text-accent" />
                          <span className="text-xs font-black uppercase tracking-widest text-white/50">Sync Freshness</span>
                        </div>
                        <span className="text-xl font-black text-accent">{Math.round(calculateFreshness(viewingMetrics.updatedAt) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${calculateFreshness(viewingMetrics.updatedAt) * 100}%` }} />
                      </div>
                      <p className="text-[10px] font-medium text-gray-500 leading-relaxed uppercase tracking-wider">
                        Architectural data recency score. Entries older than 30 cycles enter decommissioning status. Last synchronized: {new Date(viewingMetrics.updatedAt || Date.now()).toLocaleDateString()}.
                      </p>
                   </div>

                   {/* Usage */}
                   <div className="p-6 bg-white/[0.03] rounded-[2rem] border border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Zap className="w-5 h-5 text-white/40" />
                          <span className="text-xs font-black uppercase tracking-widest text-white/50">Ecosystem Usage</span>
                        </div>
                        <span className="text-xl font-black text-white/70">{Math.round(calculateUsageRating(viewingMetrics.id) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-white/30" style={{ width: `${calculateUsageRating(viewingMetrics.id) * 100}%` }} />
                      </div>
                      <p className="text-[10px] font-medium text-gray-500 leading-relaxed uppercase tracking-wider">
                        Frequency of architectural implementation across the Stillwater cluster. Higher ratings indicate robust blueprint performance and ecosystem compatibility.
                      </p>
                   </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => setViewingMetrics(null)}
                    className="w-full py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                  >
                    Close Analysis
                  </button>
                </div>
             </div>
          </div>
        )}
        {/* Clone Success Notification */}
        {notification && (
          <div className="fixed bottom-10 right-10 z-[200] max-w-sm animate-in slide-in-from-right-10 duration-500">
             <div className="relative glass-panel p-5 bg-[#1c1c2b]/95 border border-primary/30 shadow-[0_0_40px_rgba(99,102,241,0.2)] rounded-2xl flex flex-col gap-3">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary" />
                   </div>
                   <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Architecture Registered</h4>
                      <p className="text-[9px] text-gray-500 mt-1 uppercase font-bold truncate max-w-[200px]">{notification.title}</p>
                   </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                   <button 
                     onClick={() => { handleViewInGallery({ promptSetID: notification.id }); setNotification(null); }}
                     className="flex-1 py-2 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:scale-[1.02] transition-all"
                   >
                     View in Gallery
                   </button>
                   <button 
                     onClick={() => setNotification(null)}
                     className="px-3 py-2 bg-white/5 text-gray-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
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
