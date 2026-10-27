import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, Copy, Check, Globe, Radio, MoreHorizontal, Terminal, Wrench, Package, ArrowUpRight, Link2 } from 'lucide-react';
import { NotchCard, MenuPanel, MenuItem } from '@/components/ui/PageKit';
import type { AiTool } from '@/types';
import { useTranslation } from 'react-i18next';
import { getToolDisplayTitle } from '@/utils/projectToolsTransform';

interface ToolCardProps {
  tool: AiTool;
  onAction: (actionType: string, tool: AiTool) => void;
  onShowToast?: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

/**
 * Tool card component - Redesigned to be more subtle
 */
const ToolCard: React.FC<ToolCardProps> = ({ tool, onAction, onShowToast }) => {
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { t, i18n } = useTranslation();

  // Determine display title based on language
  const displayTitle = getToolDisplayTitle(tool, i18n.language);

  // Extract tool data
  const toolType = tool.config?.tool_type || 'Tool';
  const transportType = tool.config?.transport_type || 'http';
  const endpoint = tool.config?.endpoint || tool.endpoint || '';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleAction = async (actionType: string): Promise<void> => {
    setShowMenu(false);
    onAction?.(actionType, tool);
  };

  const handleCopyEndpoint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!endpoint) return;
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopiedEndpoint(true);
      onShowToast?.('success', t('common.copied', 'Copied'), t('tools.endpointCopied', 'Endpoint address copied to clipboard'));
      setTimeout(() => setCopiedEndpoint(false), 2000);
    } catch (error) {
      onShowToast?.('error', t('common.copyFailed', 'Copy failed'), t('tools.copyEndpointFailed', 'Unable to copy endpoint address'));
    }
  };

  const getToolIconConfig = (toolType: string, transportType: string) => {
    const isMCP = toolType === 'MCP';
    const isFunction = toolType === 'FUNCTION';
    const transport = transportType.toLowerCase();

    if (isFunction) {
      // Function/HTTP tools use a consistent blue/globe theme
      return {
        icon: Globe,
        color: 'text-sky-300',
        bgColor: 'bg-ink-900',
        dot: 'bg-sky-400',
        label: 'HTTP'
      };
    }

    if (isMCP) {
      // MCP tools use a consistent green theme
      let Icon = Package;
      if (transport === 'stdio') Icon = Terminal;
      if (transport === 'sse') Icon = Radio;
      
      return {
        icon: Icon,
        color: 'text-acid-400',
        bgColor: 'bg-ink-900',
        dot: 'bg-acid-500',
        label: transport.toUpperCase() || 'MCP'
      };
    }

    // Fallback for unknown types
    return {
      icon: Wrench,
      color: 'text-gray-200',
      bgColor: 'bg-ink-900',
      dot: 'bg-gray-400',
      label: transportType.toUpperCase() || 'TOOL'
    };
  };

  const toolConfig = getToolIconConfig(toolType, transportType);
  const ToolIcon = toolConfig.icon;

  return (
    <NotchCard
      raised={showMenu}
      corner={
        <button
          onClick={() => handleAction('edit')}
          aria-label={t('tools.editTool', 'Edit Tool')}
          title={t('tools.editTool', 'Edit Tool')}
          className="tgo-icon-btn h-9 w-9 group-hover:rotate-45"
        >
          <ArrowUpRight className="h-4 w-4" />
        </button>
      }
    >
      <div className="flex items-center gap-3 pr-10">
        <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toolConfig.bgColor} ${toolConfig.color}`}>
          <ToolIcon className="h-5 w-5" />
          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-800 ${toolConfig.dot}`} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{toolType}</p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{toolConfig.label}</p>
        </div>
      </div>

      <button onClick={() => handleAction('edit')} className="mt-5 text-left">
        <h3 className="line-clamp-1 text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100" title={displayTitle}>
          {displayTitle}
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {tool.description || t('tools.noDescription', 'No description')}
        </p>
      </button>

      <div className="mt-auto pt-5">
        <p className="mb-1.5 text-[11px] text-gray-400 dark:text-gray-500">{t('tools.endpointLabel', 'Endpoint')}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyEndpoint}
            disabled={!endpoint}
            title={endpoint ? t('tools.copyEndpoint', 'Copy Endpoint') : undefined}
            className="group/ep inline-flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-left text-xs text-gray-600 ring-1 ring-gray-200 transition-colors enabled:hover:bg-gray-50 disabled:cursor-default dark:text-gray-300 dark:ring-gray-700 dark:enabled:hover:bg-gray-700/50"
          >
            {copiedEndpoint ? <Check className="h-3.5 w-3.5 shrink-0 text-acid-600" /> : <Link2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
            <span className="truncate font-mono">{endpoint || t('tools.noEndpoint', 'Built-in')}</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(v => !v)}
              aria-haspopup="menu"
              aria-expanded={showMenu}
              aria-label={t('common.more', 'More')}
              className="tgo-icon-btn h-10 w-10"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <MenuPanel placement="top">
                <MenuItem onClick={() => handleAction('edit')}>
                  <Pencil className="h-4 w-4" /> {t('common.edit', 'Edit')}
                </MenuItem>
                {endpoint && (
                  <MenuItem onClick={handleCopyEndpoint}>
                    {copiedEndpoint ? <Check className="h-4 w-4 text-acid-600" /> : <Copy className="h-4 w-4" />}
                    {t('tools.copyEndpoint', 'Copy Endpoint')}
                  </MenuItem>
                )}
                <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                <MenuItem danger onClick={() => handleAction('delete')}>
                  <Trash2 className="h-4 w-4" /> {t('common.delete', 'Delete')}
                </MenuItem>
              </MenuPanel>
            )}
          </div>

          <button
            onClick={() => handleAction('edit')}
            aria-label={t('tools.editTool', 'Edit Tool')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white transition-transform duration-200 hover:scale-105 active:scale-95 dark:bg-acid-400 dark:text-ink-900"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </NotchCard>
  );
};

export default ToolCard;
