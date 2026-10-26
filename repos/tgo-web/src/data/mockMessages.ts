import type { Message } from '@/types';

export const mockMessages: Message[] = [
  {
    id: '1',
    type: 'system',
    content: 'Today 10:30',
    timestamp: '2024-05-01T10:30:00Z'
  },
  {
    id: '2',
    type: 'visitor',
    content: 'Hi, I would like to ask where my order #ORD123 is?',
    fromInfo: { name: 'Wukong', avatar: 'https://i.pravatar.cc/64?img=30', channel_id: 'visitor-1', channel_type: 1 },
    platform: 'wechat',
    avatar: 'https://i.pravatar.cc/64?img=30',
    timestamp: '2024-05-01T10:30:15Z',
    aiInfo: {
      title: 'Order Info #ORD123',
      status: 'Identified',
      details: {
        status: 'Shipped',
        product: 'Smart Noise-Cancelling Headphones Pro',
        tracking: 'SF Express SF987654321'
      },
      actions: [
        { label: 'Insert logistics info', type: 'primary' },
        { label: 'View details', type: 'secondary' }
      ]
    }
  },
  {
    id: '3',
    type: 'staff',
    content: 'Hello! Let me check the order status for you.',
    fromInfo: { name: 'Yuan Jie', avatar: 'https://i.pravatar.cc/40?img=0', channel_id: 'staff-1', channel_type: 1 },
    avatar: 'https://i.pravatar.cc/40?img=0',
    timestamp: '2024-05-01T10:30:30Z'
  },
  {
    id: '4',
    type: 'staff',
    content: 'Your order #ORD123 has been shipped. The logistics details are as follows:\n\n📦 Smart Noise-Cancelling Headphones Pro\n🚚 SF Express: SF987654321\n📍 Current status: In transit\n🕐 Estimated delivery: tomorrow afternoon',
    fromInfo: { name: 'Yuan Jie', avatar: 'https://i.pravatar.cc/40?img=0', channel_id: 'staff-1', channel_type: 1 },
    avatar: 'https://i.pravatar.cc/40?img=0',
    timestamp: '2024-05-01T10:31:00Z'
  },
  {
    id: '5',
    type: 'visitor',
    content: 'Great! Thanks for your help 👍',
    fromInfo: { name: 'Wukong', avatar: 'https://i.pravatar.cc/64?img=30', channel_id: 'visitor-1', channel_type: 1 },
    platform: 'wechat',
    avatar: 'https://i.pravatar.cc/64?img=30',
    timestamp: '2024-05-01T10:31:15Z'
  },
  {
    id: '6',
    type: 'visitor',
    content: 'By the way, how long is the warranty on these headphones?',
    fromInfo: { name: 'Wukong', avatar: 'https://i.pravatar.cc/64?img=30', channel_id: 'visitor-1', channel_type: 1 },
    platform: 'wechat',
    avatar: 'https://i.pravatar.cc/64?img=30',
    timestamp: '2024-05-01T10:31:45Z',
    aiInfo: {
      title: 'Product Warranty Inquiry',
      status: 'Pending',
      details: {
        product: 'Smart Noise-Cancelling Headphones Pro',
        category: 'Warranty Policy'
      },
      actions: [
        { label: 'Insert warranty info', type: 'primary' },
        { label: 'Transfer to technical support', type: 'secondary' }
      ]
    }
  },
  {
    id: '7',
    type: 'staff',
    content: 'The Smart Noise-Cancelling Headphones Pro come with a 2-year warranty, including:\n\n✅ Free repair of hardware faults\n✅ Battery performance guarantee\n✅ Nationwide warranty service\n\nIf you run into any problem while using them, feel free to contact our support team anytime.',
    fromInfo: { name: 'Yuan Jie', avatar: 'https://i.pravatar.cc/40?img=0', channel_id: 'staff-1', channel_type: 1 },
    avatar: 'https://i.pravatar.cc/40?img=0',
    timestamp: '2024-05-01T10:32:30Z'
  },
  {
    id: '8',
    type: 'visitor',
    content: 'Got it, thank you very much!',
    fromInfo: { name: 'Wukong', avatar: 'https://i.pravatar.cc/64?img=30', channel_id: 'visitor-1', channel_type: 1 },
    platform: 'wechat',
    avatar: 'https://i.pravatar.cc/64?img=30',
    timestamp: '2024-05-01T10:32:45Z'
  },
  {
    id: '9',
    type: 'system',
    content: 'Customer satisfaction rating: ⭐⭐⭐⭐⭐ (5/5)',
    timestamp: '2024-05-01T10:33:00Z'
  }
];
