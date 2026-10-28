import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Check, ChevronDown, Hand, PowerOff, Sparkles, X, Zap, type LucideIcon } from 'lucide-react';
import { useAIStore } from '@/stores/aiStore';
import type { Platform, PlatformAIMode } from '@/types';
import { Field } from '@/components/ui/ModalKit';

interface PlatformAISettingsProps {
  platform: Platform;
  /** Current agent selection (controlled as an array for existing callers) */
  agentIds: string[];
  /** Current AI mode (controlled) */
  aiMode: PlatformAIMode;
  /** Current fallback timeout in seconds (controlled) */
  fallbackTimeout: number | null;
  /** Callback when selected agent changes */
  onAgentIdsChange: (agentIds: string[]) => void;
  /** Callback when AI mode changes */
  onAIModeChange: (mode: PlatformAIMode) => void;
  /** Callback when fallback timeout changes */
  onFallbackTimeoutChange: (timeout: number | null) => void;
  /** Whether the section is initially expanded (default: false) */
  defaultExpanded?: boolean;
}

const MODE_ICONS: Record<PlatformAIMode, LucideIcon> = {
  auto: Zap,
  assist: Hand,
  off: PowerOff,
};

const MODES: PlatformAIMode[] = ['auto', 'assist', 'off'];

/**
 * Collapsible AI settings card for platform configuration:
 * agent picker, AI mode tiles and the assist-mode takeover timeout.
 */
const PlatformAISettings: React.FC<PlatformAISettingsProps> = ({
  platform,
  agentIds,
  aiMode,
  fallbackTimeout,
  onAgentIdsChange,
  onAIModeChange,
  onFallbackTimeoutChange,
  defaultExpanded = false,
}) => {
  const { t } = useTranslation();
  const agents = useAIStore(s => s.agents);
  const loadAgents = useAIStore(s => s.loadAgents);
  const isLoadingAgents = useAIStore(s => s.isLoadingAgents);

  const [expanded, setExpanded] = useState(defaultExpanded);

  // Load agents on mount if not already loaded
  useEffect(() => {
    if (agents.length === 0) {
      loadAgents();
    }
  }, [agents.length, loadAgents]);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!dropdownOpen) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [dropdownOpen]);

  const selectedAgent = useMemo(() => agents.find(agent => agentIds.includes(agent.id)), [agents, agentIds]);

  // Backend routing supports one platform agent; picking the selected one clears it
  const toggleAgent = (agentId: string) => {
    if (agentIds.includes(agentId)) {
      onAgentIdsChange([]);
    } else {
      onAgentIdsChange([agentId]);
      setDropdownOpen(false);
    }
  };

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onFallbackTimeoutChange(null);
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0) {
        onFallbackTimeoutChange(num);
      }
    }
  };

  const modeLabel = (mode: PlatformAIMode): string => {
    switch (mode) {
      case 'auto': return t('platforms.aiSettings.modeAuto', 'Auto');
      case 'assist': return t('platforms.aiSettings.modeAssist', 'Assist');
      default: return t('platforms.aiSettings.modeOff', 'Off');
    }
  };

  const modeHint = (mode: PlatformAIMode): string => {
    switch (mode) {
      case 'auto': return t('platforms.aiSettings.modeAutoHint', 'AI automatically handles all messages.');
      case 'assist': return t('platforms.aiSettings.modeAssistHint', 'Human first, AI takes over after timeout.');
      default: return t('platforms.aiSettings.modeOffHint', 'Disable AI, only human handles messages.');
    }
  };

  const agentSummary = selectedAgent?.name ?? t('platforms.aiSettings.defaultAgent', 'Default agent');
  const ModeIcon = MODE_ICONS[aiMode];
  const contentId = `ai-settings-${platform.id}`;

  return (
    <section className="tgo-surface">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="group flex w-full items-center gap-4 rounded-[1.75rem] p-6 text-left md:px-7"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acid-300 text-ink-900">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-medium tracking-tight text-gray-900 dark:text-white">{t('platforms.aiSettings.title', 'AI Settings')}</span>
            <span className="tgo-chip">{t('platforms.aiSettings.optional', 'Optional')}</span>
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <ModeIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{modeLabel(aiMode)} · {agentSummary}</span>
          </span>
        </span>
        <span className="tgo-icon-btn pointer-events-none group-hover:bg-acid-300 group-hover:text-ink-900 group-hover:shadow-none">
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div id={contentId} className="animate-in fade-in slide-in-from-top-1 space-y-6 px-6 pb-7 md:px-7">
          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* Agent picker */}
          <Field
            label={t('platforms.aiSettings.agents', 'AI Agents')}
            hint={agentIds.length === 0
              ? t('platforms.aiSettings.agentsHintDefault', 'If none selected, the project default AI agent will be used.')
              : t('platforms.aiSettings.agentsHint', 'Select the AI agent assigned to this platform.')}
          >
            <div ref={dropdownRef} className="relative">
              <div
                role="button"
                tabIndex={0}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
                onClick={() => setDropdownOpen(v => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDropdownOpen(v => !v);
                  }
                }}
                className={`tgo-input flex cursor-pointer items-center gap-2 !py-1.5 !pl-1.5 ${dropdownOpen ? '!bg-white dark:!bg-gray-900' : ''}`}
                data-open={dropdownOpen}
              >
                {selectedAgent ? (
                  <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-ink-900 py-1 pl-1 pr-1.5 text-xs font-medium text-white dark:bg-acid-400 dark:text-ink-900">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acid-400 text-ink-900 dark:bg-ink-900 dark:text-acid-400">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">{selectedAgent.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAgentIdsChange([]);
                      }}
                      aria-label={t('common.remove', 'Remove')}
                      className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-white/20 dark:hover:bg-ink-900/15"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 pl-1 text-gray-400">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-gray-200 dark:bg-gray-700 dark:ring-gray-600">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                    {isLoadingAgents
                      ? t('platforms.aiSettings.loadingAgents', 'Loading...')
                      : t('platforms.aiSettings.selectAgents', 'Select AI Agent')}
                  </span>
                )}
                <ChevronDown className={`ml-auto mr-2 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {dropdownOpen && (
                <div
                  role="listbox"
                  className="animate-in fade-in zoom-in-95 slide-in-from-top-1 custom-scrollbar absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-800"
                >
                  {agents.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {isLoadingAgents
                        ? t('platforms.aiSettings.loadingAgents', 'Loading...')
                        : t('platforms.aiSettings.noAgents', 'No AI Agents Available')}
                    </div>
                  ) : (
                    agents.map(agent => {
                      const active = agentIds.includes(agent.id);
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => toggleAgent(agent.id)}
                          className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                            active ? 'bg-acid-50 dark:bg-acid-400/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
                          }`}
                        >
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            active ? 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            <Bot className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{agent.name}</span>
                            {agent.description && (
                              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{agent.description}</span>
                            )}
                          </span>
                          {active && <Check className="h-4 w-4 shrink-0 text-ink-900 dark:text-acid-400" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </Field>

          {/* AI mode */}
          <Field label={t('platforms.aiSettings.mode', 'AI Mode')} hint={modeHint(aiMode)}>
            <div role="radiogroup" className="grid grid-cols-3 gap-2">
              {MODES.map(mode => {
                const Icon = MODE_ICONS[mode];
                const active = aiMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-active={active}
                    onClick={() => onAIModeChange(mode)}
                    className="tgo-option flex-col !items-start !gap-2.5 !p-3.5"
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                      active ? 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{modeLabel(mode)}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Fallback timeout (assist mode only) */}
          {aiMode === 'assist' && (
            <Field
              label={t('platforms.aiSettings.timeout', 'Timeout (seconds)')}
              htmlFor={`ai-timeout-${platform.id}`}
              hint={t('platforms.aiSettings.timeoutHint', "Time in seconds before AI takes over when there's no reply. Set to 0 to prevent AI takeover.")}
              className="animate-in fade-in slide-in-from-top-1"
            >
              <div className="relative max-w-xs">
                <input
                  id={`ai-timeout-${platform.id}`}
                  type="number"
                  min="0"
                  value={fallbackTimeout ?? ''}
                  onChange={handleTimeoutChange}
                  placeholder={t('platforms.aiSettings.timeoutPlaceholder', 'e.g., 60')}
                  className="tgo-input pr-12 tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-medium text-gray-400">s</span>
              </div>
            </Field>
          )}
        </div>
      )}
    </section>
  );
};

export default PlatformAISettings;
