import React from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass } from 'lucide-react';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import {
  ConfigCard,
  GeneralCard,
  PlatformConfigShell,
  usePlatformActions,
  usePlatformAISettings,
  usePlatformName,
} from '@/components/platforms/PlatformKit';
import type { Platform } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';

interface PlatformConfigProps {
  platform: Platform;
}

/**
 * Fallback configuration for platform types without a dedicated screen:
 * name, lifecycle and AI settings only.
 */
const PlatformConfig: React.FC<PlatformConfigProps> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const isUpdating = usePlatformStore(s => s.isUpdating);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.website.messages.enabled', 'Platform enabled'),
    disabled: t('platforms.website.messages.disabled', 'Platform disabled'),
    deleted: t('platforms.website.messages.deleteSuccess', 'Platform Deleted'),
  });
  const name = usePlatformName(platform);
  const ai = usePlatformAISettings(platform);
  const canSave = name.changed || ai.changed;

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};
      if (name.changed) updates.name = name.name.trim();
      if (ai.changed) Object.assign(updates, ai.updates());
      await updatePlatform(platform.id, updates);
      showSuccess(showToast, t('platforms.config.aiSettings.saveSuccess', 'Settings saved'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  return (
    <PlatformConfigShell
      platform={platform}
      actions={actions}
      deleteDialog={{
        title: t('platforms.website.confirm.deleteTitle', 'Delete Platform'),
        message: t('platforms.website.confirm.deleteMessage', 'Are you sure you want to delete this platform?'),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <GeneralCard
          name={name.name}
          onNameChange={name.setName}
          label={t('platforms.config.basic.platformName', 'Platform Name')}
        />
        <ConfigCard
          icon={Hourglass}
          iconTone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          title={t('platforms.config.generic.title', 'Platform Configuration')}
          description={t('platforms.config.generic.comingSoon', 'Specific configuration options for this platform will be provided in future versions.')}
        />
      </div>
      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default PlatformConfig;
