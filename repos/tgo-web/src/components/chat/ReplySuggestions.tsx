import React from 'react';
import { useTranslation } from 'react-i18next';

interface ReplySuggestionsProps {
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}

/**
 * Reply suggestions component for AI-powered quick replies
 */
const ReplySuggestions: React.FC<ReplySuggestionsProps> = ({ suggestions, onSuggestionClick }) => {
  const { t } = useTranslation();
  if (!suggestions || suggestions.length === 0) return null;

  const handleSuggestionClick = (suggestion: string): void => {
    onSuggestionClick?.(suggestion);
  };

  return (
    <div className="mt-2 ml-10 pl-2 flex items-center gap-2 border-l border-dashed border-gray-300 dark:border-gray-600">
      <span className="text-xs text-gray-400 dark:text-gray-500">{t('chat.suggestions.label', '✨ Suggestions:')}</span>
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          className="text-xs bg-white dark:bg-gray-800 hover:bg-acid-300 hover:text-ink-900 dark:hover:bg-acid-400 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-full ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-transparent transition-all duration-200 active:scale-95"
          onClick={() => handleSuggestionClick(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

export default ReplySuggestions;
