// ── Core Interfaces ────────────────────────────────────────────────

export interface ReferenceImage {
  url: string;
  id?: string;
  title?: string;
  source: 'upload' | 'gallery';
}

export interface Prompt {
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
  referenceImages?: ReferenceImage[];
}

export interface Variation {
  id?: string;
  url: string;
  title?: string;
  prompt?: string;
  variables?: Record<string, { value: string; default: string }>;
  uid?: string;
  isOriginal?: boolean;
  template?: string;
  referenceImages?: ReferenceImage[];
}

export interface StatusStep {
  id: string;
  label: string;
  status: 'waiting' | 'active' | 'done' | 'error';
}

export interface CompletionSummary {
  creditsUsed?: number;
  remainingBalance?: number;
  imageUrl?: string;
  title?: string;
  quality?: string;
  elapsed?: number;
}

export interface PromptMasterProps {
  activeTab: 'blueprints' | 'exemplars' | 'gallery';
  setActiveTab: (tab: 'blueprints' | 'exemplars' | 'gallery') => void;
  tabVersion?: number;
  setConfirmModal: (modal: any) => void;
}

// ── Constants ──────────────────────────────────────────────────────

export const VAR_REGEX = /{{(.*?)}}/g;

export const INITIAL_STEPS: StatusStep[] = [
  { id: 'auth', label: 'Auth', status: 'waiting' },
  { id: 'queue', label: 'Queue', status: 'waiting' },
  { id: 'generate', label: 'Generate', status: 'waiting' },
  { id: 'upload', label: 'Upload', status: 'waiting' },
  { id: 'complete', label: 'Complete', status: 'waiting' },
];

export const FALLBACK_PROMPTS: Prompt[] = [
  {
    id: 'sample-1',
    title: 'Cyberpunk Character Portrait',
    description: 'Neon-lit gritty cyberpunk character generation.',
    prompts: ['A {{character}} in a gritty {{setting}}, cinematic lighting, cyberpunk aesthetic, masterpiece, 8k'],
    thumbnailUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=cyber1',
  },
  {
    id: 'sample-2',
    title: 'Architectural Visualization',
    description: 'Photorealistic interior design and materials.',
    prompts: ['Modern {{room:living room}} with {{material:concrete}} accents, natural sunlight streaming through windows, architectural photography'],
    thumbnailUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=arch1',
  },
];


// ── Utility Functions ──────────────────────────────────────────────

export const parseDate = (val: any): number => {
  if (!val) return Date.now();
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  if (val instanceof Date) return val.getTime();
  return new Date(val).getTime() || Date.now();
};

export const calculateComplexity = (template?: string, prompts?: string[]) => {
  const content = template || (prompts && prompts[0]) || '';
  const vars = content.match(/{{[^}]+}}/g);
  return vars ? Math.min(vars.length, 8) / 8 : 0.1;
};

export const calculateFreshness = (updatedAt?: number) => {
  if (!updatedAt) return 0.5;
  const ageInDays = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);
  return Math.max(0.1, 1 - Math.min(ageInDays / 30, 0.9));
};

export const calculateUsageRating = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return 0.3 + (Math.abs(hash % 70) / 100);
};

export const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;


// ── End of Types ──────────────────────────────────────────────────
