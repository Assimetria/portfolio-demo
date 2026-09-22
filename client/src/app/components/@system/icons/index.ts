/**
 * @system/icons — Centralised icon barrel
 *
 * All icon imports in the product-template should come from here instead of
 * importing directly from 'lucide-react'. This single file is the only place
 * that references the underlying icon library, so swapping to a different
 * library (e.g. Phosphor, Heroicons) only requires changing this one file.
 *
 * Usage:
 *   import { Check, Loader2, type IconType } from '@/app/components/@system/icons'
 *
 * To swap icon libraries:
 *   1. Install the new library
 *   2. Update the imports in this file to point to the new library
 *   3. Map icon names as needed (see comments below for mapping hints)
 */

export type {
  LucideIcon as IconType,
  LucideProps as IconProps,
} from 'lucide-react'

// ─── Navigation & Layout ─────────────────────────────────────────────────────
export {
  Home,
  Menu,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
} from 'lucide-react'

// ─── Actions & Controls ──────────────────────────────────────────────────────
export {
  Check,
  Copy,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

// ─── Status & Feedback ───────────────────────────────────────────────────────
export {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Info,
  Loader2,
  ShieldCheck,
  ShieldOff,
  XCircle,
} from 'lucide-react'

// ─── Content & Media ─────────────────────────────────────────────────────────
export {
  Bell,
  Clock,
  Cookie,
  File,
  FileText,
  Image,
  MessageSquare,
  MapPin,
  Monitor,
  Star,
} from 'lucide-react'

// ─── Product & Business ──────────────────────────────────────────────────────
export {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  Database,
  Globe,
  Heart,
  Key,
  Lightbulb,
  Settings,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react'

// ─── Communication ───────────────────────────────────────────────────────────
export { Mail } from 'lucide-react'

// ─── Brand / Social (no lucide equivalent for Google — use inline SVG) ───────
export {
  Github,
  Linkedin,
  Twitter,
  Youtube,
} from 'lucide-react'
