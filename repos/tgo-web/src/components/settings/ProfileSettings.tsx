/**
 * Profile Settings Component
 * Manage current staff member's profile and service status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneOff, Phone, CalendarPlus, CalendarClock, AtSign, Headphones } from 'lucide-react';
import { staffApi, StaffRole, StaffStatus } from '@/services/staffApi';
import { StaffResponse } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { ErrorPanel, RefreshButton } from '@/components/ui/PageKit';
import { PrimaryButton } from '@/components/ui/ModalKit';
import { SettingsPage, SettingsCard, SettingsLoader, InfoLine } from './SettingsKit';

const roleStyleConfig: Record<StaffRole, string> = {
  admin: 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900',
  user: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  agent: 'bg-acid-300 text-ink-900',
};

const statusDotConfig: Record<StaffStatus, string> = {
  online: 'bg-acid-500',
  offline: 'bg-gray-400',
  busy: 'bg-amber-400',
};

const errorMessage = (err: unknown): string | undefined =>
  err instanceof Error ? err.message : undefined;

const ProfileSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showSuccess, showError } = useToast();

  const [profile, setProfile] = useState<StaffResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await staffApi.getMe();
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setLoadError(errorMessage(err) || t('settings.profile.loadError', 'Failed to load profile'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleToggleServicePaused = async () => {
    if (!profile || isToggling) return;

    const newPaused = !profile.service_paused;
    setIsToggling(true);

    try {
      const updated = await staffApi.toggleMyServicePaused(newPaused);
      setProfile(updated);
      showSuccess(
        newPaused
          ? t('settings.profile.servicePaused', 'Service paused')
          : t('settings.profile.serviceResumed', 'Service resumed')
      );
    } catch (err) {
      console.error('Failed to toggle service:', err);
      showError(errorMessage(err) || t('settings.profile.toggleError', 'Failed to toggle service status'));
    } finally {
      setIsToggling(false);
    }
  };

  const title = t('settings.profile.title', 'Profile');
  const subtitle = t('settings.profile.subtitle', 'View and manage your personal information');

  if (isLoading && !profile) {
    return (
      <SettingsPage title={title} subtitle={subtitle}>
        <SettingsLoader />
      </SettingsPage>
    );
  }

  if (loadError) {
    return (
      <SettingsPage title={title} subtitle={subtitle}>
        <ErrorPanel message={loadError} onRetry={loadProfile} />
      </SettingsPage>
    );
  }

  const role = (profile?.role as StaffRole) || 'user';
  const status = (profile?.status as StaffStatus) || 'offline';
  const displayName = profile?.nickname || profile?.username || '';
  const paused = Boolean(profile?.service_paused);
  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <SettingsPage
      title={title}
      subtitle={subtitle}
      actions={<RefreshButton onClick={loadProfile} spinning={isLoading} disabled={isLoading} />}
    >
      {/* Identity hero */}
      <section className="relative overflow-hidden rounded-[28px] bg-ink-900 p-7 text-white md:p-8 dark:bg-gray-900 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]">
        <span aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-acid-400/20 blur-2xl" />
        <span aria-hidden="true" className="absolute -bottom-28 right-32 h-56 w-56 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 shrink-0">
            <div className="h-24 w-24 overflow-hidden rounded-full bg-acid-400 ring-4 ring-white/10">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-light text-ink-900">
                  {(displayName || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <span className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-[3px] border-ink-900 dark:border-gray-900 ${statusDotConfig[status] || statusDotConfig.offline}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="tgo-display truncate text-[36px]">{displayName}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleStyleConfig[role] || roleStyleConfig.user}`}>
                {t(`settings.profile.roles.${role}`, role)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/60">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                <AtSign className="h-3.5 w-3.5" />
                {profile?.username}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                <span className={`h-2 w-2 rounded-full ${statusDotConfig[status] || statusDotConfig.offline}`} />
                {t(`settings.profile.statuses.${status}`, status)}
              </span>
            </div>
            {profile?.description && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">{profile.description}</p>
            )}
          </div>
        </div>
      </section>

      {/* Service status */}
      <SettingsCard
        icon={paused ? PhoneOff : Headphones}
        iconTone={paused ? 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400' : 'bg-acid-300 text-ink-900'}
        title={
          <span className="flex items-center gap-2.5">
            {t('settings.profile.serviceStatus', 'Service Status')}
            <span className={`tgo-chip ${paused ? 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400' : 'bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${paused ? 'bg-red-500' : 'bg-acid-500 tgo-pulse-ring'}`} />
              {paused ? t('settings.profile.servicePausedLabel', 'Service Paused') : t('settings.profile.serviceActiveLabel', 'Active')}
            </span>
          </span>
        }
        description={
          paused
            ? t('settings.profile.servicePausedDesc', 'You will not be assigned new visitors while paused, existing conversations are not affected')
            : t('settings.profile.serviceActiveDesc', 'System will assign new visitors to you based on assignment rules')
        }
        actions={
          <PrimaryButton
            onClick={handleToggleServicePaused}
            loading={isToggling}
            variant={paused ? 'primary' : 'danger'}
            icon={paused ? <Phone className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
          >
            {paused ? t('settings.profile.resumeService', 'Resume Service') : t('settings.profile.pauseService', 'Pause Service')}
          </PrimaryButton>
        }
      />

      {/* Account */}
      <SettingsCard title={t('settings.profile.accountInfo', 'Account Information')}>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <InfoLine icon={CalendarPlus} label={t('settings.profile.createdAt', 'Created At')}>{formatDate(profile?.created_at)}</InfoLine>
          <InfoLine icon={CalendarClock} label={t('settings.profile.updatedAt', 'Updated At')}>{formatDate(profile?.updated_at)}</InfoLine>
        </div>
      </SettingsCard>
    </SettingsPage>
  );
};

export default ProfileSettings;
