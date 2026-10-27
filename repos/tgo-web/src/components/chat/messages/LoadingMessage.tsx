import React from 'react';
import { ThinkingOrb, type OrbState } from 'thinking-orbs';
import { useTranslation } from 'react-i18next';

/**
 * LoadingMessage renders a loading indicator for streaming messages (type=100)
 * Displayed when AI is starting to generate a response
 */
export interface LoadingMessageProps {
  isStaff: boolean; // true for staff (right), false for visitor (left)
}

interface ThinkingPhase {
  state: OrbState;
  labelKey: string;
  fallback: string;
}

// Cycle through orb states so a long wait still feels like progress
const THINKING_PHASES: ThinkingPhase[] = [
  { state: 'working', labelKey: 'chat.messages.thinking.working', fallback: 'Thinking...' },
  { state: 'searching', labelKey: 'chat.messages.thinking.searching', fallback: 'Searching for answers...' },
  { state: 'weaving', labelKey: 'chat.messages.thinking.weaving', fallback: 'Connecting the dots...' },
  { state: 'composing', labelKey: 'chat.messages.thinking.composing', fallback: 'Composing a reply...' },
];

const PHASE_INTERVAL_MS = 2800;

const LoadingMessage: React.FC<LoadingMessageProps> = ({ isStaff }) => {
  const { t } = useTranslation();
  const [phaseIndex, setPhaseIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setPhaseIndex(i => Math.min(i + 1, THINKING_PHASES.length - 1));
    }, PHASE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const phase = THINKING_PHASES[phaseIndex];
  const label = t(phase.labelKey, phase.fallback);

  const bubbleClass = isStaff
    ? 'tgo-bubble-out'
    : 'tgo-bubble-in text-gray-500 dark:text-gray-400';

  return (
    <div
      className={`${bubbleClass} py-2 pl-2 pr-5 overflow-hidden max-w-full`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5">
        <ThinkingOrb
          state={phase.state}
          size={32}
          theme="auto"
          aria-label={t('chat.messages.aiThinking', 'AI is thinking...')}
        />
        <span key={phase.state} className="text-sm animate-thinking-label">
          {label}
        </span>
      </div>
    </div>
  );
};

export default LoadingMessage;
