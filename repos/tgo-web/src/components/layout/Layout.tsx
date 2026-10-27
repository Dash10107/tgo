import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import OnboardingWelcome from '@/components/onboarding/OnboardingWelcome';
import { useOnboardingStore } from '@/stores/onboardingStore';

/**
 * Main layout component with sidebar and content area
 */
const Layout: React.FC = () => {
  const {
    hasInitialized,
    isLoading,
    isCompleted,
    fetchProgress,
    startPolling,
    stopPolling
  } = useOnboardingStore();
  const location = useLocation();
  // Re-run the entrance animation only when switching top-level sections
  const sectionKey = location.pathname.split('/')[1] || 'root';
  // Chat lays out its own floating cards; every other section sits in one framed surface
  const isCardLayout = sectionKey === 'chat';

  // Fetch onboarding progress on mount
  useEffect(() => {
    if (!hasInitialized && !isLoading) {
      fetchProgress();
    }
  }, [hasInitialized, isLoading, fetchProgress]);

  // Start polling when onboarding is not completed
  useEffect(() => {
    if (hasInitialized && !isCompleted) {
      startPolling();
    }

    // Cleanup on unmount or when completed
    return () => {
      stopPolling();
    };
  }, [hasInitialized, isCompleted, startPolling, stopPolling]);

  return (
    <div className="tgo-canvas h-screen overflow-hidden font-sans antialiased">
      <div className="flex h-full w-full">
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Main Content: framed surface floating on the canvas */}
        <div className="flex min-w-0 flex-1 py-3 pr-3">
          <div
            key={sectionKey}
            className={`tgo-page relative flex min-w-0 flex-1 overflow-hidden rounded-[28px] ${
              isCardLayout ? '' : 'bg-gray-50 ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]'
            }`}
          >
            <Outlet />
          </div>
        </div>
      </div>

      {/* Onboarding Welcome Modal */}
      <OnboardingWelcome />
    </div>
  );
};

export default Layout;
