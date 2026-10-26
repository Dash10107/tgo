/// Simple localization support for TGO Widget
class TgoLocalizations {
  final String locale;

  const TgoLocalizations({this.locale = 'en'});

  /// Get localized string
  String get(String key) {
    final strings = _stringsFor(locale);
    return strings[key] ?? key;
  }

  /// Resolve the string table for a locale such as 'en', 'hi', 'mr', 'zh' or 'hi-IN'.
  static Map<String, String> _stringsFor(String locale) {
    switch (locale.toLowerCase().split(RegExp(r'[-_]')).first) {
      case 'hi':
        return _hiStrings;
      case 'mr':
        return _mrStrings;
      case 'zh':
        return _zhStrings;
      default:
        return _enStrings;
    }
  }

  static const Map<String, String> _enStrings = {
    'sending': 'Sending...',
    'sent': 'Sent',
    'failed': 'Failed',
    'retry': 'Retry',
    'delete': 'Delete',
    'cancel': 'Cancel',
    'uploading': 'Uploading',
    'upload_failed': 'Upload failed',
    'loading_history': 'Loading history...',
    'load_history_failed': 'Failed to load history',
    'no_more_messages': 'No more messages',
    'type_message': 'Type a message...',
    'send': 'Send',
    'attach': 'Attach',
    'emoji': 'Emoji',
    'interrupt': 'Stop',
    'just_now': 'Just now',
    'yesterday': 'Yesterday',
    'file_too_large': 'File too large (max {size}MB): {name}',
    'connection_error': 'Connection error',
    'auth_failed': 'Authentication failed',
    'network_error': 'Network error',
    'system_error': 'System error',
    'gallery': 'Gallery',
    'camera': 'Camera',
    'files': 'Files',
  };

  static const Map<String, String> _hiStrings = {
    'sending': 'भेजा जा रहा है...',
    'sent': 'भेजा गया',
    'failed': 'विफल',
    'retry': 'पुनः प्रयास करें',
    'delete': 'हटाएँ',
    'cancel': 'रद्द करें',
    'uploading': 'अपलोड हो रहा है',
    'upload_failed': 'अपलोड विफल',
    'loading_history': 'इतिहास लोड हो रहा है...',
    'load_history_failed': 'इतिहास लोड नहीं हो सका',
    'no_more_messages': 'और संदेश नहीं हैं',
    'type_message': 'संदेश लिखें...',
    'send': 'भेजें',
    'attach': 'संलग्न करें',
    'emoji': 'इमोजी',
    'interrupt': 'रोकें',
    'just_now': 'अभी',
    'yesterday': 'कल',
    'file_too_large': 'फ़ाइल बहुत बड़ी है (अधिकतम {size}MB): {name}',
    'connection_error': 'कनेक्शन त्रुटि',
    'auth_failed': 'प्रमाणीकरण विफल',
    'network_error': 'नेटवर्क त्रुटि',
    'system_error': 'सिस्टम त्रुटि',
    'gallery': 'गैलरी',
    'camera': 'कैमरा',
    'files': 'फ़ाइलें',
  };

  static const Map<String, String> _mrStrings = {
    'sending': 'पाठवत आहे...',
    'sent': 'पाठवले',
    'failed': 'अयशस्वी',
    'retry': 'पुन्हा प्रयत्न करा',
    'delete': 'हटवा',
    'cancel': 'रद्द करा',
    'uploading': 'अपलोड होत आहे',
    'upload_failed': 'अपलोड अयशस्वी',
    'loading_history': 'इतिहास लोड होत आहे...',
    'load_history_failed': 'इतिहास लोड करता आला नाही',
    'no_more_messages': 'आणखी संदेश नाहीत',
    'type_message': 'संदेश लिहा...',
    'send': 'पाठवा',
    'attach': 'जोडा',
    'emoji': 'इमोजी',
    'interrupt': 'थांबवा',
    'just_now': 'आत्ताच',
    'yesterday': 'काल',
    'file_too_large': 'फाइल खूप मोठी आहे (कमाल {size}MB): {name}',
    'connection_error': 'कनेक्शन त्रुटी',
    'auth_failed': 'प्रमाणीकरण अयशस्वी',
    'network_error': 'नेटवर्क त्रुटी',
    'system_error': 'सिस्टम त्रुटी',
    'gallery': 'गॅलरी',
    'camera': 'कॅमेरा',
    'files': 'फाइल्स',
  };

  static const Map<String, String> _zhStrings = {
    'sending': '发送中...',
    'sent': '已发送',
    'failed': '发送失败',
    'retry': '重试',
    'delete': '删除',
    'cancel': '取消',
    'uploading': '上传中',
    'upload_failed': '上传失败',
    'loading_history': '加载历史消息...',
    'load_history_failed': '加载历史消息失败',
    'no_more_messages': '没有更多消息',
    'type_message': '输入消息...',
    'send': '发送',
    'attach': '附件',
    'emoji': '表情',
    'interrupt': '停止',
    'just_now': '刚刚',
    'yesterday': '昨天',
    'file_too_large': '文件过大（最大 {size}MB）：{name}',
    'connection_error': '连接错误',
    'auth_failed': '认证失败',
    'network_error': '网络错误',
    'system_error': '系统错误',
    'gallery': '相册',
    'camera': '相机',
    'files': '文件',
  };
}

