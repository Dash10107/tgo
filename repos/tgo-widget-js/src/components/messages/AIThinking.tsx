import { useEffect, useState } from 'react'
import styled from '@emotion/styled'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../contexts/ThemeContext'

// Cycle through orb states so a long wait still feels like progress
const THINKING_PHASES: { state: OrbState; labelKey: string }[] = [
  { state: 'working', labelKey: 'messageList.thinking.working' },
  { state: 'searching', labelKey: 'messageList.thinking.searching' },
  { state: 'weaving', labelKey: 'messageList.thinking.weaving' },
  { state: 'composing', labelKey: 'messageList.thinking.composing' },
]

const PHASE_INTERVAL_MS = 2800

const Wrap = styled.span`
  display: inline-flex; align-items: center; gap: 8px; margin: -4px 4px -4px -6px;
`
const Label = styled.span`
  font-size: 13px; color: var(--text-secondary, #6b7280);
  animation: thinking-label-in 0.4s ease-out;
  @keyframes thinking-label-in { from { opacity: 0; transform: translateY(2px) } to { opacity: 1; transform: translateY(0) } }
`

export default function AIThinking() {
  const { t } = useTranslation()
  const { isDark } = useTheme()
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhaseIndex(i => Math.min(i + 1, THINKING_PHASES.length - 1))
    }, PHASE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  const phase = THINKING_PHASES[phaseIndex]

  return (
    <Wrap role="status" aria-live="polite">
      <ThinkingOrb state={phase.state} size={32} theme={isDark ? 'dark' : 'light'} aria-label={t('messageList.thinking.working')} />
      <Label key={phase.state}>{t(phase.labelKey)}</Label>
    </Wrap>
  )
}
