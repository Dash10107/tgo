import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Bot, GitBranch, Library, MessagesSquare } from 'lucide-react';
import Icon from '../ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import type { InboxSummary } from '@/types';

/**
 * Props for the EmptyState component
 */
export interface EmptyStateProps {
  /** Type of empty state to display */
  type: 'no-chat' | 'no-messages';
  /** Inbox totals for the workspace overview (no-chat only) */
  summary?: InboxSummary | null;
}

interface QuickLink {
  key: string;
  label: string;
  hint: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly: boolean;
}

const getGreetingKey = (hour: number): { key: string; fallback: string } => {
  if (hour < 12) return { key: 'chat.hero.greeting.morning', fallback: 'Good morning' };
  if (hour < 18) return { key: 'chat.hero.greeting.afternoon', fallback: 'Good afternoon' };
  return { key: 'chat.hero.greeting.evening', fallback: 'Good evening' };
};

/**
 * Workspace overview shown when no conversation is selected.
 * Derives its figures from the already-loaded conversation list; no extra requests.
 */
const WorkspaceHero: React.FC<{ summary?: InboxSummary | null }> = ({ summary }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const isAdmin = user?.role === 'admin';

  const stats = useMemo(() => [
    { key: 'conversations', value: summary?.conversations ?? 0, label: t('chat.hero.stats.conversations', 'conversations') },
    { key: 'unread', value: summary?.unread ?? 0, label: t('chat.hero.stats.unread', 'unread') },
    { key: 'waiting', value: summary?.waiting ?? 0, label: t('chat.hero.stats.waiting', 'waiting') },
  ], [summary, t]);

  const now = new Date();
  const greeting = getGreetingKey(now.getHours());
  const dateLabel = now.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  const name = user?.nickname || user?.username || '';

  const links: QuickLink[] = [
    { key: 'agents', label: t('navigation.agents', 'Agent Teams'), hint: t('chat.hero.links.agents', 'Train and test your AI employees'), path: '/ai/agents', icon: Bot, adminOnly: true },
    { key: 'knowledge', label: t('navigation.knowledge', 'Knowledge Base'), hint: t('chat.hero.links.knowledge', 'Ground answers in your own docs'), path: '/knowledge', icon: Library, adminOnly: false },
    { key: 'workflows', label: t('navigation.workflows', 'Workflows'), hint: t('chat.hero.links.workflows', 'Automate hand-offs and triage'), path: '/ai/workflows', icon: GitBranch, adminOnly: true },
  ];
  const visibleLinks = links.filter(link => isAdmin || !link.adminOnly);

  return (
    <main className="tgo-surface relative flex min-w-0 flex-grow flex-col overflow-hidden">
      {/* Ambient decoration */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full border border-gray-100 dark:border-gray-800" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-gray-100 dark:border-gray-800" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 top-24 h-64 w-64 rounded-full bg-acid-300/30 blur-3xl dark:bg-acid-400/10" />

      <div className="relative flex flex-1 flex-col overflow-y-auto px-8 py-10 md:px-14">
        <div className="tgo-stagger mx-auto my-auto w-full max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tgo-pill pointer-events-none h-8 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-acid-500" />
              {dateLabel}
            </span>
          </div>

          <div>
            <p className="mt-8 text-lg text-gray-400 dark:text-gray-500">
              {t(greeting.key, greeting.fallback)}{name ? `, ${name}` : ''}
            </p>
            <h1 className="tgo-display mt-2 text-[56px] uppercase text-gray-900 md:text-[72px] dark:text-white">
              {t('chat.hero.title', 'Workspace')}
            </h1>
          </div>

          <div className="mt-10 flex flex-wrap items-end gap-x-12 gap-y-6">
            {stats.map(stat => (
              <div key={stat.key} className="flex items-baseline gap-2">
                <span key={stat.value} className="tgo-pop tgo-display text-5xl tabular-nums text-gray-900 dark:text-white">{stat.value}</span>
                <span className="text-sm text-gray-400 dark:text-gray-500">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-3 rounded-[22px] bg-ink-900 p-2 pr-5 text-white shadow-[0_18px_40px_-20px_rgba(15,16,18,0.8)] dark:bg-black">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-acid-400 text-ink-900">
              <MessagesSquare className="h-5 w-5" />
            </span>
            <p className="min-w-0 flex-1 text-sm text-white/70">
              <span className="font-medium text-white">{t('chat.hero.callout.title', 'Pick a conversation to start replying.')}</span>{' '}
              {t('chat.hero.callout.body', 'New chats land in your inbox in real time, with AI drafting answers alongside you.')}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {visibleLinks.map(link => {
              const LinkIcon = link.icon;
              return (
                <button
                  key={link.key}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className="group relative rounded-[22px] bg-gray-50 p-4 text-left ring-1 ring-gray-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:ring-gray-200 dark:bg-gray-800/60 dark:ring-gray-800 dark:hover:bg-gray-800"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm ring-1 ring-gray-100 transition-colors duration-300 group-hover:bg-acid-300 group-hover:text-ink-900 group-hover:ring-transparent dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700">
                    <LinkIcon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-all duration-300 group-hover:rotate-45 group-hover:bg-ink-900 group-hover:text-white dark:text-gray-600">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                  <span className="mt-4 block text-sm font-semibold text-gray-900 dark:text-gray-100">{link.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-gray-400 dark:text-gray-500">{link.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
};

/**
 * Component for displaying empty states in the chat
 * Memoized to prevent unnecessary re-renders
 */
const EmptyState: React.FC<EmptyStateProps> = React.memo(({ type, summary }) => {
  const { t } = useTranslation();

  if (type === 'no-chat') {
    return <WorkspaceHero summary={summary} />;
  }

  if (type === 'no-messages') {
    return (
      <div className="tgo-fade-up flex h-full min-h-64 flex-col items-center justify-center text-center">
        <div className="relative mb-5 flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-acid-200/60 dark:bg-acid-400/10" />
          <span className="absolute inset-4 rounded-full bg-acid-300/70 dark:bg-acid-400/20" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-lg">
            <Icon name="MessageCircle" size={20} className="h-5 w-5" />
          </span>
        </div>
        <p className="text-base font-medium tracking-tight text-gray-700 dark:text-gray-300">
          {t('chat.history.noMessages', 'No historical messages')}
        </p>
      </div>
    );
  }

  return null;
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;
