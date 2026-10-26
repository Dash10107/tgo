
import type { NavigationItem } from '@/types';

// Navigation items configuration
export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'chat',
    title: 'navigation.chat',
    icon: 'MessageCircle',
    path: '/chat'
  },
  {
    id: 'ai',
    title: 'navigation.ai',
    icon: 'Sparkles',
    path: '/ai'
  },
  {
    id: 'visitors',
    title: 'navigation.visitors',
    icon: 'Users',
    path: '/visitors'
  },
  {
    id: 'knowledge',
    title: 'navigation.knowledge',
    icon: 'Library',
    path: '/knowledge'
  },
  {
    id: 'channels',
    title: 'navigation.channels',
    icon: 'Platform',
    path: '/platforms'
  },
  {
    id: 'settings',
    title: 'navigation.settings',
    icon: 'Settings',
    path: '/settings'
  }
];

// AI feature menu config
export const AI_MENU_ITEMS: NavigationItem[] = [
  {
    id: 'agents',
    title: 'navigation.agents',
    icon: 'Bot',
    path: '/ai/agents'
  },
  {
    id: 'tools',
    title: 'navigation.tools',
    icon: 'Wrench',
    path: '/ai/tools'
  },
  {
    id: 'skills',
    title: 'navigation.skills',
    icon: 'Zap',
    path: '/ai/skills'
  },
  {
    id: 'device-control',
    title: 'navigation.deviceControl',
    icon: 'Monitor',
    path: '/ai/device-control'
  },
  {
    id: 'workflows',
    title: 'navigation.workflows',
    icon: 'GitBranch',
    path: '/ai/workflows'
  }
];

// Platform icons mapping
export const PLATFORM_ICONS: Record<string, string> = {
  wechat: 'https://cdn.simpleicons.org/wechat/07C160',
  tiktok: 'https://cdn.simpleicons.org/tiktok/000000',
  website: 'Globe'
} as const;

// Message types
export const MESSAGE_TYPES = {
  VISITOR: 'visitor',
  AGENT: 'agent',
  SYSTEM: 'system'
} as const;

// Tag colors mapping
export const TAG_COLORS: Record<string, string> = {
  'New User': 'bg-blue-100 text-blue-700',
  'From Search': 'bg-gray-100 text-gray-700',
  'From Website': 'bg-gray-100 text-gray-700',
  'Product A Inquiry': 'bg-green-100 text-green-700',
  'Returning Customer': 'bg-purple-100 text-purple-700',
  'Technical Support': 'bg-indigo-100 text-indigo-700',
  'Follow-up Needed': 'bg-yellow-100 text-yellow-700',
  'Complaint': 'bg-red-100 text-red-700',
  'High Priority': 'bg-pink-100 text-pink-700',
  'Pre-sales Inquiry': 'bg-gray-100 text-gray-700'
} as const;

// Avatar placeholder URLs
export const AVATAR_URLS: Record<string, string> = {
  user: 'https://i.pravatar.cc/40?img=0',
  visitor: 'https://i.pravatar.cc/64?img=30'
} as const;
