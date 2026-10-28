import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PlatformList from '../components/platforms/PlatformList';
import PlatformTypeSelector from '../components/platforms/PlatformTypeSelector';
import type { PlatformOutletContext } from '../components/platforms/PlatformOverview';
import { usePlatformStore } from '@/stores/platformStore';
import type { PlatformType } from '@/types';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';

/**
 * Platform Management layout component with nested routing
 */
const PlatformManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const initializePlatformStore = usePlatformStore(state => state.initializeStore);
  const createPlatform = usePlatformStore(state => state.createPlatform);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    // Fetch platform list when the page is displayed or language changes
    // This ensures data is refreshed after language change or navigation
    initializePlatformStore();
  }, [initializePlatformStore, i18n.language]);

  const openAddPlatform = useCallback(() => setSelectorOpen(true), []);

  const handleTypeSelect = useCallback(async ({ type, name }: { type: string; name: string }) => {
    try {
      const created = await createPlatform({
        name: name || t('platforms.list.defaultName', 'New Platform'),
        type: type as PlatformType,
      });
      setSelectorOpen(false); // close only on success
      showSuccess(
        showToast,
        t('platforms.list.toast.createSuccessTitle', 'Created Successfully'),
        t('platforms.list.toast.createSuccessMessage', {
          defaultValue: 'Platform "{{name}}" has been created',
          name: created.name,
        })
      );
      navigate(`/platforms/${created.id}`);
    } catch (e) {
      // Keep the dialog open on failure
      showApiError(showToast, e);
    }
  }, [createPlatform, navigate, showToast, t]);

  const context: PlatformOutletContext = { openAddPlatform };

  return (
    <div className="flex h-full w-full bg-gray-50 dark:bg-gray-950">
      <PlatformList onAdd={openAddPlatform} />
      <Outlet context={context} />
      <PlatformTypeSelector
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleTypeSelect}
      />
    </div>
  );
};

export default PlatformManagement;
