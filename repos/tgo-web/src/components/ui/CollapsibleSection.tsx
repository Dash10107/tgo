import React, { useState } from 'react';
import { ChevronDown, GripVertical } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  rightContent?: React.ReactNode;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * A reusable collapsible section component for panels.
 */
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  defaultExpanded = true,
  expanded,
  onToggle,
  children,
  className = '',
  headerClassName = '',
  rightContent,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const [isHandlePressed, setIsHandlePressed] = useState(false);

  const isExpanded = expanded !== undefined ? expanded : internalExpanded;

  const handleToggle = () => {
    const nextState = !isExpanded;
    if (onToggle) {
      onToggle(nextState);
    } else {
      setInternalExpanded(nextState);
    }
  };

  return (
    <div
      className={`tgo-vcard ${className}`}
      draggable={draggable && isHandlePressed}
      onDragStart={onDragStart}
      onDragEnd={(e) => {
        setIsHandlePressed(false);
        onDragEnd?.(e);
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className={`flex items-center justify-between gap-2 cursor-pointer group select-none px-3.5 py-3 ${headerClassName}`}
        onClick={handleToggle}
        onMouseDown={(e) => {
          // Dragging is only allowed from the handle or the title area
          const target = e.target as HTMLElement;
          if (target.closest('.drag-handle') || target.tagName === 'H4' || target.closest('h4')) {
            setIsHandlePressed(true);
          }
        }}
        onMouseUp={() => setIsHandlePressed(false)}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {draggable && (
            <div
              className="drag-handle -ml-2 -mr-1.5 flex-shrink-0 cursor-grab p-0.5 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-500 active:cursor-grabbing dark:text-gray-600 dark:hover:text-gray-400"
              onClick={(e) => e.stopPropagation()} // Prevent collapse when clicking handle
            >
              <GripVertical size={14} />
            </div>
          )}
          {icon && <span className="tgo-vcard-icon">{icon}</span>}
          <h4 className="truncate text-[13px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h4>
        </div>
        {rightContent}
        <span
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition-all duration-300 group-hover:bg-gray-100 group-hover:text-gray-700 dark:text-gray-500 dark:group-hover:bg-gray-800 dark:group-hover:text-gray-200 ${isExpanded ? '' : '-rotate-90'}`}
        >
          <ChevronDown size={14} strokeWidth={2.25} />
        </span>
      </div>
      {isExpanded && (
        <div
          className="animate-in fade-in slide-in-from-top-1 px-3.5 pb-3.5"
          onMouseDown={() => setIsHandlePressed(false)} // Force-disable dragging when the mouse is pressed in the content area
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;

