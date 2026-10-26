
import i18n from '@/i18n';/**
 * Format number with appropriate units (K, M, B)
 */
export const formatNumber = (num: number): string => {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

/**
 * Format date to relative time
 */
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return i18n.t('time.relative.today', 'Today');
  } else if (diffInDays === 1) {
    return i18n.t('time.relative.yesterday', 'Yesterday');
  } else if (diffInDays < 7) {
    return i18n.t('time.relative.daysAgo', { count: diffInDays, defaultValue: '{{count}} days ago' });
  } else if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return i18n.t('time.relative.weeksAgo', { count: weeks, defaultValue: '{{count}} weeks ago' });
  } else if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return i18n.t('time.relative.monthsAgo', { count: months, defaultValue: '{{count}} months ago' });
  } else {
    const years = Math.floor(diffInDays / 365);
    return i18n.t('time.relative.yearsAgo', { count: years, defaultValue: '{{count}} years ago' });
  }
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
