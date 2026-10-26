// Icon map: from lucide icon names to React components
import React from 'react';
import {
  // Basic icons
  Plus,
  Search,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Pencil,
  Trash2,
  Share2,
  MoreHorizontal as Ellipsis,
  
  // Navigation icons
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  
  // Interface icons
  Smile,
  Scissors,
  Image,
  ListChecks,
  Folder,
  FolderOpen,
  Clock,
  Star,
  Meh,
  MousePointerClick,
  Ticket,
  CirclePlus,
  Inbox,
  
  // Communication icons
  Bot,
  Users,
  Globe,
  Mail,
  Phone,
  Webhook,
  Circle,
  
  // Tool icons
  Wrench,
  Activity,
  
  // Other
  type LucideIcon
} from 'lucide-react';

// Icon map object
export const iconMap: Record<string, LucideIcon> = {
  // Basic actions
  'plus': Plus,
  'search': Search,
  'settings': Settings,
  'refresh-cw': RefreshCw,
  'eye': Eye,
  'eye-off': EyeOff,
  'copy': Copy,
  'pencil': Pencil,
  'trash-2': Trash2,
  'share-2': Share2,
  'ellipsis': Ellipsis,
  
  // Navigation
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-down-up': ArrowUpDown,
  
  // Interface elements
  'smile': Smile,
  'scissors': Scissors,
  'image': Image,
  'list-checks': ListChecks,
  'folder': Folder,
  'folder-open': FolderOpen,
  'clock': Clock,
  'star': Star,
  'meh': Meh,
  'mouse-pointer-click': MousePointerClick,
  'ticket': Ticket,
  'circle-plus': CirclePlus,
  'inbox': Inbox,
  
  // Communication and channels
  'bot': Bot,
  'users': Users,
  'globe': Globe,
  'mail': Mail,
  'phone': Phone,
  'custom': Webhook,
  'circle': Circle,

  // Tools
  'wrench': Wrench,
  'activity': Activity
};

// Helper function to get an icon component
export const getIcon = (iconName: string): LucideIcon | null => {
  return iconMap[iconName] || null;
};

// Icon component wrapper that handles className and other props uniformly
interface IconProps {
  name: string;
  className?: string;
  size?: number;
  color?: string;
  [key: string]: any;
}

export const Icon: React.FC<IconProps> = ({ name, className, size, color, ...props }) => {
  const IconComponent = getIcon(name);
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in iconMap`);
    return null;
  }
  
  return (
    <IconComponent 
      className={className}
      size={size}
      color={color}
      {...props}
    />
  );
};

export default Icon;
