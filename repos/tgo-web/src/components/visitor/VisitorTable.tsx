import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { VisitorResponse } from '@/services/visitorApi';
import { ChatAvatar } from '@/components/chat/ChatAvatar';
import { ChatPlatformIcon } from '@/components/chat/ChatPlatformIcon';
import { getPlatformLabel, toPlatformType } from '@/utils/platformUtils';
import { formatLocalDateTime, formatOnlineDuration } from '@/utils/dateUtils';
import Icon from '@/components/ui/Icon';
import { normalizeTagHex, hexToRgba } from '@/utils/tagUtils';

interface VisitorTableProps {
  visitors: VisitorResponse[];
  onVisitorClick: (visitor: VisitorResponse) => void;
}

const VisitorTable: React.FC<VisitorTableProps> = ({ visitors, onVisitorClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const formatLastVisit = (timestamp: string) => {
    return formatLocalDateTime(timestamp);
  };

  const handleGoToChat = (e: React.MouseEvent, visitorId: string) => {
    e.stopPropagation();
    // Navigate to chat with customer service channel type (251)
    // Channel ID format for visitors is visitor_id + "-vtr"
    navigate(`/chat/251/${visitorId}-vtr`);
  };

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <th className="px-6 pb-3 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
            {t('visitor.table.visitor', 'Visitor')}
          </th>
          <th className="px-6 pb-3 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
            {t('visitor.table.platform', 'Platform')}
          </th>
          <th className="px-6 pb-3 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
            {t('visitor.table.lastVisit', 'Last Visit')}
          </th>
          <th className="px-6 pb-3 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
            {t('visitor.table.lastOnline', 'Last Online')}
          </th>
          <th className="px-6 pb-3 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
            {t('visitor.table.tags', 'Tags')}
          </th>
          <th className="px-6 pb-3 pt-5 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
            {t('visitor.table.actions', 'Actions')}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-gray-800/70">
            {(!visitors || visitors.length === 0) ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                  {t('visitor.table.empty', 'No visitor data')}
                </td>
              </tr>
            ) : (
              visitors.map((v) => {
                if (!v) return null;
                return (
                  <tr
                    key={v.id}
                    className="group cursor-pointer transition-colors hover:bg-acid-50 dark:hover:bg-acid-400/5"
                    onClick={() => onVisitorClick(v)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <ChatAvatar
                          displayName={v.name || v.display_nickname || v.nickname_zh || v.nickname || t('visitor.unknown', 'Unknown Visitor')}
                          displayAvatar={v.avatar_url || ''}
                          visitorStatus={v.is_online ? 'online' : 'offline'}
                          sizePx={40}
                          colorSeed={`${v.id}-vtr`}
                          wrapperClassName="relative flex-shrink-0 rounded-full ring-4 ring-gray-50 transition-shadow group-hover:ring-acid-200 dark:ring-gray-800 dark:group-hover:ring-acid-400/20"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="max-w-[180px] truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {v.name || v.display_nickname || v.nickname_zh || v.nickname || t('visitor.fallbackName', 'Visitor {{suffix}}').replace('{{suffix}}', (v.platform_open_id || '').slice(-4))}
                          </span>
                          <span className="max-w-[180px] truncate text-xs text-gray-400 dark:text-gray-500">
                            {v.email || v.phone_number || v.platform_open_id || '-'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="inline-flex h-8 items-center gap-2 rounded-full bg-gray-50 px-3 dark:bg-gray-800">
                        <ChatPlatformIcon platformType={v.platform_type as any} />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {getPlatformLabel(toPlatformType(v.platform_type)) || v.platform_type || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm tabular-nums text-gray-600 dark:text-gray-300">
                      {formatLastVisit(v.last_visit_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${v.is_online ? 'bg-acid-500 tgo-pulse-ring' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        {formatOnlineDuration(v.last_online_duration_minutes, v.is_online)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {v.tags && v.tags.length > 0 ? (
                          v.tags.map((tag) => {
                            const hex = normalizeTagHex(tag.color);
                            return (
                              <span
                                key={tag.id}
                                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                                style={{
                                  backgroundColor: hexToRgba(hex, 0.1),
                                  color: hex,
                                  borderColor: hexToRgba(hex, 0.2),
                                }}
                              >
                                {tag.name}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="tgo-icon-btn h-9 w-9 group-hover:rotate-45"
                          title={t('common.details', 'Details')}
                          aria-label={t('common.details', 'Details')}
                        >
                          <Icon name="ArrowUpRight" size={16} />
                        </button>
                        <button
                          onClick={(e) => handleGoToChat(e, v.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-acid-400 transition-transform duration-200 hover:scale-105 active:scale-95 dark:bg-acid-400 dark:text-ink-900"
                          title={t('chat.openChat', 'Open Chat')}
                          aria-label={t('chat.openChat', 'Open Chat')}
                        >
                          <Icon name="MessageCircle" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
  );
};

export default VisitorTable;
