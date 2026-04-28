import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, setDoc, query, where, deleteDoc, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toolDb, registryDb, storage } from '../../lib/firebase';
import { triggerGeneration, type GenerationProgress } from '../../lib/services/prompt-tool';
import { useAuth } from '../../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import type { 
  Prompt, Variation, StatusStep, CompletionSummary, PromptMasterProps, ReferenceImage 
} from './types';
import {
  INITIAL_STEPS, FALLBACK_PROMPTS, parseDate
} from './types';

// ── Context Shape ──────────────────────────────────────────────────

interface PromptMasterContextValue {
  // Auth
  user: any;
  profile: any;

  // Props pass-through
  activeTab: PromptMasterProps['activeTab'];
  setActiveTab: PromptMasterProps['setActiveTab'];
  setConfirmModal: PromptMasterProps['setConfirmModal'];

  // Data
  prompts: Prompt[];
  exemplars: Prompt[];
  loadingLibrary: boolean;
  filteredList: Prompt[];

  // Selection
  selectedPrompt: Prompt | null;
  setSelectedPrompt: React.Dispatch<React.SetStateAction<Prompt | null>>;
  handleSelect: (prompt: Prompt) => Promise<void>;

  // Template editing
  rawTemplate: string;
  setRawTemplate: React.Dispatch<React.SetStateAction<string>>;
  variables: Record<string, { value: string; default: string }>;
  setVariables: React.Dispatch<React.SetStateAction<Record<string, { value: string; default: string }>>>;
  resultantPrompt: string;
  isEditingBlueprint: boolean;
  setIsEditingBlueprint: React.Dispatch<React.SetStateAction<boolean>>;
  activeDetailTab: 'architect' | 'media';
  setActiveDetailTab: React.Dispatch<React.SetStateAction<'architect' | 'media'>>;
  referenceImages: ReferenceImage[];
  setReferenceImages: React.Dispatch<React.SetStateAction<ReferenceImage[]>>;

  // Variations / Gallery
  generatedImages: Variation[];
  setGeneratedImages: React.Dispatch<React.SetStateAction<Variation[]>>;
  selectedVariations: Set<string>;
  setSelectedVariations: React.Dispatch<React.SetStateAction<Set<string>>>;
  variationsViewMode: 'grid-3' | 'list';
  setVariationsViewMode: React.Dispatch<React.SetStateAction<'grid-3' | 'list'>>;

  // ...
  toggleSelectVariation: (url: string) => void;
  selectAllVariations: () => void;
  handleDeleteSelectedVariations: (url?: string) => Promise<void>;

  // Search & View
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  gallerySearchQuery: string;
  setGallerySearchQuery: React.Dispatch<React.SetStateAction<string>>;
  initialGalleryAssetId: string | null;
  setInitialGalleryAssetId: React.Dispatch<React.SetStateAction<string | null>>;
  sortMode: 'az' | 'za' | 'newest' | 'oldest' | 'updated';
  setSortMode: React.Dispatch<React.SetStateAction<'az' | 'za' | 'newest' | 'oldest' | 'updated'>>;
  viewMode: 'grid-2' | 'grid-3' | 'grid-4' | 'grid-5' | 'grid-6' | 'list';
  setViewMode: React.Dispatch<React.SetStateAction<'grid-2' | 'grid-3' | 'grid-4' | 'grid-5' | 'grid-6' | 'list'>>;

  // Engine / Generation
  engine: string;
  setEngine: React.Dispatch<React.SetStateAction<string>>;
  quality: 'standard' | 'high' | 'ultra';
  setQuality: React.Dispatch<React.SetStateAction<'standard' | 'high' | 'ultra'>>;
  generating: boolean;
  saving: boolean;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  status: StatusStep[];
  progressMsg: string;
  elapsed: number;
  completion: CompletionSummary | null;
  setCompletion: React.Dispatch<React.SetStateAction<CompletionSummary | null>>;
  isNewImageSet: boolean;
  setIsNewImageSet: React.Dispatch<React.SetStateAction<boolean>>;
  originalSnapshot: Variation | null;
  setOriginalSnapshot: React.Dispatch<React.SetStateAction<Variation | null>>;

  // Preview
  previewImageUrl: string | null;
  setPreviewImageUrl: React.Dispatch<React.SetStateAction<string | null>>;
  previewTitle: string | null;
  setPreviewTitle: React.Dispatch<React.SetStateAction<string | null>>;
  previewPrompt: string | null;
  setPreviewPrompt: React.Dispatch<React.SetStateAction<string | null>>;

  // Metrics
  viewingMetrics: Prompt | null;
  setViewingMetrics: React.Dispatch<React.SetStateAction<Prompt | null>>;

  // Notification
  notification: { id: string; title: string } | null;
  setNotification: React.Dispatch<React.SetStateAction<{ id: string; title: string } | null>>;

  // Actions
  handleSubmit: () => Promise<void>;
  handleCancelGeneration: () => void;
  saveBlueprint: (asNew?: boolean) => Promise<string | null>;
  handleDelete: (targetPrompt?: Prompt) => void;
  handleClone: (p: Prompt, confirmedTitle?: string, compiledPrompt?: string) => Promise<void>;
  handleSetHero: (img: Variation) => void;
  handleAssetSelection: (url: string | null, title: string | undefined, newPrompt: string | undefined, vars?: Record<string, { value: string; default: string }>) => void;
  handleViewVariation: (image: any) => Promise<void>;
  handleViewInGallery: (image: any) => void;
  getCleanPrompt: () => string;
  fetchPrompts: () => Promise<void>;
  uploadReferenceImage: (file: File) => Promise<void>;
  addReferenceImage: (img: ReferenceImage) => void;
  removeReferenceImage: (url: string) => void;
}

const PromptMasterContext = createContext<PromptMasterContextValue | null>(null);

export const usePromptMaster = () => {
  const ctx = useContext(PromptMasterContext);
  if (!ctx) throw new Error('usePromptMaster must be used inside PromptMasterProvider');
  return ctx;
};

// ── Provider ───────────────────────────────────────────────────────

export const PromptMasterProvider: React.FC<PromptMasterProps & { children: React.ReactNode }> = ({
  activeTab, setActiveTab, tabVersion, setConfirmModal, children,
}) => {
  const { user, profile } = useAuth();
  const { promptId } = useParams();

  // ── State ────────────────────────────────────────────────────────
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
  const [selectedVariations, setSelectedVariations] = useState<Set<string>>(new Set());
  const [generatedImages, setGeneratedImages] = useState<Variation[]>([]);
  const [rawTemplate, setRawTemplate] = useState('');
  const [variables, setVariables] = useState<Record<string, { value: string; default: string }>>({});
  const [resultantPrompt, setResultantPrompt] = useState('');
  const [isEditingBlueprint, setIsEditingBlueprint] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'architect' | 'media'>( 'architect');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [notification, setNotification] = useState<{ id: string; title: string } | null>(null);
  const [isNewImageSet, setIsNewImageSet] = useState(false);
  const [originalSnapshot, setOriginalSnapshot] = useState<Variation | null>(null);

  // Engine State
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusStep[]>(INITIAL_STEPS);
  const [progressMsg, setProgressMsg] = useState('');
  const [engine, setEngine] = useState('vision-0');
  const [quality, setQuality] = useState<'standard' | 'high' | 'ultra'>('standard');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [completion, setCompletion] = useState<CompletionSummary | null>(null);

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      if (prevTabRef.current === 'gallery') {
        setGallerySearchQuery('');
      }
      prevTabRef.current = activeTab;
    }
  }, [activeTab]);

  // ── Data Fetching ────────────────────────────────────────────────

  const fetchPrompts = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      let personal: Prompt[] = [];
      if (user) {
        // Now fetching from the SHARED ecosystem registry (prompttool-db-0)
        const personalSnap = await getDocs(collection(registryDb, 'blueprints'));
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
              updatedAt: parseDate(data.updatedAt || data.createdAt),
            } as Prompt;
          });
      }
      setPrompts(personal.length > 0 ? personal : FALLBACK_PROMPTS);

      try {
        // Exemplars (leagueEntries) also reside in the SHARED registry
        const toolSnap = await getDocs(collection(registryDb, 'leagueEntries'));
        const toolRes = toolSnap.docs.map(d => {
          const data = d.data();
          const legacyTitle = data.prompt?.slice(0, 50).trim() + (data.prompt?.length > 50 ? '...' : '');
          return {
            id: d.id,
            title: data.title || legacyTitle || 'Untitled Exemplar',
            template: data.prompt,
            prompts: [data.prompt],
            thumbnailUrl: data.imageUrl,
            description: data.description || '',
            authorName: data.authorName || 'Ecosystem Architect',
            isExemplar: true,
            promptSetID: data.promptSetID || data.entryId || d.id,
            createdAt: parseDate(data.createdAt || data.timestamp),
            updatedAt: parseDate(data.updatedAt || data.createdAt || data.timestamp),
          } as Prompt;
        });
        setExemplars(toolRes);
      } catch {
        setExemplars([]);
      }
    } catch {
      setPrompts(FALLBACK_PROMPTS);
    } finally {
      setLoadingLibrary(false);
    }
  }, [user]);

  useEffect(() => { fetchPrompts(); }, [fetchPrompts]);

  // ── Template Processing ──────────────────────────────────────────

  const extractVariables = useCallback((template: string) => {
    const regex = /{{(.*?)}}/g;
    const matches = [...template.matchAll(regex)];
    const foundTags = matches.map(m => {
      const parts = m[1].split(':');
      return { key: parts[0], default: parts.length > 1 ? parts[1] : '<undefined>' };
    });
    const foundKeys = foundTags.map(t => t.key);

    setVariables(prev => {
      const newVars: Record<string, { value: string; default: string }> = {};
      foundKeys.forEach(k => { if (k in prev) newVars[k] = prev[k]; });
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
  }, []);

  useEffect(() => { if (rawTemplate) extractVariables(rawTemplate); }, [rawTemplate, extractVariables]);

  useEffect(() => {
    if (!selectedPrompt) return;
    
    // Neural Compilation: Real-time Vision Instructions
    const refCount = referenceImages.length;
    const refIndicator = refCount > 0 
        ? `\n\n[REFERENCE MATERIALS ATTACHED: ${referenceImages.map(r => r.title || 'Untitled').join(', ')}]`
        : `\n\n[NO REFERENCE MATERIALS ATTACHED]`;

    let result = rawTemplate || '';
    Object.entries(variables).forEach(([key, data]) => {
      const isActuallyDefault = !data.value || data.value === data.default || data.default === '<undefined>';
      const displayValue = data.value || data.default || `[${key}]`;
      const wrapped = isActuallyDefault ? `__DEF__${displayValue}__DEF__` : `__VAL__${displayValue}__VAL__`;
      result = result.replace(new RegExp(`{{${key}(?::.*?)?}}`, 'g'), wrapped);
    });
    
    setResultantPrompt(result + refIndicator);
  }, [variables, selectedPrompt, rawTemplate, referenceImages]);

  const getCleanPrompt = useCallback(() => {
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
  }, [rawTemplate, variables]);

  // ── URL param auto-select ────────────────────────────────────────

  useEffect(() => {
    if (promptId && prompts.length > 0) {
      const p = prompts.find(x => x.id === promptId);
      if (p) handleSelect(p);
    }
  }, [promptId, prompts]);

  // ── Tab Sync ───────────────────────────────────────────────────

  useEffect(() => {
    // Clear selection on tab change OR click version increment
    setSelectedPrompt(null);
    if (activeTab === 'gallery') {
      setGallerySearchQuery('');
    }
    prevTabRef.current = activeTab;
  }, [activeTab, tabVersion]);

  // ── Variations Management ───────────────────────────────────────

  const toggleSelectVariation = useCallback((url: string) => {
    setSelectedVariations(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const selectAllVariations = useCallback(() => {
    setSelectedVariations(prev => {
      if (prev.size === generatedImages.length) return new Set();
      return new Set(generatedImages.map(img => img.url));
    });
  }, [generatedImages]);

  const handleDeleteSelectedVariations = useCallback(async (targetUrl?: string) => {
    if (!user) return;
    const urlsToDelete = targetUrl ? [targetUrl] : Array.from(selectedVariations);
    if (urlsToDelete.length === 0) return;

    setConfirmModal({
        isOpen: true,
        title: 'Purge Matrix Nodes',
        message: `This will permanently decommission ${urlsToDelete.length} variations from the ecosystem registry. Neural lineage will be severed. Proceed?`,
        isDanger: true,
        onConfirm: async () => {
            setConfirmModal(null);
            setSaving(true);
            try {
                for (const url of urlsToDelete) {
                    const img = generatedImages.find(i => i.url === url);
                    if (img && img.id) {
                        await deleteDoc(doc(registryDb, 'users', user.uid, 'images', img.id));
                    }
                }
                setGeneratedImages(prev => prev.filter(img => !urlsToDelete.includes(img.url)));
                setSelectedVariations(prev => {
                    const next = new Set(prev);
                    urlsToDelete.forEach(u => next.delete(u));
                    return next;
                });
                setNotification({ id: crypto.randomUUID(), title: `${urlsToDelete.length} variations purged.` });
            } catch (err: any) {
                setError(err.message);
            } finally {
                setSaving(false);
            }
        }
    });
  }, [user, selectedVariations, generatedImages, setConfirmModal]);

  // ── Selection ────────────────────────────────────────────────────

  const handleSelect = useCallback(async (prompt: Prompt) => {
    let currentPrompt = { ...prompt };

    // Asset Recovery: If an exemplar lacks a thumbnail, attempt to hydrate from the primary variation
    if (currentPrompt.isExemplar && !currentPrompt.thumbnailUrl) {
      console.log(`[Sovereign Registry] Recovering thumbnail for exemplar: ${currentPrompt.title}...`);
      try {
        const lineageID = currentPrompt.promptSetID || currentPrompt.id;
        const q = query(
          collection(registryDb, 'images'), 
          where('promptSetID', '==', lineageID),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const varData = snap.docs[0].data();
          const recoveredUrl = varData.imageUrl || varData.url;
          if (recoveredUrl) {
              currentPrompt.thumbnailUrl = recoveredUrl;
              console.log(`[Sovereign Registry] Successfully anchored thumbnail: ${recoveredUrl}`);
              // Update master list to avoid secondary lookups
              setExemplars(prev => prev.map(p => p.id === currentPrompt.id ? { ...p, thumbnailUrl: recoveredUrl } : p));
          }
        }
      } catch (err) {
        console.error("[Sovereign Registry] Asset recovery failed:", err);
      }
    }

    setReferenceImages(prompt.referenceImages || []);
    setSelectedPrompt(currentPrompt);
    setGeneratedImages([]);
    setOriginalSnapshot(null);
    setVariables({});
    const template = currentPrompt.prompts?.[0] || currentPrompt.template || '';
    setRawTemplate(template);
    extractVariables(template);
    setIsEditingBlueprint(false);
    setActiveDetailTab(prompt.isExemplar ? 'media' : 'architect');
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
          const fetchedVariations = snaps.docs.map(d => {
            const data = d.data();
            const createdAt = data.createdAt?.toMillis() || data.timestamp || 0;
            return {
              id: d.id,
              url: data.imageUrl || data.url,
              title: data.title || prompt.title,
              prompt: data.prompt,
              uid: data.userId || data.uid,
              isOriginal: data.isOriginal || false,
              variables: data.variables || {},
              template: data.template || '',
              createdAt,
            };
          }).filter(v => v.url).sort((a, b) => b.createdAt - a.createdAt);
          setGeneratedImages(fetchedVariations);
          const original = fetchedVariations.find(v => v.isOriginal);
          setOriginalSnapshot(original || null);
        } else {
          setGeneratedImages([]);
        }
      } catch (err) {
        console.error("Hydrating PromptTool variations failed:", err);
      }
    }
  }, [user, extractVariables]);

  // ── Hero ─────────────────────────────────────────────────────────

  const handleSetHero = useCallback((img: Variation) => {
    if (!selectedPrompt) return;

    const variationVars = img.variables || {};
    const hasMetadata = Object.keys(variationVars).length > 0;
    let finalTemplate = img.template || (hasMetadata ? (selectedPrompt.template || (selectedPrompt.prompts && selectedPrompt.prompts[0])) : img.prompt) || '';
    const nextVars: Record<string, { value: string; default: string }> = {};

    if (hasMetadata) {
      Object.entries(variationVars).forEach(([key, varData]) => {
        const valToBake = typeof varData === 'object' ? (varData.value || varData.default) : varData;
        if (valToBake && valToBake !== '<undefined>') {
          const regex = new RegExp(`{{${key}(?::.*?)?}}`, 'g');
          finalTemplate = finalTemplate.replace(regex, `{{${key}:${valToBake}}}`);
          nextVars[key] = { value: valToBake, default: valToBake };
        } else if (typeof varData === 'object') {
          nextVars[key] = varData as { value: string; default: string };
        }
      });
    }

    setSelectedPrompt({
      ...selectedPrompt,
      thumbnailUrl: img.url,
      template: finalTemplate,
      prompts: [finalTemplate],
    });
    setRawTemplate(finalTemplate);
    setVariables(prev => hasMetadata ? ({ ...prev, ...nextVars }) : nextVars);
    setSaveStatus('idle');
    setActiveDetailTab('architect');
    setReferenceImages(img.referenceImages || []);
  }, [selectedPrompt]);

  // ── Commit Selection ─────────────────────────────────────────────

  const commitSelection = useCallback((url: string | null, title: string | undefined, newPrompt: string, vars?: Record<string, { value: string; default: string }>) => {
    setVariables(vars || {});
    setRawTemplate(newPrompt);
    extractVariables(newPrompt);
    if (selectedPrompt) {
      setSelectedPrompt(prev => prev ? { ...prev, thumbnailUrl: url || '', title: title || prev.title } : null);
    }
    setLastCommittedPrompt(newPrompt);
    setActiveDetailTab('architect');
  }, [selectedPrompt, extractVariables]);

   const handleAssetSelection = useCallback((url: string | null, title: string | undefined, newPrompt: string | undefined, vars?: Record<string, { value: string; default: string }>) => {
    if (!newPrompt) {
      setPreviewImageUrl(url);
      setPreviewTitle(title || '<no title>');
      return;
    }

    // Toggle Logic: If selecting already active architecture, revert to Original/Genesis state
    if (url && selectedPrompt?.thumbnailUrl === url) {
      console.log("[Sovereign Registry] Deselecting Prompt; reverting to Genesis Node...");
      const originalUrl = originalSnapshot?.url || null;
      const originalTitle = originalSnapshot?.title || selectedPrompt?.title;
      const originalPrompt = originalSnapshot?.template || selectedPrompt?.template || selectedPrompt?.prompts?.[0] || '';
      const originalVars = originalSnapshot?.variables || {};
      
      commitSelection(originalUrl, originalTitle, originalPrompt, originalVars);
      return;
    }

    const updatedRaw = getCleanPrompt();
    const hasChanges = updatedRaw !== lastCommittedPrompt;

    if (hasChanges) {
      setConfirmModal({
        isOpen: true,
        title: 'Unsaved Prompt Changes',
        message: 'Your current prompt overrides have not been registered to the ecosystem. Resolving conflict...',
        isDanger: true,
        onConfirm: () => {},
        customButtons: [
          {
            label: 'Sync & Load',
            onClick: async () => { await saveBlueprint(false); commitSelection(url, title, newPrompt, vars); setConfirmModal(null); },
            className: "col-span-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20",
          },
          {
            label: 'Sync & Exit',
            onClick: async () => { await saveBlueprint(false); setSelectedPrompt(null); setConfirmModal(null); },
            className: "col-span-1 py-3 px-6 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all",
          },
          {
            label: 'Discard & Load',
            onClick: () => { commitSelection(url, title, newPrompt, vars); setConfirmModal(null); },
            className: "col-span-1 py-3 px-6 rounded-xl border border-rose-500/20 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-all",
          },
          {
            label: 'Abort & Return',
            onClick: () => setConfirmModal(null),
            className: "col-span-1 py-3 px-6 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/10 hover:text-white/40 hover:bg-white/5 transition-all",
          },
        ],
      });
    } else {
      commitSelection(url, title, newPrompt, vars);
    }
  }, [getCleanPrompt, lastCommittedPrompt, commitSelection, setConfirmModal, selectedPrompt, originalSnapshot]);

  // ── Title Suggestion ─────────────────────────────────────────────

  const suggestTitle = useCallback((text: string) => {
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
      const r = new RegExp(`[,\\s]*${n}[,\\s]*`, 'gi');
      clean = clean.replace(r, ' ');
    });
    clean = clean.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();
    const words = clean.split(/\s+/).filter(w => w.length > 2 && !w.includes('{'));
    const title = words.slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return title || (selectedPrompt?.title ? `${selectedPrompt.title} (Custom)` : 'New Architecture');
  }, [variables, selectedPrompt]);

  // ── Save ─────────────────────────────────────────────────────────

  const doSave = useCallback(async (asNew: boolean, promptToSave: Prompt): Promise<string | null> => {
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
        referenceImages: referenceImages || [],
        uid: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (isActuallyNew) {
        const docRef = await addDoc(collection(registryDb, 'blueprints'), {
          ...blueprintData,
          createdAt: serverTimestamp(),
        });
        setSelectedPrompt({
          id: docRef.id,
          ...blueprintData,
          isPersonal: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        setLastCommittedPrompt(updatedRawTemplate);
      } else if (selectedPrompt?.isPersonal) {
        await setDoc(doc(registryDb, 'blueprints', selectedPrompt.id), blueprintData, { merge: true });
        setSelectedPrompt(prev => prev ? { ...prev, ...blueprintData, updatedAt: Date.now() } : null);
        setLastCommittedPrompt(updatedRawTemplate);
      }
      // NOTE: Removed stale resourcesDb writes per architectural clarification
      // PromptResources is a separate reference library and should not receive blueprint data

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
  }, [user, profile, selectedPrompt, getCleanPrompt, fetchPrompts]);

  const saveBlueprint = useCallback(async (asNew: boolean = true): Promise<string | null> => {
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
                setTimeout(async () => { const clean = await doSave(asNew, updated); resolve(clean); }, 10);
              },
              className: "col-span-2 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20",
            },
            {
              label: 'Abort Initialization',
              onClick: () => { setConfirmModal(null); resolve(null); },
              className: "col-span-2 mt-2 py-3 px-6 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/10 hover:text-white/40 hover:bg-white/5 transition-all",
            },
          ],
        });
      });
    }
    return await doSave(asNew, selectedPrompt);
  }, [user, selectedPrompt, resultantPrompt, suggestTitle, doSave, setConfirmModal]);

  // ── Delete ───────────────────────────────────────────────────────

  const handleDelete = useCallback((targetPrompt?: Prompt) => {
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
      message: `This will permanently decommission "${promptToDelete.title}" from the ${isPersonal ? 'registry' : 'ecosystem'}. This action is irreversible.`,
      isDanger: true,
      customButtons: [
        {
          label: 'Confirm Decommission',
          onClick: async () => {
            setSaving(true);
            try {
              if (isPersonal) {
                await deleteDoc(doc(registryDb, 'blueprints', promptToDelete.id));
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
              }
              // NOTE: Removed stale resourcesDb delete per architectural clarification
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
          className: "col-span-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg bg-rose-600 hover:bg-rose-500 shadow-rose-600/20",
        },
        {
          label: 'Abort Operation',
          onClick: () => setConfirmModal(null),
          className: "col-span-1 py-3 px-6 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/10 hover:text-white/40 hover:bg-white/5 transition-all",
        },
      ],
    });
  }, [user, profile, selectedPrompt, fetchPrompts, setConfirmModal]);

  // ── Clone ────────────────────────────────────────────────────────

  const handleClone = useCallback(async (p: Prompt, confirmedTitle?: string, compiledInstructions?: string) => {
    if (!user) return;
    const template = compiledInstructions || p.template || p.prompts?.[0] || '';
    const baseTitle = confirmedTitle || p.title;

    // --- Mandatory Architectural Confirmation ---
    if (!confirmedTitle) {
      const existing = prompts.filter(bp => bp.title.toLowerCase().startsWith(p.title.toLowerCase()));
      const version = existing.length + 1;
      const suggestedTitle = version > 1 ? `${baseTitle} (v${version})` : baseTitle;

      setConfirmModal({
        isOpen: true,
        title: `Clone ${baseTitle}`,
        message: "Verify the neural architecture and vision parameters for this distinct replication.",
        preview: {
          thumbnailUrl: p.thumbnailUrl,
          template: template
        },
        customButtons: [
          {
            label: `Register as ${suggestedTitle}`,
            onClick: () => { handleClone(p, suggestedTitle, compiledInstructions); setConfirmModal(null); },
            className: "col-span-2 py-4 px-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all shadow-xl bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 active:scale-95",
          },
          {
            label: 'Abort Operation',
            onClick: () => setConfirmModal(null),
            className: "col-span-2 py-3 px-6 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest text-white/10 hover:text-white/40 hover:bg-white/5 transition-all text-center",
          },
        ],
      });
      return;
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
      
      const docRef = await addDoc(collection(registryDb, 'blueprints'), blueprintData);

      // Seed Genesis Node in user's generation ledger
      await addDoc(collection(toolDb, 'users', user.uid, 'images'), {
        url: p.thumbnailUrl,
        imageUrl: p.thumbnailUrl,
        prompt: template,
        promptSetID: docRef.id,
        isOriginal: true,
        uid: user.uid,
        createdAt: serverTimestamp(),
        title: `${baseTitle} (Genesis)`,
      });
      
      setNotification({ id: docRef.id, title: `Successfully registered clone: ${baseTitle}` });
      setTimeout(() => setNotification(null), 4000);

      // Pivot to Prompt Registry tab to ensure context stability
      setActiveTab('blueprints');

      handleSelect({
        id: docRef.id,
        ...blueprintData,
        isPersonal: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Prompt);
    } catch (err: any) {
      setError("Cloning failed: " + err.message);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [user, prompts, handleSelect, setConfirmModal, setNotification]);
  
  // ── Reference Material Handlers ──────────────────────────────────
  
  const uploadReferenceImage = useCallback(async (file: File) => {
    if (!user) return;
    setSaving(true);
    try {
      const guid = crypto.randomUUID();
      const storageRef = ref(storage, `users/${user.uid}/references/${guid}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      const newRef: ReferenceImage = {
        url,
        title: file.name,
        source: 'upload'
      };
      
      setReferenceImages(prev => [...prev, newRef]);
      setNotification({ id: guid, title: `Successfully anchored reference: ${file.name}` });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setError("Reference upload failed: " + err.message);
    } finally {
      setSaving(false);
    }
  }, [user]);

  const addReferenceImage = useCallback((img: ReferenceImage) => {
    setReferenceImages(prev => {
      if (prev.some(x => x.url === img.url)) return prev;
      return [...prev, img];
    });
  }, []);

  const removeReferenceImage = useCallback((url: string) => {
    setReferenceImages(prev => prev.filter(img => img.url !== url));
  }, []);

  // ── Generation (SSE → PromptTool) ────────────────────────────────

  const executeGeneration = useCallback(async (finalPrompt: string, activePromptSetID: string | null | undefined, generationVariables: any, refPayload: any) => {
    if (!user) return;
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
                status: i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'waiting',
              })));
            }
            setProgressMsg(event.message || 'Processing Neural Request...');
          }
          if (event.type === 'status') {
            setProgressMsg(event.message || 'Stabilizing Neural Stream...');
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
                elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000),
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
        activePromptSetID || undefined,
        generationVariables,
        getCleanPrompt(),
        quality,
        refPayload,
        abortControllerRef.current.signal
      );
    } catch (err: any) {
      setError(err.message);
      if (timerRef.current) clearInterval(timerRef.current);
      setGenerating(false);
    }
  }, [user, selectedPrompt, quality, getCleanPrompt]);

  const handleSubmit = useCallback(async () => {
    if (!user || !resultantPrompt) return;
    
    // Neural Compilation: Append reference material indicator
    const refCount = referenceImages.length;
    const refIndicator = refCount > 0 
        ? `\n\n[REFERENCE MATERIALS ATTACHED: ${referenceImages.map(r => r.title || 'Untitled').join(', ')}]`
        : `\n\n[NO REFERENCE MATERIALS ATTACHED]`;
    
    const bakedTemplate = getCleanPrompt();
    setRawTemplate(bakedTemplate);
    if (selectedPrompt && !selectedPrompt.isExemplar) {
      doSave(false, { ...selectedPrompt, template: bakedTemplate });
    }
    const finalPrompt = bakedTemplate + refIndicator;
    let activePromptSetID = selectedPrompt?.promptSetID || selectedPrompt?.id;
    if (isNewImageSet) {
      activePromptSetID = crypto.randomUUID();
      setIsNewImageSet(false);
      if (selectedPrompt) {
        setSelectedPrompt({ ...selectedPrompt, promptSetID: activePromptSetID });
      }
    }

    // Sanitize variables for Firestore compatibility (no dots in keys)
    const sanitizedVariables: Record<string, { value: string, default: string }> = {};
    Object.entries(variables).forEach(([key, val]) => {
        const safeKey = key.replace(/\./g, '_');
        sanitizedVariables[safeKey] = val;
    });

    const generationVariables = { ...sanitizedVariables };
    const refPayload = referenceImages.map(img => ({
        data: img.url,
        mimeType: 'image/png',
        title: img.title
    }));

    // --- High-Fidelity Confirmation Protocol ---
    const engineMult = engine === 'cinematic-3' ? 2 : engine === 'architect-1' ? 1.5 : 1;
    const qualityBase = quality === 'ultra' ? 5 : quality === 'high' ? 2 : 1;
    const totalCost = Math.ceil(engineMult * qualityBase);
    const balance = profile?.credits || 0;
    const remaining = balance - totalCost;

    setConfirmModal({
        isOpen: true,
        title: 'Neural Generation Request',
        message: `Authorize the ecosystem to trigger a new neural variation for "${selectedPrompt?.title || 'New Architecture'}". This will deploy the specified engine cluster and quality tier.`,
        costSummary: {
            engine: engine.split('-')[0],
            quality,
            cost: totalCost,
            balance,
            remaining
        },
        preview: {
            thumbnailUrl: selectedPrompt?.thumbnailUrl || (referenceImages.length > 0 ? referenceImages[0].url : undefined),
            visionInstructions: resultantPrompt
        },
        customButtons: [
            {
                label: 'Authorize & Generate',
                onClick: () => {
                    setConfirmModal(null);
                    executeGeneration(finalPrompt, activePromptSetID, generationVariables, refPayload);
                },
                className: "col-span-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20",
            },
            {
                label: 'Abort Session',
                onClick: () => setConfirmModal(null),
                className: "col-span-1 py-3 px-6 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/10 hover:text-white/40 hover:bg-white/5 transition-all",
            }
        ]
    });
  }, [user, resultantPrompt, selectedPrompt, variables, quality, engine, isNewImageSet, getCleanPrompt, doSave, setConfirmModal, executeGeneration, profile, referenceImages]);

  const handleCancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setGenerating(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setProgressMsg('Operation Aborted');
    }
  }, []);

  // ── Filtered list ────────────────────────────────────────────────

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

  // ── Gallery navigation ───────────────────────────────────────────

  const handleViewVariation = useCallback(async (image: any) => {
    const psid = image.promptSetID;
    if (!psid) { setError("This variation is not linked to a blueprint lineage."); return; }
    let p = prompts.find(x => x.promptSetID === psid || x.id === psid);
    let tab: 'blueprints' | 'exemplars' = 'blueprints';
    if (!p) {
      p = exemplars.find(x => x.promptSetID === psid || x.id === psid);
      tab = 'exemplars';
    }
    if (!p) { setError("Associated blueprint node not found in the registry."); return; }
    setActiveTab(tab);
    await handleSelect(p);
    handleAssetSelection(image.imageUrl, image.title, image.prompt);
  }, [prompts, exemplars, setActiveTab, handleSelect, handleAssetSelection]);

  const handleViewInGallery = useCallback((image: any) => {
    if (image?.promptSetID) {
      setGallerySearchQuery(image.promptSetID);
      setActiveTab('gallery');
    }
  }, [setActiveTab]);

  // ── Context Value ────────────────────────────────────────────────

  const value: PromptMasterContextValue = {
    user, profile,
    activeTab, setActiveTab, setConfirmModal,
    prompts, exemplars, loadingLibrary, filteredList,
    selectedPrompt, setSelectedPrompt, handleSelect,
    rawTemplate, setRawTemplate, variables, setVariables,
    resultantPrompt, isEditingBlueprint, setIsEditingBlueprint,
    activeDetailTab, setActiveDetailTab,
    generatedImages, setGeneratedImages,
    selectedVariations, setSelectedVariations,
    variationsViewMode, setVariationsViewMode,
    searchQuery, setSearchQuery,
    gallerySearchQuery, setGallerySearchQuery,
    initialGalleryAssetId, setInitialGalleryAssetId,
    sortMode, setSortMode, viewMode, setViewMode,
    engine, setEngine, quality, setQuality,
    generating, saving, saveStatus, error, setError,
    status, progressMsg, elapsed,
    completion, setCompletion,
    isNewImageSet, setIsNewImageSet,
    previewImageUrl, setPreviewImageUrl,
    previewTitle, setPreviewTitle,
    previewPrompt, setPreviewPrompt,
    viewingMetrics, setViewingMetrics,
    notification, setNotification,
    handleSubmit, handleCancelGeneration,
    saveBlueprint, handleDelete, handleClone,
    handleSetHero, handleAssetSelection,
    handleViewVariation, handleViewInGallery,
    toggleSelectVariation, selectAllVariations,
    handleDeleteSelectedVariations,
    originalSnapshot, setOriginalSnapshot,
    getCleanPrompt, fetchPrompts,
    referenceImages, setReferenceImages,
    uploadReferenceImage, addReferenceImage, removeReferenceImage,
  };

  return (
    <PromptMasterContext.Provider value={value}>
      {children}
    </PromptMasterContext.Provider>
  );
};
