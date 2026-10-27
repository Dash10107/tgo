import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Check,
  ChevronUp,
  ArrowUpRight,
  Rocket,
  Cpu,
  Settings2,
  BookOpen,
  Bot,
  MessageCircle,
} from 'lucide-react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { OnboardingStepStatus } from '@/services/onboardingApi';
import OnboardingMarkdownModal from './OnboardingMarkdownModal';
import ProgressRing from './ProgressRing';

/**
 * Check if language is Chinese
 */
const isChineseLanguage = (language: string): boolean => {
  return language === 'zh' || language === 'zh-CN' || language.startsWith('zh');
};

/**
 * Get localized title based on current language
 * Priority: title_zh (for Chinese) > title > description_zh (for Chinese) > description
 */
const getLocalizedTitle = (step: OnboardingStepStatus, language: string): string => {
  const isZh = isChineseLanguage(language);
  if (isZh) {
    return step.title_zh || step.title || step.description_zh || step.description;
  }
  return step.title || step.description;
};

/**
 * Get localized description based on current language
 */
const getLocalizedDescription = (step: OnboardingStepStatus, language: string): string => {
  const isZh = isChineseLanguage(language);
  return (isZh && step.description_zh) ? step.description_zh : step.description;
};

// Step icon mapping
const STEP_ICONS: Record<number, React.ComponentType<{ className?: string }>> = {
  1: Cpu,           // AI Provider
  2: Settings2,     // Default Models
  3: BookOpen,      // Knowledge Base
  4: Bot,           // Agent
  5: MessageCircle, // First Chat
};

/**
 * Individual step item on the dark timeline
 */
const StepItem: React.FC<{
  step: OnboardingStepStatus;
  isActive: boolean;
  isLast: boolean;
  onClick: () => void;
  language: string;
}> = ({ step, isActive, isLast, onClick, language }) => {
  const { t } = useTranslation();
  const Icon = STEP_ICONS[step.step_number] || Rocket;
  const localizedTitle = getLocalizedTitle(step, language);

  return (
    <button
      onClick={onClick}
      disabled={step.is_completed}
      className={`
        group relative flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors duration-200
        ${step.is_completed ? 'cursor-default' : isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]'}
      `}
    >
      {/* Timeline connector */}
      {!isLast && (
        <span
          aria-hidden="true"
          className={`absolute left-[23px] top-[38px] h-[calc(100%-24px)] w-px ${step.is_completed ? 'bg-acid-400/50' : 'bg-white/10'}`}
        />
      )}

      {/* Step indicator */}
      <span className={`
        relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300
        ${step.is_completed
          ? 'bg-acid-400 text-ink-900'
          : isActive
            ? 'bg-white text-ink-900 tgo-pulse-ring'
            : 'bg-white/10 text-white/50'
        }
      `}>
        {step.is_completed ? (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </span>

      {/* Step content */}
      <span className={`
        min-w-0 flex-1 truncate text-[13px]
        ${step.is_completed
          ? 'text-white/40 line-through decoration-white/20'
          : isActive
            ? 'font-medium text-white'
            : 'text-white/70'
        }
      `}>
        {t(`onboarding.steps.${step.step_name}.title`, localizedTitle)}
      </span>

      {/* Action indicator */}
      {!step.is_completed && (
        <span className={`
          flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-300
          ${isActive
            ? 'bg-acid-400 text-ink-900'
            : 'text-white/0 group-hover:bg-white/10 group-hover:text-white/70'}
        `}>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
};

/**
 * OnboardingSidebarPanel Component
 * Compact dark "quick start" card shown at the bottom of section sidebars
 */
const OnboardingSidebarPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // State for notify modal
  const [notifyModal, setNotifyModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
  }>({ isOpen: false, title: '', content: '' });

  const {
    steps,
    currentStep,
    progressPercentage,
    isCompleted,
    isPanelExpanded,
    hasInitialized,
    skipOnboarding,
    goToStep,
    togglePanelExpanded,
    setShowWelcomeModal,
  } = useOnboardingStore();

  // Don't render if completed or not initialized yet
  if (isCompleted || !hasInitialized || steps.length === 0) {
    return null;
  }

  const completedCount = steps.filter(s => s.is_completed).length;

  const handleStepClick = (step: OnboardingStepStatus) => {
    if (!step.is_completed) {
      // Handle notify type: show markdown modal
      if (step.step_type === 'notify') {
        const localizedTitle = getLocalizedTitle(step, i18n.language);
        const localizedDesc = getLocalizedDescription(step, i18n.language);
        setNotifyModal({
          isOpen: true,
          title: t(`onboarding.steps.${step.step_name}.title`, localizedTitle),
          content: localizedDesc,
        });
        return;
      }
      // Handle action type: navigate to route
      const route = goToStep(step.step_number);
      if (route) {
        navigate(route);
      }
    }
  };

  const handleSkip = async () => {
    await skipOnboarding();
  };

  const handleShowWelcome = () => {
    setShowWelcomeModal(true);
  };

  const handleCloseNotifyModal = () => {
    setNotifyModal({ isOpen: false, title: '', content: '' });
  };

  return (
    <div className="m-3 shrink-0 overflow-hidden rounded-[22px] bg-ink-900 text-white shadow-[0_18px_40px_-20px_rgba(15,16,18,0.8)] ring-1 ring-white/5 dark:bg-black">
      {/* Header - always visible */}
      <button
        onClick={togglePanelExpanded}
        aria-expanded={isPanelExpanded}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <ProgressRing value={progressPercentage} size={38} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {t('onboarding.panel.title', 'Quick Start')}
          </span>
          <span className="block text-[11px] text-white/50">
            {t('onboarding.panel.stepsDone', '{{done}} of {{total}} done', { done: completedCount, total: steps.length })}
          </span>
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80">
          <ChevronUp className={`h-4 w-4 transition-transform duration-300 ${isPanelExpanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Expanded content: grid-rows transition gives a smooth height animation */}
      <div
        className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ gridTemplateRows: isPanelExpanded ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={`px-1.5 pb-2 transition-opacity duration-300 ${isPanelExpanded ? 'opacity-100' : 'opacity-0'}`}>
            {/* Step list */}
            <div className="space-y-0.5">
              {steps.map((step, index) => (
                <StepItem
                  key={step.step_number}
                  step={step}
                  isActive={step.step_number === currentStep}
                  isLast={index === steps.length - 1}
                  onClick={() => handleStepClick(step)}
                  language={i18n.language}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="mt-2 flex items-center justify-between border-t border-white/10 px-2 pt-2.5 pb-1">
              <button
                onClick={handleSkip}
                className="text-xs text-white/40 transition-colors hover:text-white/80"
              >
                {t('onboarding.panel.skip', 'Skip')}
              </button>
              <button
                onClick={handleShowWelcome}
                className="rounded-full bg-acid-400 px-3 py-1 text-xs font-semibold text-ink-900 transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                {t('onboarding.panel.viewAll', 'View All')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notify type step markdown modal */}
      <OnboardingMarkdownModal
        isOpen={notifyModal.isOpen}
        title={notifyModal.title}
        content={notifyModal.content}
        onClose={handleCloseNotifyModal}
      />
    </div>
  );
};

export default OnboardingSidebarPanel;
