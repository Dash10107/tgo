/**
 * Time formatting utilities (ported from widget-app)
 */
var i18n = require('../core/i18n')

function formatMessageTime(input) {
  var msgDate = normalizeToDate(input)
  if (!msgDate) return ''

  var now = new Date()
  var diff = now.getTime() - msgDate.getTime()

  // < 1 minute
  if (diff < 60 * 1000) return i18n.t('time.justNow')

  // < 1 hour
  if (diff < 60 * 60 * 1000) {
    var minutes = Math.floor(diff / (60 * 1000))
    return i18n.t('time.minutesAgo', { count: minutes })
  }

  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  var startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)

  // Today
  if (msgDate >= startOfToday) {
    return fmt(msgDate, 'HH:mm')
  }

  // Yesterday
  if (msgDate >= startOfYesterday) {
    return i18n.t('time.yesterday') + ' ' + fmt(msgDate, 'HH:mm')
  }

  // Within 7 days
  var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (msgDate > sevenDaysAgo) {
    return weekdayName(msgDate) + ' ' + fmt(msgDate, 'HH:mm')
  }

  // Same year
  if (msgDate.getFullYear() === now.getFullYear()) {
    return fmt(msgDate, 'MM-DD HH:mm')
  }

  // Cross year
  return fmt(msgDate, 'YYYY-MM-DD HH:mm')
}

function normalizeToDate(input) {
  if (input instanceof Date) return input
  if (typeof input === 'number' && isFinite(input)) {
    var ms = input < 1e12 ? input * 1000 : input
    var d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function pad(n) { return n < 10 ? '0' + n : String(n) }

function fmt(d, pattern) {
  var Y = d.getFullYear()
  var M = pad(d.getMonth() + 1)
  var D = pad(d.getDate())
  var h = pad(d.getHours())
  var m = pad(d.getMinutes())
  if (pattern === 'HH:mm') return h + ':' + m
  if (pattern === 'MM-DD HH:mm') return M + '-' + D + ' ' + h + ':' + m
  return Y + '-' + M + '-' + D + ' ' + h + ':' + m
}

var WEEKDAYS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
  mr: ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
  zh: ['\u661f\u671f\u65e5', '\u661f\u671f\u4e00', '\u661f\u671f\u4e8c', '\u661f\u671f\u4e09', '\u661f\u671f\u56db', '\u661f\u671f\u4e94', '\u661f\u671f\u516d']
}

function weekdayName(d) {
  var names = WEEKDAYS[i18n.getLang()] || WEEKDAYS.en
  return names[d.getDay()]
}

module.exports = { formatMessageTime: formatMessageTime }
