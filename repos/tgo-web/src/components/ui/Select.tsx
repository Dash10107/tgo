import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, Plus } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  color?: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Show "Add Provider" option at the end */
  showAddProvider?: boolean;
  /** Callback when "Add Provider" is clicked */
  onAddProvider?: () => void;
  /** Label for the add provider option */
  addProviderLabel?: string;
  /** Message to show when no options are available */
  emptyMessage?: string;
  /** Called when dropdown opens (for lazy loading) */
  onOpen?: () => void;
  /** Show loading state */
  isLoading?: boolean;
  /** Loading text */
  loadingText?: string;
}

/**
 * Custom Select component with dropdown
 * Supports adding a "Add Provider" option at the end
 */
const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Please select',
  disabled = false,
  className = '',
  showAddProvider = false,
  onAddProvider,
  addProviderLabel = '+ Add provider',
  emptyMessage = 'No options available',
  onOpen,
  isLoading = false,
  loadingText = 'Loading...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen && onOpen) {
      onOpen();
    }
  }, [disabled, isOpen, onOpen]);

  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  }, [onChange]);

  const handleAddProvider = useCallback(() => {
    setIsOpen(false);
    onAddProvider?.();
  }, [onAddProvider]);

  const selectedOption = options.find(o => o.value === value);
  const displayLabel = selectedOption?.label || placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full flex h-9 items-center justify-between gap-2 px-4 text-sm text-left
          rounded-full border transition-colors
          ${disabled
            ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            : `bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 cursor-pointer ${isOpen ? 'border-acid-500' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`
          }
          focus:outline-none focus-visible:ring-2 focus-visible:ring-acid-400
        `}
      >
        <span className={`truncate ${!selectedOption ? 'text-gray-500 dark:text-gray-400' : ''}`}>
          {displayLabel}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="animate-in fade-in zoom-in-95 slide-in-from-top-1 absolute z-50 mt-2 max-h-60 w-full min-w-[10rem] overflow-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          {/* Loading state */}
          {isLoading && (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              {loadingText}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              {emptyMessage}
            </div>
          )}

          {/* Options */}
          {!isLoading && options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => !option.disabled && handleSelect(option.value)}
              disabled={option.disabled}
              className={`
                w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm text-left
                transition-colors
                ${option.disabled
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : option.value === value
                    ? 'bg-acid-200/70 text-ink-900 dark:bg-acid-400/15 dark:text-acid-300'
                    : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {option.color && (
                  <span 
                    className="w-2 h-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: option.color }}
                  />
                )}
                <span className="truncate">{option.label}</span>
              </div>
              {option.value === value && (
                <Check className="w-4 h-4 text-acid-700 dark:text-acid-400" />
              )}
            </button>
          ))}

          {/* Add Provider option */}
          {showAddProvider && (
            <>
              {options.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700" />
              )}
              <button
                type="button"
                onClick={handleAddProvider}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-left text-ink-900 hover:bg-acid-200/70 dark:text-acid-300 dark:hover:bg-acid-400/15 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{addProviderLabel}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Select;

