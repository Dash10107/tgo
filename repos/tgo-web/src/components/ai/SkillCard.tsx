import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Sparkles, ShieldCheck, User, Trash2, Eye, Zap, ArrowUpRight } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import { NotchCard, MenuPanel, MenuItem } from '@/components/ui/PageKit';
import { useTranslation } from 'react-i18next';

/** Skill data shape matching the backend SkillSummary response. */
export interface Skill {
  name: string;
  description: string;
  author: string | null;
  is_official: boolean;
  is_featured: boolean;
  tags: string[];
  updated_at: string | null;
  enabled: boolean;
}

interface SkillCardProps {
  skill: Skill;
  enabled: boolean;
  /** Render with the acid accent surface */
  featured?: boolean;
  onToggle: (skill: Skill, enabled: boolean) => void;
  onClick: (skill: Skill) => void;
  onDelete: (skill: Skill) => void;
}

/** Format an ISO date string to a human-readable locale string. */
function formatDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

const SkillCard: React.FC<SkillCardProps> = ({ skill, enabled, featured = false, onToggle, onClick, onDelete }) => {
  const { t } = useTranslation();
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const muted = featured ? 'text-ink-900/70' : 'text-gray-500 dark:text-gray-400';

  return (
    <NotchCard
      featured={featured}
      raised={showMenu}
      className={enabled ? '' : 'opacity-70 hover:opacity-100'}
      corner={
        <button
          onClick={() => onClick(skill)}
          aria-label={t('common.view', 'View')}
          title={t('common.view', 'View')}
          className="tgo-icon-btn h-9 w-9 group-hover:rotate-45"
        >
          <ArrowUpRight className="h-4 w-4" />
        </button>
      }
    >
      <div className="flex items-center gap-3 pr-10">
        <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          featured ? 'bg-ink-900 text-acid-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
        }`}>
          <Zap className="h-5 w-5" />
          {skill.is_featured && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-acid-400 text-ink-900 ring-2 ring-white dark:ring-gray-800">
              <Sparkles className="h-3 w-3" />
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className={`flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider ${featured ? 'text-ink-900/60' : 'text-gray-400 dark:text-gray-500'}`}>
            {skill.is_official ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
            <span className="truncate">{skill.is_official ? t('common.official', 'Official') : (skill.author || '-')}</span>
          </p>
          <p className={`truncate text-xs ${muted}`}>
            {t('skills.updated', 'Updated')} {formatDate(skill.updated_at)}
          </p>
        </div>
      </div>

      <button onClick={() => onClick(skill)} className="mt-5 text-left">
        <h3 className="line-clamp-1 text-xl font-medium tracking-tight" title={skill.name}>
          {skill.name}
        </h3>
        <p className={`mt-1.5 line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed ${muted}`}>
          {skill.description}
        </p>
      </button>

      {skill.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skill.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                featured ? 'bg-white/60 text-ink-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {tag}
            </span>
          ))}
          {skill.tags.length > 3 && (
            <span className={`self-center text-[11px] font-medium ${featured ? 'text-ink-900/60' : 'text-gray-400'}`}>+{skill.tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="mt-auto pt-5">
        <div className="flex items-center gap-2">
          <label className={`inline-flex h-10 flex-1 cursor-pointer items-center justify-between gap-2 rounded-full pl-4 pr-2 text-sm ${
            featured ? 'bg-white/60 text-ink-900' : 'text-gray-700 ring-1 ring-gray-200 dark:text-gray-200 dark:ring-gray-700'
          }`}>
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-acid-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              {enabled ? t('skills.filter.enabled', 'Enabled') : t('skills.filter.disabled', 'Disabled')}
            </span>
            <Toggle
              size="sm"
              checked={enabled}
              onChange={(next) => onToggle(skill, next)}
              aria-label={enabled ? t('skills.disable', 'Disable skill') : t('skills.enable', 'Enable skill')}
            />
          </label>

          {!skill.is_official && (
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
                  <MenuItem onClick={() => { setShowMenu(false); onClick(skill); }}>
                    <Eye className="h-4 w-4" /> {t('common.view', 'View')}
                  </MenuItem>
                  <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                  <MenuItem danger onClick={() => { setShowMenu(false); onDelete(skill); }}>
                    <Trash2 className="h-4 w-4" /> {t('common.delete', 'Delete')}
                  </MenuItem>
                </MenuPanel>
              )}
            </div>
          )}
        </div>
      </div>
    </NotchCard>
  );
};

export default SkillCard;
