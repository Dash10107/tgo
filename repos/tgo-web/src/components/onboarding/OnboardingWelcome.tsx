import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  X,
  Rocket,
  Check,
  ArrowRight,
  ArrowUpRight,
  Cpu,
  Settings2,
  BookOpen,
  Bot,
  MessageCircle
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
 * A single step row in the welcome checklist
 */
const StepRow: React.FC<{
  step: OnboardingStepStatus;
  index: number;
  isActive: boolean;
  onClick: () => void;
  language: string;
}> = ({ step, index, isActive, onClick, language }) => {
  const { t } = useTranslation();
  const Icon = STEP_ICONS[step.step_number] || Rocket;
  const title = t(`onboarding.steps.${step.step_name}.title`, getLocalizedTitle(step, language));

  return (
    <button
      onClick={onClick}
      disabled={step.is_completed}
      style={{ animationDelay: `${120 + index * 60}ms` }}
      className={`
        tgo-fade-up group flex w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left transition-[background-color,box-shadow] duration-300
        ${step.is_completed
          ? 'cursor-default'
          : isActive
            ? 'bg-acid-300 shadow-[0_12px_28px_-16px_rgba(143,179,30,0.9)] dark:bg-acid-400'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        }
      `}
    >
      <span className={`
        flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-300
        ${step.is_completed
          ? 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900'
          : isActive
            ? 'bg-ink-900 text-white'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
        }
      `}>
        {step.is_completed ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${
        step.is_completed
          ? 'text-gray-400 line-through decoration-gray-300 dark:text-gray-500 dark:decoration-gray-600'
          : isActive ? 'text-ink-900' : 'text-gray-800 dark:text-gray-200'
      }`}>
        {title}
      </span>
      <span className={`text-[11px] font-medium tabular-nums ${isActive ? 'text-ink-900/60' : 'text-gray-400 dark:text-gray-500'}`}>
        {String(index + 1).padStart(2, '0')}
      </span>
      {!step.is_completed && (
        <span className={`
          flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300
          ${isActive
            ? 'bg-ink-900 text-white'
            : 'text-gray-300 group-hover:bg-white group-hover:text-ink-900 group-hover:shadow-sm dark:text-gray-600 dark:group-hover:bg-gray-700 dark:group-hover:text-white'
          }
        `}>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
};

/**
 * OnboardingWelcome Modal Component
 * Split-panel welcome guide for new users
 */
const OnboardingWelcome: React.FC = () => {
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
    progressPercentage,
    isCompleted,
    showWelcomeModal,
    isLoading,
    setShowWelcomeModal,
    skipOnboarding,
    goToStep,
    getNextIncompleteStep,
  } = useOnboardingStore();

  const shouldShowWelcome = showWelcomeModal && !isCompleted && steps.length > 0;
  const nextStep = shouldShowWelcome ? getNextIncompleteStep() : null;
  const completedCount = steps.filter(s => s.is_completed).length;

  const openStep = (step: OnboardingStepStatus) => {
    // Notify type: show markdown modal (kept mounted after the welcome modal closes)
    if (step.step_type === 'notify') {
      const localizedTitle = getLocalizedTitle(step, i18n.language);
      const localizedDesc = getLocalizedDescription(step, i18n.language);
      setShowWelcomeModal(false);
      setNotifyModal({
        isOpen: true,
        title: t(`onboarding.steps.${step.step_name}.title`, localizedTitle),
        content: localizedDesc,
      });
      return;
    }
    // Action type: navigate to route
    const route = goToStep(step.step_number);
    if (route) {
      setShowWelcomeModal(false);
      navigate(route);
    }
  };

  const handleStartStep = () => {
    if (nextStep) {
      openStep(nextStep);
    }
  };

  const handleStepClick = (step: OnboardingStepStatus) => {
    if (!step.is_completed) {
      openStep(step);
    }
  };

  const handleSkip = async () => {
    await skipOnboarding();
  };

  const handleLater = () => {
    setShowWelcomeModal(false);
  };

  const handleCloseNotifyModal = () => {
    setNotifyModal({ isOpen: false, title: '', content: '' });
  };

  return (
    <>
      {shouldShowWelcome && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-welcome-title"
        >
          <div className="relative grid max-h-[calc(100vh-2rem)] w-full max-w-[880px] overflow-y-auto rounded-[32px] bg-white shadow-2xl dark:bg-gray-900 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:overflow-hidden">
            {/* Close button */}
            <button
              onClick={handleLater}
              aria-label={t('common.close', 'Close')}
              className="tgo-icon-btn absolute right-4 top-4 z-10"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Hero panel */}
            <div className="relative flex flex-col justify-between overflow-hidden bg-ink-900 p-8 text-white md:p-9">
              {/* Decorative orbits */}
              <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/[0.06]" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/[0.08]" />
              <div aria-hidden="true" className="tgo-float pointer-events-none absolute right-14 top-20 h-3 w-3 rounded-full bg-acid-400 shadow-[0_0_24px_6px_rgba(205,238,85,0.45)]" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-acid-400/10 blur-3xl" />

              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/80">
                  <Rocket className="h-3.5 w-3.5 text-acid-400" />
                  {t('onboarding.welcome.badge', 'Getting started')}
                </span>
                <h2 id="onboarding-welcome-title" className="tgo-display mt-6 text-[40px] leading-[1.05]">
                  {t('onboarding.welcome.title', 'Welcome to Pelatis')}
                </h2>
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
                  {t('onboarding.welcome.subtitle', 'Complete the following steps to start your AI customer service journey')}
                </p>
              </div>

              <div className="relative mt-10 flex items-center gap-4">
                <ProgressRing value={progressPercentage} size={76} stroke={6} className="text-white" />
                <div>
                  <p className="text-2xl font-light tabular-nums">
                    {completedCount}
                    <span className="text-white/40">/{steps.length}</span>
                  </p>
                  <p className="text-xs text-white/50">{t('onboarding.welcome.progress', 'Progress')}</p>
                </div>
              </div>
            </div>

            {/* Steps panel */}
            <div className="flex flex-col p-6 md:p-8">
              <p className="tgo-eyebrow mb-3 px-3">{t('onboarding.welcome.stepsTitle', 'Your setup checklist')}</p>
              <div className="space-y-1">
                {steps.map((step, index) => (
                  <StepRow
                    key={step.step_number}
                    step={step}
                    index={index}
                    isActive={step.step_number === nextStep?.step_number}
                    onClick={() => handleStepClick(step)}
                    language={i18n.language}
                  />
                ))}
              </div>

              {/* Current step detail */}
              {nextStep && (
                <div key={nextStep.step_number} className="tgo-fade-in mt-4 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-800/60">
                  <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {t(`onboarding.steps.${nextStep.step_name}.description`, getLocalizedDescription(nextStep, i18n.language))}
                    <span className="ml-1.5 whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                      · {t('onboarding.welcome.estimatedTime', '~2 min')}
                    </span>
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
                <button
                  onClick={handleSkip}
                  disabled={isLoading}
                  className="text-sm text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-50 dark:hover:text-gray-200"
                >
                  {t('onboarding.welcome.skip', 'Skip Guide')}
                </button>

                <div className="flex items-center gap-2">
                  <button onClick={handleLater} className="tgo-pill h-11 px-5">
                    {t('onboarding.welcome.later', 'Setup Later')}
                  </button>
                  <button
                    onClick={handleStartStep}
                    disabled={isLoading || !nextStep}
                    data-icon-motion="nudge"
                    className="tgo-btn-ink"
                  >
                    <span className="tgo-btn-icon"><ArrowRight className="h-4 w-4" /></span>
                    {t('onboarding.welcome.start', 'Start Setup')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notify type step markdown modal */}
      <OnboardingMarkdownModal
        isOpen={notifyModal.isOpen}
        title={notifyModal.title}
        content={notifyModal.content}
        onClose={handleCloseNotifyModal}
      />
    </>
  );
};

export default OnboardingWelcome;
