import type { Visitor } from '@/types';

export interface CustomAttribute {
  id: string;
  key: string;
  value: string;
  editable?: boolean;
}

export interface VisitorBasicInfo {
  name: string;
  email: string;
  phone: string;
  nickname?: string;
  company?: string;
  jobTitle?: string;
  source?: string;
  note?: string;
  avatarUrl?: string;
  lastOnlineDurationMinutes?: number | null;
  customAttributes?: CustomAttribute[];
}

export interface VisitorEmotion {
  type: 'positive' | 'neutral' | 'negative';
  icon: string;
  label: string;
}

export interface VisitorAIInsights {
  satisfaction: number; // out of 5
  emotion: VisitorEmotion;
}

export interface VisitorSystemInfo {
  firstVisit: string;
  source: string;
  browser: string;
}

export interface VisitorActivity {
  icon: string;
  action: string;
}

export interface VisitorTicket {
  id: string;
  title: string;
  icon: string;
}

export interface AIPersonaTag {
  type: 'interest' | 'identity' | 'preference' | 'behavior';
  label: string;
}

export interface VisitorTag {
  id: string;
  display_name?: string;
  name: string;
  color: string;
  weight: number; // 1-10, 10 is the highest weight
  createdAt?: string;
}

export interface ExtendedVisitor extends Omit<Visitor, 'tags'> {
  platform: string;
  firstVisit: string;
  visitCount: number;
  tags: VisitorTag[];
  basicInfo: VisitorBasicInfo;
  aiInsights: VisitorAIInsights;
  systemInfo: VisitorSystemInfo;
  recentActivity: VisitorActivity[];
  relatedTickets: VisitorTicket[];
  aiPersonaTags?: AIPersonaTag[];
}

export const mockVisitor: ExtendedVisitor = {
  id: '1',
  name: 'Wukong',
  avatar: 'https://i.pravatar.cc/64?img=30',
  status: 'online',
  platform: 'website',
  firstVisit: '2024/05/01 10:30',
  visitCount: 1,
  tags: [
    { id: '1', display_name: 'New User', color: 'emerald', weight: 7, name: 'New User' },
    { id: '2', display_name: 'From Website', color: 'blue', weight: 5, name: 'From Website' },
    { id: '3', display_name: 'Pre-sales Inquiry', color: 'green', weight: 8, name: 'Pre-sales Inquiry' }
  ],
  basicInfo: {
    name: 'Wukong',
    email: 'monkey.king@example.com.verylongdomainname.test',
    phone: '+86 138-0013-8000',
    customAttributes: [
      { id: '1', key: 'Company', value: 'Huaguoshan Technology Co., Ltd.', editable: true },
      { id: '2', key: 'Position', value: 'Senior Product Manager and UX Designer', editable: true },
      { id: '3', key: 'Source channel', value: 'Referred by a friend via a WeChat group share', editable: true },
      { id: '4', key: 'Notes', value: 'Very interested in our products and wants to learn more about features and pricing; may become an important customer', editable: true }
    ]
  },
  aiInsights: {
    satisfaction: 4, // out of 5
    emotion: {
      type: 'neutral',
      icon: 'Meh',
      label: 'Neutral'
    }
  },
  systemInfo: {
    firstVisit: '2024/05/01 10:30',
    source: 'Website Support',
    browser: 'Chrome / macOS'
  },
  recentActivity: [
    {
      icon: 'Eye',
      action: 'Viewed Product Page A'
    },
    {
      icon: 'MousePointerClick',
      action: 'Visited the Pricing Page'
    }
  ],
  relatedTickets: [
    {
      id: '#12345',
      title: 'Feature Inquiry',
      icon: 'Ticket'
    }
  ],
  aiPersonaTags: [
    { type: 'interest', label: 'Likes coffee' },
    { type: 'interest', label: 'Interested in Switch' },
    { type: 'identity', label: 'College student' },
    { type: 'preference', label: 'Price sensitive' },
    { type: 'preference', label: 'Quality oriented' },
    { type: 'behavior', label: 'Night owl' },
  ]
};
