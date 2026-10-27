import React from 'react';
import { Camera, Mail, MapPin, Phone } from 'lucide-react';
import { PlatformType } from '@/types';
import { getPlatformIconComponent, getPlatformLabel } from '@/utils/platformUtils';
import { useTranslation } from 'react-i18next';
import { ChatAvatar } from '@/components/chat/ChatAvatar';

interface VisitorHeaderProps {
  name: string;
  status: 'online' | 'away' | 'offline';
  avatar: string;
  platformType?: PlatformType;
  lastSeenText?: string;
  /** Optional contact details surfaced as quick-action chips */
  email?: string;
  phone?: string;
  location?: string;
  className?: string;
  /** Callback when avatar is clicked for upload */
  onAvatarClick?: () => void;
  /** Whether avatar upload is in progress */
  isUploading?: boolean;
  /** Visitor ID for consistent avatar color */
  visitorId?: string;
}

const hasText = (value?: string): value is string => Boolean(value && value.trim() && value.trim() !== '-');

/**
 * Visitor hero: large avatar with presence ring, name, status/platform pills
 * and quick contact chips. Rendered on the dark hero band of the visitor panel.
 */
const VisitorHeader: React.FC<VisitorHeaderProps> = ({
  name,
  status,
  avatar,
  platformType,
  lastSeenText,
  email,
  phone,
  location,
  className = '',
  onAvatarClick,
  isUploading = false,
  visitorId
}) => {
  const { t } = useTranslation();
  const isOnline = status === 'online';
  const statusLabel = isOnline
    ? t('chat.status.online', 'Online')
    : hasText(lastSeenText) ? lastSeenText : t('chat.status.offline', 'Offline');

  const type = platformType ?? PlatformType.WEBSITE;
  const PlatformIcon = getPlatformIconComponent(type);
  const platformLabel = getPlatformLabel(type);

  const chips: Array<{ key: string; icon: React.ReactNode; label: string; href?: string }> = [];
  if (hasText(location)) chips.push({ key: 'location', icon: <MapPin size={12} />, label: location });
  if (hasText(email)) chips.push({ key: 'email', icon: <Mail size={12} />, label: email, href: `mailto:${email}` });
  if (hasText(phone)) chips.push({ key: 'phone', icon: <Phone size={12} />, label: phone, href: `tel:${phone}` });

  return (
    <div className={`relative flex flex-col items-center text-center ${className}`}>
      <div className="relative">
        <span className={`tgo-vhero-ring ${isOnline ? 'tgo-vhero-ring--live' : ''}`} aria-hidden="true" />
        <ChatAvatar
          displayName={name}
          displayAvatar={avatar}
          colorSeed={visitorId}
          sizePx={72}
          letterClassName="text-2xl"
          wrapperClassName={`relative rounded-full ring-[3px] ring-ink-900 ${onAvatarClick ? 'group cursor-pointer' : ''}`}
          imageClassName={onAvatarClick ? 'group-hover:opacity-75 transition-opacity' : undefined}
          fallbackClassName={onAvatarClick ? 'group-hover:opacity-75 transition-opacity' : undefined}
          onClick={onAvatarClick}
          title={onAvatarClick ? t('visitor.avatar.uploadTitle', 'Click to upload avatar') : undefined}
          overlay={
            onAvatarClick ? (
              isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              )
            ) : null
          }
        />
        <span
          className={`absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full ring-[3px] ring-ink-900 ${isOnline ? 'bg-acid-400 tgo-pulse-ring' : status === 'away' ? 'bg-amber-400' : 'bg-gray-500'}`}
          aria-hidden="true"
        />
      </div>

      <h3 className="mt-3 max-w-full truncate px-2 text-lg font-semibold tracking-tight text-white" title={name}>
        {name}
      </h3>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
        <span className={`tgo-vhero-pill ${isOnline ? 'tgo-vhero-pill--live' : ''}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-ink-900' : 'bg-gray-400'}`} />
          {statusLabel}
        </span>
        <span className="tgo-vhero-pill" title={platformLabel}>
          <PlatformIcon size={12} className="h-3 w-3" />
          {platformLabel}
        </span>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex w-full flex-wrap justify-center gap-1.5">
          {chips.map((chip) => {
            const body = (
              <>
                <span className="shrink-0 text-acid-400">{chip.icon}</span>
                <span className="truncate">{chip.label}</span>
              </>
            );
            return chip.href ? (
              <a key={chip.key} href={chip.href} className="tgo-vhero-chip" title={chip.label}>{body}</a>
            ) : (
              <span key={chip.key} className="tgo-vhero-chip" title={chip.label}>{body}</span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VisitorHeader;
