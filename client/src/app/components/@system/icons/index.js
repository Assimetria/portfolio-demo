// @system — Lucide icon resolver
// Maps icon name strings from nav config to actual React components.
// This lets @custom navigation.js specify icons as strings (e.g. 'Trophy')
// and @system components resolve them without importing every icon.
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Dumbbell,
  Eye,
  Globe,
  GraduationCap,
  Heart,
  HelpCircle,
  Home,
  Key,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  Sliders,
  Sun,
  Swords,
  Trophy,
  User,
  Users,
  Webhook,
  X,
} from 'lucide-react'

const iconMap = {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Dumbbell,
  Eye,
  Globe,
  GraduationCap,
  Heart,
  HelpCircle,
  Home,
  Key,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  Sliders,
  Sun,
  Swords,
  Trophy,
  User,
  Users,
  Webhook,
  X,
}

/**
 * Resolve an icon name string to a Lucide React component.
 * Returns a fallback (HelpCircle) if not found.
 * @param {string} name - Icon name (e.g. 'Trophy')
 * @returns {React.ComponentType}
 */
export function resolveIcon(name) {
  return iconMap[name] || HelpCircle
}

export { iconMap }
