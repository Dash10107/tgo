import React, { useState, useEffect } from 'react';
import { FileText, Globe, MessageSquare, PencilLine, Lock } from 'lucide-react';
import { Modal, Field, PrimaryButton, SecondaryButton } from '@/components/ui/ModalKit';

import { TagInput } from '@/components/ui/TagInput';
import type { KnowledgeBaseItem, KnowledgeBaseType } from '@/types';
import { useTranslation } from 'react-i18next';

// Helper function to get default icon based on knowledge base type
const getDefaultIconByType = (type: KnowledgeBaseType): string => {
  switch (type) {
    case 'file': return 'FileText';
    case 'website': return 'Globe';
    case 'qa': return 'MessageSquare';
    default: return 'FileText';
  }
};

interface EditKnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: { name: string; description: string; icon: string; tags: string[] }) => Promise<void>;
  knowledgeBase: KnowledgeBaseItem | null;
  isLoading?: boolean;
}

export const EditKnowledgeBaseModal: React.FC<EditKnowledgeBaseModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  knowledgeBase,
  isLoading = false
}) => {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'FileText',
    tags: [] as string[]
  });
  const [errors, setErrors] = useState({
    name: '',
    description: ''
  });

  // Initialize form data when modal opens or knowledge base changes
  useEffect(() => {
    if (isOpen && knowledgeBase) {
      // Extract tags from the knowledge base
      const existingTags = Array.isArray(knowledgeBase.tags)
        ? knowledgeBase.tags.map(tag => typeof tag === 'string' ? tag : tag.name).filter(Boolean)
        : [];

      setFormData({
        name: knowledgeBase.title || '',
        description: knowledgeBase.content || '',
        icon: knowledgeBase.icon || getDefaultIconByType(knowledgeBase.type || 'file'),
        tags: existingTags
      });
      setErrors({ name: '', description: '' });
    }
  }, [isOpen, knowledgeBase]);

  const validateForm = (): boolean => {
    const newErrors = { name: '', description: '' };
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

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!knowledgeBase || !validateForm()) {
      return;
    }

    try {
      await onSubmit(knowledgeBase.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        icon: formData.icon,
        tags: formData.tags
      });
      onClose();
    } catch (error) {
      // Error handling is done by the parent component
      console.error('Failed to update knowledge base:', error);
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

  const typeMeta = {
    website: { icon: Globe, label: t('knowledge.typeWebsite', 'Website') },
    qa: { icon: MessageSquare, label: t('knowledge.typeQA', 'QA Pairs') },
    file: { icon: FileText, label: t('knowledge.typeFile', 'File') },
  }[knowledgeBase?.type ?? 'file'];
  const TypeIcon = typeMeta.icon;

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!knowledgeBase) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      preventClose={isLoading}
      size="md"
      icon={PencilLine}
      title={t('knowledge.edit', 'Edit Knowledge Base')}
      subtitle={t('knowledge.editDesc', 'Modify knowledge base basic information')}
      onSubmit={handleSubmit}
      footer={
        <>
          <SecondaryButton onClick={handleClose} disabled={isLoading}>
            {t('common.cancel', 'Cancel')}
          </SecondaryButton>
          <PrimaryButton type="submit" loading={isLoading} loadingText={t('common.updating', 'Updating...')}>
            {t('knowledge.update', 'Update Knowledge Base')}
          </PrimaryButton>
        </>
      }
    >
      {/* Type (read-only) */}
      <div className="tgo-well flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
          <TypeIcon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{typeMeta.label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('knowledge.typeReadonly', 'Knowledge base type cannot be changed after creation')}
          </p>
        </div>
        <Lock className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
      </div>

      {/* Website crawl info (read-only) */}
      {knowledgeBase.type === 'website' && knowledgeBase.crawlConfig && (
        <div className="tgo-well space-y-3 p-4">
          <p className="tgo-eyebrow flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {t('knowledge.crawl.info', 'Crawl Configuration')}
          </p>
          <p className="truncate font-mono text-[13px] text-gray-700 dark:text-gray-200" title={knowledgeBase.crawlConfig.start_url}>
            {knowledgeBase.crawlConfig.start_url}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="tgo-chip bg-white dark:bg-gray-800">{t('knowledge.crawl.maxPages', 'Max Pages')} · <b className="text-gray-900 dark:text-white">{knowledgeBase.crawlConfig.max_pages || 100}</b></span>
            <span className="tgo-chip bg-white dark:bg-gray-800">{t('knowledge.crawl.maxDepth', 'Max Depth')} · <b className="text-gray-900 dark:text-white">{knowledgeBase.crawlConfig.max_depth || 3}</b></span>
          </div>
        </div>
      )}

      <Field
        label={t('knowledge.name', 'Name')}
        htmlFor="edit-kb-name"
        required
        error={errors.name}
        aside={`${formData.name.length}/50`}
      >
        <input
          id="edit-kb-name"
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
        htmlFor="edit-kb-description"
        required
        error={errors.description}
        hint={t('knowledge.descriptionHelper', 'The more accurate the description, the easier it is for AI to use this knowledge base correctly')}
      >
        <textarea
          id="edit-kb-description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder={t('knowledge.descriptionPlaceholder', 'Describe the content and purpose of the knowledge base')}
          disabled={isLoading}
          rows={3}
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
    </Modal>
  );
};
