import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  collection, query, orderBy, getDocs, deleteDoc, doc, limit, startAfter, QueryDocumentSnapshot
} from 'firebase/firestore';
import { toolDb } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Image as ImageIcon, LayoutList, Search, Trash2,
  RefreshCw, Star, Trophy, Layers, X, ChevronDown,
  Film, Edit3, History as HistoryIcon, AlertCircle
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
interface GImage {
  id: string;
  userId: string;
  title?: string;
  prompt: string;
  imageUrl: string;
  videoUrl?: string;
  createdAt: any;
  promptSetID?: string;
  sourceImageId?: string;
  publishedToCommunity?: boolean;
  publishedToLeague?: boolean;
  isExemplar?: boolean;
  settings?: {
    quality?: string;
    aspectRatio?: string;
    modality?: string;
  };
  tags?: string[];
}

type ViewMode = 'grid-2' | 'grid-3' | 'grid-4' | 'list';
type SortMode = 'newest' | 'oldest';

const PAGE_SIZE = 40;

// ── Utilities ──────────────────────────────────────────────────────
const parseTs = (val: any): number => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  if (val instanceof Date) return val.getTime();
  return typeof val === 'number' ? val : 0;
};

const formatDate = (val: any) => {
  const ms = parseTs(val);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const qualityLabel: Record<string, string> = {
  standard: 'SD', high: 'HD', ultra: '4K', video: 'VID'
};

// ── Lightbox / Preview Modal ───────────────────────────────────────
function Lightbox({ 
    image, 
    onClose, 
    onViewVariation 
}: { 
    image: GImage; 
    onClose: () => void;
    onViewVariation?: (img: GImage) => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-12 animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
      
      <button
        onClick={onClose}
        className="absolute top-8 right-8 z-[1100] p-4 bg-white/5 hover:bg-red-500 text-white rounded-2xl border border-white/10 transition-all group"
      >
        <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      <div
        className="relative max-w-7xl w-full h-full max-h-[90vh] flex flex-col md:flex-row items-stretch rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 bg-[#0a0a0f]"
        onClick={e => e.stopPropagation()}
      >
        {/* Media Side */}
        <div className="flex-1 relative bg-black/40 flex items-center justify-center overflow-hidden">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_100%)]"></div>
             <img
               src={image.imageUrl}
               alt={image.prompt}
               className="relative z-10 w-full h-full object-contain p-8 animate-in zoom-in-95 duration-500"
             />
        </div>

        {/* Info Side */}
        <div className="w-full md:w-[400px] border-l border-white/10 p-8 flex flex-col gap-8 bg-[#12121a]/50 backdrop-blur-3xl overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary/50"></div>
               <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">High-Fidelity Manifest</span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
              {image.title || "Untitled Fragment"}
            </h3>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{formatDate(image.createdAt)}</p>
          </div>

          <div className="space-y-4">
             <div className="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-3">
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Neural Seed Hash</p>
                <p className="text-xs text-white/70 leading-relaxed font-medium font-mono break-all">{image.prompt}</p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Quality</p>
                <p className="text-[10px] font-black text-white uppercase">{image.settings?.quality || 'N/A'}</p>
             </div>
             <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-primary" />
                <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Type</p>
                <p className="text-[10px] font-black text-white uppercase">{image.settings?.modality || 'Image'}</p>
             </div>
          </div>

          <div className="mt-auto space-y-3 pt-6 border-t border-white/5">
            {onViewVariation && image.promptSetID && (
              <button
                onClick={() => {
                   onViewVariation(image);
                   onClose();
                }}
                className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3"
              >
                <Edit3 className="w-4 h-4" /> View in Workbench
              </button>
            )}
            <button
               onClick={onClose}
               className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all"
            >
              Close Asset Variation
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
}

function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Purge Variation" }: ConfirmModalProps) {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-[#0a0a0e] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl animate-fade-in-up">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-white uppercase tracking-wider">{title}</h3>
            <p className="text-[10px] leading-relaxed text-gray-500 font-bold uppercase tracking-widest px-4">{message}</p>
          </div>
          <div className="w-full flex flex-col gap-3 pt-2">
            <button
              onClick={onConfirm}
              className="w-full py-4 bg-red-500 hover:bg-red-400 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-red-500/20"
            >
              {confirmText}
            </button>
            <button
              onClick={onCancel}
              className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all"
            >
              Archive Entry (Cancel)
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Card ───────────────────────────────────────────────────────────
interface GalleryCardProps {
  image: GImage;
  viewMode: ViewMode;
  isSelected: boolean;
  onToggleSelect: () => void;
  onLightbox: () => void;
  onDelete: () => void;
  deleting: boolean;
  onViewVariation?: (image: GImage) => void;
}

function GalleryCard({
  image, viewMode, isSelected, onToggleSelect, onLightbox, onDelete, deleting, onViewVariation
}: GalleryCardProps) {
  const isPublished = image.publishedToCommunity || image.publishedToLeague;
  const isVideo = !!(image.videoUrl || image.settings?.modality === 'video');

  if (viewMode === 'list') {
    return (
      <div
        className={`flex items-center gap-4 p-3 rounded-xl border transition-all group ${isSelected ? 'bg-primary/10 border-primary/30' : 'bg-white/[0.02] border-white/5 hover:border-white/15'}`}
      >
        {/* checkbox */}
        <button
          onClick={onToggleSelect}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-primary border-primary' : 'border-white/20 hover:border-primary/60'}`}
        >
          {isSelected && <X className="w-3 h-3 text-white" style={{ transform: 'rotate(45deg)' }} />}
        </button>
        {/* thumb */}
        <button onClick={onLightbox} className="shrink-0">
          <img src={image.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
        </button>
        {/* info */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate">{image.title || <span className="italic text-gray-600">Untitled</span>}</p>
          <p className="text-gray-500 text-[10px] truncate">{image.prompt}</p>
        </div>
        {/* badges */}
        <div className="flex items-center gap-2 shrink-0">
          {onViewVariation && image.promptSetID && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewVariation(image); }}
              className="px-2 py-0.5 rounded-lg bg-primary/20 text-primary border border-primary/30 text-[8px] font-black uppercase tracking-widest hover:bg-primary/30 transition-all flex items-center gap-1"
            >
              <Edit3 className="w-2.5 h-2.5" /> View/Update
            </button>
          )}
          {isPublished && <span className="text-[8px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 flex items-center gap-1"><Trophy className="w-2.5 h-2.5" /> Hub</span>}
          {image.isExemplar && <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-1"><Star className="w-2.5 h-2.5" /> Exemplar</span>}
          {image.sourceImageId && <span className="text-[8px] font-black uppercase tracking-widest text-accent/80 bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20 flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> Variant</span>}
          <span className="text-[9px] font-bold text-gray-600">{formatDate(image.createdAt)}</span>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-red-500/60 hover:text-red-400 transition-all"
          >
            {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${isSelected ? 'border-primary ring-4 ring-primary/10' : 'border-transparent hover:border-white/20'}`}
    >
      {/* select toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        className={`absolute top-2 left-2 z-20 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shadow-lg bg-black/40 backdrop-blur-sm ${isSelected ? 'bg-primary border-primary scale-110' : 'border-white/30 opacity-0 group-hover:opacity-100 hover:border-white/60'}`}
      >
        {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
      </button>

      {/* delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        disabled={deleting}
        className="absolute top-2 right-2 z-20 w-6 h-6 rounded-lg bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
      >
        {deleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      </button>

      {/* image */}
      <button className="block w-full aspect-square bg-white/5" onClick={onLightbox}>
        <img src={image.imageUrl} alt={image.prompt} className="w-full h-full object-cover" loading="lazy" />
      </button>

      {/* overlays */}
      <div className="absolute top-10 left-2 flex flex-col gap-1 z-10 pointer-events-none">
        {isPublished && (
          <div className="bg-yellow-500 text-white rounded-md px-1.5 py-0.5 flex items-center gap-1">
            <Trophy className="w-2.5 h-2.5" />
            <span className="text-[7px] font-black uppercase tracking-widest">Hub</span>
          </div>
        )}
        {image.isExemplar && (
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-md px-1.5 py-0.5 flex items-center gap-1">
            <Star className="w-2.5 h-2.5" />
            <span className="text-[7px] font-black uppercase tracking-widest">Exemplar</span>
          </div>
        )}
        {image.sourceImageId && (
          <div className="bg-accent text-white rounded-md px-1.5 py-0.5 flex items-center gap-1">
            <Layers className="w-2.5 h-2.5" />
            <span className="text-[7px] font-black uppercase tracking-widest">Variant</span>
          </div>
        )}
        {isVideo && (
          <div className="bg-purple-600 text-white rounded-md px-1.5 py-0.5 flex items-center gap-1">
            <Film className="w-2.5 h-2.5" />
            <span className="text-[7px] font-black uppercase tracking-widest">Video</span>
          </div>
        )}
      </div>

      {/* quality pill */}
      {image.settings?.quality && (
        <div className="absolute bottom-8 left-2 z-10 pointer-events-none">
          <span className="text-[7px] font-black uppercase tracking-widest text-primary bg-primary/20 border border-primary/30 px-1.5 py-0.5 rounded-full">
            {qualityLabel[image.settings.quality] ?? image.settings.quality}
          </span>
        </div>
      )}

      {/* title bar */}
      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-between">
        <p className="text-[8px] font-black text-white/70 truncate uppercase tracking-widest flex-1">
          {image.title || <span className="italic text-white/30">Untitled</span>}
        </p>
      </div>

      {/* hover overlay */}
      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-4 z-[15] backdrop-blur-sm">
        {onViewVariation && image.promptSetID && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewVariation(image); }}
            className="px-6 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center gap-2 border border-white/20"
          >
            <Edit3 className="w-4 h-4" /> View/Update Variation
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onLightbox(); }}
          className="text-[9px] font-black text-white/50 hover:text-white uppercase tracking-widest transition-colors"
        >
          [ Open Preview ]
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
interface GalleryProps {
  onViewVariation?: (image: GImage) => void;
  initialSearch?: string;
  initialAssetId?: string | null;
}

export default function PromptToolGallery({ onViewVariation, initialSearch = '', initialAssetId = null }: GalleryProps) {
  const { user } = useAuth();

  const [images, setImages] = useState<GImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [viewMode, setViewMode] = useState<ViewMode>('grid-4');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<GImage | null>(null);
  const [isGrouped, setIsGrouped] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GImage[] | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchImages = useCallback(async (paginate = false) => {
    if (!user) return;
    paginate ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const dir = sortMode === 'newest' ? 'desc' : 'asc';
      let q = query(
        collection(toolDb, 'users', user.uid, 'images'),
        orderBy('createdAt', dir),
        limit(PAGE_SIZE)
      );
      if (paginate && lastDoc) q = query(q, startAfter(lastDoc));

      const snap = await getDocs(q);
      const docs: GImage[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as GImage));

      setImages(prev => paginate ? [...prev, ...docs] : docs);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load gallery');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, sortMode, lastDoc]);

  useEffect(() => { fetchImages(); }, [user, sortMode]);

  useEffect(() => {
    if (initialAssetId && images.length > 0) {
      const target = images.find(img => img.id === initialAssetId || img.imageUrl === initialAssetId);
      if (target) {
        setLightboxImage(target);
      }
    }
  }, [initialAssetId, images]);

  // ── Filtered list ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = images;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(img =>
        img.prompt.toLowerCase().includes(q) ||
        (img.title?.toLowerCase().includes(q)) ||
        (img.promptSetID?.toLowerCase() === q)
      );
    }
    return list;
  }, [images, searchQuery]);

  const grouped = useMemo(() => {
    if (!isGrouped) return null;
    const groups: Record<string, GImage[]> = {};
    filtered.forEach(img => {
      const key = img.promptSetID || `single-${img.id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(img);
    });
    return groups;
  }, [filtered, isGrouped]);

  // ── Selection ──────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const selectAll = () => setSelectedIds(new Set(filtered.map(i => i.id)));
  const clearSelection = () => setSelectedIds(new Set());

  // ── Delete ─────────────────────────────────────────────────────
  const deleteImage = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(toolDb, 'users', user.uid, 'images', id));
      setImages(prev => prev.filter(i => i.id !== id));
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch {
      // silent fail for now – could surface a toast later
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const deleteBatch = async () => {
    if (!user) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
       setDeletingId(id);
       try {
         await deleteDoc(doc(toolDb, 'users', user.uid, 'images', id));
         setImages(prev => prev.filter(i => i.id !== id));
       } catch (e) {}
    }
    setSelectedIds(new Set());
    setDeletingId(null);
    setConfirmDeleteBatch(false);
  };

  // ── Grid classes ───────────────────────────────────────────────
  const gridClass: Record<ViewMode, string> = {
    'grid-2': 'grid grid-cols-2 gap-4',
    'grid-3': 'grid grid-cols-2 sm:grid-cols-3 gap-4',
    'grid-4': 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4',
    'list': 'flex flex-col gap-2',
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
        {/* search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search gallery…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-primary/50 transition-all"
          />
        </div>

        {/* sort */}
        <select
          value={sortMode}
          onChange={e => { setSortMode(e.target.value as SortMode); setImages([]); setLastDoc(null); }}
          className="bg-white/[0.03] text-[10px] font-black uppercase tracking-widest text-gray-400 border border-white/10 rounded-xl px-4 py-2.5 outline-none cursor-pointer hover:border-primary/50 transition-all appearance-none"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>

        <div className="w-px h-12 bg-white/5 mx-2" />

        {/* Group Toggle */}
        <button
          onClick={() => setIsGrouped(!isGrouped)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${isGrouped ? 'bg-primary/20 text-primary border-primary/30 shadow-lg shadow-primary/10' : 'bg-white/[0.03] text-gray-500 border-white/10 hover:text-white hover:border-white/20'}`}
          title={isGrouped ? "Ungroup Sets" : "Group by Generation Set"}
        >
          <Layers className={`w-3.5 h-3.5 ${isGrouped ? 'animate-pulse' : ''}`} />
          {isGrouped ? "Set View" : "Individual"}
        </button>

        <div className="w-px h-6 bg-white/10" />

        {/* view mode */}
        <div className="flex items-center gap-1 bg-white/[0.02] border border-white/10 rounded-xl p-1">
          {(['grid-2', 'grid-3', 'grid-4'] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black transition-all ${viewMode === m ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
            >
              {m === 'grid-2' ? '2C' : m === 'grid-3' ? '3C' : '4C'}
            </button>
          ))}
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* refresh */}
        <button
          onClick={() => { setImages([]); setLastDoc(null); fetchImages(); }}
          disabled={loading}
          className="p-2.5 rounded-xl border border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
        </button>
      </div>

      {/* ── Selection bar ────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 px-5 py-3 bg-[#0a0a0e] border border-white/10 rounded-xl animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black shadow-lg shadow-primary/20">
              {selectedIds.size}
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-white/70">Selected</span>
          </div>
          <button onClick={selectAll} className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
            Select All
          </button>
          <button onClick={clearSelection} className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
            Clear
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            onClick={() => setConfirmDeleteBatch(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Selected
          </button>
        </div>
      )}

      {/* ── Stats bar ────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center gap-2 text-[9px] font-black text-gray-600 uppercase tracking-widest">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>{filtered.length} {filtered.length !== images.length ? `of ${images.length}` : ''} images</span>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <RefreshCw className="w-10 h-10 text-primary/40 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Loading Gallery…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4 border-2 border-dashed border-red-500/20 rounded-2xl">
          <span className="text-red-400 text-sm font-bold">Failed to load gallery: {error}</span>
          <button onClick={() => fetchImages()} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-48 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-white/[0.01] space-y-8 text-center animate-fade-in">
          <div className="relative">
            <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full opacity-20"></div>
            <ImageIcon className="relative w-16 h-16 text-gray-700/40 mx-auto" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">Variation Set Empty</p>
            <p className="text-[10px] text-gray-700 uppercase tracking-widest font-bold max-w-xs mx-auto leading-relaxed">Generated artifacts may be filtered out by your current set index criteria</p>
          </div>
          {(searchQuery || !isGrouped) && (
            <button 
              onClick={() => { setSearchQuery(''); setIsGrouped(true); }}
              className="px-8 py-4 bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] border border-primary/20 rounded-2xl transition-all shadow-2xl shadow-primary/5 hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restore All Variations
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={gridClass[viewMode]}>
            {isGrouped && grouped ? (
              Object.entries(grouped).map(([key, groupImages]) => {
                const displayImage = groupImages[0];
                const isGroupSelected = groupImages.every(i => selectedIds.has(i.id));
                const hasHubImage = groupImages.some(img => img.publishedToCommunity || img.publishedToLeague);
                
                return (
                  <div key={key} className="relative group">
                    <GalleryCard
                      image={{...displayImage, publishedToCommunity: hasHubImage}}
                      viewMode={viewMode === 'list' ? 'grid-4' : viewMode} // Force grid for grouped to show count
                      isSelected={isGroupSelected}
                      onToggleSelect={() => {
                        const ids = groupImages.map(i => i.id);
                        if (isGroupSelected) {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            ids.forEach(id => next.delete(id));
                            return next;
                          });
                        } else {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            ids.forEach(id => next.add(id));
                            return next;
                          });
                        }
                      }}
                      onLightbox={() => setSelectedGroup(groupImages)}
                      onDelete={() => setConfirmDeleteId(groupImages[0].id)}
                      deleting={groupImages.some(i => deletingId === i.id)}
                      onViewVariation={onViewVariation}
                    />
                    {groupImages.length > 1 && (
                      <div className="absolute -bottom-2 -right-2 z-20 bg-primary px-2.5 py-1 rounded-lg text-[9px] font-black text-white shadow-xl border border-white/20 pointer-events-none uppercase tracking-widest">
                        {groupImages.length} Variations
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              filtered.map(img => (
                <GalleryCard
                  key={img.id}
                  image={img}
                  viewMode={viewMode}
                  isSelected={selectedIds.has(img.id)}
                  onToggleSelect={() => toggleSelect(img.id)}
                  onLightbox={() => setLightboxImage(img)}
                  onDelete={() => setConfirmDeleteId(img.id)}
                  deleting={deletingId === img.id}
                  onViewVariation={onViewVariation}
                />
              ))
            )}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => fetchImages(true)}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
              >
                {loadingMore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {loadingMore ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────── */}
      {lightboxImage && (
        <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}

      {/* ── Group Detail Modal ────────────────────────────────────── */}
      {selectedGroup && (
        <div className="fixed inset-0 z-[210] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4">
          <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col gap-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase tracking-tighter text-white">Variation Set Explorer</h3>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{selectedGroup.length} Unique Variations</p>
              </div>
              <button 
                onClick={() => setSelectedGroup(null)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-12">
                {selectedGroup.map(img => (
                  <GalleryCard
                    key={img.id}
                    image={img}
                    viewMode="grid-4"
                    isSelected={selectedIds.has(img.id)}
                    onToggleSelect={() => toggleSelect(img.id)}
                    onLightbox={() => setLightboxImage(img)}
                    onDelete={() => setConfirmDeleteId(img.id)}
                    deleting={deletingId === img.id}
                    onViewVariation={onViewVariation}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={!!confirmDeleteId}
        title="Purge Neural Variation?"
        message="This action will permanently erase this generation artifact from your library vault."
        onConfirm={() => confirmDeleteId && deleteImage(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <ConfirmationModal
        isOpen={confirmDeleteBatch}
        title="Mass Purge Variations?"
        message={`You are about to permanently erase ${selectedIds.size} generation artifacts from your library vault.`}
        onConfirm={deleteBatch}
        onCancel={() => setConfirmDeleteBatch(false)}
        confirmText={`Delete ${selectedIds.size} Items`}
      />
    </div>
  );
}
