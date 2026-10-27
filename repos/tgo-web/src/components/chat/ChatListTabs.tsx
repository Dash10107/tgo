import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';

export type ChatTabType = 'mine' | 'unassigned' | 'recent' | 'all' | 'manual';

interface ChatListTabsProps {
  activeTab: ChatTabType;
  onTabChange: (tab: ChatTabType) => void;
  counts: {
    mine: number;      // The "Mine" tab shows the unread count
    unassigned: number; // The "Unassigned" tab shows the waiting count
    // The "All" tab shows no count
  };
}

export const ChatListTabs: React.FC<ChatListTabsProps> = ({ activeTab, onTabChange, counts }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 1 });
  const [visibleTabCount, setVisibleTabCount] = useState<number>(5); // Initially show all
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const allTabs = useMemo(() => [
    { key: 'mine' as ChatTabType, label: t('chat.list.tabs.mine', 'Mine'), count: counts.mine > 0 ? counts.mine : undefined },
    { key: 'unassigned' as ChatTabType, label: t('chat.list.tabs.unassigned', 'Unassigned'), count: counts.unassigned > 0 ? counts.unassigned : undefined },
    { key: 'recent' as ChatTabType, label: t('chat.list.tabs.recent', 'Recently Online') },
    { key: 'all' as ChatTabType, label: t('chat.list.tabs.all', 'Completed') },
    { key: 'manual' as ChatTabType, label: t('chat.list.tabs.manual', 'Manual Service') },
  ], [t, counts.mine, counts.unassigned]);

  // Calculate which tabs need to be collapsed
  const updateTabVisibility = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const padding = 8; // Total left and right padding (p-1)
    const gap = 4; // Gap between tabs (gap-1)
    const moreBtnWidth = 40; // Estimated width of the "More" button
    const availableWidth = containerWidth - padding;

    // Temporarily create a div for measuring to get each tab's width
    const buttons = Array.from(container.querySelectorAll('button[data-measure]')) as HTMLElement[];
    if (buttons.length === 0) return;

    let currentTotalWidth = 0;
    let newVisibleCount = allTabs.length;

    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const btnWidth = btn.offsetWidth;
      const spacing = i === 0 ? 0 : gap;
      
      // If adding the current button exceeds the available width
      if (currentTotalWidth + spacing + btnWidth > availableWidth) {
        // If it is not the first and the More button width has not been deducted, try to recalculate
        if (i > 0 && currentTotalWidth + spacing + moreBtnWidth > availableWidth) {
           newVisibleCount = i - 1;
        } else {
           newVisibleCount = i;
        }
        break;
      }
      currentTotalWidth += spacing + btnWidth;
    }

    setVisibleTabCount(Math.max(1, newVisibleCount)); // Keep at least one
  }, [allTabs.length]);

  const updateIndicator = useCallback(() => {
    if (!containerRef.current) return;
    
    const activeButton = containerRef.current.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeButton) {
      setIndicatorStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
        opacity: 1
      });
    } else {
      // If the active tab is inside "More", move the indicator to the "More" button
      if (moreButtonRef.current) {
        setIndicatorStyle({
          left: moreButtonRef.current.offsetLeft,
          width: moreButtonRef.current.offsetWidth,
          opacity: 1
        });
      } else {
        setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      }
    }
  }, [activeTab, visibleTabCount, allTabs]);

  useEffect(() => {
    updateTabVisibility();
    const observer = new ResizeObserver(() => {
      updateTabVisibility();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [updateTabVisibility]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator, visibleTabCount]);

  const visibleTabs = allTabs.slice(0, visibleTabCount);
  const hiddenTabs = allTabs.slice(visibleTabCount);
  const isactiveInMore = hiddenTabs.some(t => t.key === activeTab);

  const toggleMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!moreButtonRef.current) return;
    const rect = moreButtonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY,
      right: window.innerWidth - rect.right
    });
    setIsMoreOpen(!isMoreOpen);
  };

  useEffect(() => {
    const handleClickOutside = () => setIsMoreOpen(false);
    if (isMoreOpen) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isMoreOpen]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className="relative mx-3 mb-1 flex items-stretch gap-1 rounded-full bg-gray-100 p-1 overflow-hidden dark:bg-gray-800"
    >
      {/* Hidden measuring layer; always renders all tabs to get their widths */}
      <div className="absolute top-0 left-0 invisible pointer-events-none flex gap-1 px-1 h-0 overflow-hidden">
        {allTabs.map(tab => (
          <button key={`measure-${tab.key}`} data-measure={tab.key} tabIndex={-1} aria-hidden="true" className="px-3 py-1.5 text-[12.5px] font-medium flex items-center gap-1.5 whitespace-nowrap">
            <span>{tab.label}</span>
            {tab.count !== undefined && <span className="text-[10px] min-w-[16px] px-1 tabular-nums">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Sliding active pill */}
      <div
        aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-full bg-ink-900 shadow-sm transition-[left,width,opacity] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-acid-400"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          opacity: indicatorStyle.opacity,
        }}
      />

      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            data-tab={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            className={`
              relative z-10 px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors duration-300 outline-none
              flex items-center gap-1.5 whitespace-nowrap
              ${isActive
                ? 'text-white dark:text-ink-900'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }
            `}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] min-w-[16px] px-1 rounded-full tabular-nums font-semibold transition-colors duration-300 ${
                isActive ? 'bg-acid-400 text-ink-900 dark:bg-ink-900 dark:text-acid-400' : 'bg-white text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>{tab.count}</span>
            )}
          </button>
        );
      })}

      {hiddenTabs.length > 0 && (
        <button
          ref={moreButtonRef}
          onClick={toggleMore}
          className={`
            relative z-10 px-2.5 py-1.5 rounded-full text-[12.5px] font-medium transition-colors duration-300 outline-none
            flex items-center gap-1 min-w-[40px] justify-center
            ${isactiveInMore
              ? 'text-white dark:text-ink-900'
              : isMoreOpen
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }
          `}
        >
          <span>{t('common.more', 'more')}</span>
          <ChevronDown size={14} className={`transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Dropdown Menu */}
      {isMoreOpen && createPortal(
        <div 
          className="fixed z-[1000] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-1 min-w-[150px] animate-in fade-in zoom-in-95 slide-in-from-top-1"
          style={{ 
            top: dropdownPos.top + 4,
            right: dropdownPos.right
          }}
          onClick={e => e.stopPropagation()}
        >
          {hiddenTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                onTabChange(tab.key);
                setIsMoreOpen(false);
              }}
              className={`
                w-full px-3 py-2 rounded-xl text-left text-[13px] flex items-center justify-between
                transition-colors duration-150
                ${activeTab === tab.key 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-[11px] tabular-nums bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-2">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
