import React, { useState, useRef, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxTagLength?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Tag Input Component
 * Allows users to add and remove tags with visual feedback
 */
export const TagInput: React.FC<TagInputProps> = ({
  tags = [],
  onTagsChange,
  placeholder,
  maxTags = 10,
  maxTagLength = 20,
  disabled = false,
  className = ''
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Use i18n for default placeholder
  const displayPlaceholder = placeholder || t('tagInput.placeholder', 'Enter tag and press Enter to add');

  // Clear error after a delay
  const clearError = () => {
    setTimeout(() => setError(''), 3000);
  };

  // Validate and add a new tag
  const addTag = (tagName: string) => {
    const trimmedTag = tagName.trim();

    // Validation checks
    if (!trimmedTag) {
      setError(t('tagInput.errors.empty', 'Tag name cannot be empty'));
      clearError();
      return false;
    }

    if (trimmedTag.length > maxTagLength) {
      setError(t('tagInput.errors.tooLong', { max: maxTagLength, defaultValue: `Tag name cannot exceed {{max}} characters` }));
      clearError();
      return false;
    }

    if (tags.includes(trimmedTag)) {
      setError(t('tagInput.errors.duplicate', 'This tag already exists'));
      clearError();
      return false;
    }

    if (tags.length >= maxTags) {
      setError(t('tagInput.errors.maxReached', { max: maxTags, defaultValue: `Maximum of {{max}} tags allowed` }));
      clearError();
      return false;
    }

    // Add the tag
    const newTags = [...tags, trimmedTag];
    onTagsChange(newTags);
    setInputValue('');
    setError('');
    return true;
  };

  // Remove a tag
  const removeTag = (indexToRemove: number) => {
    const newTags = tags.filter((_, index) => index !== indexToRemove);
    onTagsChange(newTags);
    setError('');
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (inputValue.trim()) {
          addTag(inputValue);
        }
        break;
      
      case ',':
        e.preventDefault();
        if (inputValue.trim()) {
          addTag(inputValue);
        }
        break;
      
      case 'Backspace':
        if (!inputValue && tags.length > 0) {
          removeTag(tags.length - 1);
        }
        break;
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Prevent input if it would exceed max length
    if (value.length <= maxTagLength) {
      setInputValue(value);
      setError('');
    }
  };

  // Handle paste event to support multiple tags
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const potentialTags = pastedText.split(/[,，\n\t]/).map(tag => tag.trim()).filter(tag => tag);

    let addedCount = 0;
    for (const tag of potentialTags) {
      if (tags.length + addedCount >= maxTags) {
        setError(t('tagInput.errors.maxReached', { max: maxTags, defaultValue: `Maximum of {{max}} tags allowed` }));
        clearError();
        break;
      }
      if (addTag(tag)) {
        addedCount++;
      }
    }
  };

  // Focus input when container is clicked
  const handleContainerClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={className}>
      {/* Tag Input Container */}
      <div
        className={`tgo-input flex items-center !py-2 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-text'}`}
        aria-invalid={Boolean(error)}
        onClick={handleContainerClick}
      >
        <div className="flex w-full flex-wrap items-center gap-1.5">
          {/* Existing Tags */}
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-ink-900 pl-3 pr-1.5 text-xs font-medium text-white dark:bg-acid-400 dark:text-ink-900"
            >
              <span>{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(index);
                  }}
                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/20 dark:hover:bg-black/15"
                  title={t('tagInput.removeTag', 'Remove tag')}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}

          {/* Input Field */}
          {!disabled && tags.length < maxTags && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={tags.length === 0 ? displayPlaceholder : ''}
              className="h-7 min-w-[120px] flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
              disabled={disabled}
            />
          )}
        </div>
      </div>

      {/* Helper Text and Error */}
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px]">
        <div className="text-gray-500 dark:text-gray-400">
          {error ? (
            <span className="text-red-600 dark:text-red-400">{error}</span>
          ) : (
            <span>
              {t('tagInput.count', { current: tags.length, max: maxTags, defaultValue: `{{current}}/{{max}} tags` })}
              {inputValue && ` • ${t('tagInput.currentInput', { current: inputValue.length, max: maxTagLength, defaultValue: `Current input: {{current}}/{{max}} characters` })}`}
            </span>
          )}
        </div>

        {!disabled && (
          <div className="text-gray-400 dark:text-gray-500">
            {t('tagInput.hint', 'Press Enter or comma to add tag')}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagInput;
