import React from 'react';
import {
    Loader2,
    Download,
    Trash2,
    Copy,
    Share2,
    ExternalLink,
    MoreHorizontal,
    Heart,
    MessageSquare,
    Repeat,
    Flag,
    UserPlus,
    UserCheck,
    Trophy,
    Star,
    Camera,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Plus,
    Search,
    Settings,
    Image as ImageIcon,
    History,
    LayoutGrid,
    Layers,
    Check,
    X,
    AlertCircle,
    Clock,
    ArrowLeft,
    ArrowRight,
    Sparkles,
    Zap,
    CreditCard,
    LogOut,
    User,
    Home,
    Bell,
    Menu,
    Eye,
    EyeOff,
    Filter,
    Video,
    ArrowUp,
    ArrowDown,
    Info,
    Globe,
    HardDrive,
    AlertTriangle,
    Activity,
    Wand2,
    Shield,
    Upload,
    FileText,
    List,
    LayoutList,
    Users,
    Rows,
    Tag,
    Play,
    Award,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Folder,
    Trash,
    Save,
    Sliders,
    Send,
    ZoomIn,
    Edit3,
    UploadCloud,
    Terminal,
    Crosshair as Target
} from "lucide-react"

// Twitter/X icon (removed from lucide-react v1)
const Twitter = ({ size = "1em", height, width, ...props }: React.SVGProps<SVGSVGElement> & { size?: number | string }) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        width={size || width || "1em"} 
        height={size || height || "1em"} 
        {...props}
    >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
    </svg>
);

// Instagram icon (removed from lucide-react v1)
const Instagram = ({ size = "1em", height, width, ...props }: React.SVGProps<SVGSVGElement> & { size?: number | string }) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        width={size || width || "1em"} 
        height={size || height || "1em"} 
        {...props}
    >
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
);

// Google icon
const Google = ({ size = "1em", height, width, ...props }: React.SVGProps<SVGSVGElement> & { size?: number | string }) => (
    <svg 
        viewBox="0 0 48 48" 
        width={size || width || "1em"} 
        height={size || height || "1em"} 
        {...props}
    >
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
);

export const Icons = {
    play: Play,
    tag: Tag,
    instagram: Instagram,
    google: Google,

    spinner: Loader2,
    users: Users,
    wand: Wand2,
    text: FileText,
    upload: Upload,
    download: Download,
    delete: Trash2,
    copy: Copy,
    share: Share2,
    twitter: Twitter,
    external: ExternalLink,
    more: MoreHorizontal,
    heart: Heart,
    comment: MessageSquare,
    variation: Repeat,
    report: Flag,
    follow: UserPlus,
    following: UserCheck,
    trophy: Trophy,
    star: Star,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    chevronDown: ChevronDown,
    plus: Plus,
    search: Search,
    settings: Settings,
    image: ImageIcon,
    history: History,
    grid: LayoutGrid,
    stack: Layers,
    check: Check,
    close: X,
    clock: Clock,
    arrowLeft: ArrowLeft,
    arrowRight: ArrowRight,
    sparkles: Sparkles,
    zap: Zap,
    billing: CreditCard,
    logout: LogOut,
    user: User,
    home: Home,
    bell: Bell,
    menu: Menu,
    eye: Eye,
    eyeOff: EyeOff,
    filter: Filter,
    video: Video,
    arrowUp: ArrowUp,
    arrowDown: ArrowDown,
    info: Info,
    globe: Globe,
    database: HardDrive,
    alert: AlertTriangle,
    activity: Activity,
    shield: Shield,
    error: AlertTriangle,
    list: List,
    feed: LayoutList,
    rows: Rows,
    exemplar: Award,
    refresh: RefreshCw,
    trendingUp: TrendingUp,
    trendingDown: TrendingDown,
    folder: Folder,
    edit: Edit3,
    trash: Trash,
    layoutGrid: LayoutGrid,
    save: Save,
    sliders: Sliders,
    send: Send,
    zoomIn: ZoomIn,
    edit3: Edit3,
    uploadCloud: UploadCloud,
    camera: Camera,
    terminal: Terminal,
    target: Target
}
