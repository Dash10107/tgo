import type { Platform, PlatformStatusConfig, PlatformTypeConfig } from '@/types';

export const mockPlatforms: Platform[] = [
  {
    id: 'website',
    name: 'Website Support',
    icon: 'Globe',
    iconColor: 'text-blue-600',
    status: 'connected',
    statusText: 'Connected',
    statusColor: 'bg-green-500',
    type: 'website',
    description: 'Official website customer service platform',
    config: {
      domain: 'https://example.com',
      embedCode: '<script>...</script>'
    }
  },
  {
    id: 'wechat',
    name: 'WeChat Official Account',
    icon: 'MessageSquare',
    iconColor: 'text-green-600',
    status: 'connected',
    statusText: 'Connected',
    statusColor: 'bg-green-500',
    type: 'wechat',
    description: 'WeChat Official Account message integration',
    config: {
      appId: 'wx1234567890',
      appSecret: '***hidden***',
      token: 'your_token'
    }
  },
  {
    id: 'tiktok',
    name: 'Douyin',
    icon: 'Video',
    iconColor: 'text-black',
    status: 'unconfigured',
    statusText: 'Not configured',
    statusColor: 'bg-gray-400',
    type: 'tiktok',
    description: 'Douyin direct message integration platform',
    config: {}
  },
  {
    id: 'email',
    name: 'Email Integration',
    icon: 'Mail',
    iconColor: 'text-red-600',
    status: 'error',
    statusText: 'Connection failed',
    statusColor: 'bg-red-500',
    type: 'email',
    description: 'Email customer service integration platform',
    config: {
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      username: 'support@example.com',
      lastError: 'Authentication failed'
    }
  },
  {
    id: 'phone',
    name: 'Phone Call Center',
    icon: 'Phone',
    iconColor: 'text-gray-500',
    status: 'disabled',
    statusText: 'Disabled',
    statusColor: 'bg-gray-400',
    type: 'phone',
    description: 'Phone customer service integration platform',
    config: {}
  },
  {
    id: 'custom',
    name: 'Custom Platform (Webhook/API)',
    icon: 'Webhook',
    iconColor: 'text-purple-600',
    status: 'pending',
    statusText: 'Pending setup',
    statusColor: 'bg-yellow-400',
    type: 'custom',
    description: 'Custom platform integrated through Webhook and API',
    config: {
      webhookUrl: 'https://api.example.com/webhook/ch_abc123xyz',
      secretKey: 'sk_test_1234567890abcdef',
      outgoingUrl: '',
      outgoingToken: ''
    }
  }
];

// Platform status config
export const PLATFORM_STATUS: Record<string, PlatformStatusConfig> = {
  connected: {
    label: 'Connected',
    bgColor: 'bg-green-500',
    textColor: 'text-green-600'
  },
  pending: {
    label: 'Pending setup',
    bgColor: 'bg-yellow-400',
    textColor: 'text-yellow-600'
  },
  unconfigured: {
    label: 'Not configured',
    bgColor: 'bg-gray-400',
    textColor: 'text-gray-500'
  },
  disabled: {
    label: 'Disabled',
    bgColor: 'bg-gray-400',
    textColor: 'text-gray-500'
  },
  error: {
    label: 'Connection failed',
    bgColor: 'bg-red-500',
    textColor: 'text-red-600'
  }
};

// Platform type config
export const PLATFORM_TYPES: Record<string, PlatformTypeConfig> = {
  website: {
    label: 'Website Support',
    color: 'text-blue-600'
  },
  wechat: {
    label: 'WeChat Official Account',
    color: 'text-green-600'
  },
  tiktok: {
    label: 'Douyin',
    color: 'text-black'
  },
  email: {
    label: 'Email Integration',
    color: 'text-red-600'
  },
  phone: {
    label: 'Phone Call Center',
    color: 'text-gray-500'
  },
  custom: {
    label: 'Custom Platform',
    color: 'text-purple-600'
  }
};

// Default custom platform config
export const DEFAULT_CUSTOM_CONFIG = {
  webhookUrl: '',
  secretKey: '',
  outgoingUrl: '',
  outgoingToken: '',
  enabled: false
} as const;

