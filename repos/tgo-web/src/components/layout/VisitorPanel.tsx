import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VisitorDetailPanel from '@/components/visitor/VisitorDetailPanel';
import type { Chat } from '@/types';

interface VisitorPanelProps {
  activeChat?: Chat;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

/**
 * Normalize the channel_type field; compatible with string/number
 */
const normalizeChannelType = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

interface VisitorContext {
  channelId: string | null;
  channelType: number | null;
}

/**
 * Extract the visitor context from chat info
 */
const deriveVisitorContext = (chat?: Chat | null): VisitorContext => {
  if (!chat) {
    return {
      channelId: null,
      channelType: null
    };
  }

  const rawChannelType = chat.channelType;
  const channelType = normalizeChannelType(rawChannelType);
  const channelId = chat.channelId ?? chat.id ?? null;

  return {
    channelId,
    channelType
  };
};

/**
 * Visitor information panel component for chat interface
 * This is a wrapper around VisitorDetailPanel that extracts channel info from activeChat
 */
const VisitorPanel: React.FC<VisitorPanelProps> = ({ activeChat }) => {
  const { t } = useTranslation();
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('visitor_panel_width');
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  const { channelId, channelType } = useMemo(
    () => deriveVisitorContext(activeChat),
    [activeChat]
  );

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      // The visitor panel is on the right; dragging left (decreasing clientX) increases the width
      // Width = window.innerWidth - e.clientX
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('visitor_panel_width', width.toString());
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing, width]);

  // Show the empty state when no chat is selected
  if (!activeChat) {
    return (
      <aside 
        className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-l border-gray-200/60 dark:border-gray-700/60 flex items-center justify-center shrink-0 font-sans antialiased relative group"
        style={{ width: `${width}px` }}
      >
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-[60] group/resize flex items-center justify-center`}
          onMouseDown={startResizing}
        >
          <div className={`h-full w-0.5 transition-colors duration-200 ${isResizing ? 'bg-blue-500' : 'bg-transparent group-hover/resize:bg-blue-400/50'}`} />
        </div>
        <div className="text-center text-gray-500 dark:text-gray-400 px-4">
          <User size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-sm leading-5">{t('visitor.ui.selectConversation', 'Select a chat to view visitor information')}</p>
        </div>
      </aside>
    );
  }

  return (
    <div className="relative flex shrink-0 h-full" style={{ width: `${width}px` }}>
      {/* Drag handle: increases the hit area */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-[60] group/resize flex items-center justify-center`}
        onMouseDown={startResizing}
      >
        <div className={`h-full w-0.5 transition-colors duration-200 ${isResizing ? 'bg-blue-500' : 'bg-transparent group-hover/resize:bg-blue-400/50'}`} />
      </div>
      
      <VisitorDetailPanel
        channelId={channelId}
        channelType={channelType}
        variant="sidebar"
        className="w-full h-full border-l border-gray-200/60 dark:border-gray-700/60"
        style={{ width: '100%' }}
      />
    </div>
  );
};

export default VisitorPanel;
