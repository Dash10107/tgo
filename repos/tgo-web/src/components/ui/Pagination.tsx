import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

interface PaginationProps {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

/**
 * Pagination component
 */
const Pagination: React.FC<PaginationProps> = ({ 
  currentPage = 1, 
  totalPages = 10, 
  onPageChange,
  className = '' 
}) => {
  const { t } = useTranslation();
  const handlePageClick = (page: number): void => {
    if (page !== currentPage && page >= 1 && page <= totalPages) {
      onPageChange?.(page);
    }
  };

  const renderPageNumbers = (): React.ReactNode[] => {
    const pages: React.ReactNode[] = [];
    const showEllipsis = totalPages > 7;
    
    if (!showEllipsis) {
      // Show all pages if total is 7 or less
      for (let i = 1; i <= totalPages; i++) {
        pages.push(
          <button
            key={i}
            onClick={() => handlePageClick(i)}
            className={`
              relative inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium tabular-nums transition-colors
              ${i === currentPage 
                ? 'z-10 bg-ink-900 text-white dark:bg-acid-400 dark:text-ink-900' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-acid-300 hover:text-ink-900'
              }
            `}
          >
            {i}
          </button>
        );
      }
    } else {
      // Show abbreviated pagination
      pages.push(
        <button
          key={1}
          onClick={() => handlePageClick(1)}
          className={`
            relative inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium tabular-nums transition-colors
            ${1 === currentPage 
              ? 'z-10 bg-ink-900 text-white dark:bg-acid-400 dark:text-ink-900' 
              : 'text-gray-600 dark:text-gray-300 hover:bg-acid-300 hover:text-ink-900'
            }
          `}
        >
          1
        </button>
      );

      if (currentPage > 3) {
        pages.push(
          <span key="ellipsis1" className="relative inline-flex h-9 items-center px-2 text-sm font-medium text-gray-400">
            ...
          </span>
        );
      }

      // Show current page and neighbors
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(
            <button
              key={i}
              onClick={() => handlePageClick(i)}
              className={`
                relative inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium tabular-nums transition-colors
                ${i === currentPage 
                  ? 'z-10 bg-ink-900 text-white dark:bg-acid-400 dark:text-ink-900' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-acid-300 hover:text-ink-900'
                }
              `}
            >
              {i}
            </button>
          );
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push(
          <span key="ellipsis2" className="relative inline-flex h-9 items-center px-2 text-sm font-medium text-gray-400">
            ...
          </span>
        );
      }

      if (totalPages > 1) {
        pages.push(
          <button
            key={totalPages}
            onClick={() => handlePageClick(totalPages)}
            className={`
              relative inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium tabular-nums transition-colors
              ${totalPages === currentPage 
                ? 'z-10 bg-ink-900 text-white dark:bg-acid-400 dark:text-ink-900' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-acid-300 hover:text-ink-900'
              }
            `}
          >
            {totalPages}
          </button>
        );
      }
    }

    return pages;
  };

  return (
    <nav className={`inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_var(--color-gray-200)] dark:bg-gray-900 dark:shadow-[inset_0_0_0_1px_var(--color-gray-800)] ${className}`} aria-label="Pagination">
      {/* Previous Button */}
      <button
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage === 1}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-acid-300 hover:text-ink-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
      >
        <span className="sr-only">{t('visitor.pagination.previous', 'Previous')}</span>
        <Icon name="ChevronLeft" size={16} />
      </button>

      {/* Page Numbers */}
      {renderPageNumbers()}

      {/* Next Button */}
      <button
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-acid-300 hover:text-ink-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
      >
        <span className="sr-only">{t('visitor.pagination.next', 'Next')}</span>
        <Icon name="ChevronRight" size={16} />
      </button>
    </nav>
  );
};

export default Pagination;
