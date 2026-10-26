/**
 * Simple i18n module (en / hi / mr / zh)
 */
var locales = {
  en: {
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading...',
    'common.connecting': 'Connecting...',
    'messageInput.placeholder': 'Ask a question...',
    'messageInput.send': 'Send',
    'messageInput.interrupt': 'Stop',
    'messageList.loadingHistory': 'Loading...',
    'messageList.noMoreMessages': 'No more messages',
    'messageList.sending': 'Sending...',
    'messageList.uploading': 'Uploading...',
    'messageList.uploadingProgress': 'Uploading {percent}%',
    'errors.authFail': 'Authentication failed, cannot send message',
    'errors.networkError': 'Network error or timeout, please check your connection',
    'errors.systemError': 'System error, please try again later',
    'system.staffAssigned': 'You have been connected to customer service. Agent {name0} will assist you.',
    'system.sessionTransferred': 'Session transferred. Agent {name0} has transferred you to Agent {name1}.',
    'system.sessionClosed': 'Session ended. Agent {name0} has completed the service.',
    'system.sessionClosedNoAgent': 'Session ended.',
    'file.placeholder': '[File]',
    'upload.uploadingImage': 'Uploading image…',
    'upload.failed': 'Upload failed',
    'stream.endedAbnormally': 'Stream ended abnormally',
    'stream.unknownError': 'Unknown error',
    'time.justNow': 'Just now',
    'time.minutesAgo': '{count}m ago',
    'time.yesterday': 'Yesterday'
  },
  hi: {
    'common.retry': 'पुनः प्रयास करें',
    'common.cancel': 'रद्द करें',
    'common.loading': 'लोड हो रहा है...',
    'common.connecting': 'कनेक्ट हो रहा है...',
    'messageInput.placeholder': 'कोई प्रश्न पूछें...',
    'messageInput.send': 'भेजें',
    'messageInput.interrupt': 'रोकें',
    'messageList.loadingHistory': 'लोड हो रहा है...',
    'messageList.noMoreMessages': 'और संदेश नहीं हैं',
    'messageList.sending': 'भेजा जा रहा है...',
    'messageList.uploading': 'अपलोड हो रहा है...',
    'messageList.uploadingProgress': 'अपलोड हो रहा है {percent}%',
    'errors.authFail': 'प्रमाणीकरण विफल, संदेश नहीं भेजा जा सकता',
    'errors.networkError': 'नेटवर्क त्रुटि या टाइमआउट, कृपया अपना कनेक्शन जाँचें',
    'errors.systemError': 'सिस्टम त्रुटि, कृपया बाद में पुनः प्रयास करें',
    'system.staffAssigned': 'आपको ग्राहक सेवा से जोड़ दिया गया है। एजेंट {name0} आपकी सहायता करेंगे।',
    'system.sessionTransferred': 'सत्र स्थानांतरित किया गया। एजेंट {name0} ने आपको एजेंट {name1} को स्थानांतरित किया है।',
    'system.sessionClosed': 'सत्र समाप्त। एजेंट {name0} ने सेवा पूर्ण की है।',
    'system.sessionClosedNoAgent': 'सत्र समाप्त।',
    'file.placeholder': '[फ़ाइल]',
    'upload.uploadingImage': 'छवि अपलोड हो रही है…',
    'upload.failed': 'अपलोड विफल',
    'stream.endedAbnormally': 'स्ट्रीम असामान्य रूप से समाप्त हुई',
    'stream.unknownError': 'अज्ञात त्रुटि',
    'time.justNow': 'अभी',
    'time.minutesAgo': '{count} मिनट पहले',
    'time.yesterday': 'कल'
  },
  mr: {
    'common.retry': 'पुन्हा प्रयत्न करा',
    'common.cancel': 'रद्द करा',
    'common.loading': 'लोड होत आहे...',
    'common.connecting': 'कनेक्ट होत आहे...',
    'messageInput.placeholder': 'प्रश्न विचारा...',
    'messageInput.send': 'पाठवा',
    'messageInput.interrupt': 'थांबवा',
    'messageList.loadingHistory': 'लोड होत आहे...',
    'messageList.noMoreMessages': 'आणखी संदेश नाहीत',
    'messageList.sending': 'पाठवत आहे...',
    'messageList.uploading': 'अपलोड होत आहे...',
    'messageList.uploadingProgress': 'अपलोड होत आहे {percent}%',
    'errors.authFail': 'प्रमाणीकरण अयशस्वी, संदेश पाठवता येत नाही',
    'errors.networkError': 'नेटवर्क त्रुटी किंवा टाइमआउट, कृपया तुमचे कनेक्शन तपासा',
    'errors.systemError': 'सिस्टम त्रुटी, कृपया नंतर पुन्हा प्रयत्न करा',
    'system.staffAssigned': 'तुम्हाला ग्राहक सेवेशी जोडले आहे. एजंट {name0} तुम्हाला मदत करतील.',
    'system.sessionTransferred': 'सत्र हस्तांतरित केले. एजंट {name0} यांनी तुम्हाला एजंट {name1} कडे हस्तांतरित केले आहे.',
    'system.sessionClosed': 'सत्र संपले. एजंट {name0} यांनी सेवा पूर्ण केली आहे.',
    'system.sessionClosedNoAgent': 'सत्र संपले.',
    'file.placeholder': '[फाइल]',
    'upload.uploadingImage': 'प्रतिमा अपलोड होत आहे…',
    'upload.failed': 'अपलोड अयशस्वी',
    'stream.endedAbnormally': 'स्ट्रीम असामान्यपणे संपला',
    'stream.unknownError': 'अज्ञात त्रुटी',
    'time.justNow': 'आत्ताच',
    'time.minutesAgo': '{count} मिनिटांपूर्वी',
    'time.yesterday': 'काल'
  },
  zh: {
    'common.retry': '重试',
    'common.cancel': '取消',
    'common.loading': '加载中…',
    'common.connecting': '连接中...',
    'messageInput.placeholder': '提出问题...',
    'messageInput.send': '发送',
    'messageInput.interrupt': '中断',
    'messageList.loadingHistory': '加载中…',
    'messageList.noMoreMessages': '没有更多消息',
    'messageList.sending': '发送中…',
    'messageList.uploading': '上传中…',
    'messageList.uploadingProgress': '上传中 {percent}%',
    'errors.authFail': '认证失败，无法发送消息',
    'errors.networkError': '网络异常或超时，请检查网络后重试',
    'errors.systemError': '系统错误，请稍后重试',
    'system.staffAssigned': '已为您接入人工客服，客服 {name0} 为您服务。',
    'system.sessionTransferred': '会话已转接。客服 {name0} 已将您转接给客服 {name1}。',
    'system.sessionClosed': '会话已结束。客服 {name0} 已完成本次服务。',
    'system.sessionClosedNoAgent': '会话已结束。',
    'file.placeholder': '[文件]',
    'upload.uploadingImage': '图片上传中…',
    'upload.failed': '上传失败',
    'stream.endedAbnormally': '流异常结束',
    'stream.unknownError': '未知错误',
    'time.justNow': '刚才',
    'time.minutesAgo': '{count}分钟前',
    'time.yesterday': '昨天'
  }
}

var SUPPORTED = ['en', 'hi', 'mr', 'zh']
var DEFAULT_LANG = 'en'
var currentLang = DEFAULT_LANG

// Normalize values such as 'hi-IN', 'mr_IN' or 'zh-CN' to a supported base language
function normalizeLang(lang) {
  var base = String(lang || '').toLowerCase().split(/[-_]/)[0]
  return SUPPORTED.indexOf(base) !== -1 ? base : DEFAULT_LANG
}

function setLang(lang) {
  currentLang = normalizeLang(lang)
}

function getLang() {
  return currentLang
}

function t(key, params) {
  var dict = locales[currentLang] || locales[DEFAULT_LANG]
  var str = dict[key] || locales[DEFAULT_LANG][key] || key
  if (params) {
    Object.keys(params).forEach(function (k) {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k])
    })
  }
  return str
}

module.exports = { setLang: setLang, getLang: getLang, t: t }
