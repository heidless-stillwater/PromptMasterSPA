import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  collection, query, orderBy, getDocs, deleteDoc, doc, limit, startAfter, QueryDocumentSnapshot
} from 'firebase/firestore';
import { toolDb } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Icons } from './Icons';

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

// ── Variation Set Explorer ────────────────────────────────────────
function VariationExplorer({ 
    group, 
    onClose, 
    onLightbox,
    onDelete,
    onToggleSelect,
    selectedIds,
    deletingId,
    onViewVariation,
    activeThumbnailUrl
}: { 
    group: GImage[]; 
    onClose: () => void;
    onLightbox: (img: GImage) => void;
    onDelete: (id: string) => void;
    onToggleSelect: (id: string) => void;
    selectedIds: Set<string>;
    deletingId: string | null;
    onViewVariation?: (img: GImage) => void;
    activeThumbnailUrl?: string | null;
}) {
  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollTop = 0;
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  if (!group || group.length === 0) return null;

  return createPortal(
    <div 
      ref={scrollRef}
      className="fixed inset-0 z-[210] overflow-y-auto bg-[#0a0a0f]/98 backdrop-blur-3xl" 
      onClick={onClose}
    >
      <div className="min-h-screen w-full flex flex-col p-6 md:p-12" onClick={e => e.stopPropagation()}>
        {/* Header Area */}
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                 <Icons.stack size={16} />
              </div>
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Variation Set Explorer</span>
            </div>
            <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white">
              {group[0]?.title || "Neural Generation Set"}
            </h3>
            <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em]">
              INDEX: <span className="text-white/60">{group[0]?.promptSetID}</span> <span className="mx-2 text-white/10">|</span> {group.length} ASSETS DETECTED
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-5 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 rounded-3xl transition-all border border-white/10 group active:scale-90"
          >
            <Icons.close className="w-8 h-8 transition-transform group-hover:rotate-90" />
          </button>
        </div>

        {/* Grid Area */}
        <div className="max-w-7xl w-full mx-auto flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-24">
            {group.map(img => (
              <GalleryCard
                key={img.id}
                image={img}
                viewMode="grid-4"
                isSelected={selectedIds.has(img.id)}
                onToggleSelect={() => onToggleSelect(img.id)}
                onLightbox={() => onLightbox(img)}
                onDelete={() => onDelete(img.id)}
                deleting={deletingId === img.id}
                onViewVariation={onViewVariation}
                activeThumbnailUrl={activeThumbnailUrl}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

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
    <div className="fixed inset-0 z-[1000] overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-[#0a0a0f]/98 backdrop-blur-3xl pointer-events-none" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative max-w-7xl w-full h-auto max-h-[95vh] flex flex-col md:flex-row items-stretch rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 bg-[#0a0a0f]"
          onClick={e => e.stopPropagation()}
        >
          {/* Media Side */}
          <div className="flex-1 relative bg-black/40 flex items-center justify-center overflow-hidden min-h-[400px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_100%)]"></div>
            <img
              src={image.imageUrl}
              alt={image.prompt}
              className="relative z-10 w-full h-full object-contain p-8 animate-in zoom-in-95 duration-500"
            />
          </div>

          {/* Info Side */}
          <div className="w-full md:w-[450px] border-l border-white/5 p-8 flex flex-col gap-8 bg-[#12121a]/50 backdrop-blur-3xl overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                   <Icons.sparkles size={16} />
                </div>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Neural Manifest v1.0</span>
              </div>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                {image.title || "Untitled Fragment"}
              </h3>
              <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest">{formatDate(image.createdAt)} Registry Sequence</p>
            </div>

            <div className="space-y-4">
              <div className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl space-y-4 group">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] group-hover:text-primary transition-colors">Neural Blueprint Hash</p>
                <div className="max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                   <p className="text-xs text-white/60 leading-relaxed font-medium font-mono break-all">{image.prompt}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center gap-3">
                <Icons.stack className="w-5 h-5 text-primary" />
                <div className="text-center">
                   <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Density</p>
                   <p className="text-[11px] font-black text-white uppercase">{image.settings?.quality || 'Standard'}</p>
                </div>
              </div>
              <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center gap-3">
                <Icons.play className="w-5 h-5 text-primary" />
                <div className="text-center">
                   <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Architecture</p>
                   <p className="text-[11px] font-black text-white uppercase">{image.settings?.modality || 'Image'}</p>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-3 pt-8 border-t border-white/5">
              {onViewVariation && image.promptSetID && (
                <button
                  onClick={() => {
                    onViewVariation(image);
                    onClose();
                  }}
                  className="w-full py-5 bg-primary text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-primary/80 active:scale-[0.98] transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3"
                >
                  <Icons.edit size={16} /> Update Variations
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all"
              >
                Close Asset Node
              </button>
            </div>
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
    <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-xl" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-[#12121a] border border-rose-500/20 rounded-[2.5rem] p-10 shadow-2xl animate-fade-in-up">
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="w-20 h-20 rounded-3xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
            <Icons.alert className="w-10 h-10 text-rose-500" />
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{title}</h3>
            <p className="text-[10px] leading-relaxed text-white/30 font-black uppercase tracking-widest px-4">{message}</p>
          </div>
          <div className="w-full flex flex-col gap-4">
            <button
              onClick={onConfirm}
              className="w-full py-5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-xl shadow-rose-600/20 active:scale-95"
            >
              {confirmText}
            </button>
            <button
              onClick={onCancel}
              className="w-full py-5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all active:scale-95"
            >
              Terminate Action (Cancel)
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
  activeThumbnailUrl?: string | null;
}

function GalleryCard({
  image, viewMode, isSelected, onToggleSelect, onLightbox, onDelete, deleting, onViewVariation, activeThumbnailUrl
}: GalleryCardProps) {
  const isPublished = image.publishedToCommunity || image.publishedToLeague;
  const isVideo = !!(image.videoUrl || image.settings?.modality === 'video');

  if (viewMode === 'list') {
    return (
      <div
        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all group ${isSelected ? 'bg-primary/10 border-primary/30' : 'bg-white/[0.02] border-white/5 hover:border-white/15'}`}
      >
        <button
          onClick={onToggleSelect}
          className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-primary border-primary' : 'bg-white/5 border-white/10 hover:border-primary/50'}`}
        >
          {isSelected && <Icons.check size={14} className="text-white" />}
        </button>
        <button onClick={onLightbox} className="shrink-0 relative group">
          <img src={image.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10 group-hover:border-primary/50 transition-all" />
          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
             <p className="text-white text-sm font-black uppercase tracking-tighter truncate">{image.title || "Untitled Fragment"}</p>
             <div className="flex gap-2">
                {isPublished && <span className="text-[8px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest border border-primary/20">Registry Hub</span>}
                {image.isExemplar && <span className="text-[8px] font-black bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full uppercase tracking-widest border border-amber-500/20">Exemplar</span>}
             </div>
          </div>
          <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em] truncate">{image.prompt}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {onViewVariation && image.promptSetID && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewVariation(image); }}
              className="px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center gap-2"
            >
              <Icons.edit size={12} /> Workbench
            </button>
          )}
          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">{formatDate(image.createdAt)}</span>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-white/20 hover:text-rose-500 border border-transparent hover:border-rose-500/20 transition-all"
          >
            {deleting ? <Icons.refresh size={16} className="animate-spin" /> : <Icons.trash size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden border transition-all cursor-pointer bg-white/[0.02] shadow-2xl ${isSelected ? 'border-primary ring-4 ring-primary/10' : 'border-white/5 hover:border-primary/30'}`}
      onClick={onLightbox}
    >
      {/* select toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        className={`absolute top-3 left-3 z-20 w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-xl backdrop-blur-md ${isSelected ? 'bg-primary border-primary scale-100' : 'bg-black/40 border-white/20 opacity-0 group-hover:opacity-100 hover:border-primary'}`}
      >
        {isSelected && <Icons.check size={16} className="text-white" />}
      </button>

      {/* delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        disabled={deleting}
        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-xl bg-rose-600/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:bg-rose-500"
      >
        {deleting ? <Icons.refresh size={14} className="animate-spin" /> : <Icons.trash size={14} />}
      </button>

      {/* image */}
      <div className="aspect-square bg-white/[0.01] overflow-hidden">
        <img 
           src={image.imageUrl} 
           alt={image.prompt} 
           className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
           loading="lazy" 
        />
      </div>

      {/* Badge Overlays */}
      <div className="absolute top-14 left-3 flex flex-col gap-1.5 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        {image.imageUrl === activeThumbnailUrl && (
          <div className="flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl border border-primary/50 animate-pulse">
            <Icons.check size={10} /> Active Architecture
          </div>
        )}
        {isPublished && (
          <div className="flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl">
            <Icons.trophy size={10} /> Hub
          </div>
        )}
        {image.isExemplar && (
          <div className="flex items-center gap-2 bg-amber-500 text-black px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl">
            <Icons.star size={10} /> Exemplar
          </div>
        )}
        {isVideo && (
          <div className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl">
            <Icons.play size={10} /> Video
          </div>
        )}
      </div>

      {/* quality pill */}
      {image.settings?.quality && (
        <div className="absolute bottom-12 left-3 z-10 pointer-events-none">
          <span className="bg-black/60 backdrop-blur-md border border-white/10 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">
            {qualityLabel[image.settings.quality] ?? image.settings.quality}
          </span>
        </div>
      )}

      {/* title bar */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent z-10">
        <p className="text-[10px] font-black text-white uppercase tracking-tighter truncate">
          {image.title || "Untitled Fragment"}
        </p>
      </div>

      {/* hover overlay interaction */}
      <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-4 z-[15] backdrop-blur-[2px]">
        {onViewVariation && image.promptSetID && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewVariation(image); }}
            className={`px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-2xl active:scale-95 flex items-center gap-3 ${image.imageUrl === activeThumbnailUrl ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-white text-black hover:bg-primary hover:text-white'}`}
          >
            {image.imageUrl === activeThumbnailUrl ? <Icons.close size={14} /> : <Icons.edit size={14} />}
            {image.imageUrl === activeThumbnailUrl ? 'Deselect Architecture' : 'Workbench'}
          </button>
        )}
        <div className="flex items-center gap-2 text-[9px] font-black text-white/50 uppercase tracking-[0.3em]">
           <Icons.external size={12} /> Immersion Preview
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
interface GalleryProps {
  onViewVariation?: (image: GImage) => void;
  initialSearch?: string;
  initialAssetId?: string | null;
  activeThumbnailUrl?: string | null;
}

export default function PromptToolGallery({ onViewVariation, initialSearch = '', initialAssetId = null, activeThumbnailUrl = null }: GalleryProps) {
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
      // silent fail
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
    'grid-2': 'grid grid-cols-2 gap-6',
    'grid-3': 'grid grid-cols-2 md:grid-cols-3 gap-6',
    'grid-4': 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6',
    'list': 'flex flex-col gap-4',
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      {/* ── CONTROL BELT (Aligned with Resources) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-background-secondary/30 backdrop-blur-xl border border-white/5 rounded-[2rem] mb-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 flex-1 min-w-[300px] relative z-10">
          {/* Search Architecture */}
          <div className="relative flex-1 max-w-md group">
            <Icons.search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchQuery ? 'text-primary' : 'text-white/20'}`} />
            <input
              type="text"
              placeholder="Search Registry Artifacts…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-12 pr-10 bg-black/40 border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-primary/50 transition-all font-medium placeholder:text-white/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/80">
                <Icons.close size={14} />
              </button>
            )}
          </div>

          <div className="h-8 w-px bg-white/5 hidden md:block"></div>

          <button
            onClick={() => setIsGrouped(!isGrouped)}
            className={`flex items-center gap-2.5 h-11 px-5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${isGrouped ? 'bg-primary/10 text-primary border-primary/20 shadow-xl' : 'bg-black/40 text-white/20 border-white/5 hover:text-white hover:border-white/10'}`}
          >
            <Icons.stack className={`w-4 h-4 ${isGrouped ? 'animate-pulse' : ''}`} />
            {isGrouped ? "Grouped View" : "Individual"}
          </button>
          
          <div className="h-8 w-px bg-white/5 hidden md:block"></div>

          {/* Density Selector Architecture */}
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
            {(['grid-2', 'grid-3', 'grid-4'] as ViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === m ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white'}`}
              >
                {m.split('-')[1]}C
              </button>
            ))}
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white'}`}
              title="List View"
            >
              <Icons.list size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {/* Sort Protocol */}
          <div className="relative group/sort hidden lg:block">
            <select
              value={sortMode}
              onChange={e => { setSortMode(e.target.value as SortMode); setImages([]); setLastDoc(null); }}
              className="h-11 bg-background border border-white/5 rounded-xl px-4 pr-10 text-[10px] font-black uppercase text-white/70 outline-none hover:bg-white/5 hover:border-primary/30 transition-all cursor-pointer min-w-[180px] appearance-none tracking-widest"
            >
              <option value="newest">Latest Chronology</option>
              <option value="oldest">Legacy Archives</option>
            </select>
            <Icons.chevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 pointer-events-none group-hover/sort:text-primary transition-colors" />
          </div>

          <div className="h-8 w-px bg-white/5 hidden md:block"></div>

          <button
            onClick={() => { setImages([]); setLastDoc(null); fetchImages(); }}
            disabled={loading}
            className="h-11 w-11 flex items-center justify-center bg-black/40 border border-white/5 rounded-xl text-white/20 hover:text-primary hover:border-primary/30 transition-all shadow-xl disabled:opacity-50"
          >
            <Icons.refresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Selection bar ────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-5 px-6 py-4 bg-primary/5 border border-primary/20 rounded-[2rem] animate-fade-in-up backdrop-blur-3xl">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center text-white text-sm font-black shadow-xl shadow-primary/30">
              {selectedIds.size}
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Artifacts Selected</span>
          </div>
          <div className="flex gap-2">
             <button onClick={selectAll} className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5">
               Select All Domain
             </button>
             <button onClick={clearSelection} className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5">
               Purge Selection
             </button>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setConfirmDeleteBatch(true)}
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-rose-600/20 active:scale-95 border border-rose-400/20"
          >
            <Icons.trash size={16} /> Commit Batch Purge
          </button>
        </div>
      )}

      {/* ── Stats bar ────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center justify-between px-2">
           <div className="flex items-center gap-3 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
             <Icons.image size={14} className="text-indigo-400/30" />
             <span>{filtered.length} Indexed Nodes {filtered.length !== images.length ? `/ Total Archive: ${images.length}` : ''}</span>
           </div>
           {isGrouped && (
             <div className="flex items-center gap-3 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
               <Icons.stack size={14} className="text-indigo-400/30" />
               <span>{Object.keys(grouped || {}).length} Compressed Sets</span>
             </div>
           )}
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-6">
          <div className="relative">
             <div className="absolute -inset-4 bg-indigo-500/20 blur-2xl rounded-full animate-pulse"></div>
             <Icons.refresh className="w-12 h-12 text-indigo-400/40 animate-spin relative" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Initialising Asset Handshake…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-40 gap-6 glass-card border-rose-500/20 bg-rose-500/[0.02]">
          <Icons.alert className="w-12 h-12 text-rose-500/40" />
          <p className="text-sm font-black text-rose-500 uppercase tracking-widest text-center px-10">Sync Overload: {error}</p>
          <button onClick={() => fetchImages()} className="px-8 py-3 bg-rose-500 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-rose-400 transition-all shadow-xl shadow-rose-500/20">Retry Handshake</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-60 border border-dashed border-white/5 rounded-[3rem] bg-white/[0.01] gap-8 text-center animate-fade-in group">
          <div className="relative">
            <div className="absolute -inset-10 bg-primary/10 blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
            <Icons.image className="relative w-24 h-24 text-white/5 transition-colors group-hover:text-primary/20" />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-black uppercase tracking-[0.5em] text-white/30">Ecosystem Sparse</p>
            <p className="text-[11px] text-white/10 uppercase tracking-[0.3em] font-black max-w-sm mx-auto leading-relaxed">Generated Neural Fragments may be outside current filtering parameters</p>
          </div>
          {(searchQuery || !isGrouped) && (
            <button 
              onClick={() => { setSearchQuery(''); setIsGrouped(true); }}
              className="px-10 py-5 bg-primary/10 hover:bg-primary text-primary hover:text-white text-[11px] font-black uppercase tracking-[0.3em] border border-primary/20 rounded-[2rem] transition-all shadow-2xl active:scale-95 flex items-center gap-4 mx-auto"
            >
              <Icons.refresh size={16} /> Restore Registry Stream
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
                      viewMode={viewMode === 'list' ? 'grid-4' : viewMode}
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
                      activeThumbnailUrl={activeThumbnailUrl}
                    />
                    {groupImages.length > 1 && (
                      <div className="absolute -bottom-2 -right-2 z-20 bg-primary px-3 py-1.5 rounded-xl text-[9px] font-black text-white shadow-2xl border border-white/20 pointer-events-none uppercase tracking-widest animate-in slide-in-from-right-2">
                        {groupImages.length} Fragments
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
                  activeThumbnailUrl={activeThumbnailUrl}
                />
              ))
            )}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-8 pb-12">
              <button
                onClick={() => fetchImages(true)}
                disabled={loadingMore}
                className="flex items-center gap-3 px-10 py-5 bg-white/[0.02] border border-white/5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] text-white/30 hover:text-white hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all disabled:opacity-50 active:scale-95 shadow-2xl"
              >
                {loadingMore ? <Icons.refresh size={16} className="animate-spin text-indigo-400" /> : <Icons.arrowDown size={16} />}
                {loadingMore ? 'Hydrating Archive…' : 'Deep Archive Sync'}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────── */}
      {lightboxImage && (
        <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}

      {/* ── Group Detail Modal (Zen Immersion) ───────────────────────── */}
      {selectedGroup && (
        <VariationExplorer
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onLightbox={setLightboxImage}
          onDelete={setConfirmDeleteId}
          onToggleSelect={toggleSelect}
          selectedIds={selectedIds}
          deletingId={deletingId}
          onViewVariation={onViewVariation}
        />
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
