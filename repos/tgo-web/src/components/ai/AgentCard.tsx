import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, MessageCircle, MoreHorizontal, Copy, Power, Cpu, ArrowUpRight } from 'lucide-react';
import { NotchCard, MenuPanel, MenuItem } from '@/components/ui/PageKit';
import AgentToolTag from '@/components/ui/AgentToolTag';
import KnowledgeBaseTag from '@/components/ui/KnowledgeBaseTag';
import WorkflowTag from '@/components/ui/WorkflowTag';
import DeviceTag from '@/components/ui/DeviceTag';
import { generateDefaultAvatar, hasValidAvatar } from '@/utils/avatarUtils';
import { useAIStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import type { Agent, AgentToolResponse } from '@/types';

interface AgentCardProps {
  agent: Agent;
  onAction: (actionType: string, agent: Agent) => void;
  onToolClick?: (tool: AgentToolResponse) => void;
}

/**
 * Agent card component displaying agent information and actions
 */
const AgentCard: React.FC<AgentCardProps> = ({ agent, onAction, onToolClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showAllCollections, setShowAllCollections] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);
  const [showAllWorkflows, setShowAllWorkflows] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // Get store functions and toast
  const { updateAgent } = useAIStore();
  const { showToast } = useToast();

  // Navigate to chat with this agent
  const handleChatWithAgent = (): void => {
    const channelId = `${agent.id}-agent`;
    navigate(`/chat/1/${channelId}`, {
      state: {
        agentName: agent.name,
        agentAvatar: agent.avatar,
        platform: 'agent'
      }
    });
  };

  const handleAction = (actionType: string): void => {
    setShowMenu(false);
    onAction?.(actionType, agent);
  };

  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      const newStatus = agent.status === 'active' ? 'inactive' : 'active';
      await updateAgent(agent.id, { status: newStatus });
      showToast('success', t('agents.messages.statusUpdateSuccess', 'Refresh Successful'), t('agents.messages.statusUpdateSuccessDesc', `Agent "{{name}}" status has been updated`, { name: agent.name }));
    } catch (error) {
      showToast('error', t('agents.messages.statusUpdateFailed', 'Refresh Failed'), t('agents.messages.statusUpdateFailedDesc', 'An error occurred while updating agent status'));
    }
  };

  const handleToolClick = (tool: AgentToolResponse): void => {
    onToolClick?.(tool);
  };

  const hasValidAvatarUrl = hasValidAvatar(agent.avatar);
  const defaultAvatar = !hasValidAvatarUrl ? generateDefaultAvatar(agent.name, agent.id) : null;

  const getStatusIndicator = (status: string): { dot: string; title: string } => {
    switch (status) {
      case 'active':
        return { dot: 'bg-acid-500', title: t('agents.card.status.active', 'Active') };
      case 'inactive':
        return { dot: 'bg-gray-300 dark:bg-gray-600', title: t('agents.card.status.inactive', 'Inactive') };
      case 'error':
        return { dot: 'bg-red-500', title: t('agents.card.status.error', 'Error') };
      default:
        return { dot: 'bg-gray-400', title: t('agents.card.status.unknown', 'Unknown') };
    }
  };

  const status = getStatusIndicator(agent.status);

  const hasCapabilities = Boolean(
    (agent.agentTools && agent.agentTools.length > 0) ||
    (agent.workflows && agent.workflows.length > 0) ||
    (agent.collections && agent.collections.length > 0) ||
    agent.boundDevice
  );

  return (
    <NotchCard
      raised={showMenu}
      corner={
        <button
          onClick={() => handleAction('edit')}
          aria-label={t('agents.actions.edit', 'Edit')}
          title={t('agents.actions.edit', 'Edit')}
          className="tgo-icon-btn h-9 w-9 group-hover:rotate-45"
        >
          <ArrowUpRight className="h-4 w-4" />
        </button>
      }
    >
      {/* Identity */}
      <div className="flex items-center gap-3 pr-10">
        <span className="relative flex h-12 w-12 shrink-0">
          {hasValidAvatarUrl ? (
            <img
              src={agent.avatar}
              alt={agent.name}
              className="h-12 w-12 rounded-full object-cover ring-4 ring-gray-50 dark:ring-gray-700"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const next = e.currentTarget.nextElementSibling as HTMLElement;
                if (next) next.style.display = 'flex';
              }}
            />
          ) : null}
          <span
            className={`h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white ring-4 ring-gray-50 dark:ring-gray-700 ${defaultAvatar?.colorClass || 'bg-ink-900'}`}
            style={{ display: hasValidAvatarUrl ? 'none' : 'flex' }}
          >
            {defaultAvatar?.letter || '?'}
          </span>
          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-800 ${status.dot}`} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {agent.role || t('agents.card.defaultRole', 'Agent')}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
            <Cpu className="h-3 w-3 shrink-0" />
            <span className="truncate font-mono">{agent.llmModel || 'gemini-1.5-pro'}</span>
          </p>
        </div>
      </div>

      <button onClick={() => handleAction('edit')} className="mt-5 text-left">
        <h3 className="line-clamp-1 text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100" title={agent.name}>
          {agent.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {agent.description || t('agents.card.noDescription', 'No description available')}
        </p>
      </button>

      {/* Capabilities */}
      {hasCapabilities && (
        <div className="mt-4 space-y-2">
          {agent.agentTools && agent.agentTools.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(showAllTools ? agent.agentTools : agent.agentTools.slice(0, 2)).map((tool) => (
                <AgentToolTag key={tool.id} tool={tool} onClick={handleToolClick} size="xs" />
              ))}
              {agent.agentTools.length > 2 && (
                <button onClick={() => setShowAllTools(!showAllTools)} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 transition-colors hover:bg-acid-300 hover:text-ink-900 dark:bg-gray-700 dark:text-gray-300">
                  {showAllTools ? t('agents.actions.collapse', 'Collapse') : `+${agent.agentTools.length - 2}`}
                </button>
              )}
            </div>
          )}

          {agent.workflows && agent.workflows.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(showAllWorkflows ? agent.workflows : agent.workflows.slice(0, 2)).map((workflow) => (
                <WorkflowTag
                  key={typeof workflow === 'string' ? workflow : workflow.id}
                  workflow={typeof workflow === 'string' ? { id: workflow, name: workflow } : workflow}
                  size="xs"
                  onClick={() => navigate(`/ai/workflows/${typeof workflow === 'string' ? workflow : workflow.id}/edit`)}
                />
              ))}
              {agent.workflows.length > 2 && (
                <button onClick={() => setShowAllWorkflows(!showAllWorkflows)} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 transition-colors hover:bg-acid-300 hover:text-ink-900 dark:bg-gray-700 dark:text-gray-300">
                  {showAllWorkflows ? t('agents.actions.collapse', 'Collapse') : `+${agent.workflows.length - 2}`}
                </button>
              )}
            </div>
          )}

          {agent.collections && agent.collections.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(showAllCollections ? agent.collections : agent.collections.slice(0, 3)).map((collection) => (
                <KnowledgeBaseTag key={collection.id} name={collection.display_name} size="xs" icon={collection.collection_metadata?.icon} />
              ))}
              {agent.collections.length > 3 && (
                <button onClick={() => setShowAllCollections(!showAllCollections)} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 transition-colors hover:bg-acid-300 hover:text-ink-900 dark:bg-gray-700 dark:text-gray-300">
                  {showAllCollections ? t('agents.actions.collapse', 'Collapse') : `+${agent.collections.length - 3}`}
                </button>
              )}
            </div>
          )}

          {agent.boundDevice && (
            <div className="flex flex-wrap gap-1.5">
              <DeviceTag device={agent.boundDevice} size="xs" />
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-5">
        <p className="mb-1.5 text-[11px] text-gray-400 dark:text-gray-500">{t('agents.card.statusLabel', 'Status')}</p>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-sm text-gray-700 ring-1 ring-gray-200 dark:text-gray-200 dark:ring-gray-700">
            <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
            <span className="truncate">{status.title}</span>
          </span>

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
                  <Pencil className="h-4 w-4" /> {t('agents.actions.edit', 'Edit')}
                </MenuItem>
                <MenuItem onClick={() => handleAction('copy')}>
                  <Copy className="h-4 w-4" /> {t('agents.actions.copy', 'Copy')}
                </MenuItem>
                <MenuItem onClick={handleToggleStatus}>
                  <Power className={`h-4 w-4 ${agent.status === 'active' ? 'text-orange-500' : 'text-acid-600'}`} />
                  {agent.status === 'active' ? t('agents.actions.disable', 'Stop') : t('agents.actions.enable', 'Enable')}
                </MenuItem>
                <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                <MenuItem danger onClick={() => handleAction('delete')}>
                  <Trash2 className="h-4 w-4" /> {t('agents.actions.delete', 'Delete')}
                </MenuItem>
              </MenuPanel>
            )}
          </div>

          <button
            onClick={handleChatWithAgent}
            aria-label={t('agents.card.chatAction', 'Start Chat')}
            title={t('agents.card.chatAction', 'Start Chat')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 transition-transform duration-200 hover:scale-105 active:scale-95 dark:bg-acid-400 dark:text-ink-900"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
    </NotchCard>
  );
};

export default AgentCard;
