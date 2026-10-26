/**
 * SkillFormModal
 *
 * - **Create mode** (no `skill` prop): Import a skill from a GitHub directory URL.
 * - **Edit mode** (`skill` prop provided): Edit description / instructions / tags of
 *   an existing project-private skill.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Zap, Loader2, Tag, Plus, Github, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import SkillsApiService, {
  type SkillImportRequest,
  type SkillUpdateRequest,
  type SkillDetail,
} from '@/services/skillsApi';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SkillFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Passing a SkillDetail switches the modal to "edit" mode. */
  skill?: SkillDetail | null;
  /** Called after a successful import/update so the parent can refresh its list. */
  onSaved?: () => void;
}

// ---------------------------------------------------------------------------
// Edit form state
// ---------------------------------------------------------------------------

interface EditFormData {
  description: string;
  instructions: string;
  author: string;
  license: string;
  tags: string[];
  is_featured: boolean;
}

const EMPTY_EDIT_FORM: EditFormData = {
  description: '',
  instructions: '',
  author: '',
  license: '',
  tags: [],
  is_featured: false,
};

interface FormErrors {
  github_url?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// GitHub URL validation helper
// ---------------------------------------------------------------------------

// Accepts both /tree/ and /blob/ URLs, with or without trailing filename (e.g. SKILL.md)
const GITHUB_URL_PATTERN =
  /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(?:tree|blob)\/[^/]+\/.+$/;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SkillFormModal: React.FC<SkillFormModalProps> = ({
  isOpen,
  onClose,
  skill,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  const isEditMode = !!skill;

  // Import mode state
  const [githubUrl, setGithubUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Edit mode state
  const [editForm, setEditForm] = useState<EditFormData>(EMPTY_EDIT_FORM);
  const [tagInput, setTagInput] = useState('');

  // Common state
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // ---------------------------------------------------------------------------
  // Initialise / reset when the modal opens
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setIsSaving(false);

    if (skill) {
      // Edit mode: populate form
      setEditForm({
        description: skill.description,
        instructions: skill.instructions ?? '',
        author: skill.author ?? '',
        license: skill.license ?? '',
        tags: skill.tags ?? [],
        is_featured: skill.is_featured,
      });
      setTagInput('');
    } else {
      // Import mode: clear
      setGithubUrl('');
      setGithubToken('');
      setShowTokenInput(false);
    }
  }, [isOpen, skill]);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  const validateImport = useCallback((): boolean => {
    const e: FormErrors = {};
    const url = githubUrl.trim();

    if (!url) {
      e.github_url = t('skills.import.errors.urlRequired', 'Please enter a GitHub directory URL');
    } else if (!GITHUB_URL_PATTERN.test(url)) {
      e.github_url = t(
        'skills.import.errors.urlFormat',
        'Please enter a valid GitHub URL, supports directory or file links, e.g.: https://github.com/owner/repo/tree/branch/path',
      );
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [githubUrl, t]);

  const validateEdit = useCallback((): boolean => {
    const e: FormErrors = {};

    if (!editForm.description.trim()) {
      e.description = t('skills.form.errors.descRequired', 'Please enter a description');
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [editForm, t]);

  // ---------------------------------------------------------------------------
  // Tag helpers (edit mode only)
  // ---------------------------------------------------------------------------
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !editForm.tags.includes(tag)) {
      setEditForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setEditForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    if (isEditMode) {
      if (!validateEdit()) return;
    } else {
      if (!validateImport()) return;
    }

    setIsSaving(true);
    try {
      if (isEditMode) {
        const payload: SkillUpdateRequest = {
          description: editForm.description,
          instructions: editForm.instructions || undefined,
          author: editForm.author || undefined,
          license: editForm.license || undefined,
          tags: editForm.tags,
          is_featured: editForm.is_featured,
        };
        await SkillsApiService.updateSkill(skill!.name, payload);
        showSuccess(t('skills.form.updateSuccess', 'Skill updated'));
      } else {
        const payload: SkillImportRequest = {
          github_url: githubUrl.trim(),
          github_token: githubToken.trim() || undefined,
        };
        await SkillsApiService.importSkill(payload);
        showSuccess(t('skills.import.success', 'Skill imported successfully'));
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showError(
        isEditMode
          ? t('skills.form.updateFailed', 'Failed to update skill')
          : t('skills.import.failed', 'Failed to import skill'),
        msg,
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <Zap className="w-5 h-5 text-blue-600" />
            ) : (
              <Github className="w-5 h-5 text-gray-800 dark:text-gray-200" />
            )}
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {isEditMode
                ? t('skills.form.editTitle', 'Edit Skill')
                : t('skills.import.title', 'Import Skill from GitHub')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isEditMode ? (
            /* ============================================================
             * EDIT MODE
             * ============================================================ */
            <>
              {/* Name (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('skills.form.name', 'Skill Name')}
                </label>
                <input
                  type="text"
                  value={skill!.name}
                  disabled
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm outline-none cursor-not-allowed"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('skills.form.description', 'Description')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('skills.form.instructions', 'Skill Instructions (Markdown)')}
                </label>
                <textarea
                  rows={8}
                  value={editForm.instructions}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      instructions: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-y"
                />
              </div>

              {/* Author & License */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('skills.form.author', 'Author')}
                  </label>
                  <input
                    type="text"
                    value={editForm.author}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        author: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('skills.form.license', 'License')}
                  </label>
                  <input
                    type="text"
                    value={editForm.license}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        license: e.target.value,
                      }))
                    }
                    placeholder="MIT"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('skills.form.tags', 'Tags')}
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editForm.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-0.5 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder={t(
                      'skills.form.tagPlaceholder',
                      'Type a tag and press Enter',
                    )}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    disabled={!tagInput.trim()}
                    className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ============================================================
             * IMPORT MODE
             * ============================================================ */
            <>
              {/* GitHub URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('skills.import.urlLabel', 'GitHub Skill Directory URL')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo/tree/main/skills/my-skill"
                    className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                      errors.github_url
                        ? 'border-red-400 focus:ring-red-500/20'
                        : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                  />
                </div>
                {errors.github_url && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.github_url}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-gray-400">
                  {t(
                    'skills.import.urlHint',
                    'Paste a GitHub directory or file URL (supports /tree/ and /blob/ links), the system will automatically download the entire directory',
                  )}
                </p>
              </div>

              {/* GitHub Token (optional, collapsible) */}
              <div>
                {!showTokenInput ? (
                  <button
                    type="button"
                    onClick={() => setShowTokenInput(true)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {t(
                      'skills.import.addToken',
                      'Add GitHub Token (for private repos or higher rate limits)',
                    )}
                  </button>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('skills.import.tokenLabel', 'GitHub Token')}{' '}
                      <span className="text-xs text-gray-400 font-normal">
                        ({t('common.optional', 'Optional')})
                      </span>
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="password"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {t(
                        'skills.import.tokenHint',
                        'For accessing private repos or increasing GitHub API rate limits (anonymous: 60/hr, authenticated: 5000/hr)',
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Info box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl p-4">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                  {t('skills.import.infoTitle', 'Skill Directory Specification')}
                </h4>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                  <li>
                    {t(
                      'skills.import.infoItem1',
                      'Directory must contain a SKILL.md file with YAML frontmatter',
                    )}
                  </li>
                  <li>
                    {t(
                      'skills.import.infoItem2',
                      'SKILL.md frontmatter must include name and description fields',
                    )}
                  </li>
                  <li>
                    {t(
                      'skills.import.infoItem3',
                      'May optionally include scripts/, references/, assets/ subdirectories',
                    )}
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditMode
              ? t('common.save', 'Save')
              : t('skills.import.submit', 'Import Skill')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkillFormModal;
