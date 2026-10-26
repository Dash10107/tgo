import React, { useState, useCallback } from 'react';
import { X, FileText, Globe, ChevronDown, ChevronUp, Info, Loader2, RefreshCw, MessageSquare, FolderOpen, Store, ShoppingBag } from 'lucide-react';
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

  // Get current type icon component
  const TypeIcon = formData.type === 'file' ? FileText : formData.type === 'website' ? Globe : MessageSquare;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                <FolderOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{t('knowledge.create', 'Create Knowledge Base')}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('knowledge.createDesc', 'Select knowledge base type and fill in basic information')}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 dark:bg-gray-900">
            {/* Type Selection Section - Compact Layout */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('knowledge.type', 'Type')} <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {/* File Type */}
                <button
                  type="button"
                  onClick={() => handleTypeChange('file')}
                  disabled={isLoading}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-all duration-200 ${
                    formData.type === 'file'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                  } ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <FileText className={`w-4 h-4 ${formData.type === 'file' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  <span className="text-sm font-medium">{t('knowledge.typeFile', 'File')}</span>
                  {formData.type === 'file' && (
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Website Type */}
                <button
                  type="button"
                  onClick={() => handleTypeChange('website')}
                  disabled={isLoading}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-all duration-200 ${
                    formData.type === 'website'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                  } ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <Globe className={`w-4 h-4 ${formData.type === 'website' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  <span className="text-sm font-medium">{t('knowledge.typeWebsite', 'Website')}</span>
                  {formData.type === 'website' && (
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* QA Type */}
                <button
                  type="button"
                  onClick={() => handleTypeChange('qa')}
                  disabled={isLoading}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-all duration-200 ${
                    formData.type === 'qa'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                  } ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <MessageSquare className={`w-4 h-4 ${formData.type === 'qa' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  <span className="text-sm font-medium">{t('knowledge.typeQA', 'QA Pairs')}</span>
                  {formData.type === 'qa' && (
                    <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Separator */}
                <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 self-center mx-1" />

                {/* Tmall - Coming Soon */}
                <div
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 opacity-50 cursor-not-allowed"
                  title={t('knowledge.comingSoon', 'Coming Soon')}
                >
                  <Store className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-400 dark:text-gray-500">{t('knowledge.typeTmall', 'Tmall')}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded">
                    {t('knowledge.comingSoonBadge', 'Coming Soon')}
                  </span>
                </div>

                {/* Taobao - Coming Soon */}
                <div
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 opacity-50 cursor-not-allowed"
                  title={t('knowledge.comingSoon', 'Coming Soon')}
                >
                  <SiTaobao className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-400 dark:text-gray-500">{t('knowledge.typeTaobao', 'Taobao')}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded">
                    {t('knowledge.comingSoonBadge', 'Coming Soon')}
                  </span>
                </div>

                {/* JD - Coming Soon */}
                <div
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 opacity-50 cursor-not-allowed"
                  title={t('knowledge.comingSoon', 'Coming Soon')}
                >
                  <ShoppingBag className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-400 dark:text-gray-500">{t('knowledge.typeJD', 'JD.com')}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded">
                    {t('knowledge.comingSoonBadge', 'Coming Soon')}
                  </span>
                </div>
              </div>
            </div>

            {/* Basic Info Section for file/qa types */}
            {(formData.type === 'file' || formData.type === 'qa') && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 space-y-5 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <TypeIcon className={`w-5 h-5 ${formData.type === 'file' ? 'text-blue-600' : 'text-purple-600'}`} />
                  <h3 className="font-medium text-gray-800 dark:text-gray-100">{t('knowledge.basicInfo', 'Basic Information')}</h3>
                </div>

                {/* Name Field */}
                <div>
                  <label htmlFor="kb-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    {t('knowledge.name', 'Name')} <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    id="kb-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={t('knowledge.namePlaceholder', 'Enter knowledge base name')}
                    disabled={isLoading}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-700 dark:text-gray-100 ${
                      errors.name ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-950' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    } ${isLoading ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                    maxLength={50}
                  />
                  {errors.name && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                  )}
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {formData.name.length}/50 {t('common.characters', 'characters')}
                  </p>
                </div>

                {/* Description Field */}
                <div>
                  <label htmlFor="kb-description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    {t('knowledge.description', 'Description')} <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <textarea
                    id="kb-description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder={t('knowledge.descriptionPlaceholder', 'Describe the content and purpose of the knowledge base')}
                    disabled={isLoading}
                    rows={3}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-vertical bg-white dark:bg-gray-700 dark:text-gray-100 ${
                      errors.description ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-950' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    } ${isLoading ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                  />
                  {errors.description && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
                  )}
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {t('knowledge.descriptionHelper', 'The more accurate the description, the easier it is for AI to use this knowledge base correctly')}
                  </p>
                </div>

                {/* Tags Field */}
                <div>
                  <label htmlFor="kb-tags" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    {t('knowledge.tags', 'Tags')} <span className="text-gray-400 dark:text-gray-500 font-normal">({t('common.optional', 'Optional')})</span>
                  </label>
                  <TagInput
                    tags={formData.tags}
                    onTagsChange={handleTagsChange}
                    placeholder={t('knowledge.tagsPlaceholder', 'Enter tags and press Enter to add')}
                    maxTags={10}
                    maxTagLength={20}
                    disabled={isLoading}
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {t('knowledge.tagsHelper', 'Adding tags helps you organize and find knowledge bases')}
                  </p>
                </div>
              </div>
            )}

            {/* Website Type: URL input section with enhanced styling */}
            {formData.type === 'website' && (
              <div className="space-y-5">
                {/* URL Input Section */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-5 space-y-4 border border-green-100 dark:border-green-800">
                  <div className="flex items-center gap-3 pb-3 border-b border-green-200 dark:border-green-800">
                    <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-medium text-gray-800 dark:text-gray-100">{t('knowledge.crawl.urlSection', 'Website URL')}</h3>
                  </div>

                  {/* Start URL - Main input */}
                  <div>
                    <label htmlFor="crawl-url" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t('knowledge.crawl.startUrl', 'Website URL')} <span className="text-red-500 dark:text-red-400">*</span>
                    </label>
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
                        disabled={isLoading || isLoadingMetadata}
                        className={`flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-700 dark:text-gray-100 ${
                          errors.startUrl ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-950' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        } ${isLoading || isLoadingMetadata ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => fetchWebsiteMetadata(formData.crawlConfig.start_url)}
                        disabled={isLoading || isLoadingMetadata || !formData.crawlConfig.start_url}
                        className="px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        title={t('knowledge.metadata.fetch', 'Fetch Info')}
                      >
                        {isLoadingMetadata ? (
                          <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                        ) : (
                          <RefreshCw className="w-5 h-5 text-gray-500" />
                        )}
                      </button>
                    </div>
                    {errors.startUrl && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.startUrl}</p>
                    )}
                    {isLoadingMetadata && (
                      <p className="mt-1.5 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t('knowledge.metadata.fetching', 'Fetching info...')}
                      </p>
                    )}
                    {metadataError && (
                      <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                        {metadataError}
                      </p>
                    )}
                    {metadataFetched && !isLoadingMetadata && (
                      <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">
                        ✓ {t('knowledge.metadata.fetchSuccess', 'Website info fetched')}
                      </p>
                    )}
                    {!isLoadingMetadata && !metadataFetched && !metadataError && (
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {t('knowledge.metadata.hint', 'Website title and description will be fetched automatically after entering URL')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Advanced Settings Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {t('knowledge.advancedSettings', 'Advanced Settings')}
                </button>

                {/* Advanced Settings Panel */}
                {showAdvancedOptions && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 space-y-5 border border-gray-100 dark:border-gray-700">
                    {/* Basic Info Subsection */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        {t('knowledge.basicInfo', 'Basic Information')}
                      </h4>

                      {/* Name Field */}
                      <div>
                        <label htmlFor="kb-name-website" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          {t('knowledge.name', 'Name')} <span className="text-red-500 dark:text-red-400">*</span>
                        </label>
                        <input
                          id="kb-name-website"
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder={t('knowledge.namePlaceholder', 'Enter knowledge base name')}
                          disabled={isLoading}
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-700 dark:text-gray-100 ${
                            errors.name ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-950' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                          } ${isLoading ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                          maxLength={50}
                        />
                        {errors.name && (
                          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                        )}
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          {formData.name.length}/50 {t('common.characters', 'characters')}
                        </p>
                      </div>

                      {/* Description Field */}
                      <div>
                        <label htmlFor="kb-description-website" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          {t('knowledge.description', 'Description')} <span className="text-red-500 dark:text-red-400">*</span>
                        </label>
                        <textarea
                          id="kb-description-website"
                          value={formData.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          placeholder={t('knowledge.descriptionPlaceholder', 'Describe the content and purpose of the knowledge base')}
                          disabled={isLoading}
                          rows={2}
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-vertical bg-white dark:bg-gray-700 dark:text-gray-100 ${
                            errors.description ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-950' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                          } ${isLoading ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                        />
                        {errors.description && (
                          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
                        )}
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          {t('knowledge.descriptionHelper', 'The more accurate the description, the easier it is for AI to use this knowledge base correctly')}
                        </p>
                      </div>

                      {/* Tags Field */}
                      <div>
                        <label htmlFor="kb-tags-website" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          {t('knowledge.tags', 'Tags')} <span className="text-gray-400 dark:text-gray-500 font-normal">({t('common.optional', 'Optional')})</span>
                        </label>
                        <TagInput
                          tags={formData.tags}
                          onTagsChange={handleTagsChange}
                          placeholder={t('knowledge.tagsPlaceholder', 'Enter tags and press Enter to add')}
                          maxTags={10}
                          maxTagLength={20}
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    {/* Crawl Configuration Subsection */}
                    <div className="pt-5 border-t border-gray-200 dark:border-gray-700 space-y-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-500" />
                        {t('knowledge.crawl.title', 'Crawl Configuration')}
                      </h4>

                      {/* Max Pages & Max Depth */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="crawl-max-pages" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            {t('knowledge.crawl.maxPages', 'Max Pages')}
                          </label>
                          <input
                            id="crawl-max-pages"
                            type="number"
                            min={1}
                            max={10000}
                            value={formData.crawlConfig.max_pages}
                            onChange={(e) => handleCrawlConfigChange('max_pages', Math.min(10000, Math.max(1, parseInt(e.target.value) || 100)))}
                            disabled={isLoading}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-700 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500"
                          />
                          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                            {t('knowledge.crawl.maxPagesHint', '1-10000, default 100')}
                          </p>
                        </div>
                        <div>
                          <label htmlFor="crawl-max-depth" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            {t('knowledge.crawl.maxDepth', 'Max Depth')}
                          </label>
                          <input
                            id="crawl-max-depth"
                            type="number"
                            min={1}
                            max={10}
                            value={formData.crawlConfig.max_depth}
                            onChange={(e) => handleCrawlConfigChange('max_depth', Math.min(10, Math.max(1, parseInt(e.target.value) || 3)))}
                            disabled={isLoading}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-700 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500"
                          />
                          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                            {t('knowledge.crawl.maxDepthHint', '1-10, default 3')}
                          </p>
                        </div>
                      </div>

                      {/* Include Patterns */}
                      <div>
                        <label htmlFor="crawl-include" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          {t('knowledge.crawl.includePatterns', 'Include Patterns')}
                        </label>
                        <input
                          id="crawl-include"
                          type="text"
                          value={formData.crawlConfig.include_patterns?.join(', ') || ''}
                          onChange={(e) => handleCrawlConfigChange('include_patterns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          placeholder={t('knowledge.crawl.includePatternsPlaceholder', '/docs/*, /blog/*')}
                          disabled={isLoading}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-700 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500"
                        />
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          {t('knowledge.crawl.includePatternsHint', 'Comma-separated URL patterns, only crawl matching pages')}
                        </p>
                      </div>

                      {/* Exclude Patterns */}
                      <div>
                        <label htmlFor="crawl-exclude" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          {t('knowledge.crawl.excludePatterns', 'Exclude Patterns')}
                        </label>
                        <input
                          id="crawl-exclude"
                          type="text"
                          value={formData.crawlConfig.exclude_patterns?.join(', ') || ''}
                          onChange={(e) => handleCrawlConfigChange('exclude_patterns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          placeholder={t('knowledge.crawl.excludePatternsPlaceholder', '/admin/*, /login/*')}
                          disabled={isLoading}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-700 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500"
                        />
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          {t('knowledge.crawl.excludePatternsHint', 'Comma-separated URL patterns, skip matching pages')}
                        </p>
                      </div>

                      {/* Crawl Options */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.crawlConfig.options?.render_js || false}
                            onChange={(e) => handleCrawlOptionsChange('render_js', e.target.checked)}
                            disabled={isLoading}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-200 flex-1">
                            {t('knowledge.crawl.renderJs', 'Render JavaScript')}
                          </span>
                          <span title={t('knowledge.crawl.renderJsHint', 'Enable to execute page JavaScript, suitable for dynamic content websites')}>
                            <Info className="w-4 h-4 text-gray-400" />
                          </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.crawlConfig.options?.follow_external_links || false}
                            onChange={(e) => handleCrawlOptionsChange('follow_external_links', e.target.checked)}
                            disabled={isLoading}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-200 flex-1">
                            {t('knowledge.crawl.followExternal', 'Follow External Links')}
                          </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.crawlConfig.options?.respect_robots_txt !== false}
                            onChange={(e) => handleCrawlOptionsChange('respect_robots_txt', e.target.checked)}
                            disabled={isLoading}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-200 flex-1">
                            {t('knowledge.crawl.respectRobots', 'Respect robots.txt')}
                          </span>
                        </label>
                      </div>

                      {/* Wait Time */}
                      <div>
                        <label htmlFor="crawl-wait-time" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          {t('knowledge.crawl.waitTime', 'Wait Time (seconds)')}
                        </label>
                        <input
                          id="crawl-wait-time"
                          type="number"
                          min={0}
                          max={30}
                          value={formData.crawlConfig.options?.wait_time || 0}
                          onChange={(e) => handleCrawlOptionsChange('wait_time', Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
                          disabled={isLoading}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-700 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500"
                        />
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          {t('knowledge.crawl.waitTimeHint', 'Time to wait after page load, for dynamic content')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading || isLoadingMetadata}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || isLoadingMetadata}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                  {t('common.creating', 'Creating...')}
                </>
              ) : isLoadingMetadata ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                  {t('knowledge.metadata.fetching', 'Fetching info...')}
                </>
              ) : (
                t('knowledge.create', 'Create Knowledge Base')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
