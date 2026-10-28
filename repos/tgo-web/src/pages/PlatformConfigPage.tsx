import React, { useEffect, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePlatformStore } from '@/stores/platformStore';
import PlatformConfig from '@/components/platforms/PlatformConfig';
import WebsitePlatformConfig from '@/components/platforms/WebsitePlatformConfig';
import WeComPlatformConfig from '@/components/platforms/WeComPlatformConfig';
import WeComBotPlatformConfig from '@/components/platforms/WeComBotPlatformConfig';
import FeishuBotPlatformConfig from '@/components/platforms/FeishuBotPlatformConfig';
import DingTalkBotPlatformConfig from '@/components/platforms/DingTalkBotPlatformConfig';
import EmailPlatformConfig from '@/components/platforms/EmailPlatformConfig';
import DouyinPlatformConfig from '@/components/platforms/DouyinPlatformConfig';
import CustomPlatformConfig from '@/components/platforms/CustomPlatformConfig';
import TelegramPlatformConfig from '@/components/platforms/TelegramPlatformConfig';
import SlackPlatformConfig from '@/components/platforms/SlackPlatformConfig';
import { ErrorPanel, PageLoader } from '@/components/ui/PageKit';
import type { Platform } from '@/types';

type ConfigComponent = React.FC<{ platform: Platform }>;

const CONFIG_BY_TYPE: Record<string, ConfigComponent> = {
  website: WebsitePlatformConfig,
  wecom: WeComPlatformConfig,
  wecom_bot: WeComBotPlatformConfig,
  feishu_bot: FeishuBotPlatformConfig,
  dingtalk_bot: DingTalkBotPlatformConfig,
  email: EmailPlatformConfig,
  // Douyin / Douyin international (TikTok China market)
  douyin: DouyinPlatformConfig,
  tiktok: DouyinPlatformConfig,
  custom: CustomPlatformConfig,
  telegram: TelegramPlatformConfig,
  slack: SlackPlatformConfig,
};

/**
 * Platform Configuration page component
 * Displays configuration for a specific platform based on URL parameter
 */
const PlatformConfigPage: React.FC = () => {
  const { t } = useTranslation();
  const { platformId } = useParams<{ platformId: string }>();
  const platforms = usePlatformStore(s => s.platforms);
  const isLoadingList = usePlatformStore(s => s.isLoading || s.isConnecting || s.isUpdating || s.isDeleting);
  const isLoadingDetail = usePlatformStore(s => s.isLoadingDetail);
  const detailLoadError = usePlatformStore(s => s.detailLoadError);
  const fetchPlatformById = usePlatformStore(s => s.fetchPlatformById);
  const hasLoadedList = usePlatformStore(s => s.hasLoadedList);

  // Track the last loaded platform ID to avoid redundant fetches
  const lastLoadedIdRef = useRef<string | null>(null);

  const platform = platforms.find(p => p.id === platformId);

  // Fetch platform detail when platformId changes
  useEffect(() => {
    if (platformId && platformId !== lastLoadedIdRef.current) {
      lastLoadedIdRef.current = platformId;
      fetchPlatformById(platformId).catch((error) => {
        console.error('Failed to load platform detail:', error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformId]); // fetchPlatformById is a stable store function

  if (isLoadingDetail) {
    return <PageLoader label={t('platformConfigPage.loading', 'Loading platform configuration...')} />;
  }

  if (detailLoadError && !platform) {
    return (
      <main className="flex flex-1 items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
        <div className="w-full max-w-lg">
          <ErrorPanel
            message={`${t('platformConfigPage.loadFailed', 'Failed to load platform configuration')} — ${detailLoadError}`}
            onRetry={() => { if (platformId) void fetchPlatformById(platformId); }}
          />
        </div>
      </main>
    );
  }

  // Wait for the first list load before deciding the platform doesn't exist
  if ((isLoadingList || !hasLoadedList) && !platform) {
    return <PageLoader />;
  }

  if (!isLoadingList && !platform && platforms.length > 0) {
    return <Navigate to={`/platforms/${platforms[0]!.id}`} replace />;
  }

  if (!isLoadingList && platforms.length === 0) {
    return <Navigate to="/platforms" replace />;
  }

  if (!platform) {
    return null;
  }

  const Config = CONFIG_BY_TYPE[platform.type] ?? PlatformConfig;
  // Keyed so switching platforms of the same type starts from fresh form state
  return <Config key={platform.id} platform={platform} />;
};

export default PlatformConfigPage;
