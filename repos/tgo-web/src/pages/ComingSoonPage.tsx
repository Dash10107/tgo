import React from 'react';
import { useTranslation } from 'react-i18next';

interface ComingSoonPageProps {
  title?: string;
  icon?: string;
  description?: string;
}

/**
 * Coming soon page component for features under development
 */
const ComingSoonPage: React.FC<ComingSoonPageProps> = ({
  title,
  icon = '🚧',
  description
}) => {
  const { t } = useTranslation();
  const finalTitle = title ?? t('comingSoon.title', 'Coming soon');
  const finalDescription = description ?? t('comingSoon.description', 'This feature is under development. Stay tuned...');
  return (
    <div className="flex-grow flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center text-gray-500">
        <div className="text-6xl mb-4">{icon}</div>
        <h2 className="text-xl font-semibold mb-2">{finalTitle}</h2>
        <p>{finalDescription}</p>
      </div>
    </div>
  );
};

export default ComingSoonPage;
