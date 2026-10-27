import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Github, Zap } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  PageShell, PageHeader, InkButton, SectionHeader, SearchField, RefreshButton,
  FilterPills, FeatureBanner, EmptyPanel, SkeletonGrid, CardGrid, type FilterOption,
} from '@/components/ui/PageKit';
import SkillCard, { type Skill } from './SkillCard';
import SkillFormModal from './SkillFormModal';
import SkillDetailModal from './SkillDetailModal';
import { useToast } from '@/hooks/useToast';
import SkillsApiService, { type SkillSummary } from '@/services/skillsApi';

type SkillFilter = 'all' | 'enabled' | 'disabled' | 'official';

const Skills: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<SkillFilter>('all');

  const fetchSkills = useCallback(async () => {
    try {
      setIsLoading(true);
      const list: SkillSummary[] = await SkillsApiService.listSkills();
      setSkills(
        list.map((s) => ({
          name: s.name,
          description: s.description,
          author: s.author,
          is_official: s.is_official,
          is_featured: s.is_featured,
          tags: s.tags,
          updated_at: s.updated_at,
          enabled: s.enabled,
        })),
      );
    } catch (err) {
      showError(
        t('skills.fetchFailed', 'Failed to fetch skills'),
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t, showError]);

  useEffect(() => {
    fetchSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Local search / filter
  // ---------------------------------------------------------------------------
  const filteredSkills = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return skills.filter((skill) => {
      const matchesFilter =
        skillFilter === 'all' ||
        (skillFilter === 'enabled' && skill.enabled) ||
        (skillFilter === 'disabled' && !skill.enabled) ||
        (skillFilter === 'official' && skill.is_official);
      return matchesFilter && (
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query)
      );
    });
  }, [skills, searchQuery, skillFilter]);

  const skillCounts = useMemo(() => {
    const enabled = skills.filter(skill => skill.enabled).length;
    const official = skills.filter(skill => skill.is_official).length;
    return { all: skills.length, enabled, disabled: skills.length - enabled, official, custom: skills.length - official };
  }, [skills]);

  // ---------------------------------------------------------------------------
  // Import modal
  // ---------------------------------------------------------------------------
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openImportModal = () => {
    setIsFormOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Detail modal (read-only)
  // ---------------------------------------------------------------------------
  const [viewingSkillName, setViewingSkillName] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Toggle skill enabled/disabled (calls backend API)
  // ---------------------------------------------------------------------------
  const handleToggle = useCallback(
    async (skill: Skill, newEnabled: boolean) => {
      // Optimistic update
      setSkills((prev) =>
        prev.map((s) =>
          s.name === skill.name ? { ...s, enabled: newEnabled } : s,
        ),
      );

      try {
        await SkillsApiService.toggleSkill(skill.name, newEnabled);
      } catch (err) {
        // Revert on error
        setSkills((prev) =>
          prev.map((s) =>
            s.name === skill.name ? { ...s, enabled: !newEnabled } : s,
          ),
        );
        showError(
          t('skills.toggleFailed', 'Failed to toggle skill status'),
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    [t, showError],
  );

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (skill: Skill) => {
    if (skill.is_official) return;
    setDeleteTarget(skill);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await SkillsApiService.deleteSkill(deleteTarget.name);
      showSuccess(t('skills.deleteSuccess', 'Skill deleted'));
      setDeleteTarget(null);
      fetchSkills();
    } catch (err) {
      showError(
        t('skills.deleteFailed', 'Failed to delete skill'),
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const filterOptions: FilterOption<SkillFilter>[] = [
    { value: 'all', label: t('common.all', 'All'), count: skillCounts.all },
    { value: 'enabled', label: t('skills.filter.enabled', 'Enabled'), count: skillCounts.enabled, dot: 'bg-acid-500' },
    { value: 'disabled', label: t('skills.filter.disabled', 'Disabled'), count: skillCounts.disabled, dot: 'bg-gray-400' },
    { value: 'official', label: t('common.official', 'Official'), count: skillCounts.official, dot: 'bg-ink-900 dark:bg-white' },
  ];

  const hasActiveFilters = Boolean(searchQuery) || skillFilter !== 'all';
  // Highlight the first featured skill the same way the workflow page features its first template
  const featuredSkillName = filteredSkills.find(skill => skill.is_featured)?.name;

  return (
    <PageShell
      after={
        <>
          {/* Import Modal */}
          <SkillFormModal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            skill={null}
            onSaved={fetchSkills}
          />

          {/* Detail (read-only) Modal */}
          <SkillDetailModal
            isOpen={!!viewingSkillName}
            onClose={() => setViewingSkillName(null)}
            skillName={viewingSkillName}
          />

          <ConfirmDialog
            isOpen={!!deleteTarget}
            title={t('skills.deleteTitle', 'Delete Skill')}
            message={t('skills.deleteConfirm', 'Are you sure you want to delete skill "{{name}}"? This action cannot be undone.', { name: deleteTarget?.name })}
            confirmText={t('common.delete', 'Delete')}
            cancelText={t('common.cancel', 'Cancel')}
            confirmVariant="danger"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
            isLoading={isDeleting}
          />
        </>
      }
    >
      {/* Header */}
      <PageHeader
        title={t('skills.titleShort', 'Skills')}
        total={skillCounts.all}
        stats={[
          { key: 'enabled', value: skillCounts.enabled, label: t('skills.stats.enabled', 'enabled'), badge: 'bg-acid-300 text-ink-900' },
          { key: 'official', value: skillCounts.official, label: t('skills.stats.official', 'official'), badge: 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' },
          { key: 'custom', value: skillCounts.custom, label: t('skills.stats.custom', 'custom'), badge: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
        ]}
        actions={
          <InkButton onClick={openImportModal} icon={<Github className="h-4 w-4" />}>
            {t('skills.import.submit', 'Import Skill')}
          </InkButton>
        }
      />

      <FeatureBanner
        icon={Zap}
        eyebrow={t('skills.banner.eyebrow', 'Expertise')}
        title={t('skills.banner.title', 'Build Professional Skills')}
        description={t(
          'skills.banner.description',
          'By creating skills, you can break down complex tasks into standardized instruction templates. Enable AI agents to complete specific tasks like code review, copywriting, and data analysis like experts following best practices.',
        )}
      />

      <section className="space-y-5">
        <SectionHeader title={t('skills.listTitle', 'Skills List')} count={filteredSkills.length} countLabel={t('skills.countLabel', 'skills')}>
          <SearchField value={searchQuery} onChange={setSearchQuery} placeholder={t('skills.search.placeholder', 'Search skills...')} />
          <RefreshButton onClick={fetchSkills} spinning={isLoading} disabled={isLoading} />
          <FilterPills options={filterOptions} value={skillFilter} onChange={setSkillFilter} />
        </SectionHeader>

        {isLoading && skills.length === 0 ? (
          <SkeletonGrid count={8} itemClassName="h-64" />
        ) : filteredSkills.length === 0 ? (
          <EmptyPanel
            icon={Zap}
            title={hasActiveFilters ? t('skills.empty.noResults', 'No matching skills') : t('skills.empty.title', 'No skills yet')}
            description={hasActiveFilters ? t('skills.empty.noResultsDesc', 'Try adjusting your search keywords or filters') : t('skills.empty.description', 'Create your first skill to make AI agents more professional')}
            action={!hasActiveFilters && (
              <InkButton onClick={openImportModal} icon={<Github className="h-4 w-4" />}>
                {t('skills.import.submit', 'Import Skill')}
              </InkButton>
            )}
          />
        ) : (
          <CardGrid>
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.name}
                skill={skill}
                enabled={skill.enabled}
                featured={skill.name === featuredSkillName}
                onToggle={handleToggle}
                onClick={(s) => setViewingSkillName(s.name)}
                onDelete={handleDelete}
              />
            ))}
          </CardGrid>
        )}
      </section>
    </PageShell>
  );
};

export default Skills;
