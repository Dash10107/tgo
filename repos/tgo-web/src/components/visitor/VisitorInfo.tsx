import React from 'react';
import type { ExtendedVisitor } from '@/data/mockVisitor';
import { useTranslation } from 'react-i18next';

interface VisitorInfoProps {
  visitor?: ExtendedVisitor;
}

/**
 * Basic visitor information component
 */
const VisitorInfo: React.FC<VisitorInfoProps> = ({ visitor }) => {
  const { t } = useTranslation();
  if (!visitor) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('visitor.sections.basicInfo', 'Basic Info')}</h4>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('visitor.fields.name', 'Name')}</span>
          <span className="text-gray-800 font-medium">{visitor.basicInfo.name}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">{t('visitor.fields.email', 'Email')}</span>
          {visitor.basicInfo.email !== '-' ? (
            <a 
              href={`mailto:${visitor.basicInfo.email}`} 
              className="text-blue-600 hover:underline truncate max-w-[150px]" 
              title={visitor.basicInfo.email}
            >
              {visitor.basicInfo.email}
            </a>
          ) : (
            <span className="text-gray-800">-</span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('visitor.fields.phone', 'Phone')}</span>
          <span className="text-gray-800">{visitor.basicInfo.phone}</span>
        </div>
      </div>
    </div>
  );
};

export default VisitorInfo;
