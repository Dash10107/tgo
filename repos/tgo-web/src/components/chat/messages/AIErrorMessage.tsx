import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * AIErrorMessage renders an error message when AI response generation fails
 * Displayed when streaming message ends with an error (end=1 and end_reason > 0)
 */
export interface AIErrorMessageProps {
  isStaff: boolean; // true for staff (right), false for visitor (left)
  errorText: string; // The error message to display
}

const AIErrorMessage: React.FC<AIErrorMessageProps> = ({ isStaff, errorText }) => {
  if (isStaff) {
    return (
      <div className="bg-red-50 dark:bg-red-950/40 ring-1 ring-red-100 dark:ring-red-900/60 px-4 py-3 rounded-3xl rounded-br-lg overflow-hidden max-w-full">
        <div className="flex items-start gap-2.5 text-red-600 dark:text-red-400">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50"><AlertCircle className="w-3.5 h-3.5" /></span>
          <span className="pt-0.5 text-sm leading-relaxed">{errorText}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 dark:bg-red-950/40 ring-1 ring-red-100 dark:ring-red-900/60 px-4 py-3 rounded-3xl rounded-bl-lg overflow-hidden max-w-full">
      <div className="flex items-start gap-2.5 text-red-600 dark:text-red-400">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50"><AlertCircle className="w-3.5 h-3.5" /></span>
        <span className="pt-0.5 text-sm leading-relaxed">{errorText}</span>
      </div>
    </div>
  );
};

export default AIErrorMessage;

