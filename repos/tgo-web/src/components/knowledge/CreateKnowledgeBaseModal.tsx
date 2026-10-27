import React, { useState, useCallback } from 'react';
import { FileText, Globe, ChevronDown, Info, Loader2, RefreshCw, MessageSquare, FolderPlus, Store, ShoppingBag, Check, CheckCircle2, Settings2, type LucideIcon } from 'lucide-react';
import { Modal, Field, FieldGroup, CheckRow, PrimaryButton, SecondaryButton } from '@/components/ui/ModalKit';

import { TagInput } from '@/components/ui/TagInput';
import type { KnowledgeBaseType, WebsiteCrawlConfig, CrawlOptions } from '@/types';
import KnowledgeBaseApiService from '@/services/knowledgeBaseApi';
import { useTranslation } from 'react-i18next';
import { SiTaobao } from 'react-icons/si';

// Helper function to get default icon based on knowledge base type
const getDefaultIconByType = (type: KnowledgeBaseType): string => {
  switch (type) {
    case 'file': return 'FileText';
    case 'website': return 'Globe';
    case 'qa': return 'MessageSquare';
    default: return 'FileText';
  }
};

export interface CreateKnowledgeBaseData {
  name: string;
  description: string;
  icon: string;
  tags: string[];
  type: KnowledgeBaseType;
  crawlConfig?: WebsiteCrawlConfig;
}

interface CreateKnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateKnowledgeBaseData) => Promise<void>;
  isLoading?: boolean;
}

const DEFAULT_CRAWL_CONFIG: WebsiteCrawlConfig = {
  start_url: '',
  max_pages: 100,
  max_depth: 3,
  include_patterns: [],
  exclude_patterns: [],
  options: {
    render_js: false,
    wait_time: 0,
    follow_external_links: false,
    respect_robots_txt: true,
  }
};

export const CreateKnowledgeBaseModal: React.FC<CreateKnowledgeBaseModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false
}) => {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: getDefaultIconByType('file'),
    tags: [] as string[],
    type: 'file' as KnowledgeBaseType,
    crawlConfig: { ...DEFAULT_CRAWL_CONFIG }
  });
  const [errors, setErrors] = useState({
    name: '',
    description: '',
    startUrl: ''
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataFetched, setMetadataFetched] = useState(false);

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        icon: getDefaultIconByType('file'),
        tags: [],
        type: 'file',
        crawlConfig: { ...DEFAULT_CRAWL_CONFIG }
      });
      setErrors({ name: '', description: '', startUrl: '' });
      setShowAdvancedOptions(false);
      setIsLoadingMetadata(false);
      setMetadataError(null);
      setMetadataFetched(false);
    }
  }, [isOpen]);

  // Fetch website metadata
  const fetchWebsiteMetadata = useCallback(async (url: string) => {
    if (!url.trim()) return;

    // Validate URL first
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return; // Invalid URL, don't fetch
    }

    setIsLoadingMetadata(true);
    setMetadataError(null);

    try {
      const metadata = await KnowledgeBaseApiService.extractWebsiteMetadata(url);

      if (metadata.success) {
        // Fallback logic: use domain as title if title is empty
        const hostname = parsedUrl.hostname;
        const fallbackTitle = metadata.title?.trim() || hostname;
        // Fallback logic: use default description if description is empty
        const fallbackDescription = metadata.description?.trim() ||
          t('knowledge.metadata.defaultDescription', 'Knowledge base from {{domain}}', { domain: hostname });

        setFormData(prev => ({
          ...prev,
          name: fallbackTitle,
          description: fallbackDescription,
          icon: getDefaultIconByType('website')
        }));
        setMetadataFetched(true);
      } else {
        // API call succeeded but returned error - still apply fallback
        const hostname = parsedUrl.hostname;
        setFormData(prev => ({
          ...prev,
          name: prev.name || hostname,
          description: prev.description || t('knowledge.metadata.defaultDescription', 'Knowledge base from {{domain}}', { domain: hostname }),
          icon: getDefaultIconByType('website')
        }));
        setMetadataError(metadata.error || t('knowledge.metadata.fetchFailed', 'Failed to fetch website info'));
        setMetadataFetched(true); // Still mark as fetched since we applied fallback
      }
    } catch (error) {
      // Network error or other failure - apply fallback
      const hostname = parsedUrl.hostname;
      setFormData(prev => ({
        ...prev,
        name: prev.name || hostname,
        description: prev.description || t('knowledge.metadata.defaultDescription', 'Knowledge base from {{domain}}', { domain: hostname }),
        icon: getDefaultIconByType('website')
      }));
      console.error('Failed to fetch website metadata:', error);
      setMetadataError(error instanceof Error ? error.message : t('knowledge.metadata.fetchFailed', 'Failed to fetch website info'));
      setMetadataFetched(true); // Still mark as fetched since we applied fallback
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [t]);

  const validateForm = (): boolean => {
    const newErrors = { name: '', description: '', startUrl: '' };
    let isValid = true;

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = t('knowledge.validation.nameRequired', 'Name is required');
      isValid = false;
    } else if (formData.name.trim().length < 2) {
      newErrors.name = t('knowledge.validation.nameMin', 'Name must be at least 2 characters');
      isValid = false;
    } else if (formData.name.trim().length > 50) {
      newErrors.name = t('knowledge.validation.nameMax', 'Name cannot exceed 50 characters');
      isValid = false;
    }

    // Validate description - only check if empty
    if (!formData.description.trim()) {
      newErrors.description = t('knowledge.validation.descRequired', 'Description is required');
      isValid = false;
    }

    // Validate website-specific fields
    if (formData.type === 'website') {
      const url = formData.crawlConfig.start_url.trim();
      if (!url) {
        newErrors.startUrl = t('knowledge.validation.urlRequired', 'Website URL is required');
        isValid = false;
      } else {
        try {
          new URL(url);
        } catch {
          newErrors.startUrl = t('knowledge.validation.urlInvalid', 'Please enter a valid URL');
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const submitData: CreateKnowledgeBaseData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        icon: formData.icon,
        tags: formData.tags,
        type: formData.type
      };

      if (formData.type === 'website') {
        submitData.crawlConfig = {
          ...formData.crawlConfig,
          start_url: formData.crawlConfig.start_url.trim()
        };
      }

      await onSubmit(submitData);
      onClose();
    } catch (error) {
      // Error handling is done by the parent component
      console.error('Failed to create knowledge base:', error);
    }
  };

  const handleInputChange = (field: 'name' | 'description', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleTagsChange = (tags: string[]) => {
    setFormData(prev => ({ ...prev, tags }));
  };

  const handleTypeChange = (type: KnowledgeBaseType) => {
    setFormData(prev => ({
      ...prev,
      type,
      // Set default icon based on type automatically
      icon: getDefaultIconByType(type)
    }));
    if (type !== 'website') {
      setErrors(prev => ({ ...prev, startUrl: '' }));
      setMetadataError(null);
      setMetadataFetched(false);
    }
  };

  const handleCrawlConfigChange = <K extends keyof WebsiteCrawlConfig>(
    key: K,
    value: WebsiteCrawlConfig[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      crawlConfig: { ...prev.crawlConfig, [key]: value }
    }));
    if (key === 'start_url' && errors.startUrl) {
      setErrors(prev => ({ ...prev, startUrl: '' }));
    }
  };

  const handleCrawlOptionsChange = <K extends keyof CrawlOptions>(
    key: K,
    value: CrawlOptions[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      crawlConfig: {
        ...prev.crawlConfig,
        options: { ...prev.crawlConfig.options, [key]: value }
      }
    }));
  };

  const typeOptions: { type: KnowledgeBaseType; icon: LucideIcon; label: string; description: string }[] = [
    { type: 'file', icon: FileText, label: t('knowledge.typeFile', 'File'), description: t('knowledge.typeFileDesc', 'Upload document files to build knowledge base') },
    { type: 'website', icon: Globe, label: t('knowledge.typeWebsite', 'Website'), description: t('knowledge.typeWebsiteDesc', 'Crawl website content to build knowledge base') },
    { type: 'qa', icon: MessageSquare, label: t('knowledge.typeQA', 'QA Pairs'), description: t('knowledge.typeQADesc', 'Create QA pairs to build knowledge base') },
  ];

  const comingSoon: { key: string; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { key: 'tmall', icon: Store, label: t('knowledge.typeTmall', 'Tmall') },
    { key: 'taobao', icon: SiTaobao, label: t('knowledge.typeTaobao', 'Taobao') },
    { key: 'jd', icon: ShoppingBag, label: t('knowledge.typeJD', 'JD.com') },
  ];

  const busy = isLoading || isLoadingMetadata;

  const basicFields = (idSuffix: string, descriptionRows: number) => (
    <>
      <Field
        label={t('knowledge.name', 'Name')}
        htmlFor={`kb-name${idSuffix}`}
        required
        error={errors.name}
        aside={`${formData.name.length}/50`}
      >
        <input
          id={`kb-name${idSuffix}`}
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder={t('knowledge.namePlaceholder', 'Enter knowledge base name')}
          disabled={isLoading}
          aria-invalid={Boolean(errors.name)}
          className="tgo-input"
          maxLength={50}
        />
      </Field>

      <Field
        label={t('knowledge.description', 'Description')}
        htmlFor={`kb-description${idSuffix}`}
        required
        error={errors.description}
        hint={t('knowledge.descriptionHelper', 'The more accurate the description, the easier it is for AI to use this knowledge base correctly')}
      >
        <textarea
          id={`kb-description${idSuffix}`}
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder={t('knowledge.descriptionPlaceholder', 'Describe the content and purpose of the knowledge base')}
          disabled={isLoading}
          rows={descriptionRows}
          aria-invalid={Boolean(errors.description)}
          className="tgo-input"
        />
      </Field>

      <Field label={t('knowledge.tags', 'Tags')} optional>
        <TagInput
          tags={formData.tags}
          onTagsChange={handleTagsChange}
          placeholder={t('knowledge.tagsPlaceholder', 'Enter tags and press Enter to add')}
          maxTags={10}
          maxTagLength={20}
          disabled={isLoading}
        />
      </Field>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      preventClose={busy}
      size="lg"
      icon={FolderPlus}
      title={t('knowledge.create', 'Create Knowledge Base')}
      subtitle={t('knowledge.createDesc', 'Select knowledge base type and fill in basic information')}
      onSubmit={handleSubmit}
      bodyClassName="space-y-6"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={busy}>
            {t('common.cancel', 'Cancel')}
          </SecondaryButton>
          <PrimaryButton
            type="submit"
            disabled={busy}
            loading={busy}
            loadingText={isLoading ? t('common.creating', 'Creating...') : t('knowledge.metadata.fetching', 'Fetching info...')}
          >
            {t('knowledge.create', 'Create Knowledge Base')}
          </PrimaryButton>
        </>
      }
    >
      {/* Type selection */}
      <div>
        <p className="tgo-label">{t('knowledge.selectType', 'Select Type')} <span className="tgo-req">*</span></p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup">
          {typeOptions.map(option => {
            const active = formData.type === option.type;
            const Icon = option.icon;
            return (
              <button
                key={option.type}
                type="button"
                role="radio"
                aria-checked={active}
                data-active={active}
                onClick={() => handleTypeChange(option.type)}
                disabled={isLoading}
                className="tgo-option !flex-col !items-start !gap-3 !p-4"
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 ${active ? 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{option.description}</span>
                </span>
                {active && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-400">{t('knowledge.comingSoon', 'Coming Soon')}:</span>
          {comingSoon.map(item => {
            const Icon = item.icon;
            return (
              <span key={item.key} className="tgo-chip border border-dashed border-gray-200 bg-transparent text-gray-400 dark:border-gray-700 dark:bg-transparent" title={t('knowledge.comingSoon', 'Coming Soon')}>
                <Icon className="h-3 w-3" />
                {item.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* File / QA: basic information */}
      {(formData.type === 'file' || formData.type === 'qa') && (
        <FieldGroup key={formData.type} title={t('knowledge.basicInfo', 'Basic Information')} className="tgo-fade-in">
          {basicFields('', 3)}
        </FieldGroup>
      )}

      {/* Website: URL first, details behind "advanced" */}
      {formData.type === 'website' && (
        <div key="website" className="tgo-fade-in space-y-4">
          <FieldGroup title={t('knowledge.crawl.urlSection', 'Website URL')} icon={Globe}>
            <Field
              label={t('knowledge.crawl.startUrl', 'Website URL')}
              htmlFor="crawl-url"
              required
              error={errors.startUrl}
            >
              <div className="flex gap-2">
                <input
                  id="crawl-url"
                  type="url"
                  value={formData.crawlConfig.start_url}
                  onChange={(e) => {
                    handleCrawlConfigChange('start_url', e.target.value);
                    setMetadataFetched(false);
                    setMetadataError(null);
                  }}
                  onBlur={(e) => {
                    if (e.target.value && !metadataFetched) {
                      fetchWebsiteMetadata(e.target.value);
                    }
                  }}
                  placeholder={t('knowledge.crawl.startUrlPlaceholder', 'https://example.com')}
                  disabled={busy}
                  aria-invalid={Boolean(errors.startUrl)}
                  className="tgo-input flex-1"
                />
                <button
                  type="button"
                  onClick={() => fetchWebsiteMetadata(formData.crawlConfig.start_url)}
                  disabled={busy || !formData.crawlConfig.start_url}
                  className="tgo-icon-btn h-11 w-11"
                  title={t('knowledge.metadata.fetch', 'Fetch Info')}
                  aria-label={t('knowledge.metadata.fetch', 'Fetch Info')}
                >
                  {isLoadingMetadata ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {!errors.startUrl && (
              <p className="-mt-3 flex items-center gap-1.5 text-xs">
                {isLoadingMetadata ? (
                  <span className="flex items-center gap-1.5 text-gray-500"><Loader2 className="h-3 w-3 animate-spin" />{t('knowledge.metadata.fetching', 'Fetching info...')}</span>
                ) : metadataError ? (
                  <span className="text-amber-600 dark:text-amber-400">{metadataError}</span>
                ) : metadataFetched ? (
                  <span className="flex items-center gap-1.5 font-medium text-acid-700 dark:text-acid-400"><CheckCircle2 className="h-3.5 w-3.5" />{t('knowledge.metadata.fetchSuccess', 'Website info fetched')}</span>
                ) : (
                  <span className="text-gray-400">{t('knowledge.metadata.hint', 'Website title and description will be fetched automatically after entering URL')}</span>
                )}
              </p>
            )}
            {metadataFetched && formData.name && (
              <div className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm dark:bg-gray-800">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300">
                  <Globe className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{formData.name}</p>
                  <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{formData.description}</p>
                </div>
              </div>
            )}
          </FieldGroup>

          <button
            type="button"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            aria-expanded={showAdvancedOptions}
            className="tgo-pill"
          >
            <Settings2 className="h-4 w-4" />
            {t('knowledge.advancedSettings', 'Advanced Settings')}
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showAdvancedOptions ? 'rotate-180' : ''}`} />
          </button>

          {showAdvancedOptions && (
            <div className="tgo-fade-in space-y-4">
              <FieldGroup title={t('knowledge.basicInfo', 'Basic Information')} icon={FileText}>
                {basicFields('-website', 2)}
              </FieldGroup>

              <FieldGroup title={t('knowledge.crawl.title', 'Crawl Configuration')} icon={Globe}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('knowledge.crawl.maxPages', 'Max Pages')} htmlFor="crawl-max-pages" hint={t('knowledge.crawl.maxPagesHint', '1-10000, default 100')}>
                    <input
                      id="crawl-max-pages"
                      type="number"
                      min={1}
                      max={10000}
                      value={formData.crawlConfig.max_pages}
                      onChange={(e) => handleCrawlConfigChange('max_pages', Math.min(10000, Math.max(1, parseInt(e.target.value, 10) || 100)))}
                      disabled={isLoading}
                      className="tgo-input"
                    />
                  </Field>
                  <Field label={t('knowledge.crawl.maxDepth', 'Max Depth')} htmlFor="crawl-max-depth" hint={t('knowledge.crawl.maxDepthHint', '1-10, default 3')}>
                    <input
                      id="crawl-max-depth"
                      type="number"
                      min={1}
                      max={10}
                      value={formData.crawlConfig.max_depth}
                      onChange={(e) => handleCrawlConfigChange('max_depth', Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 3)))}
                      disabled={isLoading}
                      className="tgo-input"
                    />
                  </Field>
                </div>

                <Field label={t('knowledge.crawl.includePatterns', 'Include Patterns')} htmlFor="crawl-include" hint={t('knowledge.crawl.includePatternsHint', 'Comma-separated URL patterns, only crawl matching pages')}>
                  <input
                    id="crawl-include"
                    type="text"
                    value={formData.crawlConfig.include_patterns?.join(', ') || ''}
                    onChange={(e) => handleCrawlConfigChange('include_patterns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder={t('knowledge.crawl.includePatternsPlaceholder', '/docs/*, /blog/*')}
                    disabled={isLoading}
                    className="tgo-input font-mono text-[13px]"
                  />
                </Field>

                <Field label={t('knowledge.crawl.excludePatterns', 'Exclude Patterns')} htmlFor="crawl-exclude" hint={t('knowledge.crawl.excludePatternsHint', 'Comma-separated URL patterns, skip matching pages')}>
                  <input
                    id="crawl-exclude"
                    type="text"
                    value={formData.crawlConfig.exclude_patterns?.join(', ') || ''}
                    onChange={(e) => handleCrawlConfigChange('exclude_patterns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder={t('knowledge.crawl.excludePatternsPlaceholder', '/admin/*, /login/*')}
                    disabled={isLoading}
                    className="tgo-input font-mono text-[13px]"
                  />
                </Field>

                <div className="space-y-2">
                  <CheckRow
                    checked={formData.crawlConfig.options?.render_js || false}
                    onChange={(checked) => handleCrawlOptionsChange('render_js', checked)}
                    disabled={isLoading}
                    label={t('knowledge.crawl.renderJs', 'Render JavaScript')}
                    trailing={
                      <span title={t('knowledge.crawl.renderJsHint', 'Enable to execute page JavaScript, suitable for dynamic content websites')}>
                        <Info className="h-4 w-4 text-gray-400" />
                      </span>
                    }
                  />
                  <CheckRow
                    checked={formData.crawlConfig.options?.follow_external_links || false}
                    onChange={(checked) => handleCrawlOptionsChange('follow_external_links', checked)}
                    disabled={isLoading}
                    label={t('knowledge.crawl.followExternal', 'Follow External Links')}
                  />
                  <CheckRow
                    checked={formData.crawlConfig.options?.respect_robots_txt !== false}
                    onChange={(checked) => handleCrawlOptionsChange('respect_robots_txt', checked)}
                    disabled={isLoading}
                    label={t('knowledge.crawl.respectRobots', 'Respect robots.txt')}
                  />
                </div>

                <Field label={t('knowledge.crawl.waitTime', 'Wait Time (seconds)')} htmlFor="crawl-wait-time" hint={t('knowledge.crawl.waitTimeHint', 'Time to wait after page load, for dynamic content')}>
                  <input
                    id="crawl-wait-time"
                    type="number"
                    min={0}
                    max={30}
                    value={formData.crawlConfig.options?.wait_time || 0}
                    onChange={(e) => handleCrawlOptionsChange('wait_time', Math.min(30, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    disabled={isLoading}
                    className="tgo-input"
                  />
                </Field>
              </FieldGroup>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
