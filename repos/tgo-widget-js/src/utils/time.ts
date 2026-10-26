import i18n from '../i18n'

export function formatMessageTime(input: number | Date): string {
  const msgDate = normalizeToDate(input)
  if (!msgDate) return ''

  const now = new Date()
  const diff = now.getTime() - msgDate.getTime()

  // Within 1 minute
  if (diff < 60 * 1000) return i18n.t('time.justNow')

  // Within 1 hour
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return i18n.t('time.minutesAgo', { count: minutes })
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)

  // Today
  if (msgDate >= startOfToday) {
    return fmt(msgDate, 'HH:mm')
  }

  // Yesterday
  if (msgDate >= startOfYesterday) {
    return i18n.t('time.yesterday', { time: fmt(msgDate, 'HH:mm') })
  }

  // Within 7 days (excluding today/yesterday)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (msgDate > sevenDaysAgo) {
    return `${weekdayName(msgDate)} ${fmt(msgDate, 'HH:mm')}`
  }

  // Within this year
  if (msgDate.getFullYear() === now.getFullYear()) {
    return fmt(msgDate, 'MM-DD HH:mm')
  }

  // Across years
  return fmt(msgDate, 'YYYY-MM-DD HH:mm')
}

function normalizeToDate(input: number | Date): Date | null {
  if (input instanceof Date) return input
  if (typeof input === 'number' && isFinite(input)) {
    // Supports seconds or milliseconds
    const ms = input < 1e12 ? input * 1000 : input
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function pad(n: number): string { return n < 10 ? `0${n}` : String(n) }

function fmt(d: Date, pattern: 'HH:mm' | 'MM-DD HH:mm' | 'YYYY-MM-DD HH:mm'): string {
  const Y = d.getFullYear()
  const M = pad(d.getMonth() + 1)
  const D = pad(d.getDate())
  const h = pad(d.getHours())
  const m = pad(d.getMinutes())
  switch (pattern) {
    case 'HH:mm': return `${h}:${m}`
    case 'MM-DD HH:mm': return `${M}-${D} ${h}:${m}`
    case 'YYYY-MM-DD HH:mm':
    default: return `${Y}-${M}-${D} ${h}:${m}`
  }
}

// Localized weekday name (e.g. "Monday", "सोमवार") for the active UI language
function weekdayName(d: Date): string {
  try {
    return new Intl.DateTimeFormat(i18n.language || 'en', { weekday: 'long' }).format(d)
  } catch {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]
  }
}
